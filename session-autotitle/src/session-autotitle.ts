#!/usr/bin/env node
/**
 * SessionEnd hook: generates a short descriptive title for the session and
 * records it as a custom-title entry in the session's own transcript, so it
 * replaces the raw UUID in /resume and `claude --resume` pickers.
 */
import { spawn } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";

interface SessionEndHookInput {
  readonly session_id: string | undefined;
  readonly transcript_path: string | undefined;
}

interface CustomTitleEntry {
  readonly type: "custom-title";
  readonly customTitle: string;
  readonly sessionId: string;
}

type TitleResult =
  | { readonly ok: true; readonly title: string }
  | { readonly ok: false; readonly reason: string };

interface CommandResult {
  readonly stdout: string;
  readonly exitCode: number | null;
}

const MIN_CONTENT_CHARS = 40;
const HEAD_CHARS = 6000;
const TAIL_CHARS = 3000;
const MAX_TITLE_WORDS = 10;
const CLAUDE_TIMEOUT_MS = 20_000;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extractText(content: unknown): readonly string[] {
  if (typeof content === "string") {
    return [content];
  }
  if (Array.isArray(content)) {
    return content
      .filter((block): block is Readonly<Record<string, unknown>> => isRecord(block) && block["type"] === "text")
      .flatMap((block) => (typeof block["text"] === "string" ? [block["text"]] : []));
  }
  return [];
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseHookInput(raw: string): SessionEndHookInput | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }
    const sessionId = parsed["session_id"];
    const transcriptPath = parsed["transcript_path"];
    return {
      session_id: typeof sessionId === "string" ? sessionId : undefined,
      transcript_path: typeof transcriptPath === "string" ? transcriptPath : undefined,
    };
  } catch {
    return null;
  }
}

async function collectTranscriptText(transcriptPath: string): Promise<readonly string[]> {
  const raw = await readFile(transcriptPath, "utf8");
  const texts: string[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    let entry: unknown;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!isRecord(entry)) {
      continue;
    }
    if (entry["type"] !== "user" && entry["type"] !== "assistant") {
      continue;
    }
    const message = entry["message"];
    const content = isRecord(message) ? message["content"] : undefined;
    texts.push(...extractText(content));
  }
  return texts;
}

function buildExcerpt(joined: string): string {
  if (joined.length <= HEAD_CHARS + TAIL_CHARS) {
    return joined;
  }
  return `${joined.slice(0, HEAD_CHARS)}\n...\n${joined.slice(-TAIL_CHARS)}`;
}

/** Runs a child process, feeding `input` on stdin and collecting stdout. Rejects on timeout. */
function runCommand(command: string, args: readonly string[], input: string, timeoutMs: number): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve, reject) => {
    // cwd is pinned away from the caller's directory: even with --bare, claude -p's
    // system prompt still includes ambient cwd/git-status context, and on a thin
    // transcript the model can latch onto that instead of the piped excerpt.
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], cwd: tmpdir() });
    const stdoutChunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.on("error", (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.stdin.on("error", (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode: number | null) => {
      clearTimeout(timer);
      resolve({ stdout: Buffer.concat(stdoutChunks).toString("utf8"), exitCode });
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

async function generateTitle(excerpt: string): Promise<TitleResult> {
  const prompt =
    "Summarize what this Claude Code session accomplished in 6-10 words, " +
    "Title Case, no punctuation, no quotes, no leading article like 'The'. " +
    `Output ONLY the title text, nothing else.\n\n---\n${excerpt}`;

  let result: CommandResult;
  try {
    result = await runCommand("claude", ["-p", "--bare", "--model", "haiku"], prompt, CLAUDE_TIMEOUT_MS);
  } catch (error) {
    return { ok: false, reason: `claude -p failed to run: ${toMessage(error)}` };
  }

  if (result.exitCode !== 0) {
    return { ok: false, reason: `claude -p exited with code ${String(result.exitCode)}` };
  }

  const title = result.stdout.trim().replace(/^['"]|['"]$/g, "");
  if (title === "") {
    return { ok: false, reason: "claude -p returned an empty title" };
  }

  const capped = title.split(/\s+/).slice(0, MAX_TITLE_WORDS).join(" ");
  return { ok: true, title: capped };
}

async function appendCustomTitle(transcriptPath: string, sessionId: string, title: string): Promise<void> {
  const entry: CustomTitleEntry = { type: "custom-title", customTitle: title, sessionId };
  await appendFile(transcriptPath, `${JSON.stringify(entry)}\n`, "utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const payload = parseHookInput(raw);
  if (payload === null || payload.session_id === undefined || payload.transcript_path === undefined) {
    return;
  }
  const { session_id: sessionId, transcript_path: transcriptPath } = payload;

  let texts: readonly string[];
  try {
    texts = await collectTranscriptText(transcriptPath);
  } catch (error) {
    process.stderr.write(`session-autotitle: failed to read transcript ${transcriptPath}: ${toMessage(error)}\n`);
    return;
  }

  const joined = texts.join("\n").trim();
  if (joined.length < MIN_CONTENT_CHARS) {
    return;
  }

  const result = await generateTitle(buildExcerpt(joined));
  if (!result.ok) {
    process.stderr.write(`session-autotitle: ${result.reason}\n`);
    return;
  }

  try {
    await appendCustomTitle(transcriptPath, sessionId, result.title);
  } catch (error) {
    process.stderr.write(`session-autotitle: failed to write title to ${transcriptPath}: ${toMessage(error)}\n`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`session-autotitle: unexpected error: ${toMessage(error)}\n`);
});
