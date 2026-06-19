#!/bin/bash
# Copy trait assets into this folder for a fully standalone GitHub deploy.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$(cd "$DIR/.." && pwd)/assets"
DEST="$DIR/assets"
if [ ! -d "$SRC" ]; then
  echo "Source assets not found at $SRC"
  exit 1
fi
if [ -L "$DEST" ]; then rm "$DEST"; fi
echo "Copying assets (this may take a minute)..."
rm -rf "$DEST"
cp -R "$SRC" "$DEST"
echo "Done. assets/ is now a real copy at $DEST"
