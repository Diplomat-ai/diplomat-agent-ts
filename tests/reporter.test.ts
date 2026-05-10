/**
 * Tests for the reporter modules.
 *
 * Covers the three output formats: YAML registry, JSON, and terminal.
 */
import { describe, it, expect } from "vitest";
import { generateToolcallsYaml } from "../src/reporter/registry.js";
import { generateJson } from "../src/reporter/json.js";
import { generateTerminal } from "../src/reporter/terminal.js";
import type { ScanResult, Tool } from "../src/models.js";

function makeResult(tools: Tool[]): ScanResult {
  const noChecks = tools.filter((t) => t.status === "no_checks").length;
  const partialChecks = tools.filter((t) => t.status === "partial_checks").length;
  const confirmed = tools.filter((t) => t.status === "confirmed").length;
  return {
    generated: "2025-01-01T00:00:00.000Z",
    version: "0.1.0",
    specVersion: "1.0",
    path: "./src",
    language: "typescript",
    summary: { total: tools.length, noChecks, partialChecks, confirmed },
    tools,
  };
}

const paymentTool: Tool = {
  function: "chargeCustomer",
  file: "src/payments.ts",
  line: 10,
  sideEffects: [{ category: "payment", risk: 3, code: "stripe.charges.create(...)", line: 12 }],
  guards: [],
  missingHints: ["no bounds on amount", "no rate limit"],
  owaspAgentic: ["ASI-02", "ASI-05"],
  status: "no_checks",
};

const confirmedTool: Tool = {
  function: "sendNotification",
  file: "src/notify.ts",
  line: 5,
  sideEffects: [{ category: "email", risk: 2, code: "sgMail.send(...)", line: 7 }],
  guards: [],
  missingHints: [],
  owaspAgentic: [],
  confirmed: "protected by API gateway",
  status: "confirmed",
};

describe("generateToolcallsYaml", () => {
  it("produces valid YAML string with spec_version header", () => {
    const yaml = generateToolcallsYaml(makeResult([paymentTool]));
    expect(yaml).toContain("spec_version:");
    expect(yaml).toContain("tool_calls:");
  });

  it("places no_checks tools in the # ⚠ NO CHECKS section", () => {
    const yaml = generateToolcallsYaml(makeResult([paymentTool]));
    expect(yaml).toContain("no_checks:");
    expect(yaml).toContain("chargeCustomer");
  });

  it("places confirmed tools in the # ✓ CONFIRMED section", () => {
    const yaml = generateToolcallsYaml(makeResult([confirmedTool]));
    expect(yaml).toContain("confirmed:");
    expect(yaml).toContain("sendNotification");
  });

  it("includes OWASP codes", () => {
    const yaml = generateToolcallsYaml(makeResult([paymentTool]));
    expect(yaml).toContain("ASI-02");
  });

  it("generates consistent output for empty tool list", () => {
    const yaml = generateToolcallsYaml(makeResult([]));
    expect(yaml).toContain("spec_version:");
    expect(yaml).not.toContain("chargeCustomer");
  });
});

describe("generateJson", () => {
  it("returns valid JSON with the full scan result structure", () => {
    const result = makeResult([paymentTool]);
    const json = generateJson(result);
    const parsed = JSON.parse(json) as { language: string; tool_calls: Array<{ function: string }> };
    expect(parsed.language).toBe("typescript");
    expect(parsed.tool_calls).toHaveLength(1);
    expect(parsed.tool_calls[0]?.function).toBe("chargeCustomer");
  });

  it("compact JSON when pretty=false", () => {
    const result = makeResult([paymentTool]);
    const json = generateJson(result, false);
    expect(json).not.toContain("\n  ");
  });
});

describe("generateTerminal", () => {
  it("produces plain text with the tool function name", () => {
    const report = generateTerminal(makeResult([paymentTool]), false);
    expect(report).toContain("chargeCustomer");
    expect(report).toContain("RESULT:");
  });

  it("mentions UNGUARDED status", () => {
    const report = generateTerminal(makeResult([paymentTool]), false);
    expect(report).toContain("UNGUARDED");
  });

  it("shows CONFIRMED for confirmed tools", () => {
    const report = generateTerminal(makeResult([confirmedTool]), false);
    expect(report).toContain("CONFIRMED");
  });

  it("with color=true produces ANSI escape codes", () => {
    const report = generateTerminal(makeResult([paymentTool]), true);
    expect(report).toContain("\x1b[");
  });
});
