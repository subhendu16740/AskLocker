#!/usr/bin/env bash
# The films' cuts, with sound: out/asklocker-<film>-<16x9|9x16>[-short].mp4
# (and -sfx-only.mp4).
# usage: tools/films.sh [tag ...]   e.g. tools/films.sh business-9x16 family-16x9-short
#        (all twelve when none is named; nri is the family film told from abroad)
#        LAUNCH=1 tools/films.sh   the launch set (src/claims.js): tags end -launch,
#        never posted before end-to-end encryption ships
set -euo pipefail
cd "$(dirname "$0")/.."
ALL=(family-16x9 family-9x16 family-16x9-short family-9x16-short
  nri-16x9 nri-9x16 nri-16x9-short nri-9x16-short
  business-16x9 business-9x16 business-16x9-short business-9x16-short)
if [ $# -gt 0 ]; then TAGS=("$@"); else TAGS=("${ALL[@]}"); fi
launch=()
suffix=''
if [ "${LAUNCH:-}" = 1 ]; then launch=(--launch); suffix='-launch'; fi

for tag in "${TAGS[@]}"; do
  args=(--film "${tag%%-*}")
  if [[ $tag == *9x16* ]]; then args+=(--portrait); fi
  if [[ $tag == *-short ]]; then args+=(--short); fi
  node tools/render.mjs "${args[@]}" "${launch[@]}"
  tools/mux.sh "$tag$suffix"
done
