#!/usr/bin/env node
/**
 * Build curated agent session JSON from Cursor transcript (text-only, sanitized).
 *   node scripts/build-agent-session-curated.mjs [transcript.jsonl]
 */
import fs from "fs";
import path from "path";

const transcriptPath =
  process.argv[2] ||
  path.join(
    process.env.HOME,
    ".cursor/projects/Users-questtech-projects-hacktoberfest/agent-transcripts/dbfdd54d-79fd-40a2-bc22-71de4913b226/dbfdd54d-79fd-40a2-bc22-71de4913b226.jsonl",
  );

const lines = fs.readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);

function sanitize(text) {
  return text
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, "[REDACTED_KEY]")
    .replace(/dev_[A-Za-z0-9_-]{10,}/g, "[REDACTED_KEY]")
    .replace(/ghp_[A-Za-z0-9]{20,}/g, "[REDACTED_KEY]")
    .replace(/ELEVENLABS_API_KEY=\S+/gi, "ELEVENLABS_API_KEY=[REDACTED]")
    .replace(/MONGODB_URI=\S+/gi, "MONGODB_URI=[REDACTED]")
    .replace(/\/Users\/[^\s"'`]+/g, "[PATH]")
    .replace(/<timestamp>[\s\S]*?<\/timestamp>\s*/g, "")
    .replace(/\[REDACTED\]/g, "")
    .trim();
}

function textFromContent(content) {
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (block.type === "text" && block.text) {
      const t = sanitize(block.text);
      if (t) parts.push(t);
    }
  }
  return parts.join("\n\n").trim();
}

const messages = [];
for (const line of lines) {
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    continue;
  }
  const role = row.role;
  const content = row.message?.content ?? row.content;
  const text = textFromContent(content);
  if (!text || text.length < 8) continue;
  if (role !== "user" && role !== "assistant") continue;
  messages.push({
    role,
    content: [{ type: "text", text: text.slice(0, 12000) }],
  });
}

/** Collapse consecutive same-role turns (DEV expects alternating user/assistant). */
const merged = [];
for (const msg of messages) {
  const last = merged[merged.length - 1];
  if (last && last.role === msg.role) {
    last.content[0].text += `\n\n---\n\n${msg.content[0].text}`;
    if (last.content[0].text.length > 16000) {
      last.content[0].text = last.content[0].text.slice(-16000);
    }
  } else {
    merged.push({ role: msg.role, content: [{ type: "text", text: msg.content[0].text }] });
  }
}

const out = {
  title: "House Pot — full HF26 build log (demo, ML, submission sync)",
  tool_name: "codex",
  curated_data: {
    messages: merged,
    metadata: {
      tool_name: "codex",
      session_id: "house-pot-dbfdd54d",
      total_messages: merged.length,
      curated_indices: merged.map((_, i) => i),
      project: "https://github.com/smriad/house-pot",
      live: "https://house-pot.onrender.com/",
    },
  },
};

const outPath = path.join(process.cwd(), ".data", "agent-session-curated.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 0));
console.log("Wrote", outPath, "messages:", merged.length);
