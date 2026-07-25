#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")"
OUT="mirror-proxy-${VERSION}.zip"

rm -f "$OUT"

zip -r "$OUT" \
  manifest.json \
  background.js \
  popup.html \
  popup.js \
  icons/ \
  -x "*.DS_Store" "*/.DS_Store"

echo "Created $OUT ($(du -h "$OUT" | cut -f1))"
ls -la "$OUT"
