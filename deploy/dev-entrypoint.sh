#!/bin/sh
# Dev container entrypoint: install dependencies into the node_modules volume
# when package-lock.json changed since the last install, then run the command.
set -eu

stamp=node_modules/.xt-lock-hash
current=$(sha256sum package-lock.json | cut -d' ' -f1)

if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$current" ]; then
  echo "Installing dependencies (package-lock.json changed)..."
  npm ci --no-audit
  echo "$current" > "$stamp"
fi

exec "$@"
