#!/usr/bin/env bash
# Copies what tools/films.sh, tools/features.sh, tools/privacy.sh and
# tools/locked.sh made in out/ into the repository's marketing folder, for
# whoever posts them:
#   marketing/<family|business>/films/    asklocker-<film>-<16x9|9x16>[-short].mp4
#   marketing/<family|business>/shorts/   asklocker-<family|business>-<feature>-9x16[-sfx-only].mp4
#   marketing/<family|business>/posters/  asklocker-<family|business>-<feature>-<size>.png
#   marketing/nri/films/                  asklocker-nri-<16x9|9x16>[-short].mp4 (the family film told from abroad)
#   marketing/privacy/<films|reels|covers>/  the privacy film (tools/privacy.sh)
# and the launch set, everything rendered with --launch (src/claims.js), which
# is never posted before end-to-end encryption ships, into its own folder:
#   marketing/launch/<family|nri|business>/<films|shorts|posters>/  the same names, ending -launch
#   marketing/launch/<family|business>/locked/<films|reels|covers>/ the launch's own film (tools/locked.sh),
#                                                                   a family's and a business's
# A business feature's key starts biz- in src/features.js; its files drop it.
# The films go with music only (tools/mux.sh also writes -sfx-only ones);
# the shorts and reels go both ways, for posting with a platform's own music.
# Each folder is replaced whole, so it holds exactly what out/ has now.
# usage: tools/publish.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=..
L=$DEST/launch

for a in family business; do
  rm -rf "$DEST/$a/films" "$DEST/$a/shorts" "$DEST/$a/posters" "$L/$a/films" "$L/$a/shorts" "$L/$a/posters" "$L/$a/locked"
  mkdir -p "$DEST/$a/films" "$DEST/$a/shorts" "$DEST/$a/posters"
done
# ($L/locked is where the family's launch film was kept before the business's.)
rm -rf "$DEST/nri/films" "$DEST/privacy/films" "$DEST/privacy/reels" "$DEST/privacy/covers" \
  "$L/nri/films" "$L/locked"
mkdir -p "$DEST/nri/films" "$DEST/privacy/films" "$DEST/privacy/reels" "$DEST/privacy/covers"

audience() { # a file's name, from asklocker-feature- or asklocker- on -> "<audience> <name>"
  if [[ $1 == biz-* ]]; then echo "business ${1#biz-}"; else echo "family $1"; fi
}
# Where a file goes: today's folder, or the launch folder for a -launch file.
home() { # <file> <folder under marketing/, e.g. family/films>
  if [[ $1 == *-launch.* || $1 == *-launch-sfx-only.* ]]; then
    mkdir -p "$L/$2"; echo "$L/$2"
  else
    echo "$DEST/$2"
  fi
}

for f in out/asklocker-family-*.mp4 out/asklocker-nri-*.mp4 out/asklocker-business-*.mp4; do
  [ -e "$f" ] || continue
  [[ $f == *-sfx-only.mp4 ]] && continue
  name=$(basename "$f")
  a=${name#asklocker-}
  cp "$f" "$(home "$f" "${a%%-*}/films")/$name"
done
for f in out/asklocker-feature-*-9x16*.mp4; do
  [ -e "$f" ] || continue
  read -r a name <<< "$(audience "${f#out/asklocker-feature-}")"
  cp "$f" "$(home "$f" "$a/shorts")/asklocker-$a-$name"
done
for f in out/posters/asklocker-*.png; do
  [ -e "$f" ] || continue
  [[ $f == */asklocker-privacy-* || $f == */asklocker-locked-* ]] && continue
  read -r a name <<< "$(audience "${f#out/posters/asklocker-}")"
  cp "$f" "$(home "$f" "$a/posters")/asklocker-$a-$name"
done
# The privacy film (tools/privacy.sh): the film with music, the reels both
# ways, and every cover.
for f in out/asklocker-privacy-16x9.mp4 out/asklocker-privacy-9x16.mp4; do
  [ -e "$f" ] && cp "$f" "$DEST/privacy/films/"
done
for f in out/asklocker-privacy-*-9x16.mp4 out/asklocker-privacy-*-9x16-sfx-only.mp4; do
  [ -e "$f" ] && cp "$f" "$DEST/privacy/reels/"
done
for f in out/posters/asklocker-privacy-*-cover.png; do
  [ -e "$f" ] && cp "$f" "$DEST/privacy/covers/"
done
# The launch's own film (tools/locked.sh), a family's (asklocker-locked-*) and
# a business's (asklocker-locked-business-*), the same way: the film with
# music, the reels both ways, and every cover.
for f in out/asklocker-locked-*-launch.mp4 out/asklocker-locked-*-launch-sfx-only.mp4 out/posters/asklocker-locked-*-cover-launch.png; do
  [ -e "$f" ] || continue
  name=$(basename "$f")
  a=family
  rest=${name#asklocker-locked-}
  if [[ $rest == business-* ]]; then a=business; rest=${rest#business-}; fi
  case $rest in
    *-cover-launch.png) kind=covers ;;
    16x9-launch.mp4 | 9x16-launch.mp4) kind=films ;;
    16x9-* | 9x16-*) continue ;; # a film's -sfx-only: the films go with music only
    *) kind=reels ;;
  esac
  mkdir -p "$L/$a/locked/$kind"
  cp "$f" "$L/$a/locked/$kind/"
done

for d in family/films family/shorts family/posters nri/films business/films business/shorts business/posters \
  privacy/films privacy/reels privacy/covers \
  launch/family/films launch/family/shorts launch/family/posters launch/nri/films \
  launch/business/films launch/business/shorts launch/business/posters \
  launch/family/locked/films launch/family/locked/reels launch/family/locked/covers \
  launch/business/locked/films launch/business/locked/reels launch/business/locked/covers; do
  [ -d "$DEST/$d" ] && echo "$d: $(find "$DEST/$d" -type f | wc -l) files, $(du -sh "$DEST/$d" | cut -f1)"
done
true
