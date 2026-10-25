# Reporting a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/xeptor6569/xt-tools/security/advisories/new) for this repository. Do not open a public issue for a vulnerability.

Include what you can do with the bug, the version or image digest you tested, and whether the site was the official image or a build you made.

## Supported versions

| Version    | Supported                                           |
| ---------- | --------------------------------------------------- |
| 1.0.x      | yes                                                 |
| `edge`     | best effort; it follows `main` and is not a release |
| older tags | no                                                  |

Images are `ghcr.io/xeptor6569/xt-tools`. `latest` is the newest release. `X.Y` and `X.Y.Z` pin a release. Each image carries a provenance attestation and an SBOM.

## What this project promises

Tool input stays in the browser, except for a network tool, which sends the query you typed to the hosts named on its page, and only after you run it. Those requests are credential-free GETs and do not follow a redirect off the allowlist.

Offline tools make no requests except for this site's own files. localStorage holds pins, collections, the theme, and per-tool state you turned on. Sensitive tools do not persist or share their input.

The [threat model](docs/threat-model.md) is the longer version of what an operator can and cannot guarantee.
