/**
 * Niveau 2 — Fixture-based regression tests.
 *
 * Each fixture directory is scanned with `scan()` and the results are
 * checked against known-good expectations.  Tests are intentionally
 * exhaustive so that any future regression in the scanner immediately
 * surfaces here.
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import { scan } from "../src/scanner/ast-scanner.js";

const FIXTURES = path.resolve("tests/fixtures");

function fix(name: string): string {
  return path.join(FIXTURES, name);
}

// ---------------------------------------------------------------------------
// 2.1 — Side-effect fixtures (23 total): every category detected, no guards
// ---------------------------------------------------------------------------

describe("fixture: unguarded-payment-stripe", () => {
  it("detects 1 tool, payment category, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-payment-stripe") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("payment");
    expect(tools[0]?.status).toBe("no_checks");
    expect(tools[0]?.guards).toHaveLength(0);
  });
});

describe("fixture: unguarded-payment-paypal", () => {
  it("detects 1 tool, payment category, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-payment-paypal") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("payment");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-database-write-prisma", () => {
  it("detects 1 tool, database_write, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-database-write-prisma") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("database_write");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-database-write-mongoose", () => {
  it("detects 1 tool, database_write, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-database-write-mongoose") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("database_write");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-database-write-typeorm", () => {
  it("detects 1 tool, database_write, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-database-write-typeorm") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("database_write");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-database-write-sql", () => {
  it("detects 1 tool, database_write, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-database-write-sql") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("database_write");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-database-delete", () => {
  it("detects 1 tool, database_delete, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-database-delete") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("database_delete");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-http-fetch", () => {
  it("detects 1 tool, http_write, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-http-fetch") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("http_write");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-http-axios", () => {
  it("detects 1 tool, http_write, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-http-axios") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("http_write");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-http-got", () => {
  it("detects 1 tool, http_write, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-http-got") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("http_write");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-llm-openai", () => {
  it("detects 1 tool, llm_call, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-llm-openai") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("llm_call");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-llm-anthropic", () => {
  it("detects 1 tool, llm_call, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-llm-anthropic") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("llm_call");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-agent-invocation", () => {
  it("detects ≥1 tool with agent_invocation or llm_call, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-agent-invocation") });
    expect(tools.length).toBeGreaterThanOrEqual(1);
    const allCats = tools.flatMap((t) => t.sideEffects.map((s) => s.category));
    expect(
      allCats.some((c) => c === "agent_invocation" || c === "llm_call"),
    ).toBe(true);
    expect(tools.every((t) => t.status === "no_checks")).toBe(true);
  });
});

describe("fixture: unguarded-email-nodemailer", () => {
  it("detects 1 tool, email, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-email-nodemailer") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("email");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-email-sendgrid", () => {
  it("detects 1 tool, email, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-email-sendgrid") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("email");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-messaging-slack", () => {
  it("detects 1 tool, messaging, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-messaging-slack") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("messaging");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-messaging-twilio", () => {
  it("detects 1 tool, messaging, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-messaging-twilio") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("messaging");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-publish-s3", () => {
  it("detects 1 tool, publish, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-publish-s3") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("publish");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-dynamic-code-eval", () => {
  it("detects 1 tool, dynamic_code, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-dynamic-code-eval") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("dynamic_code");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-dynamic-code-new-function", () => {
  it("detects 1 tool, dynamic_code, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-dynamic-code-new-function") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("dynamic_code");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-dynamic-code-vm", () => {
  it("detects 1 tool, dynamic_code, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-dynamic-code-vm") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("dynamic_code");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-file-delete-fs", () => {
  it("detects 1 tool, file_delete, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-file-delete-fs") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("file_delete");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-file-delete-rm", () => {
  it("detects 1 tool, file_delete, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-file-delete-rm") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("file_delete");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-destructive-exec", () => {
  it("detects 1 tool, destructive, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-destructive-exec") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("destructive");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: unguarded-agent-runEmbedded", () => {
  it("detects runEmbeddedPiAgent as agent_invocation, no_checks", async () => {
    const tools = await scan({ path: fix("unguarded-agent-runEmbedded") });
    expect(tools).toHaveLength(1);
    const cats = tools[0]?.sideEffects.map((s) => s.category) ?? [];
    expect(cats).toContain("agent_invocation");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("SPEC FIX 4 regression — regex.exec() must not be classified destructive", () => {
  it("flags only the legit spawn() call, not the regex.exec() calls", async () => {
    const tools = await scan({ path: fix("regex-exec-not-destructive") });

    // Exactly one tool: legitSpawn
    expect(tools).toHaveLength(1);
    expect(tools[0]?.function).toBe("legitSpawn");
    expect(tools[0]?.sideEffects[0]?.category).toBe("destructive");

    // None of the regex.exec functions should appear
    const functionNames = tools.map((t) => t.function);
    expect(functionNames).not.toContain("regexLiteralExec");
    expect(functionNames).not.toContain("storedRegexExec");
    expect(functionNames).not.toContain("multipleRegexExec");
  });
});

// ---------------------------------------------------------------------------
// 2.2 — Guard fixtures: at least one guard detected → partial_checks
// ---------------------------------------------------------------------------

describe("fixture: guarded-input-validation-zod", () => {
  it("detects input_validation guard → partial_checks", async () => {
    const tools = await scan({ path: fix("guarded-input-validation-zod") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.status).toBe("partial_checks");
    const guardTypes = tools[0]?.guards.map((g) => g.type) ?? [];
    expect(guardTypes).toContain("input_validation");
  });
});

describe("fixture: guarded-rate-limit-nestjs", () => {
  it("detects rate_limit guard → partial_checks", async () => {
    const tools = await scan({ path: fix("guarded-rate-limit-nestjs") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.status).toBe("partial_checks");
    const guardTypes = tools[0]?.guards.map((g) => g.type) ?? [];
    expect(guardTypes).toContain("rate_limit");
  });
});

describe("fixture: guarded-auth-check-nestjs", () => {
  it("detects auth_check guard → partial_checks", async () => {
    const tools = await scan({ path: fix("guarded-auth-check-nestjs") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.status).toBe("partial_checks");
    const guardTypes = tools[0]?.guards.map((g) => g.type) ?? [];
    expect(guardTypes).toContain("auth_check");
  });
});

describe("fixture: guarded-approval-step", () => {
  it("detects confirmation guard → partial_checks", async () => {
    const tools = await scan({ path: fix("guarded-approval-step") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.status).toBe("partial_checks");
    const guardTypes = tools[0]?.guards.map((g) => g.type) ?? [];
    expect(guardTypes.some((t) => t === "confirmation" || t === "approval_step")).toBe(true);
  });
});

describe("fixture: guarded-idempotency-key", () => {
  it("detects idempotency_key guard → partial_checks", async () => {
    const tools = await scan({ path: fix("guarded-idempotency-key") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.status).toBe("partial_checks");
    const guardTypes = tools[0]?.guards.map((g) => g.type) ?? [];
    expect(guardTypes).toContain("idempotency_key");
  });
});

describe("fixture: guarded-retry-bound", () => {
  it("detects retry_bound guard from p-retry import → partial_checks", async () => {
    const tools = await scan({ path: fix("guarded-retry-bound") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.status).toBe("partial_checks");
    const guardTypes = tools[0]?.guards.map((g) => g.type) ?? [];
    expect(guardTypes).toContain("retry_bound");
  });
});

describe("fixture: guarded-confirmation", () => {
  it("detects confirmation guard from if(userConfirmed) → partial_checks", async () => {
    const tools = await scan({ path: fix("guarded-confirmation") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.status).toBe("partial_checks");
    const guardTypes = tools[0]?.guards.map((g) => g.type) ?? [];
    expect(guardTypes.some((t) => t === "confirmation" || t === "approval_step")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2.3 — Special-case fixtures
// ---------------------------------------------------------------------------

describe("fixture: multiple-side-effects", () => {
  it("detects payment + email side effects in one tool", async () => {
    const tools = await scan({ path: fix("multiple-side-effects") });
    expect(tools).toHaveLength(1);
    const cats = tools[0]?.sideEffects.map((s) => s.category) ?? [];
    expect(cats).toContain("payment");
    expect(cats).toContain("email");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: multiple-guards-partial", () => {
  it("detects payment tool with auth guard but still partial", async () => {
    const tools = await scan({ path: fix("multiple-guards-partial") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("payment");
    expect(tools[0]?.status).toBe("partial_checks");
  });
});

describe("fixture: multiple-guards-full", () => {
  it("detects multiple guards on a payment tool", async () => {
    const tools = await scan({ path: fix("multiple-guards-full") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("payment");
    expect(tools[0]?.status).toBe("partial_checks");
    expect(tools[0]?.guards.length).toBeGreaterThanOrEqual(2);
  });
});

describe("fixture: excluded-test-files", () => {
  it("returns 0 tools — .test.ts files are excluded", async () => {
    const tools = await scan({ path: fix("excluded-test-files") });
    expect(tools).toHaveLength(0);
  });
});

describe("fixture: excluded-node-modules", () => {
  it("returns 0 tools — node_modules directory is excluded", async () => {
    const tools = await scan({ path: fix("excluded-node-modules") });
    expect(tools).toHaveLength(0);
  });
});

describe("fixture: nested-functions", () => {
  it("detects side effects inside nested functions", async () => {
    const tools = await scan({ path: fix("nested-functions") });
    expect(tools.length).toBeGreaterThanOrEqual(1);
    const allCats = tools.flatMap((t) => t.sideEffects.map((s) => s.category));
    expect(allCats.some((c) => c === "database_write" || c === "email")).toBe(true);
  });
});

describe("fixture: class-methods", () => {
  it("detects payment in a class method", async () => {
    const tools = await scan({ path: fix("class-methods") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("payment");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: arrow-function-export", () => {
  it("detects payment in an arrow function export", async () => {
    const tools = await scan({ path: fix("arrow-function-export") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("payment");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: decorator-on-class-method", () => {
  it("detects the database_write tool (class-level decorator not propagated)", async () => {
    const tools = await scan({ path: fix("decorator-on-class-method") });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.sideEffects.map((s) => s.category)).toContain("database_write");
    // Class-level @UseGuards is not detected by the scanner (by design — method scope only)
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("fixture: false-positive-checker", () => {
  it("returns 0 tools for pure computation code", async () => {
    const tools = await scan({ path: fix("false-positive-checker") });
    expect(tools).toHaveLength(0);
  });
});

// SPEC FIX 5 regression — deploy pattern precision
describe("fixture: deploy-exact-not-management", () => {
  it("flags bare deploy() but not cancelDeploy/getDeployStatus/listDeployments/redeployApp", async () => {
    const tools = await scan({ path: fix("deploy-exact-not-management") });
    // Only publishApp (wrapping bare deploy()) should be detected
    expect(tools).toHaveLength(1);
    expect(tools[0]?.function).toBe("publishApp");
    const cats = tools[0]?.sideEffects.map((s) => s.category);
    expect(cats).toContain("publish");
    // Management functions must not appear
    const toolNames = tools.map((t) => t.function);
    expect(toolNames).not.toContain("cancel");
    expect(toolNames).not.toContain("status");
    expect(toolNames).not.toContain("list");
    expect(toolNames).not.toContain("redeploy");
    expect(toolNames).not.toContain("logs");
  });
});
