# xt-tools build plan

> Your toolbox, your server, no internet required.

This document is the build brief for **xt-tools**: a self-hostable static website of privacy-first browser utilities. It replaces the original OpenCode prompt. Where the two disagree, this document wins.

Every tool runs entirely client-side. Nothing the user enters ever leaves their device. The site must work fully offline after first load, deploy with one Docker command, and let contributors add a new tool with a single terminal command.

Work through the phases in [section 20](#20-phases) in order. Finish and verify each phase before starting the next. If something isn't covered here, pick the simpler, smaller, more private option and record it in the [progress log](#22-progress-log).

---

## Contents

1. [Decisions](#1-decisions)
2. [Core principles](#2-core-principles)
3. [Tech stack and pinned versions](#3-tech-stack-and-pinned-versions)
4. [Architecture](#4-architecture)
5. [Tool contract](#5-tool-contract)
6. [Scripts: scaffolder, validator and build helpers](#6-scripts-scaffolder-validator-and-build-helpers)
7. [Shared UI kit](#7-shared-ui-kit)
8. [Site features](#8-site-features)
9. [Privacy and security model](#9-privacy-and-security-model)
10. [Offline and PWA](#10-offline-and-pwa)
11. [Performance budgets](#11-performance-budgets)
12. [Accessibility](#12-accessibility)
13. [Testing strategy](#13-testing-strategy)
14. [Docker and deployment](#14-docker-and-deployment)
15. [CI/CD](#15-cicd)
16. [Dependency policy and licensing](#16-dependency-policy-and-licensing)
17. [Repository hygiene](#17-repository-hygiene)
18. [Documentation deliverables](#18-documentation-deliverables)
19. [Tool catalog](#19-tool-catalog)
20. [Phases](#20-phases)
21. [How to work](#21-how-to-work)
22. [Progress log](#22-progress-log)

---

## 1. Decisions

| #   | Topic                       | Choice                                                                                                                                                                                  | Source        |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| D1  | Project name                | `xt-tools` for the package, the image `ghcr.io/xeptor6569/xt-tools` and the archive `xt-tools.tar.gz`                                                                                   | User          |
| D2  | License                     | MIT. All code written from scratch, nothing copied from GPL projects such as IT-Tools.                                                                                                  | User          |
| D3  | Styling                     | Tailwind CSS v4. Design tokens live in `@theme`. No Stylelint.                                                                                                                          | User          |
| D4  | Crypto approach             | Noble-first: audited pure-JS `@noble/*` and `@scure/*`, which work over plain HTTP. WebCrypto only where nothing else fits (RSA key generation, CSR signing, PKCS#7 checks).            | User          |
| D5  | Legacy ciphers              | TripleDES, Rabbit and RC4 are **decrypt-only**, loaded only when used, and clearly labeled. AES-GCM is the only encryption option.                                                      | User          |
| D6  | Overlapping catalog entries | Merge them: one tool per job, with old names kept as search keywords. See [19.1](#191-merges).                                                                                          | User          |
| D7  | Node version                | Node 26 (becomes LTS on 2026-10-28, supported until 2029-04).                                                                                                                           | User          |
| D8  | PWA tooling                 | `workbox-build` runs after `astro build`. `@vite-pwa/astro` is not used because it only supports Astro ≤5.                                                                              | Agent default |
| D9  | TypeScript                  | Pin TypeScript 6.0.x. TypeScript 7 is blocked by typescript-eslint (<6.1) and `@astrojs/check` (^5 or ^6).                                                                              | Agent default |
| D10 | Preact                      | Pin Preact 10.x. Preact 11 is blocked by `@astrojs/preact` (peer `^10.6.5`).                                                                                                            | Agent default |
| D11 | CSP delivery                | One policy, generated at build time. Astro emits it as a `<meta>` tag and a script writes the same policy plus `frame-ancestors` as an nginx header. CI checks they match.              | Agent default |
| D12 | Shareable state             | Stored in the URL fragment (`#`), never the query string, and written only when the user clicks "Copy share link". Turned off for `sensitive` tools.                                    | Agent default |
| D13 | Image tags                  | `latest` means the newest release tag. Pushes to `main` publish `edge` and `sha-<short>`. This changes the spec: self-hosters who track `latest` should get releases, not every commit. | Agent default |
| D14 | Dependency bot              | Renovate, chosen because it can pin image digests and keep the Playwright package and image versions in sync. Dependabot is the fallback if the Renovate app can't be installed.        | Agent default |
| D15 | Browser support             | Last 2 versions of Chrome, Edge and Firefox, plus Safari 17+.                                                                                                                           | Agent default |
| D16 | i18n                        | English only for v1. Text is still kept out of logic files so translation can be added later.                                                                                           | Agent default |
| D17 | Scripts runtime             | Repo scripts are `.ts` files run directly by Node 26's built-in type stripping, with Node built-ins only.                                                                               | Agent default |
| D18 | URL format                  | `trailingSlash: 'always'` and `build.format: 'directory'`, so tool pages live at `<base>tools/<id>/`.                                                                                   | Agent default |

The user must approve any change to D1–D7. Agent defaults can be revisited, but record the change in the progress log.

---

## 2. Core principles

1. **Nothing leaves the device unless a tool says so.** No analytics, CDNs, remote fonts or telemetry. A tool may contact a named HTTPS service only when it sets `network.hosts`, the user runs it, and every host is on the allowlist in `src/lib/network-allow.ts`. Lookups are not sent on page load, carry no cookies, and do not follow redirects. Six layers still enforce this ([section 9.2](#92-enforcement-layers)): lint rules, the validator, a scan of `dist/`, a strict CSP, end-to-end tests that block external requests, and end-to-end tests run on a Docker network with no internet access.
2. **One folder per tool.** Each tool is self-contained and registers itself automatically. There is no central list to edit by hand.
3. **Static output only.** The build produces plain files that any web server can host: nginx, Apache, Caddy, shared hosting or a NAS.
4. **Ship little JavaScript.** Each tool page loads only its own code. Heavy tools lazy-load WASM or large datasets only when used.
5. **Adding a tool takes one command.** Scaffold, implement, test, validate, deploy.
6. **Be honest about secure contexts.** Browsers turn off service workers, `crypto.subtle`, the Clipboard API, camera and screen capture on plain HTTP outside `localhost`. The site must degrade gracefully on HTTP and tell the user what HTTPS would unlock ([section 9.4](#94-secure-context-matrix)).
7. **Untrusted input stays contained.** Rendered HTML, Markdown, SVG and email previews never run in the main document ([section 9.5](#95-untrusted-content)).

---

## 3. Tech stack and pinned versions

Versions were current on 2026-10-14. Pin exact versions (`save-exact=true`) and let Renovate bump them.

| Area             | Choice                                                                                            | Version / note                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Runtime          | Node                                                                                              | 26.x. Set `.nvmrc` to `26` and `engines.node` to `>=26`. Use `node:26-alpine` pinned by digest. |
| Site generator   | Astro (multi-page, static output)                                                                 | 7.3.x                                                                                           |
| UI islands       | Preact via `@astrojs/preact` (with `compat` enabled)                                              | Preact 10.x, `@astrojs/preact` 6.0.x                                                            |
| Language         | TypeScript, strict, with `erasableSyntaxOnly` and `verbatimModuleSyntax`                          | 6.0.x (see D9)                                                                                  |
| Styling          | Tailwind CSS via `@tailwindcss/vite`                                                              | 4.3.x                                                                                           |
| Search           | Fuse.js, loaded lazily, over an index built at build time                                         | 7.5.x                                                                                           |
| Heavy work       | Web Workers and WASM                                                                              | —                                                                                               |
| PWA              | `workbox-build` (`generateSW` over `dist/`), `workbox-window`, handwritten `manifest.webmanifest` | 7.4.x                                                                                           |
| Unit tests       | Vitest, using Astro's `getViteConfig()`                                                           | 5.0.x                                                                                           |
| End-to-end tests | `@playwright/test` and `@axe-core/playwright`                                                     | 1.64.1, with image `mcr.microsoft.com/playwright:v1.64.1-noble`                                 |
| Lint             | ESLint flat config, `typescript-eslint`, `eslint-plugin-astro`, `eslint-plugin-jsx-a11y-x`        | ESLint 10.x. The original `jsx-a11y` doesn't support ESLint 10.                                 |
| Format           | Prettier, `prettier-plugin-astro`, `prettier-plugin-tailwindcss`                                  | 3.9.x                                                                                           |
| Performance      | `@lhci/cli` with filesystem upload only                                                           | 0.15.x                                                                                          |
| Runtime image    | `nginxinc/nginx-unprivileged` stable Alpine (1.30.x at time of writing)                           | Pinned by digest                                                                                |
| HTTPS overlay    | `caddy:2-alpine`                                                                                  | Pinned by digest                                                                                |
| Pre-commit       | Plain shell hook in `.githooks/`, turned on with `core.hooksPath`                                 | No husky or lint-staged                                                                         |

**Telemetry and build-time privacy:**

- Set `ASTRO_TELEMETRY_DISABLED=1` in the Dockerfile, CI, the dev compose file and the Makefile.
- Set these in `.npmrc`: `fund=false`, `update-notifier=false`, `audit=false` (CI runs `npm audit` explicitly instead), `engine-strict=true`, `save-exact=true`.
- Configure Lighthouse CI with `upload.target: filesystem`.

---

## 4. Architecture

### 4.1 Repository layout

```
.
├── .githooks/pre-commit
├── .github/workflows/{ci.yml,release.yml,scheduled.yml}
├── .nvmrc  .npmrc  .dockerignore  .env.example  renovate.json  LICENSE
├── astro.config.ts  tsconfig.json  eslint.config.js  prettier.config.js
├── vitest.config.ts  playwright.config.ts  lighthouserc.json
├── Dockerfile  compose.yaml  compose.https.yaml  compose.dev.yaml  Makefile
├── deploy/
│   ├── nginx/{nginx.conf,default.conf,security-headers.conf,mime-extra.conf}
│   ├── Caddyfile
│   └── static-hosts/{apache.htaccess.example,Caddyfile.static.example}
├── docs/{deployment.md,reverse-proxy.md,air-gap.md,datasets.md,threat-model.md}
├── public/
│   ├── data/            # hand-curated datasets, versioned file names (committed)
│   ├── icons/           # PWA icons
│   └── manifest.webmanifest
├── scripts/
│   ├── lib/             # shared helpers for scripts (Node built-ins only)
│   ├── templates/{two-pane,text-transform,file-processor,generator,diff,reference-table}/
│   ├── new-tool.ts  validate-tools.ts  list-tools.ts  remove-tool.ts  batch-tools.ts
│   ├── postbuild.ts     # runs gen-sw, gen-csp, scan-dist, check-budget, precompress
│   ├── gen-sw.ts  gen-csp.ts  scan-dist.ts  check-budget.ts  precompress.ts
│   ├── check-licenses.ts  setup-hooks.ts  refresh-data.ts
├── src/
│   ├── categories.ts                 # single source of truth for categories
│   ├── capabilities.ts               # capability IDs and their browser checks
│   ├── tools/
│   │   ├── types.ts                  # ToolMeta, Capability, ToolInputError
│   │   ├── registry.ts               # import.meta.glob discovery and helpers
│   │   └── <id>/{meta.ts,logic.ts,logic.test.ts,ui.tsx,worker.ts?}
│   ├── pages/
│   │   ├── index.astro  404.astro  settings.astro  licenses.astro
│   │   ├── category/[id].astro
│   │   ├── search-index.json.ts      # static JSON endpoint
│   │   └── tools/<id>.astro          # thin, generated, one per tool
│   ├── layouts/{BaseLayout.astro,ToolLayout.astro}
│   ├── components/
│   │   ├── site/                     # header, search dialog, tool card, theme switch …
│   │   └── ui/                       # shared UI kit (section 7)
│   ├── lib/{href,storage,clipboard,download,load-local-asset,url-state,worker-rpc,capabilities}.ts
│   └── styles/global.css             # Tailwind import and @theme tokens
└── tests/
    ├── helpers/expect-robust.ts
    ├── e2e/{tools.spec.ts,site.spec.ts,offline.spec.ts,links.spec.ts}
    └── fixtures/                     # PEMs, signed PDFs, archives, images …
```

### 4.2 Registry

- `src/tools/registry.ts` uses `import.meta.glob('./*/meta.ts', { eager: true, import: 'default' })`.
- It exposes `allTools()` (sorted by name), `getTool(id)`, `toolsByCategory()` and `newTools(now)`.
- The registry only works under Vite. Node scripts and Playwright load `meta.ts` files directly; this works because `meta.ts` uses only erasable TypeScript and type-only imports ([5.2](#52-file-rules)).

### 4.3 Pages

- `src/pages/tools/<id>.astro` is a thin generated page. One page per tool is required because Astro must import hydrated components statically. This also gives each page its own code bundle.
- The page imports `meta` and `ui`, wraps them in `ToolLayout`, and hydrates the UI with `client:load`. Heavy tools may use `client:visible`.
- `src/pages/category/[id].astro` builds category pages with `getStaticPaths()` from `categories.ts`.
- `src/pages/search-index.json.ts` emits `{ id, name, description, category, categoryLabel, groupLabel?, keywords, tags, added }[]` at build time.

### 4.4 Layouts

- `BaseLayout.astro`:
  - Contains `<html lang="en">`, the meta tags, the theme bootstrap script, the skip link, the header with search, and the footer showing version and the licenses link.
  - Contains no inline `style` attributes.
- `ToolLayout.astro`:
  - Renders the title, description and breadcrumbs (Home › Category › Tool).
  - Reads the tool's metadata to show the `CapabilityNotice` (from `requires`), the `LegacyWarning` (from `legacy`), the "Sensitive: nothing is stored or shared" note (from `sensitive`), and the `<h1>` that must equal `meta.name`.

### 4.5 Base path and URLs

- `BASE_PATH` (default `/`, must start and end with `/`) is passed to Astro's `base`. `SITE_URL` (optional) is passed to `site`. Canonical and OG URLs are only emitted when `SITE_URL` is set.
- Internal links must go through `href(path)` in `src/lib/href.ts`. A lint rule bans `href="/..."` literals in `.astro` and `.tsx` files.
- Tool pages live at `<base>tools/<id>/` (D18). Under `BASE_PATH=/tools/`, that becomes `/tools/tools/<id>/`. This is accepted.
- CI builds and smoke-tests both `/` and `/tools/` from Phase 0 onwards.

### 4.6 Local storage

- All keys go through `src/lib/storage.ts` and are namespaced as `xt:<BASE_PATH>:<key>`, so two instances on one domain don't collide.
- Stored keys:
  - `favorites` (pins: tools, categories, curated groups and personal collections)
  - `collections` (personal collections and one level of sub-collections)
  - `recent` (maximum 12)
  - `theme`
  - `tool:<id>:state`, only for non-sensitive tools where the user has turned persistence on
- Settings offer **Clear all local data**, which removes localStorage keys, Cache Storage, IndexedDB and the service worker registration.

---

## 5. Tool contract

### 5.1 `ToolMeta`

```ts
// src/tools/types.ts (illustrative; the implementation is the source of truth after Phase 1)
import type { CategoryId } from "../categories.ts";
import type { Capability } from "../capabilities.ts";

export interface ToolExample {
  input: string; // typed into the primary input
  expect: string; // substring that must appear in the primary output
}

export interface ToolMeta {
  id: string; // kebab-case, 2–40 chars, equals folder name
  name: string; // display name, 2–40 chars
  description: string; // one sentence, 20–160 chars; used on cards and in <meta>
  category: CategoryId; // must exist in categories.ts
  group?: string; // curated sub-collection; required when that category defines groups
  keywords: string[]; // ≥1, lowercase; old names of merged tools go here
  tags: string[]; // 1–4 public labels, lowercase; shown on the card and matched by search
  added: string; // ISO date YYYY-MM-DD; drives the "New" badge
  sensitive?: boolean; // handles secrets: no URL state, no persistence by default, private inputs
  requires?: Capability[]; // e.g. ['camera'], ['display-capture'], ['webcrypto']
  heavy?: boolean; // lazy-loads WASM or large data and shows a loading state
  legacy?: string; // tool-level warning text (per-algorithm warnings live in the UI, 5.3)
  network?: { hosts: string[] }; // allowlisted HTTPS origins, contacted only after the user runs the tool
  examples?: ToolExample[]; // drive the e2e example test and the "Try an example" button
}
```

- **Capabilities** (`src/capabilities.ts`): `secure-context`, `webcrypto`, `clipboard-read`, `camera`, `microphone`, `display-capture`, `local-fonts`, `speech-synthesis`, `service-worker`.
  - Each capability has a browser check, for example `() => isSecureContext && !!navigator.mediaDevices?.getUserMedia`.
  - `CapabilityNotice` lists what is missing and why, for example "Needs HTTPS or localhost" or "Not supported by this browser".
- **Categories** (`src/categories.ts`) are a `const` array of `{ id, label, icon }`:

  | ID             | Label            |
  | -------------- | ---------------- |
  | `crypto`       | Crypto           |
  | `converter`    | Converter        |
  | `web`          | Web              |
  | `images-media` | Images and media |
  | `development`  | Development      |
  | `network`      | Network          |
  | `math`         | Math             |
  | `measurement`  | Measurement      |
  | `text`         | Text             |
  | `data`         | Data             |
  | `privacy`      | Privacy          |
  | `documents`    | Documents        |
  | `design`       | Design           |

  Icons are inline SVGs copied from Lucide (ISC license, credited on the licenses page). There is no icon dependency.

### 5.2 File rules

| File            | Rules                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta.ts`       | `import type` only, then `const meta: ToolMeta = { … }; export default meta;` (an annotation, not `satisfies`, so optional fields such as `examples` stay visible to the UI). No runtime imports, so Node can load it without Vite. |
| `logic.ts`      | Pure functions. No DOM, no framework, no `window`, `document`, `navigator` or `localStorage` (enforced by lint). User mistakes throw `ToolInputError(message)`; any other exception is a bug. |
| `logic.test.ts` | Known test vectors where they exist, plus `expectRobust()` ([13.1](#131-unit-tests)).                                                                                                         |
| `ui.tsx`        | Preact component built from the shared UI kit. Logic that may take more than ~50 ms on large input runs in `worker.ts` through `useWorker`.                                                   |
| `worker.ts`     | Optional. Uses `src/lib/worker-rpc.ts`. Created with `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`.                                                               |

### 5.3 Per-algorithm legacy labels

- Tools that offer several algorithms use `AlgorithmSelect`. Each option has the shape `{ value, label, legacy?: string }`.
- Choosing a legacy option shows the `LegacyWarning` inline.
- Secure algorithms are always the default.
- The tool-level `legacy` field is only for tools that are entirely legacy.

### 5.4 Granularity rule

One page per distinct job a user would search for. Variants of the same job (formats, algorithms, directions) are options within one page. Old names become keywords.

### 5.5 Contract freeze

The contract is frozen at the end of Phase 1. After that, any change needs user approval and a migration of all existing tools in the same PR.

---

## 6. Scripts: scaffolder, validator and build helpers

All scripts use Node built-ins only and run as `node scripts/<name>.ts` (D17).

### 6.1 `npm run new-tool`

```
npm run new-tool -- [id] --name "My Tool" --category text --group transform --description "…" \
  --keywords "a,b,c" [--requires camera,microphone] [--sensitive] [--heavy] \
  [--worker] [--template two-pane|text-transform|file-processor|generator|diff|reference-table] [--yes]
```

- **Interactive mode** prompts for anything missing, using `node:readline/promises`.
- **Non-interactive mode** (`--yes`, for CI) accepts defaults and never prompts. It fails with a clear message if a required value is missing.
- The `id` defaults to the slugified `--name`.
- **Behavior:**
  1. Validate the ID format, refuse duplicates (folder or page), and reject unknown categories, capabilities and templates. Every error message lists the valid values.
  2. Create `src/tools/<id>/` from the chosen template (default `two-pane`):
     - `meta.ts`, with `added` set to today
     - `logic.ts`, with a placeholder pure function
     - `logic.test.ts`, with one passing test, `expectRobust()`, and `it.todo` items for test vectors and empty input
     - `ui.tsx`, a two-pane input/output layout with inline error display and a copy button
     - `worker.ts` if `--worker` is set
  3. Create the thin page `src/pages/tools/<id>.astro`.
  4. Never overwrite an existing file. If any target exists, abort before writing anything.
  5. Every placeholder contains the marker `XT-TODO`. The validator warns about these locally and fails on them in CI.
  6. Print each created file and the next steps:
     - implement the logic
     - run `npx vitest src/tools/<id>`
     - open `http://localhost:4321<base>tools/<id>/`
     - run `npm run validate-tools`
- A newly scaffolded tool appears on the home page, in search, on its category page and in the end-to-end suite with no other edits.

### 6.2 `npm run validate-tools`

This runs in pre-commit, CI and the Docker build. It lists every problem it finds and exits non-zero if there are any. For every tool folder it checks that:

- `meta.ts`, `logic.ts`, `logic.test.ts` and `ui.tsx` exist, and `src/pages/tools/<id>.astro` exists.
- The page imports `../../tools/<id>/ui` and `../../tools/<id>/meta`, uses `ToolLayout`, and has a `client:` directive.
- There are no orphan pages without a tool folder, and no tool folders without a page.
- The metadata passes the schema in [5.1](#51-toolmeta):
  - the ID equals the folder name, and IDs are unique
  - the description is 20–160 characters and a single sentence
  - the category and capabilities are valid
  - `added` is a valid date and not in the future
  - keywords are lowercase and unique
  - tags are 1–4 lowercase labels of letters, digits and hyphens
  - examples have the correct shape
- `logic.ts` does not import `preact`, `.tsx` files or anything under `components/`.
- Sensitive tools do not import `useShareableState`.
- No `XT-TODO` markers remain. This is a warning by default and an error with `--strict`, which CI and the Docker build use.

The network check is no longer a regex in the validator: it would flag tools whose _output_ contains `fetch('https://…')`, such as the cURL converter or the CSP builder. Network APIs are enforced by lint and by `scan-dist` instead ([9.2](#92-enforcement-layers)).

### 6.3 Other scripts

| Script                    | Purpose                                                                                                                                                                                                                                                                                                                                                                         | Phase                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `list-tools`              | Prints the registry grouped by category, with counts. `--json` for machine use.                                                                                                                                                                                                                                                                                                 | 0                               |
| `remove-tool <id>`        | Deletes the tool folder and its page together, after confirmation (`--yes` skips it).                                                                                                                                                                                                                                                                                           | 0                               |
| `batch-tools <spec.json>` | Creates many tools from a JSON array of `new-tool` options (`catalog/*.json`). Validates everything first, so nothing is written if any entry is invalid. `--skip-existing`, `--only a,b` and `--dry-run` help work through a batch.                                                                                                                                                                                                                                          | 2 (first task)                  |
| `postbuild`               | Runs `gen-sw`, `gen-csp`, `scan-dist`, `check-budget` and `precompress`, in that order.                                                                                                                                                                                                                                                                                         | 0, with `gen-sw` added in 3     |
| `gen-sw`                  | `workbox-build` `generateSW` over `dist/` ([section 10](#10-offline-and-pwa)).                                                                                                                                                                                                                                                                                                  | 3                               |
| `gen-csp`                 | Checks every `dist/**/*.html` has the CSP `<meta>` as the first `<head>` child. Merges the script and style hashes from all pages. Writes `build/server/csp.conf` (nginx), `build/server/base.conf` (redirect from `/` to the base path when it isn't `/`), and the Apache and Caddy snippets used in the release zip.                                                          | 0                               |
| `scan-dist`               | Fails if `dist/` HTML or CSS references any external resource: `src`, `href` on `link`, `url()`, `@import`. Fails if any JS constructs a load from an absolute URL: `import("http…")`, `importScripts`, `new Worker`, `fetch`, `WebSocket`, `EventSource`. Other absolute URLs (`xmlns`, library comments) are reported against an allowlist in `scripts/scan-dist.allow.json`. | 0                               |
| `check-budget`            | Static per-page JavaScript budget ([section 11](#11-performance-budgets)).                                                                                                                                                                                                                                                                                                      | 1                               |
| `precompress`             | Writes `.gz` and `.br` copies (`node:zlib`) of html, js, mjs, css, svg, json, wasm, webmanifest, xml and txt files over 1 KB.                                                                                                                                                                                                                                                   | 0                               |
| `check-licenses`          | Reads `package-lock.json` (lockfile v3 includes licenses) and checks production dependencies against the allowlist ([16.2](#162-licenses)). Also generates the data for `/licenses/`.                                                                                                                                                                                           | 0                               |
| `setup-hooks`             | Runs from `prepare`. Sets `core.hooksPath=.githooks` when a `.git` directory exists, and does nothing otherwise (Docker, tarballs).                                                                                                                                                                                                                                             | 0                               |
| `refresh-data <dataset>`  | Developer-only download of a hand-curated dataset, such as the IEEE OUI list or the EFF wordlist. Writes a versioned file and records the source, date, license and SHA-256 in `docs/datasets.md`. Never runs during the build.                                                                                                                                                 | When the first dataset is added |

### 6.4 npm scripts

```
dev            astro dev
build          astro build && node scripts/postbuild.ts
preview        astro preview
check          astro check
lint           eslint . && prettier --check .
format         prettier --write .
test           vitest run
test:e2e       playwright test
validate-tools node scripts/validate-tools.ts
new-tool | remove-tool | list-tools | batch-tools | check-licenses
prepare        node scripts/setup-hooks.ts
```

The pre-commit hook runs ESLint and Prettier on staged files, then `validate-tools`.

---

## 7. Shared UI kit

Build this in Phase 1, before the pilot tools. Components live in `src/components/ui/`, with helpers in `src/lib/`.

| Group       | Pieces                                                                 | Notes                                                                                                                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs      | `TextArea`, `Input`, `Select`, `Toggle`, `Tabs`, `AlgorithmSelect`     | Defaults: `spellcheck={false}`, `autocomplete="off"`, `autocapitalize="off"`, `translate="no"`. Every input is labeled.                                                                                                                                         |
| Actions     | `CopyButton`, `DownloadButton`, `FileDropZone`                         | Copy uses `navigator.clipboard.writeText`, falling back to `execCommand('copy')` outside a secure context. Download builds a Blob and an object URL, then revokes it. The drop zone supports multiple files, an `accept` filter, a size limit and keyboard use. |
| Results     | `OutputRegion`, `ResultTable`, `KeyValueList`                          | `OutputRegion` is an `aria-live="polite"` region. Tables are sortable and copyable.                                                                                                                                                                             |
| Notices     | `CapabilityNotice`, `LegacyWarning`, `ErrorMessage`, `LoadingState`    | The capability notice appears automatically from `meta.requires`. Errors appear inline and are announced.                                                                                                                                                       |
| Containment | `SandboxedPreview`                                                     | `<iframe sandbox srcdoc>` (no `allow-scripts`, no `allow-same-origin`), with content sanitized by DOMPurify first. The iframe inherits the page CSP, so remote images and tracking pixels are blocked and shown as placeholders.                                |
| Layout      | `ToolShell`, `TwoPane`, `ExampleButton`                                | Built mobile-first and usable at 360 px width.                                                                                                                                                                                                                  |
| Hooks       | `useWorker`, `usePersistentState`, `useShareableState`, `useDebounced` | Details below.                                                                                                                                                                                                                                                  |

**Hook details:**

- **`useWorker`:**
  - Wraps RPC to the tool's worker.
  - Supports cancellation and a timeout: when the timeout passes, the worker is terminated and recreated. This protects against ReDoS in the regex tools, runaway expressions in `math-evaluator` and slow jq queries.
- **`usePersistentState`:**
  - Off by default.
  - The user turns it on per tool.
  - Never available for `sensitive` tools.
- **`useShareableState`:**
  - Serializes state to `#s=<base64url(deflate-raw(json))>` using the native `CompressionStream`.
  - Only writes when the user clicks "Copy share link".
  - Not available for sensitive tools (enforced by the validator).

---

## 8. Site features

- **Home page:**
  - A tool grid rendered statically, so it works without JavaScript.
  - Category chips that jump to that category on the page. The category heading links to its page.
  - Curated groups inside categories that define them (Text, Converter, Development).
  - Pinned tools, groups, categories and personal collections shown first, when present.
  - Personal collections, with one level of sub-collections, stored on this device.
- **Search:**
  - A search bar in the header on every page, including the 404 page.
  - Matches the title, the description, tags and keywords. Every query word has to match. A longer word can miss by one or two edits.
  - Focused with Ctrl+K, Cmd+K or `/`.
  - An accessible combobox. `search-index.json` loads the first time the bar is used.
  - A tag on a card or a tool page fills the bar with that tag.
- **Category pages:** one per category, with curated groups and a pin control for the category and each group.
- **Collections page:** create, rename and delete personal collections and sub-collections, and add or remove tools. A link from a tool opens it with that tool ready to add.
- **Pins:** tools, curated groups, categories and personal collections. Stored in localStorage only, newest first, up to 48. Recents stay in localStorage too.
- **Themes:** dark, light and system.
  - A tiny inline bootstrap script prevents a flash of the wrong theme. It must be covered by the CSP hash; if Astro doesn't hash it, add its hash through `security.csp.scriptDirective.hashes`.
  - `<meta name="color-scheme">`.
- **"New" badge:** shown for tools whose `added` date is within 30 days of the build date.
- **Shareable state:** see D12 and [section 7](#7-shared-ui-kit).
- **Settings page:**
  - Theme.
  - **Download everything for offline use**: pre-caches all lazy assets from the build's heavy-asset manifest, shows progress and calls `navigator.storage.persist()`.
  - **Clear all local data**.
  - Storage usage via `navigator.storage.estimate()` where available.
- **Licenses page:** generated from `check-licenses` data, plus the dataset sources and attributions (the EFF wordlist is CC-BY, Lucide is ISC).
- **Custom 404 page:** a search box and links to all categories.
- **Without JavaScript:**
  - Pages still render their heading and description.
  - A `<noscript>` notice explains that the tools need JavaScript.
- **Base path:** see [4.5](#45-base-path-and-urls).

---

## 9. Privacy and security model

### 9.1 What we promise

- Offline tools make no network requests other than same-origin requests for the site's own files.
- A network tool may `GET` an allowlisted HTTPS origin after the user runs it. The request sends the query they typed (or, for "this connection", the IP the service sees) and nothing else: no cookies, no page-load request, and no redirect to a host that is not on the list.
- Tool input stays in the tab, apart from that explicit lookup.
- localStorage is written only for favorites, collections, recents, theme and per-tool state the user has opted into (never for sensitive tools).
- Anyone can verify this through the CSP in devtools and an offline test.

### 9.2 Enforcement layers

| Layer                          | What it catches                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ESLint**                     | Bans the globals `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` and `RTCPeerConnection`. Bans `navigator.sendBeacon`, `Math.random` (use `crypto.getRandomValues`), `eval`, `new Function`, `dangerouslySetInnerHTML`, `innerHTML` assignment and `document.write`. Bans `href="/…"` literals. Bans DOM globals in `logic.ts`. Only `src/lib/load-local-asset.ts` may call `fetch` for same-origin files, and only `src/lib/network.ts` may call it for an allowlisted HTTPS origin. |
| **Validator**                  | Structure and contract rules ([6.2](#62-npm-run-validate-tools)).                                                                                                                                                                                                                                                                                                                                                                              |
| **`scan-dist`**                | External references in built HTML and CSS, and absolute-URL loaders in built JS, including bundled dependencies.                                                                                                                                                                                                                                                                                                                               |
| **CSP**                        | Blocks anything else at runtime ([9.3](#93-content-security-policy)).                                                                                                                                                                                                                                                                                                                                                                          |
| **End-to-end loop**            | Aborts and fails on any request outside the base URL's origin, on any `securitypolicyviolation` event, and on any page error ([13.2](#132-end-to-end-tests)).                                                                                                                                                                                                                                                                                  |
| **Egress-less end-to-end run** | The container and the Playwright runner sit on an `internal: true` Docker network, which also catches requests from service workers and workers that page-level routing can miss.                                                                                                                                                                                                                                                              |

### 9.3 Content Security Policy

Astro's built-in CSP (`security.csp`, stable since Astro 6) emits a `<meta http-equiv="content-security-policy">` on every page, with hashes for Astro's inline hydration scripts and styles. It is **off in `astro dev`**, so CSP is only tested against built output.

The target policy:

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval' <astro-hashes>;
style-src 'self' <astro-hashes>;
img-src 'self' blob: data:;
media-src 'self' blob: data:;
font-src 'self' data:;
connect-src 'self' blob: data: <allowlisted lookup origins>;
worker-src 'self' blob:;
frame-src 'self' blob:;
manifest-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'self';          # header only; meta tags can't set it
```

**Rules:**

1. Browsers enforce _every_ policy they receive. An nginx header with `script-src 'self'` and no hashes would block Astro's inline scripts. So `gen-csp` builds the header from the merged hashes in the built pages, and the end-to-end suite checks that the header and the meta tag agree ([D11](#1-decisions)).
2. Dedicated workers get their CSP from the worker script's response header, not from the page. The nginx header covers them; on hosts without headers, the meta tag is the only protection. Document this residual risk.
3. Set `build.inlineStylesheets: 'never'` so stylesheets are external files that can be cached.
4. Server-rendered HTML must not contain inline `style="…"` attributes, because CSP blocks them and Preact hydration won't restore them.
   - Use Tailwind classes, or set CSS custom properties from JavaScript (CSSOM), which CSP allows.
   - Astro's `define:vars` is banned.
5. Don't use Shiki, whose inline styles CSP blocks. Use a class-based highlighter (Prism or highlight.js) for code-to-image.
6. Don't use `upgrade-insecure-requests`, because it breaks plain-HTTP LAN deployments.
7. Libraries that need `eval` or `new Function` (Ajv, for example), inject `<style>` tags, or load scripts from `blob:` must be reconfigured or replaced. Adding a new source to any directive needs user approval.
8. Defer evaluating Trusted Types (`require-trusted-types-for 'script'`) to Phase 3.

### 9.4 Secure-context matrix

Plain HTTP on a LAN (for example `http://nas.lan:8080`) is _not_ a secure context.

| Browser feature                 | Secure context needed  | Affected                                                                 | Behavior over HTTP                                                                                            |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Service worker, Cache Storage   | Yes                    | Offline mode, PWA install, "Download everything"                         | Site banner: "Offline mode needs HTTPS". Everything else still works online.                                  |
| `crypto.subtle`                 | Yes                    | `rsa-keygen`, `csr-tool` (generate), `ssh-keygen` (RSA), `pdf-signature` | `CapabilityNotice`. Noble covers hashes, HMAC, AES-GCM, PBKDF2, scrypt, Ed25519, ECDSA and X25519 without it. |
| `crypto.randomUUID`             | Yes                    | `uuid-generator`                                                         | Not used. UUIDs are built from `crypto.getRandomValues`, which works everywhere.                              |
| `navigator.clipboard.writeText` | Yes                    | Every copy button                                                        | `execCommand('copy')` fallback                                                                                |
| `navigator.clipboard.read*`     | Yes, plus a permission | Paste buttons                                                            | Button hidden; Ctrl+V still works                                                                             |
| `getUserMedia`                  | Yes                    | Camera and audio recorders, QR camera                                    | Notice. `qr-reader` falls back to file input.                                                                 |
| `getDisplayMedia`               | Yes                    | `screen-recorder`                                                        | Notice                                                                                                        |
| `queryLocalFonts`               | Yes, plus a permission | `font-pairing`                                                           | Falls back to a curated list of system font stacks                                                            |
| `navigator.storage`             | Yes                    | Settings (persist, estimate)                                             | Hidden                                                                                                        |

Workers, WASM, Canvas, WebAudio, `speechSynthesis`, `CompressionStream`, localStorage and IndexedDB all work over HTTP.

### 9.5 Untrusted content

- Every tool shares one origin, and so one localStorage, including the encrypted secure note. CSP stops `fetch` from sending data out, but it does not stop navigation-based leaks such as `location = 'https://evil/?d=…'`.
- Therefore all user-supplied HTML, Markdown, SVG and email bodies render only inside `SandboxedPreview`, sanitized with DOMPurify.
- Raw SVG is never put into the main document with `innerHTML`.

### 9.6 Browser-level leaks (outside CSP's reach)

- **Text to speech:** only offer voices with `localService === true`. Chrome's remote voices send the text to Google.
- **Spell check and translation:** inputs default to `spellcheck=false`, and tool areas set `translate="no"`. Chrome's Enhanced Spell Check and page translation send text to external services.
- **WebRTC:** banned by lint.
- **Share links:** fragments never reach servers, but they do end up in browser history and sync. This is why share links are explicit and unavailable for sensitive tools.
- **Logs:** nginx `access_log` is **off by default**. Self-hosters can turn it on in the overridable config. There are no query-string tool inputs to log anyway.

### 9.7 Threat model

`docs/threat-model.md` and `SECURITY.md` must cover:

- Users trust whoever serves the JavaScript (the operator and the image build). Provenance, the SBOM and pinned digests reduce supply-chain risk.
- What we can't protect against:
  - malicious browser extensions
  - a compromised OS or clipboard managers
  - an operator who modifies the files
  - shoulder surfing
- How to report vulnerabilities, through GitHub private advisories.

---

## 10. Offline and PWA

- **Service worker:**
  - `scripts/gen-sw.ts` runs `workbox-build` `generateSW` after the build, with `swDest: dist/sw.js` and the scope set to the base path.
  - It is registered from a bundled module script, not an inline one, using `workbox-window`.
  - When a new version is waiting, an **"Update available, reload"** prompt appears.
- **Pre-cache:** the site shell, every HTML page, the search index, CSS, and the static JS graph of every page.
- **Runtime cache (cache-first):**
  - WASM, `public/data/*` and the lazy chunks of heavy tools are cached on first use.
  - Datasets carry their version in the file name (`oui-2026-10.json`) and WASM gets a hash in its file name, so cache-first never serves stale data.
- **Heavy-asset manifest:** the build writes `heavy-assets.json`, which lists the lazy URLs for "Download everything".
- **Manifest:** `manifest.webmanifest` with `start_url` and `scope` set to the base path, and local icons only.
- **Caching:** the service worker and manifest are never cached long-term ([14.2](#142-nginx)).
- **Offline end-to-end test:**
  1. Load the home page and wait for the service worker to be ready and the pre-cache to finish.
  2. Go offline with `context.setOffline(true)`.
  3. Load a sample of tool pages, and one heavy tool after "Download everything", and assert their headings.

---

## 11. Performance budgets

- **Static JavaScript budget (`check-budget`, blocks CI, covers every page):**
  - For each built page, follow `<script type="module">`, `<link rel="modulepreload">` and the island `component-url`/`renderer-url` attributes.
  - Recursively follow static `import`/`export … from` statements in the chunks.
  - Sum the gzipped sizes. The limit is **≤ 150 KB gzipped**.
  - Dynamic `import()` chunks are excluded. Heavy tools pass by lazy-loading their weight, and are listed with their lazy-chunk sizes for visibility.
- **Lighthouse CI** (against the container, median of 3 runs) on a sample: the home page, one category page, three light tools and one heavy tool.
  - Performance ≥ 95
  - Accessibility = 100
  - Best Practices ≥ 95
- **Fonts:** system font stack only; no web fonts.
- **Built-in data:** use `Intl` for countries, currencies, languages and time zones (`Intl.DisplayNames`, `Intl.supportedValuesOf`) instead of bundling datasets.

---

## 12. Accessibility

- Full keyboard navigation, a visible focus ring, a skip link, and focus kept inside dialogs.
- Every input has a label. Outputs are announced through live regions, and errors are announced.
- WCAG 2.2 AA contrast in both themes, using design tokens.
- **Zero axe violations** for `wcag2a`, `wcag2aa`, `wcag21aa` and `wcag22aa`, on every page, in both light and dark color schemes.
- Respect `prefers-reduced-motion`.
- Use 44 px touch targets for primary actions.

---

## 13. Testing strategy

### 13.1 Unit tests

- Vitest runs over `src/**/*.test.ts`.
- Every `logic.ts` has known test vectors where they exist: NIST/RFC hashes, RFC 4648, RFC 6238 TOTP, BIP39 vectors and so on.
- `tests/helpers/expect-robust.ts` exports `expectRobust(fn, { malformed: [...] })`. It calls the function with:
  - an empty string
  - whitespace
  - a 5 MB string
  - lone surrogates and `\0`
  - the tool's own malformed samples

  Each call must either return or throw `ToolInputError`, and finish within a time limit. No other exception types are allowed.

### 13.2 End-to-end tests

- **Target:** `E2E_BASE_URL` sets the target (default `http://localhost:4321`, served by `astro preview`; in CI it points at the container). The dev server is never the target, because CSP is off in dev.
- **`tools.spec.ts`** runs once per tool, looping over every `src/tools/*/meta.ts`:
  - Abort any request outside the base URL's origin, and fail if one was attempted.
  - Use `serviceWorkers: 'block'` so every request is visible to the test.
  - Fail on any `pageerror` or `securitypolicyviolation` event (recorded with an init script).
  - Check that `<h1>` equals `meta.name`.
  - Run axe in light and dark modes.
  - For each `meta.examples` entry: type the input, then assert the output contains `expect`.
  - Sensitive tools: type into the primary input, then assert that localStorage and the URL are unchanged.
- **`site.spec.ts`:** home, category pages, search (Ctrl+K finds a tool by keyword), favorites and recents, the theme switcher, the 404 page, and that the CSP header matches the meta tag.
- **`links.spec.ts`:** crawls all internal links from the home page and asserts each returns 200. This runs for both base paths.
- **`offline.spec.ts`:** see [section 10](#10-offline-and-pwa). Added in Phase 3.

### 13.3 Commands per phase

Each phase must pass validate, lint, typecheck, unit tests, the build at both base paths, `scan-dist`, `check-budget`, `check-licenses`, the image smoke test, and end-to-end tests against the container.

---

## 14. Docker and deployment

### 14.1 Dockerfile (multi-stage)

1. **`deps`:**
   - `FROM --platform=$BUILDPLATFORM node:26-alpine@sha256:…`.
   - `npm ci` with a cache mount (`--mount=type=cache,target=/root/.npm`).
2. **`build`:**
   - Accepts the build arguments `BASE_PATH=/`, `SITE_URL=` and `VERSION=dev`, and sets `ASTRO_TELEMETRY_DISABLED=1`.
   - Runs `validate-tools --strict`, `npm test`, `npm run build` and `check-licenses`, so a broken tool can never produce an image.
3. **`runtime`:** `nginxinc/nginx-unprivileged:<stable>-alpine@sha256:…`.
   - Runs as a non-root user (UID 101) on port 8080, with no build tools.
   - Copies `dist/` to `/usr/share/nginx/html${BASE_PATH}` and keeps a root-level `/404.html`.
   - Copies `build/server/csp.conf` and `base.conf` into `/etc/nginx/snippets/`.
   - Adds OCI labels: `title`, `description`, `version`, `source`, `licenses=MIT`, `revision`, `created`.
   - `HEALTHCHECK` runs `wget -qO- http://127.0.0.1:8080/healthz`.
4. **`dev`:**
   - `node:26-alpine` with the build arguments `UID` and `GID`.
   - Pre-creates `/app/node_modules` owned by `UID:GID`, so a fresh named volume inherits that owner.
5. **`e2e`:**
   - `FROM mcr.microsoft.com/playwright:v1.64.1-noble`.
   - Runs `npm ci` at build time, while the network is still available, then copies in `tests/`, the `src/tools/*/meta.ts` files and the Playwright config.

The building platform builds the site once. Only the runtime stage varies by architecture, which keeps multi-arch builds fast.

**`.dockerignore`** excludes:

- `node_modules`, `dist`, `build`, `.astro` and `.git`
- test reports, logs and coverage
- `.env*` except `.env.example`
- editor and OS files, and exported archives

### 14.2 nginx

- **Behavior:**
  - `server_tokens off`, `absolute_redirect off`, `port_in_redirect off`.
  - `access_log off` by default.
- **`/healthz`:**
  - `location = /healthz { access_log off; return 200 "ok\n"; }`
  - Includes the security headers.
- **Compression:**
  - gzip is on for text, JS, CSS, JSON, SVG, WASM and webmanifest files.
  - `gzip_static on` serves the `.gz` copies from `precompress`. The official image has no brotli module; Caddy and Apache can use the `.br` files.
- **MIME types:** `mime-extra.conf` adds `application/javascript mjs` and `application/manifest+json webmanifest`. The stock list has neither, and pdf.js workers fail without `.mjs`.
- **Clean URLs:** `try_files $uri $uri/ $uri.html =404;` and `error_page 404 /404.html;`.
- **Hidden files:** dotfiles are denied.
- **Locations:** match with regexes so the config works under any base path. `base.conf` adds a `302` from `/` to the base path when one is set.
- **Read-only filesystem:**
  - Replace `default.conf`, so the image's entrypoint scripts do nothing.
  - Don't use the environment-variable `templates/` directory, which needs a writable filesystem.
  - Writable paths are tmpfs only (`/tmp`).

**Caching policy:**

| Content                                                   | `Cache-Control`                       |
| --------------------------------------------------------- | ------------------------------------- |
| `/_astro/*` (hashed, including WASM imported with `?url`) | `public, max-age=31536000, immutable` |
| `/data/*`, other `*.wasm`                                 | `public, max-age=604800`              |
| HTML, `404.html`                                          | `no-cache`                            |
| `sw.js`, `workbox-*.js`, `manifest.webmanifest`           | `no-cache`                            |
| Icons                                                     | `public, max-age=86400`               |

**Security headers** live in `security-headers.conf`, which is included in **every** location, because nginx drops inherited `add_header` directives in any location that adds its own. It sets:

- `include /etc/nginx/snippets/csp.conf;` (generated)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: no-referrer`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), clipboard-read=(self), local-fonts=(self), geolocation=(), payment=(), usb=(), serial=(), hid=(), midi=(), browsing-topics=()` (no `bluetooth`: Chromium logs an "unrecognized feature" console error for it)

Self-hosters can override `security-headers.conf` with a volume mount without rebuilding. The docs warn them to keep the `csp.conf` include. HSTS belongs on the TLS terminator (Caddy), not here.

COEP is deliberately not set: static hosts can't send it, so ffmpeg uses its single-threaded core.

### 14.3 Compose files

- **`compose.yaml` (production):**
  - `image: ghcr.io/xeptor6569/xt-tools:${XT_TAG:-latest}`, with a `build:` fallback.
  - Ports `${XT_BIND:-0.0.0.0}:${XT_PORT:-8080}:8080`.
  - `restart: unless-stopped`, `read_only: true`, `tmpfs: [/tmp]`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`.
  - A healthcheck.
- **`compose.https.yaml` (overlay):**
  - Adds a `caddy` service in front of `tools` and removes the direct port with `ports: !reset []` (needs Compose 2.24 or later).
  - Exposes `80`, `443` and `443/udp`.
  - Stores data in the named volumes `caddy_data` and `caddy_config`.
  - `deploy/Caddyfile` uses `{$DOMAIN}` with automatic Let's Encrypt certificates and adds HSTS for public domains. A documented LAN alternative uses `tls internal`, and `make caddy-ca` exports the root CA so each device can trust it once.
- **`compose.dev.yaml`:**
  - **`dev` service:**
    - Uses build target `dev` and runs `npm run dev -- --host 0.0.0.0` on port 4321.
    - Mounts `.:/app` and the named volume `node_modules:/app/node_modules`.
    - Runs as `user: "${UID}:${GID}"`, with `stdin_open` and `tty` on.
    - Sets `WATCH_POLL=1`, which `astro.config.ts` maps to `vite.server.watch.usePolling`.
  - **`site` service:** the production image, built locally.
  - **`e2e` service:** build target `e2e`, behind `profiles: [test]`, with `E2E_BASE_URL=http://site:8080`.
  - `site` and `e2e` share a network with `internal: true`, so there's no internet access during the tests.
- **`.env.example`** (at the repo root, where Compose looks for `.env`): `XT_TAG`, `XT_BIND`, `XT_PORT`, `BASE_PATH`, `SITE_URL`, `VERSION`, `DOMAIN`.

### 14.4 Makefile

Bash and zsh don't export `UID` and `GID`, so the Makefile sets them:

```make
UID := $(shell id -u)
GID := $(shell id -g)
export UID GID ASTRO_TELEMETRY_DISABLED=1
```

| Target                                                  | What it does                                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `help` (default)                                        | Lists the targets                                                                                                    |
| `new-tool`                                              | `docker compose -f compose.dev.yaml run --rm dev npm run new-tool -- $(ARGS)`. Interactive when `ARGS` is empty.     |
| `remove-tool` / `list-tools`                            | The same pattern, passing `ARGS` through, for example `make remove-tool ARGS="demo-tool --yes"`                      |
| `dev`                                                   | Dev server with hot reload                                                                                           |
| `validate` / `lint` / `test-unit` / `test-e2e` / `test` | `test` runs validate, unit and end-to-end tests (end-to-end via the `test` profile, against the locally built image) |
| `build`                                                 | Builds the image, passing `BASE_PATH`, `SITE_URL` and `VERSION` through                                              |
| `up` / `up-https` / `down` / `logs`                     | Run, stop and follow the site over HTTP or HTTPS                                                                     |
| `export` / `import`                                     | `docker save … \| gzip > xt-tools.tar.gz` and `gunzip -c … \| docker load`                                           |
| `caddy-ca`                                              | Copies Caddy's internal root CA out of its volume                                                                    |
| `clean`                                                 | Removes `dist`, `build` and test reports                                                                             |

**The contributor loop with only Docker installed:**

1. `make new-tool`
2. `make dev`
3. `make test`
4. `make build up`

The new tool appears automatically.

### 14.5 Deployment paths to document

1. **Single `docker run`** of the prebuilt image with the hardening flags:
   ```
   docker run -d --name xt-tools -p 8080:8080 --read-only --tmpfs /tmp \
     --cap-drop ALL --security-opt no-new-privileges --restart unless-stopped \
     ghcr.io/xeptor6569/xt-tools:latest
   ```
2. **Clone the repo and use Compose**, over HTTP (`make up`) or HTTPS (`make up-https`).
3. **Custom sub-path:** the base path is compiled into the site, so you build the image yourself (`make build BASE_PATH=/tools/`).
4. **Air-gapped install:** `make export` on a connected machine, copy the file over, then `make import up`.
5. **Behind an existing reverse proxy:** examples for Traefik labels and an nginx `location` block. Forward `Host`, and keep the security headers from the container (don't strip or duplicate them).
6. **Any static host:** use the release zip, which includes `server-configs/` with the generated CSP for nginx, Apache (`.htaccess`) and Caddy. Without host headers, the meta CSP still applies. Only `frame-ancestors` and worker CSP are lost.

---

## 15. CI/CD

### 15.1 `ci.yml` (every push and pull request)

1. **Install:** `actions/setup-node` with `.nvmrc`, then `npm ci`.
2. **Checks:** `validate-tools --strict`, then `check-licenses`.
3. **Static analysis:** `npm run check` (typecheck), then `npm run lint`.
4. **Unit tests:** `npm test`.
5. **Site build:** a matrix over `BASE_PATH` `/` and `/tools/`. Each build runs the full post-build: CSP, `scan-dist`, budget, precompress.
6. **Image:** build a local test image for each base path.
7. **Smoke test:**
   - Run the container with `--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges`.
   - Wait for it to report healthy.
   - Check that the CSP header is present and equals the generated policy.
   - Check that a deep tool link returns 200 and that `/healthz` returns `ok`.
8. **End-to-end:** the full Playwright suite runs against the root-path container through `compose.dev.yaml --profile test`, on the internal network. The `/tools/` image gets `links.spec.ts` plus a sample of tool pages. The Playwright report is uploaded as an artifact.
9. **Lighthouse CI:** runs on the sample pages ([section 11](#11-performance-budgets)), with filesystem upload.
10. **Scan:** Trivy image scan, failing on HIGH or CRITICAL issues that have a fix (`ignore-unfixed: true`).

All actions are pinned by commit SHA. Use `permissions: contents: read` by default.

### 15.2 `release.yml` (`main` and `v*` tags)

- Log in to GHCR.
- Build multi-arch images (`linux/amd64`, `linux/arm64`) with `docker/build-push-action`.
- Attach provenance (`provenance: mode=max`) and an SBOM (`sbom: true`).
- Use the GitHub Actions build cache (`cache-from/to: type=gha`).
- **Tags** (`docker/metadata-action`):
  - `v*` tags: `{{version}}`, `{{major}}.{{minor}}` and `latest`
  - `main`: `edge` and `sha-<short>` (D13)
- **On `v*` tags:** attach these to the GitHub release:
  - `xt-tools-<version>-site.zip` (the root-path `dist/` plus `server-configs/`)
  - `SHA256SUMS`
  - the SBOM

### 15.3 `scheduled.yml`

- Rebuilds weekly to pick up base-image patches, and runs Trivy.
- Can be run manually (`workflow_dispatch`).
- GitHub turns off scheduled workflows after 60 days without repo activity. Document this.

### 15.4 Renovate

- Pin Docker digests and action SHAs.
- Group Astro packages together.
- Keep `@playwright/test` and the `mcr.microsoft.com/playwright` image tag in the same group, using a regex manager over the Dockerfile and workflows.
- Automerge patch updates for dev dependencies only when CI is green.

---

## 16. Dependency policy and licensing

### 16.1 Rules

- Prefer well-maintained libraries for parsing and crypto over code written by hand. Use the Noble libraries first (D4), and WebCrypto where nothing else fits.
- Every dependency is bundled locally. Never load anything from a CDN.
- Configure libraries with CDN defaults to use local paths:
  - pdf.js: `isEvalSupported: false`, plus local cMaps, standard fonts and worker
  - ffmpeg.wasm: local core URLs, not blob-wrapped CDN fetches
  - zxing-wasm and sql.js: local `locateFile`
- WASM and data that ship inside npm packages are imported through Vite (`?url` or dynamic `import()`), so they get hashed file names. Commit only hand-curated datasets, in `public/data/`, with versions in the file names.
- **Ask the user before:**
  - adding a dependency over roughly 100 KB gzipped to a non-heavy tool
  - changing the tool contract after Phase 1
  - adding a CSP source
  - accepting a license outside the allowlist
- **Pre-approved, lazy-loaded only** (the tool is flagged `heavy`, or the chunk is loaded with dynamic import):
  - Math and data: mathjs, @faker-js/faker (single locale), libphonenumber-js, sql-formatter, Kubernetes JSON schemas
  - Formatters and minifiers: prettier/standalone and its plugins, terser or esbuild-wasm, svgo (browser build)
  - Crypto: openpgp, hash-wasm, @zxcvbn-ts language packs, crypto-js (legacy decryption only)
  - Editors and highlighting: the smallest workable WYSIWYG editor, Prism or highlight.js
  - Data: emojibase-data, the OUI dataset, figlet fonts
  - Documents and media: pdf-lib, pdfjs-dist, @ffmpeg/ffmpeg with the single-threaded core, sql.js, zxing-wasm
- **Banned:**
  - `ua-parser-js` v2 and later (AGPL); use v1 (MIT) or bowser
  - Ajv, or anything that uses `eval` or `new Function`; use `@cfworker/json-schema`
  - `crypto-js` for anything other than legacy decryption
  - moment and full lodash
  - any library that phones home or can't be pointed at local assets
- **Shortlist** (check maintenance and size when implementing):

  | Area         | Libraries                                                                                                                                          |
  | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Crypto       | `@noble/hashes`, `@noble/ciphers`, `@noble/curves`, `@scure/base`, `@scure/bip39`, `bcryptjs`, `shamir-secret-sharing`, `@peculiar/x509` (parsing) |
  | Development  | `croner` and `cronstrue`, `jsonpath-plus` (with `eval: 'safe'`)                                                                                    |
  | Formats      | `culori`, `yaml`, `smol-toml`, `fast-xml-parser`, `marked`, `turndown`                                                                             |
  | UI and other | `dompurify`, `qrcode`, `diff`, `@zxcvbn-ts/core`                                                                                                   |

### 16.2 Licenses

- The project is MIT.
- **Allowlist for production dependencies:** MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, CC0-1.0, Unlicense, BlueOak-1.0.0, MPL-2.0 (unmodified files only), and CC-BY-3.0/4.0 for data, with attribution.
- **Exceptions** are recorded in `scripts/licenses.allow.json`, each with a reason:
  - `openpgp` (LGPL-3.0+): kept in its own chunk, which users can replace
  - `@ffmpeg/core` (GPL-2.0+): shipped as a separate unmodified asset, with a link to its source on the licenses page
  - dual-licensed packages, with the permissive option chosen
- Dev-only dependencies are not checked; for example, `@axe-core/playwright` is MPL-2.0.

---

## 17. Repository hygiene

### 17.1 `.gitignore` corrections (Phase 0)

The current file already matches the spec. Phase 0 makes these fixes:

- Replace `offline-tools.tar.gz` with `xt-tools*.tar.gz` (D1).
- Replace the per-extension fixture re-includes (`!tests/fixtures/**/*.pem`, `*.tar.gz`, `*.zip`) with one `!tests/fixtures/**`, so `.key`, `.crt` and `.tar` fixtures aren't ignored.
- Add `build/`, for generated server snippets.
- Keep these tracked: `public/data/`, `public/wasm/` (if ever used), `package-lock.json`.

### 17.2 Repository metadata

- **GitHub description:** "100+ privacy-first developer and everyday tools that run in your browser. No tracking. Network tools name the service they contact and run only when you ask. Self-host with one Docker command."
- **Topics:** self-hosted, offline-first, privacy, developer-tools, pwa, docker, astro, preact, static-site, web-tools, cybersecurity, homelab.
- **README tagline:** "Your toolbox, your server, no internet required."
- Set the description and topics with `gh repo edit` in Phase 4.

---

## 18. Documentation deliverables

| File                                                             | Contents                                                                                                                                                                                | Phase                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `README.md`                                                      | What it is, quick start for every deployment path, HTTPS and secure-context requirements, base path, air-gap steps, refreshing datasets, links to the docs                              | Skeleton now, complete in 4     |
| `CONTRIBUTING.md`                                                | The five-step tool workflow (`make new-tool` or `npm run new-tool`), with and without local Node. Covers the contract, templates, definition of done, and the dependency and CSP rules. | 0, refined in 1                 |
| `SECURITY.md`                                                    | Reporting, supported versions, summary of the threat model                                                                                                                              | 4                               |
| `docs/deployment.md`, `docs/reverse-proxy.md`, `docs/air-gap.md` | Full deployment guides                                                                                                                                                                  | 4                               |
| `docs/datasets.md`                                               | Source, version, license, SHA-256 and refresh steps for each bundled dataset                                                                                                            | When the first dataset is added |
| `docs/threat-model.md`                                           | [9.7](#97-threat-model) in full                                                                                                                                                         | 4                               |

---

## 19. Tool catalog

**Tags:**

| Tag             | Meaning                                              |
| --------------- | ---------------------------------------------------- |
| **P0/P1/P5/P6** | Built in that phase (untagged tools are Phase 2)     |
| **S**           | `sensitive`                                          |
| **H**           | `heavy`                                              |
| **W**           | Uses a worker                                        |
| **L**           | Has legacy options                                   |
| **R:x**         | `requires` capability `x`                            |
| **▢**           | Renders untrusted content through `SandboxedPreview` |
| **ᴹ**           | Merge candidate to decide at the start of the batch  |

### 19.1 Merges

**Approved (D6):**

| Tool                         | Absorbs                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `data-format-converter`      | YAML/JSON/TOML/XML in all directions, CSV⇄JSON/YAML, JSON→CSV, .env/INI/properties⇄JSON |
| `table-converter`            | CSV→Markdown/HTML table, Markdown table generator                                       |
| `regex-tester`               | Regex find and replace                                                                  |
| `date-time`                  | Batch Unix timestamp converter (as a tab)                                               |
| `markdown-editor`            | Markdown→HTML with print-to-PDF                                                         |
| `unit-converter`             | Temperature converter                                                                   |
| `base-encoder`               | Base64 text, Base32, Base58, Base85, hex (`base64-file` stays separate)                 |
| `jwt-debugger`               | JWT parser, JWT signer/verifier                                                         |
| `hash-text`, `file-checksum` | Text hashing, file hash/checksum, CRC32/Adler-32/xxHash/BLAKE3                          |
| `image-converter`            | Resize, compress, crop, format conversion                                               |
| `metadata-remover`           | EXIF stripper (`exif-viewer` stays in Images)                                           |

**Moved:** TOTP from Web to Crypto. Temperature from Measurement to Converter (inside `unit-converter`).

**Candidates (ᴹ), to confirm with the user when their batch starts:**

- `curl-converter` + `http-snippet`
- `math-evaluator` + `unit-calculator`
- `qr-generator` + `wifi-qr`

### 19.2 Catalog by category (186 pages)

#### Crypto (24)

- `token-generator`: Random bytes. A local openssl rand: hex, base64, base64url or a raw file, for a chosen number of bytes · S
- `password-generator`: Password and passphrase generator (character sets, or EFF Diceware) · S · H
- `hash-text`: Hash text. MD5ᴸ, SHA-1ᴸ, SHA-2, SHA-3, RIPEMD-160, BLAKE3, plus non-cryptographic CRC32, Adler-32 and xxHash, labeled as such · **P1** · L
- `file-checksum`: File checksum verifier. Same algorithms, streamed, compared against an expected value · W
- `bcrypt`: Bcrypt hash and compare · S · W
- `uuid-generator`: UUID generator (v4 and v7 built with `getRandomValues`; nil and max) · **P1**
- `ulid-generator`: ULID generator
- `text-encrypt`: Text encrypt/decrypt. AES-GCM with a scrypt/PBKDF2-derived key. TripleDESᴸ, Rabbitᴸ and RC4ᴸ are decrypt-only (D5) · S · L
- `bip39`: BIP39 mnemonic and passphrase generator/recovery · S
- `hmac-generator`: HMAC generator · S
- `rsa-keygen`: RSA key pair generator · S · R:webcrypto
- `password-strength`: Password strength analyser (zxcvbn-ts, dictionaries loaded lazily) · S · H
- `ec-keygen`: Ed25519/ECDSA key generator · S
- `ssh-keygen`: SSH key generator and fingerprint viewer (Ed25519 with Noble; RSA mode R:webcrypto) · S
- `x509-decoder`: X.509/PEM certificate decoder
- `csr-tool`: CSR generator and decoder (generation R:webcrypto) · S
- `password-hash`: Argon2, scrypt and PBKDF2 hashing · S · H · W · **P5**
- `jwt-debugger`: JWT decode, sign and verify (HS/RS/ES/EdDSA; `alg: none` is flagged) · S · L
- `file-encrypt`: AES-GCM file encryptor (streamed in chunks) · S · W
- `diceware`: Diceware passphrases from the EFF wordlist (CC-BY, credited) · S
- `shamir`: Shamir secret sharing · S
- `pgp`: PGP encrypt/decrypt/sign via OpenPGP.js · S · H · W · **P5**
- `pdf-signature`: PDF signature checker · H · R:webcrypto · **P5**
- `totp`: TOTP generator and validator (RFC 6238) · S

#### Converter (21)

- `date-time`: Date-time converter, with a batch Unix timestamp tab
- `base-converter`: Integer base converter (BigInt)
- `roman-numerals`: Roman numeral converter
- `base-encoder`: Base64 (standard and URL-safe), Base32, Base58, Base85 and hex · **P1**
- `base64-file`: Base64 file converter
- `color-converter`: Color converter · **P1**
- `case-converter`: Case converter · **P1**
- `nato-alphabet`: NATO alphabet
- `text-to-binary`: Text to ASCII binary
- `text-to-unicode`: Text to Unicode code points and escapes
- `data-format-converter`: JSON ⇄ YAML ⇄ TOML ⇄ XML ⇄ CSV ⇄ .env ⇄ INI ⇄ properties, with from/to selectors
- `list-converter`: List converter
- `table-converter`: CSV/TSV/JSON ⇄ Markdown/HTML tables, with a table editor
- `html-to-markdown`: HTML to Markdown
- `unit-converter`: Unit converter, including KB vs KiB and temperature
- `currency-converter`: Currency converter. Latest ECB rates from Frankfurter, fetched only when the two currencies differ · network: `api.frankfurter.dev`
- `time-zones`: Time zone converter and meeting planner (`Intl` only)
- `number-to-words`: Number to words
- `morse-code`: Morse code with audio (WebAudio)
- `punycode`: Punycode/IDN converter
- `text-encodings`: Quoted-printable, UTF-7 and UTF-16 encoders

#### Web (27)

- `url-encoder`: URL encoder/decoder
- `html-entities`: HTML entity escaper
- `url-parser`: URL parser
- `device-info`: Device information (only what the browser exposes locally; no IP lookup)
- `basic-auth`: Basic auth header generator · S
- `og-meta-generator`: Open Graph meta generator
- `mime-types`: MIME types lookup (`mime-db` loaded with dynamic import)
- `keycode-info`: Keycode info
- `slugify`: Slugify · **P0** (reference tool)
- `html-editor`: HTML WYSIWYG editor · ▢ · H
- `user-agent-parser`: User-agent parser (ua-parser-js v1 or bowser)
- `http-status-codes`: HTTP status codes reference
- `json-diff`: JSON diff
- `safe-links-decoder`: Outlook Safe Links decoder
- `csp-builder`: CSP builder and analyser
- `security-headers`: Security headers generator
- `curl-converter`: cURL to fetch/Python/Go · ᴹ
- `http-snippet`: Offline HTTP request snippet builder · ᴹ
- `cookie-parser`: Cookie parser
- `robots-sitemap`: robots.txt and sitemap generators
- `redirect-generator`: .htaccess/nginx redirect generator
- `favicon-generator`: Favicon generator (canvas, ICO/PNG)
- `social-preview`: SEO and social card preview · ▢
- `data-uri`: Data URI generator
- `query-string-json`: Query string ⇄ JSON
- `code-minifier`: Minifiers and beautifiers for HTML, CSS and JS · H · W
- `email-headers`: Email header analyser (parsing only; no DNS lookups)

#### Images and media (16)

- `qr-generator`: QR code generator · **P1** · ᴹ
- `wifi-qr`: WiFi QR code generator · S · ᴹ
- `svg-placeholder`: SVG placeholder generator
- `camera-recorder`: Camera recorder · R:camera,microphone
- `image-converter`: Image resize, compress, crop and format conversion (canvas; better codecs in P5) · W
- `exif-viewer`: EXIF viewer
- `palette-extractor`: Color palette extractor
- `qr-reader`: QR reader from camera or file (file mode works without a camera) · H · R:camera (camera mode)
- `barcode-generator`: Barcode generator
- `svg-optimizer`: SVG optimizer · H · ▢
- `screen-recorder`: Screen recorder · R:display-capture
- `audio-recorder`: Audio recorder with waveform · R:microphone
- `sprite-splitter`: Sprite sheet splitter
- `hue-variants`: Hue-shift variant generator
- `aspect-ratio`: Aspect ratio calculator
- `video-to-gif`: Video to GIF and frame extractor via ffmpeg.wasm (single-threaded) · H · W · **P5**

#### Development (29)

- `git-cheatsheet`: Git cheatsheet
- `random-port`: Random port generator
- `crontab`: Crontab generator and explainer, showing the next runs · **P1**
- `json-format`: JSON prettify and minify · **P1**
- `sql-formatter`: SQL formatter · H
- `chmod-calculator`: Chmod calculator
- `docker-compose-converter`: docker run ⇄ Docker Compose
- `docker-compose-builder`: Docker Compose file builder with a form for services, networks and volumes (added at user request)
- `xml-formatter`: XML formatter
- `yaml-formatter`: YAML formatter
- `email-normalizer`: Email normalizer
- `regex-tester`: Regex tester with find and replace (runs in a worker with a timeout) · **P1** · W
- `regex-cheatsheet`: Regex cheatsheet
- `json-schema`: JSON Schema validator and generator (`@cfworker/json-schema`)
- `json-to-types`: JSON to TypeScript/Go/Rust/Python types
- `json-query`: JSONPath/jq playground (JSONPath in P2; jq WASM in P5) · W · H (jq)
- `patch-applier`: Unified diff/patch applier
- `semver`: Semver comparator and range tester
- `gitignore-generator`: .gitignore generator (templates from github/gitignore, CC0)
- `dockerfile-linter`: Dockerfile linter (hand-written rule set)
- `k8s-manifest`: Kubernetes manifest validator and generator (schemas loaded lazily) · H
- `mock-data`: Mock data generator · H
- `sqlite-browser`: SQLite browser via sql.js · H · W · **P5**
- `code-to-image`: Code-to-image (class-based highlighter, canvas export)
- `string-escaper`: String escapers for JSON, SQL, shell and regex
- `docker-cheatsheet`: Docker cheatsheet
- `kubernetes-cheatsheet`: Kubernetes cheatsheet
- `vim-cheatsheet`: Vim cheatsheet
- `tmux-cheatsheet`: tmux cheatsheet

#### Network (18)

- `ipv4-subnet`: IPv4 subnet calculator · **P1**
- `ipv4-converter`: IPv4 address converter
- `ipv4-range-expander`: IPv4 range expander
- `mac-vendor`: MAC vendor lookup, using the bundled OUI dataset (`refresh-data oui`) · H
- `mac-generator`: MAC address generator
- `ipv6-ula`: IPv6 ULA generator
- `ipv6-subnet`: IPv6 subnet calculator and expand/compress tool
- `cidr-tools`: CIDR aggregator and overlap checker
- `ip-in-range`: IP-in-range checker
- `wildcard-mask`: Wildcard mask converter
- `port-reference`: Port reference
- `dns-records`: DNS record builder for SPF, DMARC, DKIM, CAA and SRV
- `wireguard`: WireGuard config and key generator (X25519 via Noble) · S
- `transfer-time`: Bandwidth/transfer time calculator
- `hosts-merger`: Hosts file and adblock list merger · W
- `ip-lookup`: Public IP address and approximate location · network: `api.ipify.org`, `api64.ipify.org`, `ipwho.is`
- `dns-lookup`: DNS lookup through Cloudflare DNS-over-HTTPS (one resolver, not worldwide propagation) · network: `cloudflare-dns.com`
- `whois-lookup`: RDAP registration data for .com, .net, .org and ARIN IP addresses. A referral to another registry is refused · network: `rdap.verisign.com`, `rdap.publicinterestregistry.org`, `rdap.arin.net`

#### Math (11)

- `math-evaluator`: Math evaluator · H · W · ᴹ
- `eta-calculator`: ETA calculator
- `percentage-calculator`: Percentage calculator
- `unit-calculator`: Unit-aware calculator · H · ᴹ
- `statistics`: Statistics calculator
- `matrix-calculator`: Matrix calculator
- `number-theory`: Primes, factorization, GCD and LCM · W
- `random-numbers`: Seeded random numbers, dice and list shuffle (seeded PRNG, otherwise `getRandomValues`)
- `loan-calculator`: Loan and compound interest calculator
- `date-difference`: Date difference calculator, including business days
- `graph-plotter`: Function graph plotter

#### Measurement (6)

- `chronometer`: Chronometer
- `benchmark-builder`: Benchmark builder (compares measured values; never runs user code)
- `timer`: Countdown and Pomodoro timer
- `world-clock`: World clock
- `metronome`: Metronome and tone generator
- `screen-ruler`: Screen ruler and DPI calculator

#### Text (15)

- `lorem-ipsum`: Lorem ipsum generator
- `text-stats`: Text statistics
- `emoji-picker`: Emoji picker · H
- `string-obfuscator`: String obfuscator
- `text-diff`: Text diff
- `numeronym`: Numeronym generator
- `ascii-art`: ASCII art text (figlet fonts loaded lazily) · H
- `text-cleanup`: Dedupe, trim and blank-line remover
- `word-frequency`: Word frequency counter
- `invisible-chars`: Invisible character and homoglyph detector
- `unicode-normalizer`: Unicode normalizer
- `text-to-speech`: Text to speech (`localService` voices only) · R:speech-synthesis
- `readability`: Readability score
- `markdown-editor`: Markdown editor with live preview, HTML export and print-to-PDF · ▢
- `fancy-text`: Fancy Unicode text

#### Data (8)

- `phone-parser`: Phone parser · H
- `iban-validator`: IBAN validator
- `luhn-validator`: Credit card Luhn validator (documented for test numbers only) · S
- `isbn-ean-validator`: ISBN, EAN and UPC validator
- `vat-validator`: VAT format validator (format only; no VIES lookup)
- `iso-codes`: ISO country, currency and language lookup (`Intl`)
- `geo-converter`: Coordinate and geohash converter
- `csv-editor`: CSV viewer and editor · W

#### Privacy (3)

- `metadata-remover`: Metadata remover for images, PDF and Office files · H · W · **P6**
- `secure-note`: Encrypted local secure note (AES-GCM, scrypt key, IndexedDB) · S · **P6**
- `password-export-viewer`: Password manager export viewer · S · **P6**

#### Documents (3)

- `pdf-tools`: PDF merge, split, rotate and compress · H · W · **P5**
- `pdf-image-extractor`: Image extraction from PDFs · H · W · **P5**
- `pdf-to-images`: PDF to images (pdf.js) · H · W · **P5**

#### Design (5)

- `gradient-generator`: Gradient generator
- `box-shadow`: Box-shadow generator
- `css-clamp`: CSS clamp() calculator
- `contrast-checker`: WCAG contrast checker
- `font-pairing`: Font pairing preview (local and system fonts only; never web fonts) · R:local-fonts (optional)

### 19.3 Definition of done (per tool)

- The logic is pure and unit-tested, including known test vectors where they exist, and passes `expectRobust()`.
- Empty, very large and malformed input never crash the tool. Errors are shown inline and announced.
- Copy and download work where relevant, including over plain HTTP.
- The tool works keyboard-only and has zero axe violations in both themes.
- It makes no network requests, unless it is a network tool: then it contacts only its declared hosts, only after the user runs it, and the page still passes the end-to-end suite because that suite never clicks the button. The validator (`--strict`) and `scan-dist` pass either way.
- `sensitive`, `requires`, `heavy` and legacy labels are set where they apply. Secure algorithms are the default.
- At least one `examples` entry exists for text-in/text-out tools.
- The page passes the JavaScript budget. Heavy assets load lazily, with a `LoadingState`.

---

## 20. Phases

Every phase ends with the full check set from [13.3](#133-commands-per-phase) passing, and an entry in the [progress log](#22-progress-log) covering what was built, the decisions made and anything deferred.

### Phase 0: Foundation and safety checks

1. **Tooling:**
   - Config: `package.json`, `.nvmrc` (26), `.npmrc`, strict `tsconfig.json` (`erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`).
   - Lint and format: ESLint 10 flat config with the [9.2](#92-enforcement-layers) rules, and Prettier.
   - The `.githooks/pre-commit` hook and `setup-hooks`.
   - Repo files: `renovate.json`, `LICENSE` (MIT), and the `.gitignore` corrections ([17.1](#171-gitignore-corrections-phase-0)).
2. **Astro setup:**
   - Astro 7 with `@astrojs/preact` (Preact 10) and Tailwind v4.
   - `security.csp` with the full directive list, `inlineStylesheets: 'never'`, `trailingSlash: 'always'`.
   - `BASE_PATH` and `SITE_URL` from the environment, and the `href()` helper.
3. **Site skeleton:**
   - `categories.ts`, `capabilities.ts`, `types.ts` and the registry.
   - `BaseLayout` and `ToolLayout`, with a minimal `CapabilityNotice` and `LegacyWarning`.
   - A static home grid, category pages, the 404 page and a stub licenses page.
4. **Scripts:**
   - `new-tool` (`two-pane` template), `validate-tools`, `list-tools` and `remove-tool`.
   - `postbuild` with `gen-csp`, `scan-dist` and `precompress`.
   - `check-licenses` and `setup-hooks`.
5. **Reference tool:** create `slugify` **with the scaffolder** and implement it fully.
6. **Tests:**
   - Vitest with `expectRobust`.
   - Playwright `tools.spec.ts` (network guard, CSP violations, page errors, heading, axe), `site.spec.ts` (minimal) and `links.spec.ts`.
7. **Docker:**
   - Dockerfile (all stages), `.dockerignore`, and the nginx config with security headers, the generated CSP, `/healthz` and the caching rules.
   - `compose.yaml`, `compose.dev.yaml` (with the internal end-to-end network), `.env.example` and the Makefile.
8. **CI:** `ci.yml`, steps 1–8 and 10 from [15.1](#151-ciyml-every-push-and-pull-request), with both base paths.
9. **Docs:** a first `CONTRIBUTING.md`.

**Exit criteria:**

- Running `make new-tool ARGS="demo-tool --name 'Demo Tool' --category text --description 'Demo tool used to prove the scaffolding loop.' --yes"` creates a tool that appears on the home page, the text category page and the search index, and is covered by the end-to-end loop, with no other edits.
- `make remove-tool ARGS="demo-tool --yes"` removes it cleanly.
- CI is green for `/` and `/tools/`.
- The image runs read-only and passes the smoke test.

### Phase 1: UI kit, templates and pilot tools

- The full UI kit ([section 7](#7-shared-ui-kit)), including the copy fallback, `SandboxedPreview`, `AlgorithmSelect`, `useWorker` with timeout, `usePersistentState` and `useShareableState`.
- Themes: dark, light and system, with tokens that meet AA in both.
- All six templates: `two-pane`, `text-transform`, `file-processor`, `generator`, `diff`, `reference-table`.
- The 10 pilot tools: `hash-text`, `base-encoder`, `json-format`, `ipv4-subnet`, `uuid-generator`, `case-converter`, `color-converter`, `crontab`, `regex-tester`, `qr-generator`.
- `check-budget` and Lighthouse CI (step 9).
- **Exit:** the contract is frozen ([5.5](#55-contract-freeze)), and the templates reflect what the pilots needed.

### Phase 2: Lightweight catalog

- **First:** `batch-tools` and a `catalog/` directory of JSON specs generated from [19.2](#192-catalog-by-category-180-pages).
- **Then:** build in batches, one PR and one `v0.x` tag per batch:
  1. Text + Converter
  2. Development
  3. Lightweight Crypto
  4. Network
  5. Web
  6. Math + Measurement
  7. Data
  8. Design
  9. Canvas-only Images and media
- Resolve each ᴹ candidate with the user when its batch starts.
- Refine the templates as common patterns emerge.
- Pages tagged H that only need lazy JS (not WASM) are built here.

### Phase 3: Offline and discovery

- PWA ([section 10](#10-offline-and-pwa)): `gen-sw`, the manifest, icons, the update prompt and `offline.spec.ts`.
- Search with Ctrl/Cmd+K and `/`, favorites, recents and the "New" badge.
- Settings: download everything, persistent storage, clear all local data and the storage estimate.
- Site banner for secure contexts. Evaluate Trusted Types.
- A full accessibility pass across every page.

### Phase 4: v1.0 release

- `release.yml`: multi-arch images on GHCR with provenance and an SBOM, the release zip with `server-configs/`, and `SHA256SUMS`.
- `compose.https.yaml` and the Caddyfile (public domain and LAN), and `make caddy-ca`.
- `scheduled.yml` with weekly rebuilds and Trivy.
- Docs: the complete README, `SECURITY.md`, the threat model, the deployment, reverse-proxy and air-gap guides, and the secure-context matrix.
- Repo description and topics (`gh repo edit`). Tag `v1.0.0`.

### Phase 5: Heavy tools

- `password-hash` (Argon2 via hash-wasm, in a worker), `pgp`, `pdf-signature`.
- `pdf-tools`, `pdf-image-extractor`, `pdf-to-images`.
- `video-to-gif` (ffmpeg single-threaded), `sqlite-browser`, jq for `json-query`.
- WASM codecs for `image-converter`.
- Every heavy asset is listed in `heavy-assets.json` and covered by the offline test after "Download everything".

### Phase 6: Expansion

- Privacy tools: `metadata-remover`, `secure-note`, `password-export-viewer`.
- Any remaining catalog gaps.
- A Helm chart or Kubernetes manifest, only if requested.

---

## 21. How to work

- Finish and verify each phase before starting the next. After each phase, run the full check set, fix every failure, and add a progress log entry.
- When something isn't specified, choose the simpler, smaller, more private option, and log it.
- Never weaken the CSP, the network checks or the license checks to make something pass. Find another way, or ask the user.
- Keep commits small, with conventional messages (`feat(tool): add hash-text`, `chore(ci): …`). Use one PR per batch.
- Ask the user before:
  - changing D1–D7
  - changing the contract after Phase 1
  - adding a non-pre-approved dependency over ~100 KB gzipped to a non-heavy tool
  - adding a CSP source
  - accepting a license outside the allowlist
  - merging an ᴹ candidate

---

## 22. Progress log

| Date       | Phase | Entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-14 | —     | Reviewed the original prompt against current upstream: npm registry, Node release schedule, Astro CSP docs, nginx mime types. Found these blockers: `@vite-pwa/astro` is incompatible with Astro 7; TypeScript 7 and Preact 11 are blocked by their integrations; a header-only CSP would break Astro's hydration; plain HTTP turns off the service worker and WebCrypto; the safety checks were scheduled too late. Recorded decisions D1–D18. Merged overlapping catalog entries (about 189 entries became 180 pages; 3 more merge candidates are still open). Reordered the phases so the safety checks, base path and Docker exist from Phase 0. |
| 2026-10-14 | 0     | **Phase 0 done.** Built: Astro 7.3 + Preact 10 + Tailwind 4 site with Astro CSP, base-path support, registry, layouts, home/category/404/licenses pages and search index; the scaffolder (`two-pane` template, `--worker`), validator, list/remove scripts, post-build `gen-csp`/`scan-dist`/`precompress`, license check; the `slugify` reference tool (created with the scaffolder); Vitest with `expectRobust`; Playwright registry loop (network guard, CSP violations, page and console errors, heading, axe in both schemes, examples, typed-input smoke test, sensitive-tool storage check), site and link-crawl specs, and guard self-tests that must fail; Dockerfile (deps/build/dev/e2e/runtime), nginx config, compose files with an `internal` e2e network, Makefile, smoke test, CI, Renovate, MIT LICENSE, CONTRIBUTING.md. Verified locally: validate (strict), licenses, audit, typecheck, lint, unit tests, builds at `/` and `/tools/`, e2e against preview at both base paths, image smoke test (read-only, no capabilities), e2e in the egress-less Docker network with header checks, Trivy (0 HIGH/CRITICAL), actionlint, and the Docker-only loop (`make new-tool` → files owned by the host user, hot reload, `make remove-tool`, `make build up`). **Decisions:** a minimal UI-kit slice (TextArea, CopyButton with execCommand fallback, ErrorMessage, TwoPane, useWorker, worker RPC) was pulled into Phase 0 because the scaffolder's template needs it; Phase 1 completes the kit. `bluetooth` dropped from Permissions-Policy (unrecognized by Chromium). The e2e fixture ignores one benign console error: Chromium ignores COOP on plain-HTTP origins. Astro's Markdown Shiki highlighter is turned off (CSP). `astro preview` runs with `--ignore-lock` in Playwright because Astro 7.2+ auto-backgrounds it when it detects an agent. The Playwright image ships Node 24, so its stage sets `npm_config_engine_strict=false`. Run dev compose through `make` so UID/GID are passed. Phase 0 has no dark/light toggle yet: colors follow `prefers-color-scheme`. **Deferred:** Caddy/HTTPS overlay, release workflow and scheduled rebuilds (Phase 4); `check-budget` and Lighthouse CI (Phase 1); `is:inline` scripts are not hashed by Astro, so the theme bootstrap script in Phase 1 needs a manual hash. |
| 2026-10-18 | 1     | **Phase 1 done; tool contract frozen (5.5).** Built: the full UI kit (inputs incl. `AlgorithmSelect`, `Button`, `CopyButton` with HTTP fallback, `DownloadButton`, `FileDropZone`, `OutputRegion`, `KeyValueList`, `ResultTable`, `LoadingState`, `LegacyNotice`, `SandboxedPreview`, `ExampleButton`, `ShareButton`, `RememberToggle`; hooks `useWorker`, `useDebounced`, `usePersistentState`, `useShareableState`); dark/light/system theme switch; five new templates (`text-transform`, `generator`, `file-processor`, `diff`, `reference-table`) with CI scaffolding, checking and e2e-testing one tool per template; the 10 pilots (`hash-text` in a worker, `base-encoder`, `json-format`, `ipv4-subnet`, `uuid-generator`, `case-converter`, `color-converter`, `crontab`, `regex-tester` in a worker with a 2 s timeout, `qr-generator`); `check-budget` (static per-page JS graph, gzip) and Lighthouse CI. Verified locally: everything from Phase 0 plus 156 unit tests, 53 e2e tests at both base paths against preview and the egress-less container (including ReDoS termination, worker hashing of 2 MB, local blob downloads, remember/share, clipboard fallback over plain HTTP), budget (largest page 28.8 KB gzip, home 0.7 KB) and Lighthouse on 6 pages (performance ≥ 0.95, accessibility 1, best practices ≥ 0.95). **Decisions:** `meta.ts` uses `const meta: ToolMeta = …` instead of `satisfies` so optional fields stay typed for the UI. The theme bootstrap script sits at the start of `<body>` because Astro appends the CSP `<meta>` to the end of `<head>`; its hash is added in `astro.config.ts`. Tool sections are `min-h-screen` so output that appears after hydration doesn't shift the footer (Lighthouse CLS 0.19 → 0). CRC32, Adler-32, xxHash64 and Ascii85 are hand-written (small, no suitable bundled library) and cross-checked against `hash-wasm` (dev-only oracle) and Python-generated vectors. Base58 is capped at 2,048 bytes/4,096 characters (the @scure/base limits). The JSON formatter keeps big numbers exact with `JSON.rawJSON`. `usePersistentState` writes in a layout effect so quick reloads don't lose changes. `ToolShell` was dropped: `ToolLayout` + `TwoPane` cover it. New shipped dependencies (all on the allowlist): @noble/hashes, @scure/base, culori, croner, cronstrue, uqr, js-xxhash, dompurify. **Deferred:** `SandboxedPreview` has no consumer until `markdown-editor` (Phase 2), so its e2e test lands then; Trusted Types evaluation stays in Phase 3. |
| 2026-10-18 | 2.1   | **Batch 1 (Text + Converter) done, tagged v0.1.0.** Added `batch-tools` (`--skip-existing`, `--only`, `--dry-run`) and `catalog/01-text-converter.json`; 32 new tools, so every Text and Converter entry in 19.2 now exists (43 tools in total); shared `src/lib/csv.ts` (RFC 4180) and `src/lib/time-zones.ts` (Intl only). Verified: lint, typecheck, strict validator, licenses, 421 unit tests (with RFC 3492/4648/2045/2152 vectors, Python-generated QP/UTF-7/Ascii85 vectors), 146 e2e tests against preview and the egress-less container at both base paths, smoke test, budget (largest page: data-format-converter 74.6 KB gzip). **Decisions:** the first real `SandboxedPreview` consumer (markdown editor) surfaced three issues, all fixed and covered by an e2e test with hostile Markdown: (1) loading `preview.css` from the opaque-origin sandbox was blocked by our own `Cross-Origin-Resource-Policy: same-origin`, so the preview CSS is now inlined and its hash added to `style-src` in `astro.config.ts` (no request at all, works on any static host); (2) Chrome reports a `script-src-attr` violation as soon as DOMPurify parses an element with an `on*=` attribute, so handlers are stripped from tags before parsing; (3) media in previews may only use `data:`/`blob:` URLs — anything else, relative URLs included, is removed and marked "external content blocked". Markdown "Print / save as PDF" opens the sanitized document from a `blob:` URL with a `default-src 'none'` CSP and calls `print()`. The e2e fixture ignores the console error from Playwright's own init script being blocked inside the sandbox, and axe skips iframes. `string-obfuscator` is marked `sensitive`. `text-to-speech` lists only `localService` voices. `emoji-picker` and `ascii-art` are `heavy`: Emojibase data and each FIGlet font are separate lazy chunks, and figlet's `fetchFontIfMissing` is switched off. `scan-dist.allow.json` gained three never-fetched URLs (FIGlet font credits, a marked error message). Batch 1 has no ᴹ merge candidates. **Deferred:** the data format converter could lazy-load its YAML/TOML/XML parsers per format; the table converter has no grid editor yet (CSV/Markdown text editing covers it for now). |
| 2026-10-24 | 2.2   | **Batch 2 (Development) done.** Added `catalog/02-development.json`; 24 new tools, so every Development entry in 19.2 except `sqlite-browser` (P5) now exists (67 tools in total): six searchable cheatsheets (Git, regex, Docker, Kubernetes, Vim, tmux), `random-port`, `chmod-calculator`, `email-normalizer`, `string-escaper`, `semver`, `xml-formatter`, `yaml-formatter`, `sql-formatter`, `json-schema`, `json-to-types`, `json-query` (JSONPath), `docker-compose-converter`, `dockerfile-linter`, `patch-applier`, `gitignore-generator`, `k8s-manifest`, `mock-data` and `code-to-image`. New dependencies: sql-formatter, @faker-js/faker, @cfworker/json-schema, jsonpath-plus, semver, prismjs. First bundled datasets, with `scripts/refresh-data.ts` dispatching to `scripts/datasets/<name>.ts`, `docs/datasets.md`, and credits on the licenses page: `gitignore-0e5d690.json` (github/gitignore, CC0, 312 templates, 57 KB gzip) and `k8s-v1.37.1.json` (28 kinds derived from the Kubernetes OpenAPI spec, Apache-2.0, 10.5 KB gzip). New `tests/e2e/dev-tools.spec.ts` covers the worker and dataset paths that `meta.examples` can't (mock-data, code-to-image, gitignore-generator). Verified: strict validator, licenses, audit, typecheck, lint, 944 unit tests, builds at `/` and `/tools/`, e2e against preview at both base paths (224) and in the egress-less container at both base paths (225), smoke test, and the budget (largest page is still data-format-converter at 75.6 KB gzip; the largest new one is docker-compose-converter at 57.1 KB). **Decisions:** `argparse` (Python-2.0; used only by sql-formatter's CLI and never bundled) is a user-approved license exception. `scan-dist.allow.json` gained never-fetched strings: the @cfworker/json-schema fallback base URI, Prism's @license/@author comment, and faker's error texts, image-module URL templates and Googlebot UA string. faker always bundles its image module, but mock-data offers no image, avatar or URL fields. Libraries run only where the CSP allows: jsonpath-plus always uses `eval: 'safe'`, Prism uses `tokenize` only (never HTML output) with `manual` set before core loads, and its main bundle is avoided because it includes a network-loading plugin. `mock-data` and `code-to-image` run faker and Prism in workers (not tagged W in 19.2): this keeps them out of the page bundle and makes slow grammars and large schemas stoppable. mock-data always seeds from `crypto.getRandomValues` or the user's seed, and adds a "dates relative to" field so a seed reproduces the same data. sql-formatter is a lazy chunk (about 74 KB gzip) and the formatter is passed into `logic.ts`. yaml-formatter replaces yaml's quadratic duplicate-key check with a linear one. k8s schemas reject unknown fields (`additionalProperties: false`) and YAML is read with 1.1 rules, as Kubernetes does. The Dockerfile linter uses its own rule IDs and wording (hadolint is GPL-3.0). Tool names: "Docker run to Compose" (`docker-compose-converter`) and "JSONPath playground" (`json-query`). Batch 2 has no ᴹ merge candidates. **Deferred:** jq for `json-query` (P5) and `sqlite-browser` (P5); `json-schema` validates on the main thread, so a catastrophic user `pattern` could freeze the tab, and moving it to a worker is open; sql-formatter has no safe minify mode. |
| 2026-10-24 | CI    | **CI moved to self-hosted runners, with continuous deployment.** At the user's request, `ci.yml` runs on `[self-hosted, linux, x64]` (override with the `XT_RUNNER_LABELS` repository variable) for pushes to `main` and manual runs. Pull requests stay on `ubuntu-latest` because the repository is public. A new `deploy` job runs after every green push to `main` (and on manual runs on `main`): `scripts/deploy.ts` builds `xt-tools:sha-<short>` with the host's Docker, writes `compose.yaml` and `.env` into `XT_DEPLOY_DIR` (default `~/xt-tools`), runs `docker compose -p xt-tools-prod up -d --wait`, checks `/healthz` and the base path on the host port, and rolls back to the previous image on failure. It keeps the live and previous images and removes older ones. Defaults: port 3125 and base `/`, changeable with the repository variables `XT_PORT`, `XT_BIND`, `BASE_PATH` and `SITE_URL`. The job uses the `production` environment and the `deploy-production` concurrency group; `make deploy` does the same by hand. **Changes for a shared, non-ephemeral host:** each job uses unique Compose project, image and container names and cleans up with `if: always()`. Reports written by the root-run Playwright container are handed back to the runner user. The scaffolding job's e2e run now uses the Compose test profile (Playwright image) instead of `playwright install --with-deps`, which needs root; its test image sets `XT_VALIDATE_STRICT=0` because the temporary `ci-*` tools intentionally keep their `XT-TODO` placeholders (production builds stay strict). Lighthouse runs in the Playwright image in the site container's network namespace, so it still audits `http://localhost:8080` without a host browser or a published port. `compose.yaml` gained an `XT_IMAGE` variable (default unchanged). The deploy script is Node `.ts` (D17), so the deploy job sets up Node. Verified locally: actionlint (only the earlier shellcheck style warnings remain), the containerised Lighthouse run (all assertions pass), and deploy, redeploy, rollback and setting validation with `scripts/deploy.ts`. Documented in `docs/self-hosted-runner.md`. |
| 2026-10-24 | 2     | **Added `docker-compose-builder` at the user's request (68 tools).** A form-based Compose file builder, separate from `docker-compose-converter`: service tabs (add, duplicate, remove), image/build, container name, restart policy, ports, expose, volumes, environment rows, env files, command/entrypoint, working directory, user, hostname, dependencies with conditions, network attachments, declared volumes/networks (external, driver), and per-service/top-level "extra" YAML mappings for every other Compose key. It generates YAML 1.1 with quoted ports, auto-declares referenced named volumes and networks with warnings, imports an existing compose.yaml (unrecognized keys are preserved in the extra mappings), and offers Copy/Download. Added to 19.2 (Development is now 29 entries, 181 pages) and `catalog/02-development.json`. 67 unit tests cover generation, validation, import/round trips and robustness. **Decisions:** no new dependencies; short port/volume syntax only in the form (long syntax belongs in the extra YAML); imported command/entrypoint lists are shell-joined with best-effort quoting. `tests/e2e/dev-tools.spec.ts` also covers multi-service editing, import and download. Verified: strict validator, typecheck, lint, 1011 unit tests, builds at `/` and `/tools/`, 228 e2e tests against preview at both base paths, 229 in the egress-less container at both base paths, the smoke test and the budget (84 pages, largest 75.6 KB gzip). |
| 2026-10-24 | 2     | **Pins, curated groups and personal collections.** Text, Converter and Development tools now belong to a curated group (`meta.group`, required only for categories that define groups; the contract change was requested). The home page shows pins first and keeps the full catalog underneath, with category chips that jump on the page. Personal collections, including one level of sub-collections, live in localStorage (`collections`) beside pins (`favorites`, newest first, cap 48). A collections page creates, renames and deletes them and adds or removes tools. **Decisions:** categories with only a few tools stay flat; groups are one deep; personal collections are one deep; the home grid stays in the static HTML so it still works without JavaScript. Recents and search stay deferred to Phase 3. |
| 2026-10-24 | 2     | **Network lookups, as an exception.** At the user's request, a tool may contact a named HTTPS service the way sharevb/it-tools does, without opening the rest of the site. `meta.network.hosts` must be a subset of `src/lib/network-allow.ts`. `networkFetch` is the only cross-origin `fetch`, and it is GET, credential-free, and does not follow a redirect. CSP `connect-src` lists those origins. The page notice and the Network badge name the hosts. Nothing is sent on load, so the end-to-end suite still fails on any external request. Added `ip-lookup` (ipify and ipwho.is), `dns-lookup` (Cloudflare DNS-over-HTTPS), `whois-lookup` (.com, .net, .org and ARIN RDAP) and `currency-converter` (Frankfurter, ECB rates; same-currency math stays local). Catalog is 185 pages. **Not taken from it-tools:** ping, port tests and the Docker image downloader, which need their companion containers; Plausible analytics; machine-translated i18n (D16); a runtime `BASE_URL` (Astro bakes asset paths); mounting a tool filter over the HTML catalog (pages would still be reachable); splitting merged tools (D6); copying GPL code. PWA stays in Phase 3. Verified: strict validator (72 tools), check, lint, 1064 unit tests, build with scan-dist clean and the largest page at 78.0 KB gzip, end-to-end tests for the four tools (axe, and no request while typing), and live lookups for example.com DNS and registration, USD to EUR, a same-currency conversion that stays local, and this connection's public IP. |
| 2026-10-24 | 3     | **Offline and PWA.** `scripts/gen-sw.ts` runs `workbox-build` 7.4.1 `generateSW` after the Astro build (`swDest: dist/sw.js`) and is wired into `postbuild` before `gen-csp`. The worker is registered from a bundled module with `workbox-window` 7.4.1, not an inline script. A new version shows an "Update available, reload" prompt. Precache covers the shell, every HTML page, `search-index.json`, CSS and the static JS graph of every page. WASM, `data/*` and lazy chunks are cache-first at runtime (`matchOptions.ignoreVary`, because a module import sends `Origin` and Download everything's fetch does not, while some servers send `Vary: Origin`; Workbox also tests that route against the full request URL), and `heavy-assets.json` lists them for Settings → Download everything (with progress and `navigator.storage.persist()`). Settings also has the theme, a storage estimate and Clear all local data (localStorage, Cache Storage, IndexedDB, service worker). `manifest.webmanifest` uses the build-time base path for `start_url` and `scope`, with local PNGs in `public/icons/` (regenerated by `scripts/gen-icons.ts`). Over plain HTTP the banner says "Offline mode needs HTTPS." `tests/e2e/offline.spec.ts` allows service workers; the rest of the suite still blocks them. The container suite loads `http://site:8080`, which is not a secure context, so it checks the HTTPS banner and that Download everything stays hidden. The offline tool run happens on localhost or HTTPS. **Decisions:** `generateSW` has no scope field, so the scope is the base path passed at registration. nginx already sends `Cache-Control: no-cache` for `sw.js`, `workbox-*.js` and the manifest. Workbox's runtime contains a never-fetched documentation URL in its unrevisioned-precache warning (`https://bit.ly/wb-precache`); every precache entry has a revision, so it is allowlisted. **Deferred:** Ctrl/Cmd+K search, recents, Trusted Types and the full accessibility pass stay in Phase 3. |
| 2026-10-24 | 2     | **Phase 2 lightweight catalog done (174 tools).** Batches 3–9 add Lightweight Crypto, the rest of Network, Web, Math, Measurement, Data, Design, and canvas-only Images and media. Specs are `catalog/04-crypto.json` through `catalog/10-images-media.json` (102 new tools). Every untagged page in 19.2 now exists. Still deferred to Phase 5: `password-hash`, `pgp`, `pdf-signature`, `sqlite-browser`, `video-to-gif`, `pdf-tools`, `pdf-image-extractor`, `pdf-to-images`, jq WASM and image WASM codecs. Still deferred to Phase 6: `metadata-remover`, `secure-note` and `password-export-viewer`. **ᴹ candidates kept as separate pages:** `curl-converter` and `http-snippet`, `math-evaluator` and `unit-calculator`, `qr-generator` and `wifi-qr`. **Decisions:** AES-GCM uses `@noble/ciphers`, so text and file encryption work on plain HTTP; RSA, CSR generation and other WebCrypto-only paths declare `requires`. TripleDES, Rabbit and RC4 are decrypt-only. Bcrypt (bcryptjs, in a worker) accepts cost 4–12 and defaults to 10. Diceware loads the EFF large wordlist with a dynamic import and is flagged `heavy` even though 19.2 did not mark it H, so the list stays out of the static graph. `image-converter` draws on the main-thread canvas and does not ship a worker; WASM codecs stay in Phase 5. `svg-optimizer` is a small hand-written cleaner, with no SVGO, and stays flagged heavy. MAC vendors use the IEEE MA-L, MA-M and MA-S lists (`public/data/oui-2026-10.json`, 54,289 prefixes, `scripts/datasets/oui.ts`), not a GPL manuf file. Math, the unit calculator and the graph plotter share `src/lib/safe-expr.ts` and never call eval. No new network hosts. Camera, microphone and display capture start only from a button. New exact dependencies, all on the license allowlist: `@noble/ciphers`, `@noble/curves`, `@scure/bip39`, `bcryptjs`, `@zxcvbn-ts/core` with its English dictionaries, `libphonenumber-js`, `bowser`, `mime-db`, `jsqr`, `exifr` and `acorn`. Credits: the IEEE OUI list is on the licenses page and in `docs/datasets.md`; the EFF Large Wordlist (CC-BY-4.0) is on the licenses page. Rolldown's CJS interop error string (`https://rolldown.rs/in-depth/bundling-cjs`) is allowlisted: it is thrown only when bundled code calls `require` and the browser has none, and it is never fetched. The screen ruler is sized to its container so the page has no keyboard-inaccessible scroll region. The collections end-to-end test waits for hydration before it creates a collection. **Verified:** strict validator (174 tools), licenses (65 packages), typecheck, lint, 1562 unit tests, builds at `/` and `/tools/` (scan-dist clean, largest page 80.6 KB gzip, 62 heavy assets), and 589 passing end-to-end tests (8 skipped) against preview at `/tools/`, including axe in both themes. **Deferred:** search, recents, Trusted Types and the full accessibility pass stay in Phase 3. |
| 2026-10-24 | 2     | **Image build installs OpenSSL and OpenSSH.** The Alpine build stage runs the unit tests. `csr-tool` and `ssh-keygen` shell out to `openssl` and `ssh-keygen`, which `node:26-alpine` does not ship, so the image jobs and the scaffolding loop failed before the site was built. The build stage now installs `openssl` and `openssh-client`. The runtime image still copies only the static files. |
| 2026-10-24 | 2     | **Password tools.** Password strength was already in the catalog (zxcvbn, dictionaries loaded lazily). Added `password-generator`: character-set passwords (length, sets, ambiguous characters excluded by default, every selected set used at least once) and EFF Diceware passphrases (word count, space/hyphen/none, optional capitals), sharing the Diceware wordlist and its unbiased draw. `token-generator` is now Random bytes, a local `openssl rand`: 1 to 1,048,576 bytes, hex, base64 (wrapped at 64 columns), base64url, or a raw binary download, with the matching openssl command shown. Catalog is 186 pages. Verified in the browser: zxcvbn on "password", a 12-character password, a 6-word passphrase, and hex, base64 and raw download. |
| 2026-10-24 | 3     | **Search bar and tool tags.** Every tool has 1–4 public `tags` (the contract change was requested) shown on its card and page. Keywords stay the longer alias list. The header search is a combobox on every page, focused with Ctrl+K, Cmd+K or `/`. It ranks the title, then tags, keywords and the description, and every query word has to match. A longer word can miss by one or two edits. The catalog JSON loads the first time the bar is used. Clicking a tag fills the bar with that tag. **Decision:** a small local ranker instead of Fuse.js, so those weights stay explicit and the page does not take on another library. Recents, Trusted Types and the full accessibility pass stay in Phase 3. |
| 2026-10-24 | 3     | **Search uses Fuse.js.** The header combobox, tags and `search-index.json` stay. Ranking is Fuse.js 7.5.0, loaded the first time someone searches, with the title weighted above tags, keywords and the description. Every query word has to match; a longer word can miss by one or two edits. Fuse still returns some weak hits, so those are dropped before the list is shown. The hand-written ranker is gone. |
| 2026-10-24 | 4     | **v1.0 release machinery, not yet tagged.** `release.yml` publishes multi-arch images to GHCR (`edge` and `sha-<short>` from `main`; `X.Y.Z`, `X.Y` and `latest` from a `v*` tag) with provenance and an SBOM. A `v*` tag also attaches the root-path site zip, `SHA256SUMS` and `sbom.spdx.json` to the GitHub release. The zip includes `server-configs/` plus the CSP snippets generated for that build. `scheduled.yml` rebuilds `edge` every Monday and runs Trivy; GitHub disables that schedule after 60 days without repository activity. `compose.https.yaml` and `deploy/Caddyfile` add Caddy (`make up-https`, `make caddy-ca` for a LAN `tls internal` CA). Docs: README quick start, `SECURITY.md`, `docs/threat-model.md`, `docs/deployment.md` (including the secure-context matrix), `docs/reverse-proxy.md`, `docs/air-gap.md`. **Decisions:** release and the weekly rebuild run on `ubuntu-latest` because the self-hosted runners are amd64 only and multi-arch needs QEMU. Caddy is not `cap_drop: ALL`, because binding 443 needs `NET_BIND_SERVICE`. The first GHCR push creates a private package; it has to be set public once. `v1.0.0` is not tagged yet. Recents, Trusted Types and the full accessibility pass were still open at the end of Phase 3. |
