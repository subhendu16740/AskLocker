#!/usr/bin/env bash
# Copies what tools/films.sh, tools/features.sh and tools/posters.mjs made in
# out/ into the repository's marketing folder, for whoever posts them:
#   marketing/<family|business>/films/    asklocker-<film>-<16x9|9x16>[-short].mp4
#   marketing/<family|business>/shorts/   asklocker-<family|business>-<feature>-9x16[-sfx-only].mp4
#   marketing/<family|business>/posters/  asklocker-<family|business>-<feature>-<size>.png
#   marketing/nri/films/                  asklocker-nri-<16x9|9x16>[-short].mp4 (the family film told from abroad)
# A business feature's key starts biz- in src/features.js; its files drop it.
# The films go with music only (tools/mux.sh also writes -sfx-only ones);
# the shorts go both ways, for posting with a platform's own music. Each
# folder is replaced whole, so it holds exactly what out/ has now.
# usage: tools/publish.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=..

for a in family business; do
  rm -rf "$DEST/$a/films" "$DEST/$a/shorts" "$DEST/$a/posters"
  mkdir -p "$DEST/$a/films" "$DEST/$a/shorts" "$DEST/$a/posters"
done
rm -rf "$DEST/nri/films"
mkdir -p "$DEST/nri/films"

audience() { # a file's name, from asklocker-feature- or asklocker- on -> "<audience> <name>"
  if [[ $1 == biz-* ]]; then echo "business ${1#biz-}"; else echo "family $1"; fi
}

for f in out/asklocker-family-*.mp4 out/asklocker-nri-*.mp4 out/asklocker-business-*.mp4; do
  [ -e "$f" ] || continue
  [[ $f == *-sfx-only.mp4 ]] && continue
  name=$(basename "$f")
  a=${name#asklocker-}
  cp "$f" "$DEST/${a%%-*}/films/$name"
done
for f in out/asklocker-feature-*-9x16*.mp4; do
  [ -e "$f" ] || continue
  read -r a name <<< "$(audience "${f#out/asklocker-feature-}")"
  cp "$f" "$DEST/$a/shorts/asklocker-$a-$name"
done
for f in out/posters/asklocker-*.png; do
  [ -e "$f" ] || continue
  read -r a name <<< "$(audience "${f#out/posters/asklocker-}")"
  cp "$f" "$DEST/$a/posters/asklocker-$a-$name"
done

for d in family/films family/shorts family/posters nri/films business/films business/shorts business/posters; do
  echo "$d: $(find "$DEST/$d" -type f | wc -l) files, $(du -sh "$DEST/$d" | cut -f1)"
done
