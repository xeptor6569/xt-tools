# Threat model

People who use xt-tools trust whoever served them the JavaScript: the operator of the site, and the build that produced the image or the zip. A provenance attestation and an SBOM on the published image, and pinned dependency versions, reduce the chance that a dependency swap goes unnoticed. They do not protect a visitor whose operator changes the files.

## What the site is for

Each tool runs in the browser. Input stays in that tab, apart from a network tool. A network tool names its hosts on the page and sends a GET, with no cookies, only after the visitor runs it. The request does not follow a redirect to a host that is not on the allowlist.

The Content Security Policy, the lint rules, the build scan and the end-to-end tests exist so a tool cannot quietly call the network. A header CSP and the `<meta>` policy carry the same directives. Worker scripts only see the header, so a host that cannot set headers leaves workers with no CSP. That residual risk is called out in the deployment guide.

## What we do not claim to stop

- A malicious browser extension, which can read the page and anything typed into it.
- A compromised operating system, or a clipboard manager that records what you copy.
- An operator who edits the files after the build, or who serves a different build than the one you think you are using.
- Someone looking over your shoulder. Tool output is on screen, and the recent list and pins are titles of tools, not their contents. Sensitive tools still show their input in the tab while you use them.
- Browser features outside the page's control. Spell check, page translation and remote text-to-speech voices can send text to the browser vendor. Inputs default to `spellcheck=false`, tool areas set `translate="no"`, and text-to-speech offers only `localService` voices. A visitor can still turn the browser features back on.
- Share links. The fragment is not sent to the server, but it is stored in browser history and can sync with the browser account. Sensitive tools do not offer a share link.

## Supply chain

Dependencies are pinned exactly. CI fails on a license outside the allowlist and on a high or critical advisory that has a fix. The image build runs the unit tests before it publishes files. Weekly rebuilds pick up base-image patches and scan the result.

Verify a release with `SHA256SUMS` in the GitHub release, and the image with the registry attestation (`gh attestation verify oci://ghcr.io/xeptor6569/xt-tools:X.Y.Z`).

## Reporting

Use GitHub private vulnerability reporting. See [SECURITY.md](../SECURITY.md).
