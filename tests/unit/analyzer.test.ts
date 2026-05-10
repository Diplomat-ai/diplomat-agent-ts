import { describe, it, expect } from "vitest";
import { applyMissingHints } from "../../src/analyzer/checks.js";
import { mapToolToOwasp } from "../../src/analyzer/owasp.js";
import type { Tool } from "../../src/models.js";

const makeTool = (overrides: Partial<Tool> = {}): Tool => ({
  function: "test",
  file: "test.ts",
  line: 1,
  sideEffects: [],
  guards: [],
  missingHints: [],
  owaspAgentic: [],
  status: "no_checks",
  ...overrides,
});

describe("applyMissingHints", () => {
  it("emits 'no rate limit' for an unguarded payment", () => {
    const tool = makeTool({
      sideEffects: [{ category: "payment", risk: 3, code: "stripe.refunds.create()", line: 5 }],
    });
    applyMissingHints(tool);
    expect(tool.missingHints).toContain("no rate limit");
    expect(tool.missingHints).toContain("no bounds on amount");
  });

  it("does not emit hints for guard types that are present", () => {
    const tool = makeTool({
      sideEffects: [{ category: "payment", risk: 3, code: "x", line: 1 }],
      guards: [{ type: "rate_limit", coverage: "full", code: "y", line: 2 }],
    });
    applyMissingHints(tool);
    expect(tool.missingHints).not.toContain("no rate limit");
  });

  it("emits no hints for confirmed tools", () => {
    const tool = makeTool({
      sideEffects: [{ category: "payment", risk: 3, code: "x", line: 1 }],
      confirmed: "manually approved",
      status: "confirmed",
    });
    applyMissingHints(tool);
    expect(tool.missingHints).toEqual([]);
  });

  it("emits hints for database_write side effect", () => {
    const tool = makeTool({
      sideEffects: [{ category: "database_write", risk: 2, code: "prisma.user.create({})", line: 3 }],
    });
    applyMissingHints(tool);
    expect(tool.missingHints.length).toBeGreaterThan(0);
  });

  it("deduplicates hints when multiple side-effects share the same guard type", () => {
    const tool = makeTool({
      sideEffects: [
        { category: "payment", risk: 3, code: "stripe.charges.create()", line: 1 },
        { category: "email", risk: 2, code: "sgMail.send()", line: 2 },
      ],
    });
    applyMissingHints(tool);
    const rateLimitCount = tool.missingHints.filter((h) => h === "no rate limit").length;
    expect(rateLimitCount).toBe(1);
  });
});

describe("mapToolToOwasp", () => {
  it("maps payment to ASI-02 and ASI-03", () => {
    const tool = makeTool({
      sideEffects: [{ category: "payment", risk: 3, code: "x", line: 1 }],
    });
    const codes = mapToolToOwasp(tool);
    expect(codes).toContain("ASI-02");
    expect(codes).toContain("ASI-03");
  });

  it("adds ASI-06 when 'no rate limit' hint is present", () => {
    const tool = makeTool({
      sideEffects: [{ category: "payment", risk: 3, code: "x", line: 1 }],
      missingHints: ["no rate limit"],
    });
    const codes = mapToolToOwasp(tool);
    expect(codes).toContain("ASI-06");
  });

  it("returns deduplicated and sorted codes", () => {
    const tool = makeTool({
      sideEffects: [
        { category: "payment", risk: 3, code: "x", line: 1 },
        { category: "database_delete", risk: 3, code: "y", line: 2 },
      ],
    });
    const codes = mapToolToOwasp(tool);
    const sorted = [...codes].sort();
    expect(codes).toEqual(sorted);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("returns empty array for confirmed tools", () => {
    const tool = makeTool({
      sideEffects: [{ category: "payment", risk: 3, code: "x", line: 1 }],
      confirmed: "manually approved",
      status: "confirmed",
    });
    expect(mapToolToOwasp(tool)).toEqual([]);
  });

  it("returns empty array for tool with no side effects", () => {
    const tool = makeTool({ sideEffects: [] });
    expect(mapToolToOwasp(tool)).toEqual([]);
  });
});
