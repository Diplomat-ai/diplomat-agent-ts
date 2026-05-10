// Regression fixture for SPEC FIX 4 (OpenClaw-driven).
// A file that imports child_process AND makes regex.exec() calls.
// The scanner must flag ONLY the legitimate spawn() call as destructive;
// all regex.exec() calls are read-only string operations and must NOT be flagged.

import { spawn } from "node:child_process";

const PATH_RE = /^extensions\/([^/]+)\//;
const VERSION_RE = /^v(\d+)\.(\d+)\.(\d+)$/;

export function legitSpawn() {
  return spawn("ls", ["-la"]);
}

export function regexLiteralExec(s: string) {
  // Inline regex literal — must NOT be flagged destructive
  return /^[a-z]+$/.exec(s);
}

export function storedRegexExec(s: string) {
  // Stored regex variable — must NOT be flagged destructive
  return PATH_RE.exec(s);
}

export function multipleRegexExec(s: string) {
  // Multiple regex.exec() in one function — must NOT be flagged destructive
  const a = PATH_RE.exec(s);
  const b = VERSION_RE.exec(s);
  return { a, b };
}
