#!/usr/bin/env bash
# Generates favicon.ico from icon.svg.
# Requires rsvg-convert and python3 with Pillow.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
SVG="$DIR/public/icon.svg"
ICO="$DIR/public/favicon.ico"
TMP="$(mktemp -d)"

rsvg-convert -w 256 -h 256 "$SVG" -o "$TMP/icon-256.png"

python3 - "$TMP/icon-256.png" "$ICO" <<'PY'
import sys
from PIL import Image

source, target = sys.argv[1], sys.argv[2]
image = Image.open(source).convert("RGBA")
image.save(target, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print(f"wrote {target}")
PY

rm -rf "$TMP"
