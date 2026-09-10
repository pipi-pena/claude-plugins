#!/usr/bin/env bash
# Anchored to a command boundary so a merely quoted "git push" in an echo or a
# heredoc does not trip the reminder.
set -u

command_text=$(jq -r '.tool_input.command // empty')

printf '%s' "$command_text" | grep -qE \
  '(^|[;&|(]|&&|\|\|)[[:space:]]*(git[[:space:]]+push|gh[[:space:]]+pr[[:space:]]+(create|edit))([[:space:]]|$)' \
  || exit 0

cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"About to push or open/edit a PR. Invoke the tidy-comments skill FIRST, unless it already ran since the last code change this session. It strips redundant, restating and AI-narration comments from the CHANGED LINES ONLY, in any language. It must NOT remove linter/scanner directives (# noqa, # type: ignore, //nolint, # checkov:skip, # shellcheck disable, eslint-disable, @ts-expect-error), pragmas, shebangs, build tags, generated-block markers, SPDX or license headers, or comments that are the product (Terraform description, OpenAPI description, public JSDoc). If nothing changed since the last run, just proceed."}}
JSON
