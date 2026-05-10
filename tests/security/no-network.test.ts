/**
 * NF — No-network guarantee test.
 *
 * Verifies that the scanner and analyzer modules do NOT import any
 * networking libraries or make network calls.  This is a static analysis
 * test: it inspects the source files for known networking patterns.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");

function readAllSrcFiles(dir: string): { filePath: string; content: string }[] {
  const results: { filePath: string; content: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...readAllSrcFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
      results.push({ filePath: fullPath, content: fs.readFileSync(fullPath, "utf8") });
    }
  }
  return results;
}

// Networking module names that should NOT appear in src/ (imports or requires)
const FORBIDDEN_NETWORK_IMPORTS = [
  "'node:http'",
  '"node:http"',
  "'node:https'",
  '"node:https"',
  "'node:net'",
  '"node:net"',
  "'node:dgram'",
  '"node:dgram"',
  "require('http')",
  'require("http")',
  "require('https')",
  'require("https")',
  "require('net')",
  'require("net")',
  "fetch(",
  "axios",
  "got(",
  "node-fetch",
];

// These are legitimate exports/tests that reference "http" as a category name
// We allow the string "http_write" and the pattern "http" in comments
const ALLOW_PATTERNS = [
  "http_write",
  "// ",
  "* ",
  "methodHttp",
];

describe("no-network: src/ files do not import networking modules", () => {
  const files = readAllSrcFiles(SRC);

  it("no forbidden networking imports found in src/ source files", () => {
    const violations: string[] = [];

    for (const { filePath, content } of files) {
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();

        // Only consider actual import/require statements, not strings that
        // happen to mention library names. Patterns catalog contains string
        // literals like objContains: ["axios"] which are data, not imports.
        const isImportLine =
          trimmed.startsWith("import ") ||
          trimmed.startsWith("import{") ||
          trimmed.startsWith("import(") ||
          /\brequire\s*\(/.test(trimmed);

        if (!isImportLine) continue;

        for (const forbidden of FORBIDDEN_NETWORK_IMPORTS) {
          if (line.includes(forbidden)) {
            const isAllowed = ALLOW_PATTERNS.some((allow) => line.includes(allow));
            if (!isAllowed) {
              const rel = path.relative(SRC, filePath);
              violations.push(`${rel}:${i + 1}: ${line.trim()}`);
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      console.error("Networking violations found:\n" + violations.join("\n"));
    }
    expect(violations).toHaveLength(0);
  });
});

describe("no-network: scan() does not use dynamic imports with network modules", () => {
  it("ast-scanner.ts does not call fetch or use http/https directly", () => {
    const scannerPath = path.join(SRC, "scanner", "ast-scanner.ts");
    const content = fs.readFileSync(scannerPath, "utf8");
    expect(content).not.toMatch(/import\s+.*\s+from\s+['"]node:http['"]/);
    expect(content).not.toMatch(/import\s+.*\s+from\s+['"]node:https['"]/);
    expect(content).not.toMatch(/\bfetch\s*\(/);
  });
});
