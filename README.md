# xt-tools

> Your toolbox, your server, no internet required.

xt-tools is a self-hostable collection of 100+ privacy-first developer and everyday tools that run entirely in your browser. There's no tracking and no server-side processing, and the code makes no network calls. Host it with one Docker command, or put the static files on any web server, and it keeps working offline as an installable PWA.

> [!NOTE]
> **Status: Phase 0 (foundation) done.** The site, scaffolder, validator, Docker image and CI work, with one reference tool (Slugify). No image is published yet, so build it from source (see [Run it now](#run-it-now)). The full build plan, including decisions, architecture, tool catalog and phases, is in **[PLAN.md](PLAN.md)**.

## Principles

- **Nothing leaves your device.** No analytics, CDNs, remote fonts or telemetry. Six layers enforce this: lint rules, a validator, a scan of the built files, a strict Content Security Policy, end-to-end tests that fail on any external request, and tests run on a network with no internet access.
- **Works offline.** After the first visit, the site keeps working without a connection. This needs HTTPS or `localhost` ([why](#https-and-secure-contexts)).
- **Self-host anywhere.** The output is plain static files: nginx, Apache, Caddy, shared hosting or a NAS all work. The Docker image runs as a non-root user on a read-only filesystem.
- **Small and fast.** Each page loads only its own code, at most 150 KB of gzipped JavaScript. Heavy tools (PDF, ffmpeg, SQLite, Argon2, OpenPGP) download their WASM only when you use them.
- **Easy to extend.** One folder per tool, registered automatically. A new tool takes one command to create.

## What's included (planned)

About 180 tools in 13 categories:

| Category         | Examples                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crypto           | Hashing, AES-GCM text and file encryption, bcrypt and Argon2, JWT debugger, TOTP, BIP39, Shamir secret sharing, SSH/RSA/Ed25519 keys, X.509 and CSR, PGP |
| Converter        | Date-time, base encoders, JSON/YAML/TOML/XML/CSV/.env, colors, units, time zones, Morse code                                                             |
| Web              | URL and HTML encoders, CSP builder, security headers, cURL converter, user-agent parser, minifiers, email header analyser                                |
| Images and media | QR codes (create and read), image convert/resize/compress, EXIF viewer, screen, camera and audio recorders, video to GIF                                 |
| Development      | JSON tools, regex tester, cron, SQL formatter, JSON Schema, JSON to types, SQLite browser, cheatsheets                                                   |
| Network          | IPv4/IPv6 subnet calculators, CIDR tools, MAC vendor lookup, DNS record builder, WireGuard config generator                                              |
| Math             | Expression evaluator, statistics, matrices, loans, date differences, graph plotter                                                                       |
| Measurement      | Chronometer, timers and Pomodoro, world clock, metronome, screen ruler                                                                                   |
| Text             | Diff, statistics, case and Unicode tools, Markdown editor, invisible character detector, text to speech                                                  |
| Data             | IBAN, Luhn, ISBN/EAN, VAT and phone validators, ISO codes, geohash, CSV editor                                                                           |
| Privacy          | Metadata remover, encrypted local note, password manager export viewer                                                                                   |
| Documents        | PDF merge, split, rotate and compress; image extraction; PDF to images                                                                                   |
| Design           | Gradients, box shadows, CSS `clamp()`, WCAG contrast checker, font pairing                                                                               |

The full list, with tool IDs and phases, is in [PLAN.md § 19](PLAN.md#19-tool-catalog).

## Run it now

With Docker installed:

```sh
git clone https://github.com/xeptor6569/xt-tools.git && cd xt-tools
make build up    # builds the image and serves it on http://localhost:8080
make down        # stop it
```

Or with Node 26: `npm ci && npm run build && npx astro preview`.

## Quick start (planned for v1.0)

### Docker

```sh
docker run -d --name xt-tools -p 8080:8080 \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  --restart unless-stopped \
  ghcr.io/xeptor6569/xt-tools:latest
```

Then open <http://localhost:8080>.

### Docker Compose

```sh
git clone https://github.com/xeptor6569/xt-tools.git && cd xt-tools
cp .env.example .env
make up          # HTTP on port 8080
make up-https    # HTTPS via Caddy (Let's Encrypt, or an internal CA for LANs)
```

### Other deployment options

- **Sub-path** (for example `https://example.com/tools/`): the base path is compiled into the site, so build the image yourself with `make build BASE_PATH=/tools/`.
- **Air-gapped machines:** run `make export` on a connected machine, copy `xt-tools.tar.gz` across, then run `make import up`.
- **Behind an existing reverse proxy:** examples for Traefik and nginx will be in `docs/reverse-proxy.md`.
- **Any static host:** each release will include a zip of the built site, with ready-made header configs for nginx, Apache and Caddy.

Image tags: `latest` is the newest release, `X.Y` and `X.Y.Z` pin a version, and `edge` follows `main`.

## HTTPS and secure contexts

Browsers turn off some features on plain HTTP unless the address is `localhost`. A typical example is a LAN address such as `http://nas.lan:8080`.

| Needs HTTPS (or `localhost`)                                 | Works over plain HTTP                                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Offline mode and PWA install (service worker)                | Nearly all tools                                                                             |
| Camera, microphone and screen recording                      | Hashing, encryption, Ed25519/ECDSA keys and the other crypto tools (pure-JS Noble libraries) |
| RSA key and CSR generation, PDF signature checks (WebCrypto) | Copy buttons (a fallback is used)                                                            |
| Reading from the clipboard                                   | Local storage for favorites and settings                                                     |

The HTTPS Compose overlay sets this up for both public domains and LANs.

## Contributing

You only need Docker. Local Node 26 is optional.

```sh
make new-tool                     # 1. scaffold (interactive), or pass ARGS="my-tool --name 'My Tool' --category text"
make dev                          # 2. develop with hot reload at http://localhost:4321
make test                         # 3. validator, unit and end-to-end tests
make build up                     # 4. rebuild and redeploy; the new tool appears automatically
```

With Node installed, run `npm run new-tool`, `npm run dev`, `npm test` and `npm run test:e2e` directly. [CONTRIBUTING.md](CONTRIBUTING.md) covers the tool contract, the rules CI enforces and the definition of done.

## Security and privacy

What the project promises, how that's enforced, and what it can't protect against: see [PLAN.md § 9](PLAN.md#9-privacy-and-security-model). A `SECURITY.md` with reporting instructions will come with v1.0.

## Tech stack

Astro 7 (static, multi-page) · Preact islands · TypeScript (strict) · Tailwind CSS v4 · Web Workers and WASM · Workbox · Vitest · Playwright with axe · nginx (unprivileged) · Caddy (optional HTTPS)

## License

[MIT](LICENSE). Third-party licenses are listed on the site's `/licenses/` page.
