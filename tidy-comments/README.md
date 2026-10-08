# tidy-comments

Code gets written with a comment above every block explaining what the block
plainly says. That noise survives into the pull request and reviewers scroll
past it. This plugin removes it, in any language, from the changed lines only.

It ships two halves:

- **A skill** (`tidy-comments`) that does the work.
- **A `PreToolUse` gate** that blocks `git push`, `gh pr create` and
  `gh pr edit` until the skill has run for the commit at `HEAD`.

## Install

```
/plugin marketplace add pipi-pena/claude-plugins
/plugin install tidy-comments@pipi-pena-plugins
```

## The test a comment has to pass

A comment earns its place by doing one of two things:

1. **Naming the feature** the code enables — why it exists at all.
2. **Stating an invariant a future edit could silently break** — a required
   ordering, the reason a guard exists, the regression a test specifically
   catches.

Everything else goes. The operative question: *if I delete this, does a future
reader lose anything?*

## Logic, not provenance

A comment explains what the code does and why. It never names where the
requirement came from: no Linear or Jira ids, GitHub issue or PR numbers, Notion
links, `RFC-`/`ADR-`/`INC-` ids, incident names, or "per <person>". This holds
for comments Claude writes while coding, not only for the ones it tidies.

```go
// Before — the ticket is the whole comment
// RFC-092 R3: never mix features in one Require

// After — the rule itself
// a Require covers a single feature; register a twin route for the other one
```

A pointer with a real reason behind it is rewritten as that reason; a bare
pointer is deleted. Tracker links belong in the commit message or PR description.

```hcl
# Before
# Create the storage account for the registry
# This uses the standard tier
resource "azurerm_storage_account" "registry" { ... }

# After — the name and the arguments already said all of that
resource "azurerm_storage_account" "registry" { ... }
```

## What it never touches

Deleting one of these breaks the build, the linter, or a compliance gate, so the
skill leaves them alone:

- Linter and scanner directives — `# noqa`, `# type: ignore`, `# nosec`,
  `//nolint:`, `# shellcheck disable=`, `# checkov:skip=`, `# tflint-ignore:`,
  `eslint-disable`, `@ts-expect-error`
- Compiler and tooling pragmas — shebangs, `//go:build`, `# fmt: off`,
  `# renovate:`
- Generated-block markers — `<!-- BEGIN_TF_DOCS -->`, `DO NOT EDIT` banners
- License and SPDX headers
- Comments that are the product — a Terraform `description`, an OpenAPI
  `description:`, JSDoc on an exported public API
- `TODO` / `FIXME` that says what must change and why (tracker ids are removed)
- Anything on a line you did not change

It only removes comments. It does not rename, restructure, reformat, or fix
bugs.

## The gate

`hooks/pre-push-gate.sh` matches the Bash command against a command boundary,
so a `git push` merely quoted inside an `echo` or a heredoc does not trip it. It
finds the repository from `cd <dir> && ...` or `git -C <dir> ...` as well as the
session directory.

The gate is verified, not time-based: when the skill finishes it runs
`hooks/mark-tidied.sh`, which seals the current `HEAD` commit. The gate allows
the command only while that seal matches `HEAD`. Any new commit invalidates it,
so the skill has to run again before the next push.

| Command | State | Result |
|---|---|---|
| `git push -u origin feat/x` | no seal for `HEAD` | blocked |
| `git push` | sealed at `HEAD` | allowed |
| `git push` after another commit | seal is stale | blocked |
| `cd repo && gh pr create --title x` | no seal | blocked |
| `echo "probe: git push"` | any | silent |
| `gh pr view 12` | any | silent |
| `git push` outside a git repository | nothing to check | silent |

Seals live in `~/.claude/.tidy-gate/` (override with `TIDY_GATE_DIR`).

## Run it on demand

```
/tidy-comments
```

Natural-language triggers work too: "too many comments", "clean up the
comments", "the code is too verbose".

## License

MIT — see [LICENSE](./LICENSE).
