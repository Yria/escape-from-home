#!/bin/sh
# 앱 아이콘 PNG 를 icons/*.svg 에서 다시 만든다. 필요: rsvg-convert (brew install librsvg)
#  icon.svg          둥근 모서리, 투명 여백 — 브라우저 탭·안드로이드 일반 아이콘
#  icon-maskable.svg 꽉 찬 배경, 열쇠구멍은 가운데 안전 영역 — 안드로이드 적응형(maskable)·iOS 홈 화면
set -e
cd "$(dirname "$0")/.."
out=public/icons
mkdir -p "$out"
rsvg-convert -w 192 -h 192 icons/icon.svg -o "$out/icon-192.png"
rsvg-convert -w 512 -h 512 icons/icon.svg -o "$out/icon-512.png"
rsvg-convert -w 512 -h 512 icons/icon-maskable.svg -o "$out/icon-maskable-512.png"
rsvg-convert -w 180 -h 180 icons/icon-maskable.svg -o "$out/apple-touch-icon.png"
cp icons/icon.svg public/favicon.svg
echo "아이콘 생성 완료 → $out"
