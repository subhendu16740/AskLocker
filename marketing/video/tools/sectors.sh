#!/usr/bin/env bash
# Business marketing for professions that live on paper (src/sectors.js):
# for each, a 9:16 short with and without music, its two posters (1:1 and
# 16:9) and its pamphlet (an A4 PDF to print and a PNG to send).
# usage: tools/sectors.sh [lawyers chartered-accountants clinics real-estate insurance-advisors transport]
#        (all of them when none is named), then tools/publish.sh, which puts
#        each in marketing/business/sectors/<sector>/
# Today's claims only: never with LAUNCH=1.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${LAUNCH:-}" = 1 ]; then echo "The professions' set says today's claims: run it without LAUNCH=1" >&2; exit 1; fi
ALL=$(node -e "import('./src/sectors.js').then((m) => console.log(Object.keys(m.SECTORS).join(' ')))")
if [ $# -gt 0 ]; then SECTORS=("$@"); else read -r -a SECTORS <<< "$ALL"; fi
for s in "${SECTORS[@]}"; do
  node tools/render.mjs --film features --feature "sector-$s" --portrait --workers "${WORKERS:-4}"
  tools/mux.sh "feature-sector-$s-9x16"
done
node tools/posters.mjs --features "$(printf 'sector-%s,' "${SECTORS[@]}" | sed 's/,$//')"
node tools/pamphlets.mjs --sectors "$(IFS=,; echo "${SECTORS[*]}")"
