# claude-plugins

A personal Claude Code plugin marketplace by [@pipi-pena](https://github.com/pipi-pena).

Every plugin lives in this repository, in its own top-level directory. The
marketplace manifest points at them with relative sources, so there is one repo
to clone and one place to edit.

## Add the marketplace

```
/plugin marketplace add pipi-pena/claude-plugins
/reload-plugins
```

## Install a plugin

```
/plugin install session-autotitle@pipi-pena-plugins
/plugin install tidy-comments@pipi-pena-plugins
```

## Plugins

| Plugin | What it does |
|--------|--------------|
| [session-autotitle](./session-autotitle) | Auto-generates a short descriptive title for every session on `SessionEnd`, instead of leaving it labeled with a raw UUID |
| [tidy-comments](./tidy-comments) | Strips redundant and AI-narration comments from changed code in any language, and reminds you to run it before every push or pull request |

## Adding a new plugin

1. Create `<name>/` at the root of this repo, with its own
   `.claude-plugin/plugin.json` plus whatever it ships (`hooks/`, `skills/`,
   `agents/`, `commands/`), a README and a LICENSE.
2. Add an entry to `.claude-plugin/marketplace.json` with
   `"source": "./<name>"`.
3. Commit and push — the marketplace updates immediately, no build step.

A plugin directory must not contain its own `marketplace.json`. This repo is the
only marketplace; a nested manifest is ignored at best and confusing at worst.

## License

MIT — see [LICENSE](./LICENSE).
