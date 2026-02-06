#!/bin/bash

# Icon generation script for claudedidwhat
# Requires: ImageMagick (convert, magick) or rsvg-convert for SVG→PNG
#           electron-icon-builder (npm devDependency) for PNG→icns/ico
#
# Usage: ./scripts/generate-icons.sh
# Or:    npm run generate-icons  (runs electron-icon-builder only, requires icon.png)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
RESOURCES_DIR="$PROJECT_DIR/resources"
SVG_ICON="$RESOURCES_DIR/icon.svg"

# Check if SVG exists
if [ ! -f "$SVG_ICON" ]; then
    echo "Error: SVG icon not found at $SVG_ICON"
    exit 1
fi

# Check for conversion tools
if command -v magick &> /dev/null; then
    CONVERT="magick"
elif command -v convert &> /dev/null; then
    CONVERT="convert"
elif command -v rsvg-convert &> /dev/null; then
    CONVERT="rsvg"
else
    echo "Error: No image conversion tool found."
    echo "Please install one of:"
    echo "  - ImageMagick: apt install imagemagick / brew install imagemagick"
    echo "  - librsvg: apt install librsvg2-bin / brew install librsvg"
    exit 1
fi

echo "Using conversion tool: $CONVERT"

# Step 1: Generate 1024x1024 PNG from SVG
echo "Generating icon.png (1024x1024) from SVG..."
if [ "$CONVERT" = "rsvg" ]; then
    rsvg-convert -w 1024 -h 1024 "$SVG_ICON" -o "$RESOURCES_DIR/icon.png"
else
    $CONVERT "$SVG_ICON" -background none -resize "1024x1024" "$RESOURCES_DIR/icon.png"
fi

# Step 2: Generate all platform icons using electron-icon-builder
echo "Generating platform icons (icns, ico, PNGs)..."
cd "$PROJECT_DIR"
npx electron-icon-builder --input=resources/icon.png --output=resources --flatten

echo ""
echo "Icon generation complete!"
echo "Generated files in $RESOURCES_DIR/icons/:"
ls -la "$RESOURCES_DIR/icons/" 2>/dev/null || true
