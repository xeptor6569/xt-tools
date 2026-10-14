# Contributing to xt-tools

Thanks for helping. Every tool lives in its own folder and registers itself, so adding one never means editing a central list. The full design is in [PLAN.md](PLAN.md); this page is the practical part.

## Requirements

- **Docker only:** everything runs through `make` targets in a dev container.
- **Or Node 26** (see `.nvmrc`) and npm, if you prefer running things directly.

## Add a tool in five steps

| Step                       | With Docker only                              | With local Node                                                           |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Scaffold                | `make new-tool` (interactive)                 | `npm run new-tool`                                                        |
| 2. Develop with hot reload | `make dev`, then open <http://localhost:4321> | `npm run dev`                                                             |
| 3. Test                    | `make test`                                   | `npm run validate-tools && npm test && npm run build && npm run test:e2e` |
| 4. Check style and types   | `make lint`                                   | `npm run check && npm run lint`                                           |
| 5. Deploy                  | `make build up`                               | `docker compose up -d --build`                                            |

Non-interactive scaffolding (handy in scripts):

```sh
make new-tool ARGS="jwt-debugger --name 'JWT debugger' --category crypto \
  --description 'Decode, sign and verify JSON Web Tokens.' --keywords 'jwt,token' --sensitive --yes"
# or: npm run new-tool -- jwt-debugger --name ... --yes
```

Options: `--requires camera,microphone`, `--sensitive`, `--heavy`, `--worker` (also scaffolds a Web Worker), `--template`. Run `npm run new-tool -- --help` for the full list. `make remove-tool ARGS="jwt-debugger --yes"` deletes a tool and its page.

The scaffolder creates:

```
src/tools/<id>/meta.ts         metadata (the contract below)
src/tools/<id>/logic.ts        pure logic: no DOM, no framework, no storage
src/tools/<id>/logic.test.ts   unit tests
src/tools/<id>/ui.tsx          Preact UI built from src/components/ui/
src/tools/<id>/worker.ts       optional, with --worker
src/pages/tools/<id>.astro     thin page; don't put logic here
```

The new tool appears on the home page, its category page, the search index and the end-to-end suite automatically. Replace every `XT-TODO` before opening a pull request: CI runs the validator in strict mode.

## The tool contract

`meta.ts` exports an object that `satisfies ToolMeta` (`src/tools/types.ts`). Use only `import type` in it, so plain Node can load it.

| Field         | Rule                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| `id`          | kebab-case, equals the folder name                                                     |
| `name`        | 2–40 characters; also the page heading                                                 |
| `description` | one sentence, 20–160 characters, ending with a period                                  |
| `category`    | an id from `src/categories.ts`                                                         |
| `keywords`    | lowercase search terms                                                                 |
| `added`       | `YYYY-MM-DD`; tools added in the last 30 days get a "New" badge                        |
| `sensitive`   | the tool handles secrets: nothing is stored or put in the URL                          |
| `requires`    | capabilities from `src/capabilities.ts`, e.g. `camera`, `webcrypto`                    |
| `heavy`       | the tool lazy-loads WASM or large data                                                 |
| `legacy`      | warning text when the whole tool is legacy                                             |
| `examples`    | `{ input, expect }` pairs; the end-to-end suite types each input and checks the output |

In `logic.ts`, throw `ToolInputError` (from `src/tools/types.ts`) for problems with the user's input; the UI shows its message inline. Any other exception is treated as a bug.

## Definition of done

- Logic is pure and unit-tested, with known test vectors where they exist, and passes `expectRobust()` (empty, 5 MB and malformed input).
- Errors are shown inline; nothing crashes.
- Copy and download work where relevant, including over plain HTTP.
- Keyboard-only use works and axe reports no violations in light and dark mode.
- No network requests: the validator, `scan-dist` and the end-to-end suite all pass.
- `sensitive`, `requires`, `heavy` and legacy labels are set where they apply. Secure algorithms are the default.
- At least one `examples` entry for text-in/text-out tools.

## Rules that CI enforces

- **No network access.** `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon` and WebRTC are banned by lint. Load bundled files with `loadLocalAsset()` from `src/lib/load-local-asset.ts`. The built site is scanned for external URLs, and the end-to-end suite fails on any request to another origin.
- **Strict CSP.** No `eval`/`new Function`, no inline `style` attributes, no inline event handlers, no `innerHTML` or `dangerouslySetInnerHTML`. Untrusted HTML will be rendered in a sandboxed preview component (Phase 1).
- **Base path.** Build internal links with `href()` from `src/lib/href.ts`, never `"/..."` literals.
- **Randomness.** Use `crypto.getRandomValues`, never `Math.random`.
- **Dependencies.** Everything is bundled locally. Ask before adding a dependency over roughly 100 KB gzipped to a non-heavy tool. Shipped licenses must be on the allowlist in `scripts/licenses.allow.json`. Put browser-shipped libraries in `dependencies` and build tooling in `devDependencies`.
- **Formatting.** Prettier and ESLint run in a pre-commit hook (enabled by `npm install`) and in CI.

## Testing details

- `npm test` runs Vitest over `src/**/*.test.ts` and `tests/unit/`.
- `npm run test:e2e` builds nothing: run `npm run build` first. It serves `dist/` with `astro preview` (CSP is off in `astro dev`, so it's never tested there). Set `BASE_PATH=/tools/` for both commands to test a sub-path build.
- `make test-e2e` builds the production image and runs Playwright against it from a container on a Docker network with no internet access, including the security-header checks.
- `npm run smoke` (or `make smoke`) starts the image read-only with all capabilities dropped and checks health, headers, caching, deep links and the 404 page.

Use `make` rather than calling `docker compose -f compose.dev.yaml` directly: the Makefile passes your user and group IDs so files created in the container belong to you.
