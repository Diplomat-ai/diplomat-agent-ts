/**
 * Niveau 3 — Full pipeline integration tests.
 *
 * Tests scan → analyze → report as a complete pipeline.
 * Uses the `multiple-side-effects` fixture (stripe payment + nodemailer email)
 * as the canonical integration target since it exercises all pipeline stages.
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

function buildScanResult(tools: ScanResult["tools"], scanPath: string): ScanResult {
  return {
    generated: new Date().toISOString(),
    version: "0.1.0",
    specVersion: "1.0",
    path: scanPath,
    language: "typescript",
    summary: {
      total: tools.length,
      noChecks: tools.filter((t) => t.status === "no_checks").length,
      partialChecks: tools.filter((t) => t.status === "partial_checks").length,
      confirmed: tools.filter((t) => t.status === "confirmed").length,
    },
    tools,
  };
}

describe("pipeline: scan → analyze → yaml (multiple-side-effects fixture)", () => {
  it("produces a non-empty YAML string with spec_version: '1.0'", async () => {
    const fixturePath = path.join(FIXTURES, "multiple-side-effects");
    const tools = await scan({ path: fixturePath });
    applyMissingHintsToAll(tools);
    applyOwasp(tools);
    const result = buildScanResult(tools, fixturePath);
    const yaml = generateToolcallsYaml(result);

    expect(typeof yaml).toBe("string");
    expect(yaml.length).toBeGreaterThan(0);
    expect(yaml).toMatch(/spec_version:\s*['"]?1\.0['"]?/);
  });

  it("YAML contains tool_calls section", async () => {
    const fixturePath = path.join(FIXTURES, "multiple-side-effects");
    const tools = await scan({ path: fixturePath });
    applyMissingHintsToAll(tools);
    applyOwasp(tools);
    const result = buildScanResult(tools, fixturePath);
    const yaml = generateToolcallsYaml(result);

    expect(yaml).toMatch(/tool_calls:/);
  });

  it("YAML contains both payment and email side-effect categories", async () => {
    const fixturePath = path.join(FIXTURES, "multiple-side-effects");
    const tools = await scan({ path: fixturePath });
    applyMissingHintsToAll(tools);
    applyOwasp(tools);
    const result = buildScanResult(tools, fixturePath);
    const yaml = generateToolcallsYaml(result);

    expect(yaml).toMatch(/payment/);
    // sendMail appears in the actions list proving email side-effect was detected
    expect(yaml).toMatch(/sendMail/);
  });

  it("YAML contains OWASP codes for payment (ASI-02, ASI-03)", async () => {
    const fixturePath = path.join(FIXTURES, "multiple-side-effects");
    const tools = await scan({ path: fixturePath });
    applyMissingHintsToAll(tools);
    applyOwasp(tools);
    const result = buildScanResult(tools, fixturePath);
    const yaml = generateToolcallsYaml(result);

    expect(yaml).toMatch(/ASI-02/);
    expect(yaml).toMatch(/ASI-03/);
  });
});

describe("pipeline: scan → analyze → JSON (multiple-side-effects fixture)", () => {
  it("produces valid parseable JSON", async () => {
    const fixturePath = path.join(FIXTURES, "multiple-side-effects");
    const tools = await scan({ path: fixturePath });
    applyMissingHintsToAll(tools);
    applyOwasp(tools);
    const result = buildScanResult(tools, fixturePath);
    const json = generateJson(result);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("JSON contains spec_version '1.0' and language 'typescript'", async () => {
    const fixturePath = path.join(FIXTURES, "multiple-side-effects");
    const tools = await scan({ path: fixturePath });
    applyMissingHintsToAll(tools);
    applyOwasp(tools);
    const result = buildScanResult(tools, fixturePath);
    const parsed = JSON.parse(generateJson(result));

    expect(parsed.spec_version).toBe("1.0");
    expect(parsed.language).toBe("typescript");
  });

  it("JSON summary.total matches tools array length", async () => {
    const fixturePath = path.join(FIXTURES, "multiple-side-effects");
    const tools = await scan({ path: fixturePath });
    applyMissingHintsToAll(tools);
    applyOwasp(tools);
    const result = buildScanResult(tools, fixturePath);
    const parsed = JSON.parse(generateJson(result));

    expect(parsed.summary.total).toBe(parsed.tool_calls.length);
  });

  it("JSON tool has side_effects, guards, missing_hints, owasp_agentic", async () => {
    const fixturePath = path.join(FIXTURES, "multiple-side-effects");
    const tools = await scan({ path: fixturePath });
    applyMissingHintsToAll(tools);
    applyOwasp(tools);
    const result = buildScanResult(tools, fixturePath);
    const parsed = JSON.parse(generateJson(result));

    expect(parsed.tool_calls.length).toBeGreaterThan(0);
    const tool = parsed.tool_calls[0];
    expect(Array.isArray(tool.side_effects)).toBe(true);
    expect(Array.isArray(tool.guards)).toBe(true);
    expect(Array.isArray(tool.missing_hints)).toBe(true);
    expect(Array.isArray(tool.owasp_agentic)).toBe(true);
  });
});

describe("pipeline: scan → analyze → JSON (unguarded-payment-stripe fixture)", () => {
  it("tool has status no_checks and non-empty missing_hints", async () => {
    const fixturePath = path.join(FIXTURES, "unguarded-payment-stripe");
    const tools = await scan({ path: fixturePath });
    applyMissingHintsToAll(tools);
    applyOwasp(tools);
    const result = buildScanResult(tools, fixturePath);
    const parsed = JSON.parse(generateJson(result));

    expect(parsed.summary.no_checks).toBe(1);
    expect(parsed.summary.partial_checks).toBe(0);
    const tool = parsed.tool_calls[0];
    expect(tool.status).toBe("no_checks");
    expect(tool.missing_hints.length).toBeGreaterThan(0);
    expect(tool.owasp_agentic.length).toBeGreaterThan(0);
  });
});

describe("pipeline: reproducibility — same input produces identical output", () => {
  it("YAML output is deterministic across two runs", async () => {
    const fixturePath = path.join(FIXTURES, "multiple-side-effects");

    async function runPipeline(): Promise<string> {
      const tools = await scan({ path: fixturePath });
      applyMissingHintsToAll(tools);
      applyOwasp(tools);
      const result: ScanResult = {
        generated: "2024-01-01T00:00:00.000Z", // fixed timestamp
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
      return generateToolcallsYaml(result);
    }

    const run1 = await runPipeline();
    const run2 = await runPipeline();
    expect(run1).toBe(run2);
  });
});
