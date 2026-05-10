/**
 * Niveau 4 — End-to-end CLI tests.
 *
 * Invokes the compiled `dist/cli.js` as a subprocess and validates
 * exit codes, stdout/stderr content, and output files.
 *
 * Requires a prior `npm run build`. If dist/ is absent the suite is skipped.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const ROOT = path.resolve(".");
const CLI = path.join(ROOT, "dist", "cli.js");
const FIXTURE_PAYMENT = path.join(ROOT, "tests", "fixtures", "unguarded-payment-stripe");
const FIXTURE_CONFIRMED = path.join(ROOT, "tests", "fixtures", "annotation-confirmed");

function cliAvailable(): boolean {
  return fs.existsSync(CLI);
}

function cli(args: string[], env?: Record<string, string>) {
  const result = spawnSync("node", [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    cwd: ROOT,
  });
  return {
    status: result.status,
    stdout: result.stdout as string,
    stderr: result.stderr as string,
  };
}

beforeAll(() => {
  if (!cliAvailable()) {
    console.warn("dist/cli.js not found — skipping E2E CLI tests. Run `npm run build` first.");
  }
});

describe("CLI: --version", () => {
  it("exits 0 and prints a semver version", () => {
    if (!cliAvailable()) return;
    const result = cli(["--version"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });
});

describe("CLI: --help", () => {
  it("exits 0 and prints usage information", () => {
    if (!cliAvailable()) return;
    const result = cli(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout.toLowerCase()).toMatch(/usage|options|diplomat/);
  });
});

describe("CLI: missing path argument", () => {
  it("exits 2 when no path is provided", () => {
    if (!cliAvailable()) return;
    const result = cli([]);
    expect(result.status).toBe(2);
  });
});

describe("CLI: non-existent path", () => {
  it("exits non-zero for a path that does not exist", () => {
    if (!cliAvailable()) return;
    const result = cli(["/non-existent-path-xyz-123"]);
    expect(result.status).not.toBe(0);
  });
});

describe("CLI: --format terminal (default)", () => {
  it("exits 0 and outputs tool information to stdout", () => {
    if (!cliAvailable()) return;
    const result = cli([FIXTURE_PAYMENT]);
    expect(result.status).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
  });
});

describe("CLI: --format json", () => {
  it("exits 0 and outputs valid JSON", () => {
    if (!cliAvailable()) return;
    const result = cli([FIXTURE_PAYMENT, "--format", "json"]);
    expect(result.status).toBe(0);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  });

  it("JSON output has spec_version 1.0 and tool_calls array", () => {
    if (!cliAvailable()) return;
    const result = cli([FIXTURE_PAYMENT, "--format", "json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.spec_version).toBe("1.0");
    expect(Array.isArray(parsed.tool_calls)).toBe(true);
  });
});

describe("CLI: --format registry", () => {
  it("exits 0 and outputs YAML with spec_version", () => {
    if (!cliAvailable()) return;
    const result = cli([FIXTURE_PAYMENT, "--format", "registry"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/spec_version:\s*['"]?1\.0['"]?/);
  });
});

describe("CLI: --output-registry", () => {
  it("writes YAML to the specified file", () => {
    if (!cliAvailable()) return;
    const tmpFile = path.join(os.tmpdir(), `diplomat-test-${Date.now()}.yaml`);
    try {
      const result = cli([FIXTURE_PAYMENT, "--output-registry", tmpFile]);
      expect(result.status).toBe(0);
      expect(fs.existsSync(tmpFile)).toBe(true);
      const content = fs.readFileSync(tmpFile, "utf8");
      expect(content).toMatch(/spec_version/);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });
});

describe("CLI: --fail-on-unchecked", () => {
  it("exits 1 when unchecked tools are found", () => {
    if (!cliAvailable()) return;
    const result = cli([FIXTURE_PAYMENT, "--fail-on-unchecked"]);
    expect(result.status).toBe(1);
  });

  it("exits 0 when all tools are confirmed", () => {
    if (!cliAvailable()) return;
    const result = cli([FIXTURE_CONFIRMED, "--fail-on-unchecked"]);
    // annotation-confirmed has a checked:ok annotation → no unchecked tools
    expect(result.status).toBe(0);
  });
});

describe("CLI: NO_COLOR env var", () => {
  it("suppresses ANSI color codes when NO_COLOR=1", () => {
    if (!cliAvailable()) return;
    const result = cli([FIXTURE_PAYMENT], { NO_COLOR: "1" });
    // Should not contain ESC character (ANSI escape sequence start)
    // eslint-disable-next-line no-control-regex
    expect(result.stdout).not.toMatch(/\x1b\[/);
  });
});
