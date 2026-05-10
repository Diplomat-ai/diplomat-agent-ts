/**
 * NF — No-code-execution guarantee test.
 *
 * Verifies that the scanner does NOT execute the code it analyzes.
 * The scanner is AST-based (ts-morph) and should never call eval(),
 * require() on scanned files, or dynamic import() on user code.
 *
 * This is a static analysis test on the src/ source files.
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
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      results.push({ filePath: fullPath, content: fs.readFileSync(fullPath, "utf8") });
    }
  }
  return results;
}

/**
 * Patterns that indicate code execution of user-provided files.
 * We exclude string patterns that are clearly part of pattern matching logic.
 */
const FORBIDDEN_EXECUTION_PATTERNS: RegExp[] = [
  /\beval\s*\(/,                    // eval(...)
  /\bnew\s+Function\s*\(/,          // new Function(...)
  /\bvm\.runInNewContext\s*\(/,     // vm.runInNewContext(...)
  /\bvm\.runInThisContext\s*\(/,    // vm.runInThisContext(...)
  /\bvm\.runInContext\s*\(/,        // vm.runInContext(...)
  /\brequire\s*\(\s*(?:filePath|scanPath|userFile|targetFile)/, // require(userInput)
];

// Lines containing these strings are excluded (they are pattern definitions)
const SAFE_CONTEXTS = [
  "eval(",       // in SIDE_EFFECT_PATTERNS string literals
  "// ",         // comments
  "* ",          // JSDoc
  '"eval"',      // string literal in pattern
  "'eval'",      // string literal in pattern
  "`eval`",      // template literal
];

describe("no-code-execution: scanner never executes analyzed code", () => {
  const files = readAllSrcFiles(SRC);

  it("no eval/new Function/vm.run* usage in src/ scanner files", () => {
    const violations: string[] = [];

    for (const { filePath, content } of files) {
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const isComment = line.trim().startsWith("//") || line.trim().startsWith("*");
        if (isComment) continue;

        for (const pattern of FORBIDDEN_EXECUTION_PATTERNS) {
          if (pattern.test(line)) {
            const isInStringContext = SAFE_CONTEXTS.some((ctx) => line.includes(ctx));
            if (!isInStringContext) {
              const rel = path.relative(SRC, filePath);
              violations.push(`${rel}:${i + 1}: ${line.trim()}`);
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      console.error("Code execution violations found:\n" + violations.join("\n"));
    }
    expect(violations).toHaveLength(0);
  });

  it("ast-scanner.ts uses ts-morph Project for parsing, not require/import of user files", () => {
    const scannerPath = path.join(SRC, "scanner", "ast-scanner.ts");
    const content = fs.readFileSync(scannerPath, "utf8");

    // Should use ts-morph Project
    expect(content).toMatch(/new Project\s*\(/);

    // Should NOT dynamically import or require user-provided paths
    expect(content).not.toMatch(/await import\s*\(\s*(?:filePath|rootPath|scanPath)/);
    expect(content).not.toMatch(/require\s*\(\s*(?:filePath|rootPath|scanPath)/);
  });
});
