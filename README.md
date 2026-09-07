# claude-plugins

A personal Claude Code plugin marketplace by [@pipi-pena](https://github.com/pipi-pena).

## Add the marketplace

```
/plugin marketplace add pipi-pena/claude-plugins
/reload-plugins
```

## Install any plugin

```
/plugin install session-autotitle@pipi-pena-plugins
```

## Plugins

| Plugin | Description | Repo |
|--------|-------------|------|
| [session-autotitle](https://github.com/pipi-pena/session-autotitle) | Auto-generates a short descriptive title for every session on `SessionEnd`, instead of leaving it labeled with a raw UUID | [pipi-pena/session-autotitle](https://github.com/pipi-pena/session-autotitle) |

## Adding a new plugin

1. Create the plugin repo at `pipi-pena/<name>` (its own `.claude-plugin/plugin.json`, hooks/skills/agents, README, LICENSE).
2. Add an entry to `.claude-plugin/marketplace.json` in this repo, pointing `source` at that repo's `.git` URL.
3. Commit and push — the marketplace updates immediately, no build step.

## License

MIT — see [LICENSE](./LICENSE).
