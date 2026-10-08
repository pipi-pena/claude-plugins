#!/usr/bin/env bash
# Records that tidy-comments finished for the commit currently at HEAD.
# pre-push-gate.sh only lets a push or PR through while this seal matches HEAD.
set -eu

top=$(git rev-parse --show-toplevel)
head_sha=$(git rev-parse HEAD)
seal_dir="${TIDY_GATE_DIR:-$HOME/.claude/.tidy-gate}"
seal_key=$(printf '%s' "$top" | shasum | cut -c1-16)

mkdir -p "$seal_dir"
printf '%s\n' "$head_sha" > "$seal_dir/$seal_key"
echo "tidy-comments: sealed $head_sha for $top"
