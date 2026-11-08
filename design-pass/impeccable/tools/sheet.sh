#!/bin/sh
# sheet.sh out.jpg img1 img2 ... (side by side, each scaled to 330px wide)
out=$1; shift
n=$#; inputs=""; filt=""; i=0
for f in "$@"; do inputs="$inputs -i $f"; filt="$filt[$i:v]scale=330:-1[v$i];"; i=$((i+1)); done
stack=""; i=0; for f in "$@"; do stack="$stack[v$i]"; i=$((i+1)); done
ffmpeg -loglevel error -y $inputs -filter_complex "${filt}${stack}hstack=inputs=$n" -q:v 4 "$out"
