#!/usr/bin/env bash
# Scores a rendered video and writes the deliverables:
#   out/asklocker-<tag>.mp4            music, sound effects and voices
#   out/asklocker-<tag>-sfx-only.mp4   sound effects and voices, no music,
#                                      for adding a platform's own music track
# usage: tools/mux.sh <film>-<16x9|9x16>[-short], e.g. tools/mux.sh business-9x16
#        (after tools/render.mjs has written out/video-<tag>.mp4)
#        VIDEO=out/video-family-16x9.mp4 tools/mux.sh family-16x9-narrated: scores a
#        cue sheet over another tag's video (the narrated film's frames are the plain
#        film's: tools/render.mjs --narration en --cues-only)
#        TARGET_LUFS=-14.5 tools/mux.sh <tag>: brings the music mix to that
#        loudness, its few peaks held under -1 dBFS by a limiter, and the
#        sound-effects mix by the same gain (the why films, whose quiet
#        nights would otherwise play softer than every other video)
set -euo pipefail
cd "$(dirname "$0")/.."
TAG=${1:-family-16x9}
FFMPEG=${FFMPEG:-ffmpeg}
PYTHON=${PYTHON:-python3}

"$PYTHON" audio/score.py "out/cues-$TAG.json" "out/score-$TAG.wav"
"$PYTHON" audio/score.py "out/cues-$TAG.json" "out/sfx-$TAG.wav" --sfx-only

AF=()
if [ -n "${TARGET_LUFS:-}" ]; then
  now=$("$FFMPEG" -hide_banner -nostats -i "out/score-$TAG.wav" -af ebur128 -f null - 2>&1 | awk '$1 == "I:" { v = $2 } END { print v }')
  AF=(-af "$(awk -v t="$TARGET_LUFS" -v i="$now" 'BEGIN { printf "volume=%.2fdB,alimiter=limit=0.891:level=false:latency=true", t - i }')")
fi
mux() { # video audio out
  "$FFMPEG" -y -loglevel error -i "$1" -i "$2" -map 0:v -map 1:a -c:v copy "${AF[@]}" \
    -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$3"
  echo "$3"
}
VIDEO=${VIDEO:-out/video-$TAG.mp4}
mux "$VIDEO" "out/score-$TAG.wav" "out/asklocker-$TAG.mp4"
mux "$VIDEO" "out/sfx-$TAG.wav" "out/asklocker-$TAG-sfx-only.mp4"
