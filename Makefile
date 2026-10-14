# xt-tools shortcuts. Everything works with only Docker installed.
# Run `make` or `make help` for the list.

UID := $(shell id -u)
GID := $(shell id -g)
export UID GID
export ASTRO_TELEMETRY_DISABLED := 1

-include .env
export

IMAGE      ?= xt-tools:local
BASE_PATH  ?= /
SITE_URL   ?=
VERSION    ?= dev
ARGS       ?=

DEV     := docker compose -f compose.dev.yaml
PROD    := docker compose -f compose.yaml
RUN_DEV := $(DEV) run --rm --service-ports=false dev

.DEFAULT_GOAL := help
.PHONY: help new-tool remove-tool list-tools dev shell validate lint test-unit test-e2e test \
        build smoke up down logs export import clean

help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

## ---- Develop --------------------------------------------------------------

new-tool: ## Scaffold a tool (interactive, or ARGS="my-tool --name 'My tool' --category text ...")
	$(RUN_DEV) npm run new-tool -- $(ARGS)

remove-tool: ## Remove a tool: ARGS="my-tool --yes"
	$(RUN_DEV) npm run remove-tool -- $(ARGS)

list-tools: ## List tools by category
	$(RUN_DEV) npm run list-tools -- $(ARGS)

dev: ## Dev server with hot reload on http://localhost:4321
	$(DEV) up dev

shell: ## Shell in the dev container
	$(RUN_DEV) sh

## ---- Test -----------------------------------------------------------------

validate: ## Check every tool against the contract
	$(RUN_DEV) npm run validate-tools -- --strict

lint: ## Typecheck and lint
	$(RUN_DEV) sh -c 'npm run check && npm run lint'

test-unit: ## Unit tests
	$(RUN_DEV) npm test

test-e2e: ## Build the image and run Playwright against it with no internet access
	$(DEV) --profile test build site e2e
	$(DEV) --profile test run --rm e2e; status=$$?; $(DEV) --profile test down; exit $$status

test: validate test-unit test-e2e ## Validator, unit and end-to-end tests

## ---- Build and run --------------------------------------------------------

build: ## Build the production image (xt-tools:local)
	docker build -t $(IMAGE) \
	  --build-arg BASE_PATH=$(BASE_PATH) --build-arg SITE_URL=$(SITE_URL) --build-arg VERSION=$(VERSION) \
	  --build-arg REVISION=$$(git rev-parse --short HEAD 2>/dev/null || echo unknown) \
	  --build-arg CREATED=$$(date -u +%Y-%m-%dT%H:%M:%SZ) .

smoke: ## Smoke-test the image like production (needs Node 26 on the host; CI runs this too)
	node scripts/smoke-test.ts --image $(IMAGE) --base $(BASE_PATH)

up: ## Run the site over HTTP (your local build, or the published XT_TAG from .env)
ifeq ($(strip $(XT_TAG)),)
	@docker image inspect $(IMAGE) >/dev/null 2>&1 || $(MAKE) build
	docker tag $(IMAGE) ghcr.io/xeptor6569/xt-tools:local
	XT_TAG=local $(PROD) up -d --no-build
else
	$(PROD) up -d
endif
	@echo "xt-tools is running on http://localhost:$(or $(XT_PORT),8080)$(BASE_PATH)"

down: ## Stop the site
	$(PROD) down

logs: ## Follow the site logs
	$(PROD) logs -f

## ---- Air-gapped installs --------------------------------------------------

export: ## Save the image to xt-tools.tar.gz
	docker save $(IMAGE) | gzip > xt-tools.tar.gz
	@echo "Wrote xt-tools.tar.gz. Copy it to the offline machine and run: make import up"

import: ## Load the image from xt-tools.tar.gz
	gunzip -c xt-tools.tar.gz | docker load

clean: ## Remove build output and test reports
	rm -rf dist build .astro test-results playwright-report coverage
