# syntax=docker/dockerfile:1.12
#
# xt-tools: privacy-first browser tools, served as static files by unprivileged nginx.
#
#   docker build -t xt-tools .
#   docker build --build-arg BASE_PATH=/tools/ -t xt-tools .
#
# Stages: deps → build → runtime (the default, last). `dev` and `e2e` are
# used by compose.dev.yaml.

ARG NODE_IMAGE=node:26-alpine@sha256:6f08a523443ddedf52941874c203475b0ad503e859ad70cb26ab8be9a517dbd5
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30-alpine@sha256:782bb89768cc87b7f95c18b95baa1af250e5d451f26794f59363540161147c01
ARG PLAYWRIGHT_IMAGE=mcr.microsoft.com/playwright:v1.64.1-noble@sha256:7852dc5a7d72f5fe458a597d690f6c42fbc8e9e26ddfa95f8e6ef552558d9bbf

# ---------------------------------------------------------------------------
# deps: install dependencies once, on the build machine's own platform. The
# output is static files, so it never needs to be built per target arch.
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS deps
ENV ASTRO_TELEMETRY_DISABLED=1 \
    npm_config_fund=false \
    npm_config_update_notifier=false
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY scripts/setup-hooks.ts scripts/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit

# ---------------------------------------------------------------------------
# build: validate, test and build. A broken tool can never produce an image.
FROM deps AS build
ARG BASE_PATH=/
ARG SITE_URL=
ARG VERSION=dev
# Only the CI scaffolding-loop test image sets this to 0: it deliberately
# contains freshly scaffolded tools that still have XT-TODO placeholders.
# Every production build stays strict (CI and the Docker build both run it).
ARG XT_VALIDATE_STRICT=1
ENV BASE_PATH=${BASE_PATH} SITE_URL=${SITE_URL} VERSION=${VERSION}
COPY . .
RUN npm run validate-tools $( [ "$XT_VALIDATE_STRICT" = "1" ] && echo --strict ) \
 && npm run check-licenses \
 && npm test \
 && npm run build \
 && mkdir -p "/out/html${BASE_PATH}" \
 && cp -R dist/. "/out/html${BASE_PATH}" \
 && cp dist/404.html /out/html/404.html \
 && mkdir -p /out/snippets \
 && cp build/server/csp.conf build/server/base.conf /out/snippets/

# ---------------------------------------------------------------------------
# dev: hot-reload dev server used by compose.dev.yaml. The source is
# bind-mounted; node_modules lives in a named volume owned by UID:GID.
FROM ${NODE_IMAGE} AS dev
ARG UID=1000
ARG GID=1000
ENV ASTRO_TELEMETRY_DISABLED=1 \
    npm_config_fund=false \
    npm_config_update_notifier=false \
    HOME=/tmp \
    WATCH_POLL=1
WORKDIR /app
RUN mkdir -p /app/node_modules && chown -R "${UID}:${GID}" /app
COPY deploy/dev-entrypoint.sh /usr/local/bin/dev-entrypoint
USER ${UID}:${GID}
EXPOSE 4321
ENTRYPOINT ["/usr/local/bin/dev-entrypoint"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------------------------------------------------------------------------
# e2e: Playwright runner. Dependencies are installed at build time, so the
# container can run on a network with no internet access.
FROM ${PLAYWRIGHT_IMAGE} AS e2e
ENV CI=1 \
    npm_config_engine_strict=false \
    npm_config_fund=false \
    npm_config_update_notifier=false \
    ASTRO_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY scripts/setup-hooks.ts scripts/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --ignore-scripts
COPY playwright.config.ts tsconfig.json ./
COPY src/ src/
COPY tests/ tests/
CMD ["npx", "playwright", "test"]

# ---------------------------------------------------------------------------
# runtime is last so `docker build .` produces it by default.
# runtime: unprivileged nginx, no build tools. Listens on 8080 as UID 101.
FROM ${NGINX_IMAGE} AS runtime
ARG VERSION=dev
ARG REVISION=unknown
ARG CREATED=unknown
LABEL org.opencontainers.image.title="xt-tools" \
      org.opencontainers.image.description="Privacy-first developer and everyday tools that run entirely in your browser." \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}" \
      org.opencontainers.image.source="https://github.com/xeptor6569/xt-tools" \
      org.opencontainers.image.url="https://github.com/xeptor6569/xt-tools" \
      org.opencontainers.image.licenses="MIT"

USER root
# Pick up Alpine security fixes released since the base image was built
# (the weekly rebuild keeps this current).
RUN apk upgrade --no-cache \
 && rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/*
COPY --chown=root:root deploy/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --chown=root:root deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --chown=root:root deploy/nginx/security-headers.conf deploy/nginx/mime-extra.conf /etc/nginx/snippets/
COPY --from=build --chown=root:root /out/snippets/ /etc/nginx/snippets/
COPY --from=build --chown=root:root /out/html/ /usr/share/nginx/html/
RUN nginx -t
USER 101

ENV NGINX_ENTRYPOINT_QUIET_LOGS=1
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=1s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
