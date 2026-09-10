# tidy-comments

Code gets written with a comment above every block explaining what the block
plainly says. That noise survives into the pull request and reviewers scroll
past it. This plugin removes it, in any language, from the changed lines only.

It ships two halves:

- **A skill** (`tidy-comments`) that does the work.
- **A `PreToolUse` hook** that reminds Claude to run the skill before
  `git push`, `gh pr create` or `gh pr edit`.

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
- `TODO` / `FIXME` that carries an owner or an issue link
- Anything on a line you did not change

It only removes comments. It does not rename, restructure, reformat, or fix
bugs.

## The hook

`hooks/pre-push-gate.sh` matches the Bash command against a command boundary,
so a `git push` merely quoted inside an `echo` or a heredoc does not trip the
reminder:

| Command | Reminder |
|---|---|
| `git push -u origin feat/x` | fires |
| `npm test && git push` | fires |
| `gh pr create --title x` | fires |
| `echo "probe: git push"` | silent |
| `git commit -m "prep git push"` | silent |
| `gh pr view 12` | silent |

The hook only injects a reminder. It never blocks the command.

## Run it on demand

```
/tidy-comments
```

Natural-language triggers work too: "too many comments", "clean up the
comments", "the code is too verbose".

## License

MIT — see [LICENSE](./LICENSE).
