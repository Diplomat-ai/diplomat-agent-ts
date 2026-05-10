/**
 * NF — Dependency audit tests.
 *
 * Verifies that the package.json does not declare any forbidden or
 * unexpected runtime dependencies.  The scanner should be thin:
 * only ts-morph for AST and yaml for output are expected.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PKG_PATH = path.resolve("package.json");
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  version?: string;
};

// Runtime deps that are expected
const EXPECTED_RUNTIME_DEPS = ["ts-morph", "yaml"];

// Runtime deps that must NOT appear (security / bloat concerns)
const FORBIDDEN_RUNTIME_DEPS = [
  "lodash",
  "axios",
  "node-fetch",
  "express",
  "fastify",
  "koa",
  "hapi",
  "prisma",
  "stripe",
  "openai",
  "@anthropic-ai/sdk",
];

describe("meta: package.json dependency audit", () => {
  const deps = pkg.dependencies ?? {};

  it("package has a version string", () => {
    expect(typeof pkg.version).toBe("string");
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("expected runtime dependencies are present", () => {
    for (const dep of EXPECTED_RUNTIME_DEPS) {
      expect(Object.keys(deps), `Expected runtime dep "${dep}" to be present`).toContain(dep);
    }
  });

  it("no forbidden runtime dependencies present", () => {
    for (const dep of FORBIDDEN_RUNTIME_DEPS) {
      expect(Object.keys(deps), `Forbidden runtime dep "${dep}" found`).not.toContain(dep);
    }
  });

  it("runtime dependencies count is reasonable (≤10)", () => {
    const count = Object.keys(deps).length;
    expect(count, `Too many runtime deps: ${count}`).toBeLessThanOrEqual(10);
  });
});

describe("meta: type-safety checks", () => {
  it("src/index.ts exists and exports are present", () => {
    const indexPath = path.resolve("src", "index.ts");
    expect(fs.existsSync(indexPath)).toBe(true);
    const content = fs.readFileSync(indexPath, "utf8");
    expect(content).toMatch(/export/);
  });

  it("src/models.ts exports ScanResult, Tool, and related types", () => {
    const modelsPath = path.resolve("src", "models.ts");
    const content = fs.readFileSync(modelsPath, "utf8");
    expect(content).toMatch(/export.*ScanResult/);
    expect(content).toMatch(/export.*Tool/);
    expect(content).toMatch(/export.*SideEffect/);
    expect(content).toMatch(/export.*Guard/);
  });

  it("package.json has 'type': 'module' for ESM", () => {
    const rawPkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8")) as { type?: string };
    expect(rawPkg.type).toBe("module");
  });

  it("package.json has 'exports' or 'main' field", () => {
    const rawPkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8")) as { main?: string; exports?: unknown };
    expect(rawPkg.main ?? rawPkg.exports).toBeTruthy();
  });
});
