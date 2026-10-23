#!/usr/bin/env bash
# Üretilen android/ projesine uygulama ikonunu yerleştirir.
set -euo pipefail

RES="android/app/src/main/res"
SRC="icon-source.png"

if [ ! -f "$SRC" ] || ! command -v convert >/dev/null 2>&1; then
  echo "İkon atlandı (kaynak veya ImageMagick yok)."
  exit 0
fi

# Adaptive icon tanımını kaldır, klasik PNG ikonlar kullanılsın
rm -rf "$RES/mipmap-anydpi-v26"

declare -A SIZES=( [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192 )
for d in "${!SIZES[@]}"; do
  s=${SIZES[$d]}
  mkdir -p "$RES/mipmap-$d"
  convert "$SRC" -resize ${s}x${s} "$RES/mipmap-$d/ic_launcher.png"
  convert "$SRC" -resize ${s}x${s} "$RES/mipmap-$d/ic_launcher_round.png"
  convert "$SRC" -resize ${s}x${s} "$RES/mipmap-$d/ic_launcher_foreground.png"
done
echo "İkonlar yerleştirildi."
