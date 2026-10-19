#!/usr/bin/env bash
# Downloads the video's fonts from Google Fonts (all SIL Open Font License)
# into ./fonts and writes ./fonts/fonts.css pointing at the local copies, so a
# render never depends on the network. Re-run to refresh.
set -euo pipefail
cd "$(dirname "$0")/.."
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
FAMILIES=(
  'Bricolage+Grotesque:opsz,wght@12..96,300..800'
  'Instrument+Serif:ital@0;1'
  'Roboto:wght@400;500;600;700'
  'Noto+Sans+Devanagari:wght@400;500;600;700'
  'Caveat:wght@500;700'
  # The other scripts of the voice languages (src/lib/voice-languages.ts): 600
  # for the language cards, and the chat's weights for the voice scene in each.
  'Noto+Sans+Bengali:wght@400;500;600;700'
  'Noto+Sans+Tamil:wght@400;500;600;700'
  'Noto+Sans+Telugu:wght@400;500;600;700'
  'Noto+Sans+Gujarati:wght@400;500;600;700'
  'Noto+Sans+Kannada:wght@400;500;600;700'
  'Noto+Sans+Malayalam:wght@400;500;600;700'
  'Noto+Sans+Gurmukhi:wght@400;500;600;700'
)
# Written aside and moved into place whole, so a render starting meanwhile
# never reads half of it.
: > fonts/fonts.css.tmp
for fam in "${FAMILIES[@]}"; do
  css=$(curl -fsSL -A "$UA" "https://fonts.googleapis.com/css2?family=${fam}&display=block")
  # Keep only the subsets the video uses.
  css=$(printf '%s\n' "$css" | awk '
    /^\/\* / { keep = ($2=="latin" || $2=="latin-ext" || $2=="devanagari" || $2=="bengali" || $2=="tamil" || $2=="telugu" || $2=="gujarati" || $2=="kannada" || $2=="malayalam" || $2=="gurmukhi") }
    { if (keep) print }')
  for url in $(printf '%s\n' "$css" | grep -o 'https://fonts.gstatic.com/[^)]*'); do
    # Most files are under /s/<family>/; a few come as /l/font?kit=<id>.
    file=$(printf '%s' "$url" | sed -E 's#https://fonts.gstatic.com/s/##; s#https://fonts.gstatic.com/l/font\?kit=([^&]*).*#kit_\1.woff2#; s#/#_#g')
    [ -f "fonts/$file" ] || curl -fsSL -o "fonts/$file" "$url"
    css=${css//"$url"/"$file"}
  done
  printf '%s\n' "$css" >> fonts/fonts.css.tmp
done
mv fonts/fonts.css.tmp fonts/fonts.css
ls fonts | wc -l
