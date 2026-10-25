# Reverse proxy

Put TLS on the proxy. Leave the security headers to the xt-tools container, and do not add a second Content Security Policy. Browsers enforce every policy they receive, and a header without the build's script hashes blocks the site.

Forward `Host`. Do not strip `Content-Security-Policy` or the other headers the container sends. HSTS belongs here, not in the container.

The container listens on port 8080 and answers `/healthz` with `ok`.

## nginx

```nginx
server {
    listen 443 ssl;
    server_name tools.example.com;

    # ssl_certificate and ssl_certificate_key go here.

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

`proxy_hide_header` and `more_clear_headers` would drop the container's policy. Do not add them for the security headers. `add_header` in this `location` does not remove headers that came from the upstream.

## Traefik

Labels on the `tools` service, with entrypoints and a certificate resolver you already have:

```yaml
services:
  tools:
    labels:
      - traefik.enable=true
      - traefik.http.routers.xt.rule=Host(`tools.example.com`)
      - traefik.http.routers.xt.entrypoints=websecure
      - traefik.http.routers.xt.tls.certresolver=le
      - traefik.http.services.xt.loadbalancer.server.port=8080
      - traefik.http.middlewares.xt-hsts.headers.stsSeconds=31536000
      - traefik.http.middlewares.xt-hsts.headers.stsIncludeSubdomains=true
      - traefik.http.routers.xt.middlewares=xt-hsts
```

Do not set Traefik's `contentSecurityPolicy` header option. That replaces or adds a policy and will not contain this build's hashes.

## Caddy

The repo's overlay (`make up-https`, `deploy/Caddyfile`) is Caddy in front of the container. If you already run Caddy, proxy to the container the same way and do not import a second CSP:

```caddy
tools.example.com {
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        -Server
    }
    reverse_proxy 127.0.0.1:8080
}
```

## A sub-path on an existing site

Build the image with `BASE_PATH=/tools/` and proxy that prefix without stripping it:

```nginx
location /tools/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
}
```

`proxy_pass` without a trailing URI keeps the incoming path. The pages and assets were built for `/tools/`, so the proxy must not rewrite them to `/`.
