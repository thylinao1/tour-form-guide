#!/bin/bash
# Join the captured frames and the narration into one MP4.
#   tools/video/assemble.sh <frames_dir> <audio_dir> <out.mp4>
# For each scene: frames at 10 per second plus its narration (audio padded with silence to the scene length).
set -euo pipefail
FR="$1"; AU="$2"; OUT="$3"; HERE="$(cd "$(dirname "$0")" && pwd)"; TMP="$(mktemp -d)"
: > "$TMP/list.txt"
for id in $(python3 -c "import json;print(' '.join(s['id'] for s in json.load(open('$HERE/storyboard.json'))['scenes']))"); do
  n=$(ls "$FR/$id" | wc -l | tr -d ' '); dur=$(python3 -c "print($n/10)")
  ffmpeg -v error -y -framerate 10 -i "$FR/$id/f%05d.jpg" -i "$AU/$id.wav" \
    -filter_complex "[0:v]fps=25,format=yuv420p[v];[1:a]adelay=250|250,apad,atrim=0:$dur,aresample=48000[a]" \
    -map "[v]" -map "[a]" -t "$dur" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k "$TMP/$id.mp4"
  echo "file '$TMP/$id.mp4'" >> "$TMP/list.txt"
done
ffmpeg -v error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
rm -rf "$TMP"
