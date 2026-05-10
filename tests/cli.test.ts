/**
 * CLI integration tests.
 *
 * Tests the `main()` function directly (no subprocess) to verify argument
 * parsing, exit codes, and output format routing.
 */
import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { main } from "../src/cli.js";

const FIXTURES = path.resolve("tests/fixtures");

describe("CLI — --help flag", () => {
  it("exits 0 and prints usage", async () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      writes.push(String(s));
      return true;
    });
    const code = await main(["--help"]);
    vi.restoreAllMocks();
    expect(code).toBe(0);
    expect(writes.join("")).toContain("Usage:");
  });
});

describe("CLI — --version flag", () => {
  it("exits 0 and prints version string", async () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      writes.push(String(s));
      return true;
    });
    const code = await main(["--version"]);
    vi.restoreAllMocks();
    expect(code).toBe(0);
    expect(writes.join("")).toMatch(/diplomat-agent-ts \d+\.\d+\.\d+/);
  });
});

describe("CLI — invalid path", () => {
  it("exits 2 for non-existent path", async () => {
    const stderrWrites: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((s) => {
      stderrWrites.push(String(s));
      return true;
    });
    const code = await main(["--", "/does/not/exist/abc123"]);
    vi.restoreAllMocks();
    expect(code).toBe(2);
  });
});

describe("CLI — unguarded-payment fixture", () => {
  it("scans fixture and returns exit 0 without --fail-on-unchecked", async () => {
    const stdoutWrites: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      stdoutWrites.push(String(s));
      return true;
    });
    const code = await main([path.join(FIXTURES, "unguarded-payment")]);
    vi.restoreAllMocks();
    // No --fail-on-unchecked: should exit 0 even with unguarded tools
    expect(code).toBe(0);
  });

  it("exits 1 with --fail-on-unchecked when unguarded tools exist", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await main([
      path.join(FIXTURES, "unguarded-payment"),
      "--fail-on-unchecked",
    ]);
    vi.restoreAllMocks();
    expect(code).toBe(1);
  });
});

describe("CLI — --format json", () => {
  it("produces JSON output containing tools array", async () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      writes.push(String(s));
      return true;
    });
    const code = await main([
      path.join(FIXTURES, "unguarded-payment"),
      "--format",
      "json",
    ]);
    vi.restoreAllMocks();
    expect(code).toBe(0);
    const output = writes.join("");
    const parsed = JSON.parse(output) as { tool_calls: unknown[] };
    expect(Array.isArray(parsed.tool_calls)).toBe(true);
  });
});

describe("CLI — readonly-only fixture", () => {
  it("reports 0 tools and exits 0", async () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      writes.push(String(s));
      return true;
    });
    const code = await main([path.join(FIXTURES, "readonly-only")]);
    vi.restoreAllMocks();
    expect(code).toBe(0);
    // Even with --fail-on-unchecked there should be no unguarded tools
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code2 = await main([
      path.join(FIXTURES, "readonly-only"),
      "--fail-on-unchecked",
    ]);
    vi.restoreAllMocks();
    expect(code2).toBe(0);
  });
});
