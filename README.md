# session-autotitle

A [Claude Code](https://claude.com/claude-code) plugin that automatically gives every session a short, descriptive name when it ends — instead of leaving it labeled with a raw UUID in `/resume` and `claude --resume`.

**Before:** `7da313f4-49d0-4d2b-805e-7c1de275a517`
**After:** `Session Auto-Rename Hook`

## How it works

It registers a single `SessionEnd` hook. When a session ends, the hook:

1. Reads the session's transcript (`transcript_path` from the hook's stdin JSON).
2. Pulls out all the user/assistant text.
3. Asks a fast model (`claude -p --bare --model haiku`) to summarize what the session accomplished in 6–10 words.
4. Appends a `custom-title` entry to the transcript with that summary.

That last step uses the exact same mechanism Claude Code itself uses when you run `-n`/`--name` or `/rename` — so the generated title shows up everywhere sessions are listed, with no extra state to manage.

The summarization call runs with `--bare`, which skips hooks, CLAUDE.md, and plugin loading for that sub-invocation — so it can't recursively trigger itself, and stays fast and cheap (Haiku).

## Requirements

- Claude Code with the `claude` CLI available on `PATH`.
- `python3` available on `PATH`.
- An authenticated `claude` session (subscription login, or `ANTHROPIC_API_KEY` / `apiKeyHelper` configured) — the hook shells out to `claude -p` to generate the title.

## Install

```
/plugin marketplace add pipi-pena/session-autotitle
/plugin install session-autotitle@session-autotitle
```

Then reload plugins (or restart Claude Code) so the hook takes effect:

```
/reload-plugins
```

### Alternative: without the plugin system

If you'd rather wire it up by hand, copy `scripts/session-autotitle.py` somewhere and add this to your `settings.json` (global `~/.claude/settings.json`, or project-level `.claude/settings.json`):

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/session-autotitle.py",
            "timeout": 20
          }
        ]
      }
    ]
  }
}
```

## Notes

- Very short sessions (little to no user/assistant content) are skipped — no point summarizing an empty session.
- If the `claude -p` call fails or times out for any reason, the hook just exits quietly without writing a title. It never blocks session exit.
- Titles are capped at 10 words, Title Case, no punctuation.

## License

MIT — see [LICENSE](./LICENSE).
