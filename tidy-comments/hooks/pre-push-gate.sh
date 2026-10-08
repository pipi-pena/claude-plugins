#!/usr/bin/env bash
# Blocks `git push` and `gh pr create|edit` until tidy-comments has sealed the
# commit at HEAD (see mark-tidied.sh). A new commit invalidates the seal, so the
# skill has to run again before the next push.
#
# The pattern is anchored to a command boundary so a merely quoted "git push" in
# an echo or a heredoc does not trip the gate.
set -u

seal_dir="${TIDY_GATE_DIR:-$HOME/.claude/.tidy-gate}"
mark_script="$(cd "$(dirname "$0")" && pwd)/mark-tidied.sh"

payload=$(cat)
command_text=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')
session_cwd=$(printf '%s' "$payload" | jq -r '.cwd // empty')

printf '%s' "$command_text" | grep -qE \
  '(^|[;&|(]|&&|\|\|)[[:space:]]*git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push([[:space:]]|$)|(^|[;&|(]|&&|\|\|)[[:space:]]*gh[[:space:]]+pr[[:space:]]+(create|edit)([[:space:]]|$)' \
  || exit 0

# The Bash tool resets cwd on every call, so the repo is usually named inside the
# command itself: `cd <dir> && git push` or `git -C <dir> push`.
target_dir=$(printf '%s' "$command_text" | sed -nE \
  -e 's/.*git[[:space:]]+-C[[:space:]]+("([^"]+)"|'"'"'([^'"'"']+)'"'"'|([^[:space:]]+)).*/\2\3\4/p' | head -n1)
if [ -z "$target_dir" ]; then
  target_dir=$(printf '%s' "$command_text" | sed -nE \
    -e 's/(^|.*[;&|(])[[:space:]]*cd[[:space:]]+("([^"]+)"|'"'"'([^'"'"']+)'"'"'|([^[:space:];&|]+)).*/\3\4\5/p' | head -n1)
fi
target_dir="${target_dir/#\~/$HOME}"
case "$target_dir" in
  "") target_dir="$session_cwd" ;;
  /*) ;;
  *) target_dir="${session_cwd:-.}/$target_dir" ;;
esac

top=$(git -C "$target_dir" rev-parse --show-toplevel 2>/dev/null) || exit 0
head_sha=$(git -C "$target_dir" rev-parse HEAD 2>/dev/null) || exit 0

seal_key=$(printf '%s' "$top" | shasum | cut -c1-16)
if [ -f "$seal_dir/$seal_key" ] && [ "$(cat "$seal_dir/$seal_key")" = "$head_sha" ]; then
  exit 0
fi

reason="tidy-comments has not run for the commit at HEAD (${head_sha:0:8}) in ${top}. Run the tidy-comments skill on the changed lines (keep directives, pragmas, swagger/OpenAPI annotations, license headers; never leave tracker references in comments), commit any edits, then run: cd '${top}' && bash '${mark_script}' - and retry this command."
jq -n --arg reason "$reason" \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
