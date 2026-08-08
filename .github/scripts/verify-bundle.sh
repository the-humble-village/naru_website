#!/usr/bin/env bash
#
# Guards the failure mode that took production down: a bundle whose symlinks
# resolve on the runner but not after it is copied to EC2. Checking for *broken*
# links is not enough — the @naru/shared link pointed at an absolute path that
# exists on the runner and only dangled on EC2. The test that matters is whether
# every link resolves to somewhere inside the bundle.
#
# Do not "fix" a failure here by dereferencing the tree (cp -rL). That flattens
# pnpm's .pnpm store, after which packages can no longer resolve their own
# dependencies — prisma loses @prisma/engines.
#
# Usage: verify-bundle.sh <bundle-dir>
set -euo pipefail

BUNDLE=${1:?usage: verify-bundle.sh <bundle-dir>}

test -f "$BUNDLE/node_modules/@naru/shared/package.json" || {
  echo "::error::@naru/shared missing from $BUNDLE"; exit 1; }

# pwd -P, not pwd: readlink -f returns a fully resolved path, so a logical path
# would never match once any parent is itself a symlink.
ROOT=$(cd "$BUNDLE" && pwd -P)
links=$(mktemp)
escaped=$(mktemp)

find "$BUNDLE" -type l > "$links"
while IFS= read -r link; do
  target=$(readlink -f "$link" || true)
  case "$target" in
    "$ROOT"/*) ;;
    *) printf '%s -> %s\n' "$link" "${target:-<broken>}" >> "$escaped" ;;
  esac
done < "$links"

if [ -s "$escaped" ]; then
  echo "::error::$BUNDLE has symlinks resolving outside itself; these will dangle on EC2:"
  head -20 "$escaped"
  exit 1
fi

echo "bundle self-contained: $(du -sh "$BUNDLE" | cut -f1), $(wc -l < "$links") internal symlinks"
