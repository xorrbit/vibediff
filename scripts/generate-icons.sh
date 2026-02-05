#!/bin/bash

# Icon generation script for vibediff
# Requires: ImageMagick (convert, magick) or rsvg-convert
#
# This script converts the SVG icon to various formats needed for packaging:
# - macOS: .icns (requires iconutil on macOS)
# - Windows: .ico
# - Linux: PNG files in various sizes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOURCES_DIR="$SCRIPT_DIR/../resources"
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
echo "Generating icons from $SVG_ICON..."

# Generate PNG at various sizes for Linux
SIZES=(16 32 48 64 128 256 512 1024)

for size in "${SIZES[@]}"; do
    output="$RESOURCES_DIR/icon-${size}.png"
    echo "  Generating ${size}x${size} PNG..."

    if [ "$CONVERT" = "rsvg" ]; then
        rsvg-convert -w "$size" -h "$size" "$SVG_ICON" -o "$output"
    else
        $CONVERT -background none -resize "${size}x${size}" "$SVG_ICON" "$output"
    fi
done

# Generate main icon.png (1024x1024)
echo "  Generating icon.png (1024x1024)..."
if [ "$CONVERT" = "rsvg" ]; then
    rsvg-convert -w 1024 -h 1024 "$SVG_ICON" -o "$RESOURCES_DIR/icon.png"
else
    $CONVERT -background none -resize "1024x1024" "$SVG_ICON" "$RESOURCES_DIR/icon.png"
fi

# Generate Windows .ico (contains multiple sizes)
echo "  Generating icon.ico for Windows..."
if [ "$CONVERT" != "rsvg" ]; then
    $CONVERT "$RESOURCES_DIR/icon-16.png" "$RESOURCES_DIR/icon-32.png" \
             "$RESOURCES_DIR/icon-48.png" "$RESOURCES_DIR/icon-256.png" \
             "$RESOURCES_DIR/icon.ico"
else
    echo "    Note: ICO generation requires ImageMagick"
fi

# Generate macOS .icns (requires macOS with iconutil)
if command -v iconutil &> /dev/null; then
    echo "  Generating icon.icns for macOS..."

    ICONSET="$RESOURCES_DIR/icon.iconset"
    mkdir -p "$ICONSET"

    # macOS iconset requires specific filenames
    cp "$RESOURCES_DIR/icon-16.png" "$ICONSET/icon_16x16.png"
    cp "$RESOURCES_DIR/icon-32.png" "$ICONSET/icon_16x16@2x.png"
    cp "$RESOURCES_DIR/icon-32.png" "$ICONSET/icon_32x32.png"
    cp "$RESOURCES_DIR/icon-64.png" "$ICONSET/icon_32x32@2x.png"
    cp "$RESOURCES_DIR/icon-128.png" "$ICONSET/icon_128x128.png"
    cp "$RESOURCES_DIR/icon-256.png" "$ICONSET/icon_128x128@2x.png"
    cp "$RESOURCES_DIR/icon-256.png" "$ICONSET/icon_256x256.png"
    cp "$RESOURCES_DIR/icon-512.png" "$ICONSET/icon_256x256@2x.png"
    cp "$RESOURCES_DIR/icon-512.png" "$ICONSET/icon_512x512.png"
    cp "$RESOURCES_DIR/icon-1024.png" "$ICONSET/icon_512x512@2x.png"

    iconutil -c icns "$ICONSET" -o "$RESOURCES_DIR/icon.icns"
    rm -rf "$ICONSET"
else
    echo "  Note: macOS .icns generation requires iconutil (only available on macOS)"
fi

echo ""
echo "Icon generation complete!"
echo "Generated files in $RESOURCES_DIR:"
ls -la "$RESOURCES_DIR"/*.{png,ico,icns} 2>/dev/null || true
