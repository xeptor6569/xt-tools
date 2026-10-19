# AGENTS.md

xt-tools is a privacy-first, offline, self-hostable static browser toolbox (Astro 7 + Preact islands + Tailwind v4, served by nginx in Docker). Nothing may leave the browser: no network calls, no CDNs, no telemetry.

- `PLAN.md` is the authoritative spec. It covers the decisions D1–D18, the catalog in §19, the phases in §20 and the progress log in §22. Read the relevant section before starting a phase or batch. Append a progress-log row when a batch finishes, including any deviations from the plan.
- `CONTRIBUTING.md` documents the tool contract and the scaffolder for humans.

## Commands

Node 26 is required (`engine-strict`, `save-exact` in `.npmrc`). Scripts are run as plain `.ts` with `node`.

- `npm run check`: `astro check` plus `tsc`.
- `npm run lint`: ESLint plus `prettier --check`. Fix formatting with `npm run format`.
- `npm test`: Vitest. Run one file with `npx vitest run src/tools/<id>/logic.test.ts`.
- `npm run validate-tools -- --strict`: the contract validator, as CI runs it. The pre-commit hook runs it without `--strict`.
- `npm run check-licenses`: run it after adding any dependency. Exceptions go in `scripts/licenses.allow.json`.
- `npm run build`: `astro build` followed by `scripts/postbuild.ts`, which generates the CSP, scans `dist/` for URLs, checks the JS budget and precompresses. A build fails if any of these fail.
- Build with a base path: `BASE_PATH=/tools/ npm run build`. CI builds and tests both `/` and `/tools/`.
- E2E against the current `dist/`: `npm run test:e2e`.
  - It serves `dist/` with `astro preview`, so build first, using the same `BASE_PATH` for both commands.
  - Never e2e-test against `astro dev`, because the CSP is off in dev mode.
- E2E against the real image on a network with no internet access: `make test-e2e`, or `BASE_PATH=/tools/ make test-e2e`. This is the authoritative e2e run and takes a few minutes.
- `make smoke`: smoke-tests the production image.
- Run dev containers through `make` (`make dev`, `make shell`) so UID/GID are passed in. Don't call `docker compose -f compose.dev.yaml` directly.
- CI order (`.github/workflows/ci.yml`): validate --strict, licenses, audit, check, lint, test, build at both base paths, then image build, smoke and container e2e.

## Tools: the contract is frozen

- Each tool lives in `src/tools/<id>/`:
  - `meta.ts` is required. Write it as `const meta: ToolMeta = {...}; export default meta;`.
  - `logic.ts` and `logic.test.ts` hold pure logic and its tests. Bad input throws `ToolInputError`.
  - `ui.tsx` is optional. So is `worker.ts`, loaded via `useWorker` / `src/lib/worker-rpc.ts`.
- Tools are discovered by `import.meta.glob` in `src/tools/registry.ts`. Don't register them anywhere by hand.
- `meta.examples` are run by both the unit tests and `tests/e2e/tools.spec.ts`, so they must stay correct.
- Scaffold tools; don't hand-create them:
  - `npm run new-tool -- <id> --name ... --category ... --template ...`
  - The templates are in `scripts/templates/`.
  - To create a batch from a catalog spec: `npm run batch-tools -- catalog/<nn>-<name>.json --skip-existing --only a,b [--dry-run]`.
- Unit tests use `expectRobust` from `tests/helpers/expect-robust.ts`. Use published RFC/reference vectors where they exist.
- UI test hooks are `data-xt="input" | "output" | "error"`. Build UI from the shared kit in `src/components/ui/`.
- Meta flags:
  - `sensitive`: input is never persisted or shared.
  - `heavy`: big data or libraries must be lazy chunks.
  - `requires`: lists browser capabilities the tool needs.
- Legacy or broken ciphers are decrypt-only (see `LegacyNotice`/`LegacyWarning`).
- Merge overlapping tools. For ᴹ merge candidates in §19, ask the user at the start of that batch.

## Hard constraints (never weaken them to make tests pass)

- **CSP** (`astro.config.ts`):
  - Inline `style=` attributes and inline event handlers are blocked.
  - Every inline `<script>`/`<style>` needs its hash in `astro.config.ts`. Today those are the theme bootstrap at the start of `<body>` and `PREVIEW_CSS` from `src/lib/preview-css.ts`.
  - If you edit either one, update its hash.
- **ESLint bans:** `fetch`, `Math.random` (use `crypto.getRandomValues`), `innerHTML`, `style=`, and `href="/..."` literals. Use `href()`/`toolHref()` from `src/lib/href.ts` so base paths keep working.
- **`scan-dist`** fails on absolute URLs in `dist/`. Only URLs that are never fetched (credits, error strings) may be allowlisted, in `scripts/scan-dist.allow.json`, with a reason.
- **Libraries must not fetch at runtime.** Turn off options like figlet's `fetchFontIfMissing`. Load bundled assets via `src/lib/load-local-asset.ts`. Text-to-speech uses `localService` voices only.
- **Untrusted HTML** must go through `src/lib/sanitize.ts` and be rendered in `SandboxedPreview`.
  - The sandbox has an opaque origin. nginx sends `CORP: same-origin`, so the iframe cannot load same-origin files, and its styles must stay inline.
  - Previews keep media only if it uses `data:` or `blob:` URLs.
- **JS budget:** each page must stay at or below 150 KB of gzipped JS (`scripts/check-budget.ts`). Lazy-load anything big.

## E2E fixture quirks (`tests/e2e/fixtures.ts`)

- Tests fail on any of these: external requests, CSP violations, console errors, or same-origin 4xx/5xx responses.
- Two console messages are deliberately ignored:
  - COOP being ignored over HTTP.
  - Playwright's init script being blocked in `about:srcdoc`.
- axe excludes `[data-xt="preview"]` and runs without iframes.
- The Clipboard API is unavailable in the container (plain HTTP). Assert copies with the `trackCopies`/`lastCopied` helpers in `tests/e2e/ui-kit.spec.ts`, not by reading the clipboard.

## Workflow

- Work happens on `main` (remote `xeptor6569/xt-tools`). Ask the user before committing or pushing at the end of a phase or batch.
- After pushing, watch CI with `gh run watch <id> --exit-status`.
- Each batch gets one annotated tag `v0.x.0`, created only after CI is green.
- Commit style is Conventional Commits, e.g. `feat(text): ...`, `fix(docker): ...`.
- The pre-commit hook (`.githooks/`, installed by `npm install`) runs Prettier, ESLint and the validator on staged files.
