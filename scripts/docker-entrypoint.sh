#!/bin/sh
set -eu

cd /app

LOCKFILE_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
STAMP_FILE="node_modules/.package-lock.sha256"

if [ ! -d node_modules ] || [ ! -f "$STAMP_FILE" ] || [ "$(cat "$STAMP_FILE")" != "$LOCKFILE_HASH" ]; then
  echo "Installing dependencies to match package-lock.json..."
  npm ci
  mkdir -p node_modules
  printf '%s' "$LOCKFILE_HASH" > "$STAMP_FILE"
fi

exec "$@"
