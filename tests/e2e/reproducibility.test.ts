/**
 * Niveau 5 — Reproducibility tests.
 *
 * Validates that scanning the same code multiple times produces identical
 * results (no non-determinism from in-memory state or async scheduling).
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import { scan } from "../../src/scanner/ast-scanner.js";
import { applyMissingHintsToAll } from "../../src/analyzer/checks.js";
import { applyOwasp } from "../../src/analyzer/owasp.js";
import { generateToolcallsYaml } from "../../src/reporter/registry.js";
import { generateJson } from "../../src/reporter/json.js";
import type { ScanResult } from "../../src/models.js";

const FIXTURES = path.resolve("tests/fixtures");
const FIXED_TIMESTAMP = "2024-01-01T00:00:00.000Z";

async function runFullPipeline(fixturePath: string): Promise<{ yaml: string; json: string }> {
  const tools = await scan({ path: fixturePath });
  applyMissingHintsToAll(tools);
  applyOwasp(tools);
  const result: ScanResult = {
    generated: FIXED_TIMESTAMP,
    version: "0.1.0",
    specVersion: "1.0",
    path: fixturePath,
    language: "typescript",
    summary: {
      total: tools.length,
      noChecks: tools.filter((t) => t.status === "no_checks").length,
      partialChecks: tools.filter((t) => t.status === "partial_checks").length,
      confirmed: tools.filter((t) => t.status === "confirmed").length,
    },
    tools,
  };
  return {
    yaml: generateToolcallsYaml(result),
    json: generateJson(result),
  };
}

describe("reproducibility: multiple-side-effects fixture", () => {
  it("YAML output is identical across 3 sequential runs", async () => {
    const fixturePath = path.join(FIXTURES, "multiple-side-effects");
    const run1 = await runFullPipeline(fixturePath);
    const run2 = await runFullPipeline(fixturePath);
    const run3 = await runFullPipeline(fixturePath);

    expect(run1.yaml).toBe(run2.yaml);
    expect(run2.yaml).toBe(run3.yaml);
  });

  it("JSON output is identical across 3 sequential runs", async () => {
    const fixturePath = path.join(FIXTURES, "multiple-side-effects");
    const run1 = await runFullPipeline(fixturePath);
    const run2 = await runFullPipeline(fixturePath);
    const run3 = await runFullPipeline(fixturePath);

    expect(run1.json).toBe(run2.json);
    expect(run2.json).toBe(run3.json);
  });
});

describe("reproducibility: unguarded-payment-stripe fixture", () => {
  it("YAML output is identical across 3 sequential runs", async () => {
    const fixturePath = path.join(FIXTURES, "unguarded-payment-stripe");
    const run1 = await runFullPipeline(fixturePath);
    const run2 = await runFullPipeline(fixturePath);
    const run3 = await runFullPipeline(fixturePath);

    expect(run1.yaml).toBe(run2.yaml);
    expect(run2.yaml).toBe(run3.yaml);
  });
});

describe("reproducibility: parallel scan consistency", () => {
  it("parallel scans of multiple fixtures produce same results as sequential", async () => {
    const fixture1 = path.join(FIXTURES, "unguarded-payment-stripe");
    const fixture2 = path.join(FIXTURES, "unguarded-database-write-prisma");
    const fixture3 = path.join(FIXTURES, "unguarded-email-nodemailer");

    // Sequential
    const seq1 = await runFullPipeline(fixture1);
    const seq2 = await runFullPipeline(fixture2);
    const seq3 = await runFullPipeline(fixture3);

    // Parallel
    const [par1, par2, par3] = await Promise.all([
      runFullPipeline(fixture1),
      runFullPipeline(fixture2),
      runFullPipeline(fixture3),
    ]);

    expect(par1.yaml).toBe(seq1.yaml);
    expect(par2.yaml).toBe(seq2.yaml);
    expect(par3.yaml).toBe(seq3.yaml);
  });
});
