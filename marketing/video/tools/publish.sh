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
# is never posted before end-to-end encryption ships, all in one folder,
# numbered in the order to watch them (marketing/launch/README.md lists them):
#   marketing/launch/NN-<film|feature|reel>-<name>-launch.mp4
#                                01-16 the long films, 17-33 the feature shorts,
#                                34-45 the launch film's reels
#   marketing/launch/no-music/   the shorts and reels without music, named the same
#   marketing/launch/covers/     each launch film's and reel's cover, named as its video
#   marketing/launch/posters/    every feature's posters, numbered as its short: the
#                                launch's where its words change at launch, else today's
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
  rm -rf "$DEST/$a/films" "$DEST/$a/shorts" "$DEST/$a/posters"
  mkdir -p "$DEST/$a/films" "$DEST/$a/shorts" "$DEST/$a/posters"
done
rm -rf "$DEST/nri/films" "$DEST/privacy/films" "$DEST/privacy/reels" "$DEST/privacy/covers"
mkdir -p "$DEST/nri/films" "$DEST/privacy/films" "$DEST/privacy/reels" "$DEST/privacy/covers"
# The launch folder, all but its README.
mkdir -p "$L"
find "$L" -mindepth 1 ! -name README.md -delete

audience() { # a file's name, from asklocker-feature- or asklocker- on -> "<audience> <name>"
  if [[ $1 == biz-* ]]; then echo "business ${1#biz-}"; else echo "family $1"; fi
}
launched() { [[ $1 == *-launch.* || $1 == *-launch-sfx-only.* ]]; }

# ─── Today's set ─────────────────────────────────────────────────────────
for f in out/asklocker-family-*.mp4 out/asklocker-nri-*.mp4 out/asklocker-business-*.mp4; do
  [ -e "$f" ] || continue
  [[ $f == *-sfx-only.mp4 ]] && continue
  launched "$f" && continue
  name=$(basename "$f")
  a=${name#asklocker-}
  cp "$f" "$DEST/${a%%-*}/films/$name"
done
for f in out/asklocker-feature-*-9x16*.mp4; do
  [ -e "$f" ] || continue
  launched "$f" && continue
  read -r a name <<< "$(audience "${f#out/asklocker-feature-}")"
  cp "$f" "$DEST/$a/shorts/asklocker-$a-$name"
done
for f in out/posters/asklocker-*.png; do
  [ -e "$f" ] || continue
  [[ $f == */asklocker-privacy-* || $f == */asklocker-locked-* ]] && continue
  launched "$f" && continue
  read -r a name <<< "$(audience "${f#out/posters/asklocker-}")"
  cp "$f" "$DEST/$a/posters/asklocker-$a-$name"
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

# ─── The launch set, in the order to watch it ───────────────────────────
n=0
N=00
missing=0
step() { n=$((n + 1)); N=$(printf '%02d' "$n"); }
put() { # <file in out/> <path under launch/>
  if [ -e "$1" ]; then
    mkdir -p "$(dirname "$L/$2")"
    cp "$1" "$L/$2"
  else
    echo "missing: $1" >&2
    missing=$((missing + 1))
  fi
}
# 01-12: the family, NRI and business films, in full and short, 16:9 and 9:16.
for film in family nri business; do
  for cut in 16x9 9x16 16x9-short 9x16-short; do
    shape=${cut%-short}
    short=${cut#"$shape"}
    step
    put "out/asklocker-$film-$cut-launch.mp4" "$N-film-$film$short-$shape-launch.mp4"
  done
done
# 13-16: the launch film "Locked on your phone", a family's and a business's.
for b in '' -business; do
  for shape in 16x9 9x16; do
    step
    put "out/asklocker-locked$b-$shape-launch.mp4" "$N-film-locked-on-your-phone$b-$shape-launch.mp4"
    put "out/posters/asklocker-locked$b-$shape-cover-launch.png" "covers/$N-film-locked-on-your-phone$b-$shape-launch.png"
  done
done
# 17-33: the feature shorts, with and without music, and their posters
# (features.sh's order; a business feature's key starts biz-).
for f in ask:ask read:instant-insights voice:voice reminders:reminders tree:family-tree \
  emergency:emergency-card share:share-by-link vaults:privacy fingerprint:fingerprint-sign-in \
  biz-capture:business-capture biz-ask:business-ask biz-overview:business-overview \
  biz-reminders:business-reminders biz-team:business-team biz-share:business-share-by-link \
  biz-access:business-access-and-control biz-sheets:business-spreadsheets; do
  key=${f%%:*}
  name=${f#*:}
  step
  put "out/asklocker-feature-$key-9x16-launch.mp4" "$N-feature-$name-launch.mp4"
  put "out/asklocker-feature-$key-9x16-launch-sfx-only.mp4" "no-music/$N-feature-$name-launch.mp4"
  for size in 1080x1080 1920x1080; do
    # A poster has no end card, so it changes at launch only where its words
    # do (features.sh); the others are today's.
    p="out/posters/asklocker-$key-$size-launch.png"
    [ -e "$p" ] || p="out/posters/asklocker-$key-$size.png"
    put "$p" "posters/$N-feature-$name-$size-launch.png"
  done
done
# 34-45: the launch film's reels, a family's and a business's, both ways.
for r in locker:the-locker-on-your-phone who:who-can-open-it asking:asking-without-handing-it-over \
  key:your-key-your-way-back family:adding-family emergency:the-emergency-card \
  business-locker:business-the-locker-on-your-phone business-who:business-who-can-open-it \
  business-asking:business-asking-without-handing-it-over business-key:business-your-key-your-way-back \
  business-share:business-sending-one-record business-team:business-adding-your-team; do
  key=${r%%:*}
  name=${r#*:}
  step
  put "out/asklocker-locked-$key-9x16-launch.mp4" "$N-reel-$name-launch.mp4"
  put "out/asklocker-locked-$key-9x16-launch-sfx-only.mp4" "no-music/$N-reel-$name-launch.mp4"
  put "out/posters/asklocker-locked-$key-cover-launch.png" "covers/$N-reel-$name-launch.png"
done

for d in family/films family/shorts family/posters nri/films business/films business/shorts business/posters \
  privacy/films privacy/reels privacy/covers; do
  [ -d "$DEST/$d" ] && echo "$d: $(find "$DEST/$d" -type f | wc -l) files, $(du -sh "$DEST/$d" | cut -f1)"
done
echo "launch: $(find "$L" -maxdepth 1 -name '*.mp4' | wc -l) videos, $(du -sh --exclude=no-music --exclude=covers --exclude=posters "$L" | cut -f1)"
for d in no-music covers posters; do
  echo "launch/$d: $(find "$L/$d" -type f | wc -l) files, $(du -sh "$L/$d" | cut -f1)"
done
if [ "$missing" -gt 0 ]; then
  echo "$missing launch file(s) missing from out/: render them, then publish again" >&2
  exit 1
fi
