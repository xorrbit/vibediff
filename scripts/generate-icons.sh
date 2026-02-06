#!/bin/bash

# Icon generation script for claudedidwhat
# Requires: ImageMagick (convert, magick) or rsvg-convert for SVG→PNG
#
# Usage: ./scripts/generate-icons.sh
# Or:    npm run generate-icons

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

# Step 2: Generate platform icons using ImageMagick
ICONS_DIR="$RESOURCES_DIR/icons"
mkdir -p "$ICONS_DIR"

echo "Generating .ico (Windows)..."
if [ "$CONVERT" = "rsvg" ]; then
    # rsvg-convert can't produce ico, generate PNGs then use ImageMagick if available
    echo "Warning: rsvg-convert cannot generate .ico files directly."
    echo "Install ImageMagick for .ico generation."
else
    $CONVERT "$RESOURCES_DIR/icon.png" \
        \( -clone 0 -resize 16x16 \) \
        \( -clone 0 -resize 32x32 \) \
        \( -clone 0 -resize 48x48 \) \
        \( -clone 0 -resize 64x64 \) \
        \( -clone 0 -resize 128x128 \) \
        \( -clone 0 -resize 256x256 \) \
        -delete 0 "$ICONS_DIR/icon.ico"
fi

echo "Generating PNG sizes for Linux..."
for size in 16 32 48 64 128 256 512 1024; do
    if [ "$CONVERT" = "rsvg" ]; then
        rsvg-convert -w "$size" -h "$size" "$SVG_ICON" -o "$ICONS_DIR/icon_${size}x${size}.png"
    else
        $CONVERT "$RESOURCES_DIR/icon.png" -resize "${size}x${size}" "$ICONS_DIR/icon_${size}x${size}.png"
    fi
done

echo ""
echo "Icon generation complete!"
echo "Generated files in $ICONS_DIR/:"
ls -la "$ICONS_DIR/" 2>/dev/null || true
echo ""
echo "Note: macOS .icns can be generated with iconutil (macOS only) or png2icns."
