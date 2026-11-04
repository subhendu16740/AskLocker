#!/usr/bin/env bash
# The family and business films in India's languages (src/i18n.js), 16:9,
# with sound: out/asklocker-<family|business>-16x9-in-<code>.mp4 (and
# -sfx-only.mp4). The family film's voice scene speaks the same language.
# usage: tools/languages.sh [hi bn mr ta te gu kn ml pa ...]   (all nine when none is named)
#        FILMS=business tools/languages.sh ta   one film only
#        WORKERS=4 sets how many frames render at once (4 unless set)
# They are today's films (no --launch). Have someone who speaks each language
# watch its films before they go out: the translations are first drafts.
set -euo pipefail
cd "$(dirname "$0")/.."
ALL=(hi bn mr ta te gu kn ml pa)
if [ $# -gt 0 ]; then LANGS=("$@"); else LANGS=("${ALL[@]}"); fi

for lang in "${LANGS[@]}"; do
  for film in ${FILMS:-family business}; do
    node tools/render.mjs --film "$film" --ui "$lang" --workers "${WORKERS:-4}"
    tools/mux.sh "$film-16x9-in-$lang"
  done
done
