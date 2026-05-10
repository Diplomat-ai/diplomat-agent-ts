/**
 * Niveau 5 — OpenClaw benchmark tests.
 *
 * Validates zero false positives and zero false negatives
 * by running the scanner over all known-good and known-bad fixtures
 * and asserting on aggregate statistics.
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import { scan } from "../../src/scanner/ast-scanner.js";
import { applyMissingHintsToAll } from "../../src/analyzer/checks.js";
import { applyOwasp } from "../../src/analyzer/owasp.js";

const FIXTURES = path.resolve("tests/fixtures");

// Fixtures that MUST yield ≥1 tool (true positives)
const TRUE_POSITIVE_FIXTURES: { dir: string; minTools: number }[] = [
  { dir: "unguarded-payment-stripe", minTools: 1 },
  { dir: "unguarded-payment-paypal", minTools: 1 },
  { dir: "unguarded-database-write-prisma", minTools: 1 },
  { dir: "unguarded-database-write-mongoose", minTools: 1 },
  { dir: "unguarded-database-write-typeorm", minTools: 1 },
  { dir: "unguarded-database-write-sql", minTools: 1 },
  { dir: "unguarded-database-delete", minTools: 1 },
  { dir: "unguarded-http-fetch", minTools: 1 },
  { dir: "unguarded-http-axios", minTools: 1 },
  { dir: "unguarded-http-got", minTools: 1 },
  { dir: "unguarded-llm-openai", minTools: 1 },
  { dir: "unguarded-llm-anthropic", minTools: 1 },
  { dir: "unguarded-email-nodemailer", minTools: 1 },
  { dir: "unguarded-email-sendgrid", minTools: 1 },
  { dir: "unguarded-messaging-slack", minTools: 1 },
  { dir: "unguarded-messaging-twilio", minTools: 1 },
  { dir: "unguarded-publish-s3", minTools: 1 },
  { dir: "unguarded-dynamic-code-eval", minTools: 1 },
  { dir: "unguarded-dynamic-code-vm", minTools: 1 },
  { dir: "unguarded-file-delete-fs", minTools: 1 },
  { dir: "unguarded-file-delete-rm", minTools: 1 },
  { dir: "unguarded-destructive-exec", minTools: 1 },
  { dir: "multiple-side-effects", minTools: 1 },
];

// Fixtures that MUST yield 0 tools (true negatives = no false positives)
const TRUE_NEGATIVE_FIXTURES: string[] = [
  "false-positive-checker",
  "readonly-only",
  "excluded-test-files",
  "excluded-node-modules",
];

describe("openclaw-bench: true positives — all side-effect fixtures detected", () => {
  it("every expected fixture yields ≥1 tool", async () => {
    const results = await Promise.all(
      TRUE_POSITIVE_FIXTURES.map(async ({ dir, minTools }) => {
        const tools = await scan({ path: path.join(FIXTURES, dir) });
        return { dir, tools, minTools };
      }),
    );

    for (const { dir, tools, minTools } of results) {
      expect(tools.length, `${dir} should have ≥${minTools} tool(s)`).toBeGreaterThanOrEqual(minTools);
    }
  });
});

describe("openclaw-bench: true negatives — no false positives", () => {
  it("pure/excluded fixtures yield 0 tools", async () => {
    const results = await Promise.all(
      TRUE_NEGATIVE_FIXTURES.map(async (dir) => {
        const tools = await scan({ path: path.join(FIXTURES, dir) });
        return { dir, tools };
      }),
    );

    for (const { dir, tools } of results) {
      expect(tools.length, `${dir} should yield 0 tools (false positive)`).toBe(0);
    }
  });
});

describe("openclaw-bench: full pipeline over all true-positive fixtures", () => {
  it("applyMissingHintsToAll + applyOwasp complete without error", async () => {
    const allTools = (
      await Promise.all(
        TRUE_POSITIVE_FIXTURES.map(({ dir }) =>
          scan({ path: path.join(FIXTURES, dir) }),
        ),
      )
    ).flat();

    expect(() => {
      applyMissingHintsToAll(allTools);
      applyOwasp(allTools);
    }).not.toThrow();

    // Every tool gets OWASP codes from its side effects
    for (const tool of allTools) {
      expect(tool.owaspAgentic.length, `${tool.function} should have OWASP codes`).toBeGreaterThan(0);
    }
  });

  it("all no_checks tools have missing hints populated", async () => {
    const allTools = (
      await Promise.all(
        TRUE_POSITIVE_FIXTURES.map(({ dir }) =>
          scan({ path: path.join(FIXTURES, dir) }),
        ),
      )
    ).flat();
    applyMissingHintsToAll(allTools);

    const noChecksTools = allTools.filter((t) => t.status === "no_checks");
    for (const tool of noChecksTools) {
      expect(
        tool.missingHints.length,
        `${tool.function} (no_checks) should have missing hints`,
      ).toBeGreaterThan(0);
    }
  });
});
