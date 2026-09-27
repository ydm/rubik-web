#!/usr/bin/env bash
# Regenerate every icon and share image from the cube drawing in
# scripts/cube-icon.py. Needs python3, rsvg-convert and ImageMagick (`magick`),
# plus the Geist font installed for the share image's text.
#
#   scripts/generate-icons.sh
set -euo pipefail
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

BG="#09090b" # the app's header / tab bar colour (zinc-950)

# Browser tab icon: scalable SVG for modern browsers, .ico for the rest.
python3 scripts/cube-icon.py > src/app/icon.svg
for n in 16 32 48; do
  rsvg-convert -w "$n" -h "$n" src/app/icon.svg -o "$tmp/fav-$n.png"
done
# (As `icon.ico`, not `favicon.ico`: Next.js drops the favicon.ico link when
# a basePath is set, as it is for GitHub Pages.)
magick "$tmp/fav-16.png" "$tmp/fav-32.png" "$tmp/fav-48.png" src/app/icon.ico

# iOS home screen: opaque (iOS rounds the corners itself).
python3 scripts/cube-icon.py --background "$BG" --padding 7 > "$tmp/apple.svg"
rsvg-convert -w 180 -h 180 "$tmp/apple.svg" -o src/app/apple-icon.png

# Web app manifest (Android / desktop install).
mkdir -p public/icons
python3 scripts/cube-icon.py --background "$BG" --padding 4 > "$tmp/app.svg"
rsvg-convert -w 192 -h 192 "$tmp/app.svg" -o public/icons/icon-192.png
rsvg-convert -w 512 -h 512 "$tmp/app.svg" -o public/icons/icon-512.png
# Maskable: the launcher may crop to a circle, so keep the cube in the middle 80%.
python3 scripts/cube-icon.py --background "$BG" --padding 12 > "$tmp/maskable.svg"
rsvg-convert -w 512 -h 512 "$tmp/maskable.svg" -o public/icons/icon-maskable-512.png

# Share image (Open Graph / social previews), 1200x630.
cube=$(python3 scripts/cube-icon.py | sed '1d;$d')
cat > "$tmp/og.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="$BG"/>
  <svg x="90" y="115" width="400" height="400" viewBox="0 0 64 64">
$cube
  </svg>
  <text x="560" y="290" font-family="Geist" font-weight="700" font-size="78" fill="#ffffff">Кубът на Рубик</text>
  <text x="562" y="360" font-family="Geist" font-size="34" fill="#a1a1aa">Виж как да наредиш куба</text>
  <text x="562" y="408" font-family="Geist" font-size="34" fill="#a1a1aa">на Рубик стъпка по стъпка.</text>
</svg>
SVG
rsvg-convert -w 1200 -h 630 "$tmp/og.svg" -o src/app/opengraph-image.png
printf '%s' "Кубът на Рубик — подреден куб до надпис „Виж как да наредиш куба на Рубик стъпка по стъпка.“" \
  > src/app/opengraph-image.alt.txt

echo "icons regenerated"
