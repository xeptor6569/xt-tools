# Deployment

xt-tools is a static site. The Docker image is nginx serving those files. Nothing in the container processes tool input.

Images are published to `ghcr.io/xeptor6569/xt-tools` by [`.github/workflows/release.yml`](../.github/workflows/release.yml).

| Tag           | What it is                             |
| ------------- | -------------------------------------- |
| `X.Y.Z`       | A release                              |
| `X.Y`         | The newest patch of that minor release |
| `latest`      | The newest release                     |
| `edge`        | The newest build of `main`             |
| `sha-<short>` | One commit on `main`                   |

The first workflow run creates the GHCR package as private. Open the package and set it to public once. After that, pulls work without a token.

A `v*` tag also attaches `xt-tools-<version>-site.zip`, `SHA256SUMS` and `sbom.spdx.json` to the GitHub release. Check the zip with `sha256sum -c SHA256SUMS`.

GitHub turns off the weekly rebuild ([`.github/workflows/scheduled.yml`](../.github/workflows/scheduled.yml)) after 60 days with no repository activity. A commit, or running that workflow by hand, turns the schedule back on.

## Docker

```sh
docker run -d --name xt-tools -p 8080:8080 \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  --restart unless-stopped \
  ghcr.io/xeptor6569/xt-tools:latest
```

Open <http://localhost:8080>. `/healthz` returns `ok`.

## Compose

```sh
git clone https://github.com/xeptor6569/xt-tools.git && cd xt-tools
cp .env.example .env
make up
```

`make up` with `XT_TAG` unset builds your checkout and serves it on port 8080. Set `XT_TAG=latest` (or `1.0`, `edge`) in `.env` to run a published image instead.

`make down` stops it. `make logs` follows the logs.

### HTTPS

`make up-https` adds Caddy (`compose.https.yaml`) and stops publishing port 8080. Set `DOMAIN` in `.env` to a name that points at the machine. Caddy gets a Let's Encrypt certificate and sends HSTS. The site container still sends the CSP and the other headers.

On a LAN, with no public DNS, edit `deploy/Caddyfile` and use the commented `tls internal` block instead of the public one. Do not send HSTS for that name. Then:

```sh
make up-https
make caddy-ca
```

`make caddy-ca` writes `caddy-root.crt`. Trust that file once on each device.

### A sub-path

The base path is compiled into the pages and the asset URLs. Build the image yourself:

```sh
make build BASE_PATH=/tools/ SITE_URL=https://example.com
make up
```

The site is then at <http://localhost:8080/tools/>. Under that setting, tool pages are `/tools/tools/<id>/`.

### Your own runner

CI can deploy every green push to `main` with Compose on a self-hosted runner. See [self-hosted-runner.md](self-hosted-runner.md).

## Secure contexts

Plain HTTP on a LAN address such as `http://nas.lan:8080` is not a secure context. `localhost` is.

| Browser feature               | Needs a secure context | What happens over plain HTTP                                                                                                                                   |
| ----------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service worker, Cache Storage | yes                    | Banner: "Offline mode needs HTTPS". The tools still work while you are online.                                                                                 |
| `crypto.subtle`               | yes                    | RSA key generation, CSR generation and the RSA mode of the SSH key tool show a notice. Hashes, HMAC, AES-GCM, Ed25519 and ECDSA use Noble and work without it. |
| `crypto.randomUUID`           | yes                    | Not used. UUIDs come from `crypto.getRandomValues`.                                                                                                            |
| Clipboard write               | yes                    | Copy uses an `execCommand` fallback.                                                                                                                           |
| Clipboard read                | yes, plus a permission | The paste button is hidden. Ctrl+V still works.                                                                                                                |
| Camera and microphone         | yes                    | Those tools show a notice. The QR reader falls back to a file.                                                                                                 |
| Screen capture                | yes                    | The screen recorder shows a notice.                                                                                                                            |
| Local fonts                   | yes, plus a permission | Font pairing uses a built-in list of system font stacks.                                                                                                       |
| `navigator.storage`           | yes                    | The persist and estimate controls on Settings are hidden.                                                                                                      |

Workers, WebAssembly, canvas, WebAudio, speech synthesis, compression streams, localStorage and IndexedDB work over HTTP.

## Static files

Unzip a release on any static host and use [server-configs](../server-configs/README.md). The meta CSP still applies if you cannot set headers. You then lose `frame-ancestors` and the CSP on worker scripts.

Refreshing bundled datasets is described in [datasets.md](datasets.md).
