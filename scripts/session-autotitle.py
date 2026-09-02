#!/usr/bin/env python3
"""SessionEnd hook: auto-generate a short descriptive title for the session
and record it as a custom-title entry in the session's own transcript, so it
replaces the raw UUID in /resume and claude --resume pickers."""
import json
import os
import subprocess
import sys

MIN_CONTENT_CHARS = 40
HEAD_CHARS = 6000
TAIL_CHARS = 3000
MAX_TITLE_WORDS = 10


def extract_text(content):
    if isinstance(content, str):
        return [content]
    if isinstance(content, list):
        out = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                out.append(block.get("text", ""))
        return out
    return []


def collect_transcript_text(transcript_path):
    texts = []
    with open(transcript_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if entry.get("type") not in ("user", "assistant"):
                continue
            message = entry.get("message", {})
            texts.extend(extract_text(message.get("content")))
    return texts


def build_excerpt(joined):
    if len(joined) <= HEAD_CHARS + TAIL_CHARS:
        return joined
    return joined[:HEAD_CHARS] + "\n...\n" + joined[-TAIL_CHARS:]


def generate_title(excerpt):
    prompt = (
        "Summarize what this Claude Code session accomplished in 6-10 words, "
        "Title Case, no punctuation, no quotes, no leading article like 'The'. "
        "Output ONLY the title text, nothing else.\n\n---\n" + excerpt
    )
    try:
        result = subprocess.run(
            ["claude", "-p", "--bare", "--model", "haiku"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except Exception:
        return None
    if result.returncode != 0:
        return None
    title = result.stdout.strip().strip("\"'")
    if not title:
        return None
    return " ".join(title.split()[:MAX_TITLE_WORDS])


def main():
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        return

    session_id = payload.get("session_id")
    transcript_path = payload.get("transcript_path")
    if not session_id or not transcript_path or not os.path.isfile(transcript_path):
        return

    try:
        texts = collect_transcript_text(transcript_path)
    except OSError:
        return

    joined = "\n".join(t for t in texts if t).strip()
    if len(joined) < MIN_CONTENT_CHARS:
        return

    title = generate_title(build_excerpt(joined))
    if not title:
        return

    entry = {"type": "custom-title", "customTitle": title, "sessionId": session_id}
    try:
        with open(transcript_path, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except OSError:
        pass


if __name__ == "__main__":
    main()
