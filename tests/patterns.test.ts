/**
 * Tests for src/scanner/patterns.ts
 */
import { describe, it, expect } from "vitest";
import {
  SIDE_EFFECT_PATTERNS,
  GUARD_PATTERNS,
  READ_ONLY_PATTERNS,
  ORCHESTRATOR_DECORATORS,
  EXCLUDED_DIRS,
  EXCLUDED_FILE_PATTERNS,
} from "../src/scanner/patterns.js";
import type { SideEffectPattern, GuardPattern, ReadOnlyPattern } from "../src/scanner/patterns.js";

describe("SIDE_EFFECT_PATTERNS", () => {
  it("contains all 12 required categories", () => {
    const categories = new Set(SIDE_EFFECT_PATTERNS.map((p: SideEffectPattern) => p.category));
    const required = [
      "payment","database_write","database_delete","http_write","llm_call",
      "agent_invocation","email","messaging","publish","dynamic_code","file_delete","destructive",
    ];
    for (const cat of required) {
      expect(categories.has(cat as never), `category ${cat} present`).toBe(true);
    }
  });

  it("has a Stripe payment pattern", () => {
    const stripe = SIDE_EFFECT_PATTERNS.filter(
      (p: SideEffectPattern) =>
        p.category === "payment" &&
        (p.match.objContains?.includes("stripe") || p.match.objExact?.includes("stripe"))
    );
    expect(stripe.length).toBeGreaterThan(0);
  });

  it("has a prisma database_write pattern", () => {
    const prisma = SIDE_EFFECT_PATTERNS.filter(
      (p: SideEffectPattern) =>
        p.category === "database_write" &&
        (p.match.objContains?.includes("prisma") ||
          p.match.attrExact?.some((a: string) => ["create", "save", "upsert"].includes(a)))
    );
    expect(prisma.length).toBeGreaterThan(0);
  });

  it("all patterns have a risk score of 1, 2, or 3", () => {
    for (const p of SIDE_EFFECT_PATTERNS) {
      expect([1, 2, 3]).toContain(p.risk);
    }
  });
});

describe("GUARD_PATTERNS", () => {
  it("contains all 7 guard types", () => {
    const types = new Set(GUARD_PATTERNS.map((p: GuardPattern) => p.type));
    const required = [
      "input_validation","rate_limit","auth_check","approval_step",
      "idempotency_key","retry_bound","confirmation",
    ];
    for (const t of required) {
      expect(types.has(t as never), `guard type ${t} present`).toBe(true);
    }
  });

  it("each guard pattern specifies a coverage", () => {
    for (const p of GUARD_PATTERNS) {
      expect(["full", "partial"]).toContain(p.coverage);
    }
  });
});

describe("READ_ONLY_PATTERNS", () => {
  it("includes GET-style http patterns", () => {
    const httpGet = READ_ONLY_PATTERNS.filter(
      (p: ReadOnlyPattern) =>
        p.match.attrExact?.includes("get") || p.match.attrContains?.includes("get")
    );
    expect(httpGet.length).toBeGreaterThan(0);
  });

  it("includes findUnique / findMany style db reads", () => {
    const dbReads = READ_ONLY_PATTERNS.filter(
      (p: ReadOnlyPattern) =>
        p.match.attrContains?.some((a: string) => a.startsWith("find")) ||
        p.match.attrExact?.some((a: string) =>
          ["count", "aggregate", "findUnique", "findMany", "findFirst"].includes(a)
        )
    );
    expect(dbReads.length).toBeGreaterThan(0);
  });
});

describe("ORCHESTRATOR_DECORATORS", () => {
  it("is a non-empty set of strings", () => {
    expect(ORCHESTRATOR_DECORATORS.length).toBeGreaterThan(0);
    for (const d of ORCHESTRATOR_DECORATORS) {
      expect(typeof d).toBe("string");
    }
  });
});

describe("EXCLUDED_DIRS", () => {
  it("excludes node_modules and dist", () => {
    expect(EXCLUDED_DIRS).toContain("node_modules");
    expect(EXCLUDED_DIRS).toContain("dist");
  });
});

describe("EXCLUDED_FILE_PATTERNS", () => {
  it("excludes test and spec files", () => {
    const joined = EXCLUDED_FILE_PATTERNS.join(" ");
    expect(joined).toMatch(/test|spec/i);
  });
});
