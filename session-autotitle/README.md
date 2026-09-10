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
- [Node.js](https://nodejs.org/) 18+ available on `PATH` (no TypeScript toolchain needed at runtime — the plugin ships pre-compiled JavaScript in `dist/`).
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

If you'd rather wire it up by hand, copy `dist/session-autotitle.js` somewhere and add this to your `settings.json` (global `~/.claude/settings.json`, or project-level `.claude/settings.json`):

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/session-autotitle.js",
            "timeout": 20
          }
        ]
      }
    ]
  }
}
```

## Development

The hook is written in TypeScript (`src/session-autotitle.ts`) and follows the [ts-patterns](https://github.com/gagoar/typescript-patterns-enforcer) conventions: no `any`, explicit return types, `readonly` by default, `async`/`await` only, and typed (discriminated-union) results instead of silently swallowed errors.

```
npm install
npm run typecheck   # tsc --noEmit
npm run build        # compiles src/ -> dist/
```

`dist/session-autotitle.js` is committed so the plugin works out of the box with just Node — no build step required for end users.

## Notes

- Very short sessions (little to no user/assistant content) are skipped — no point summarizing an empty session.
- If the `claude -p` call fails or times out for any reason, the hook logs the reason to stderr and exits quietly. It never blocks session exit.
- Titles are capped at 10 words, Title Case, no punctuation.

## License

MIT — see [LICENSE](./LICENSE).
