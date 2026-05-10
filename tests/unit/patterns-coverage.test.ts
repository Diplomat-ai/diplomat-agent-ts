import { describe, it, expect } from "vitest";
import {
  SIDE_EFFECT_PATTERNS,
  GUARD_PATTERNS,
  READ_ONLY_PATTERNS,
} from "../../src/scanner/patterns.js";
import type { SideEffectCategory, GuardType } from "../../src/models.js";

const ALL_CATEGORIES: SideEffectCategory[] = [
  "payment", "database_write", "database_delete", "http_write",
  "llm_call", "agent_invocation", "email", "messaging",
  "publish", "dynamic_code", "file_delete", "destructive",
];

const ALL_GUARD_TYPES: GuardType[] = [
  "input_validation", "rate_limit", "auth_check", "approval_step",
  "idempotency_key", "retry_bound", "confirmation",
];

describe("SIDE_EFFECT_PATTERNS coverage", () => {
  for (const category of ALL_CATEGORIES) {
    it(`has at least one entry for ${category}`, () => {
      const found = SIDE_EFFECT_PATTERNS.filter((p) => p.category === category);
      expect(found.length).toBeGreaterThan(0);
    });
  }

  it("every entry has a non-empty match object", () => {
    for (const p of SIDE_EFFECT_PATTERNS) {
      const keys = Object.keys(p.match);
      expect(keys.length).toBeGreaterThan(0);
    }
  });

  it("every risk score is 1, 2, or 3", () => {
    for (const p of SIDE_EFFECT_PATTERNS) {
      expect([1, 2, 3]).toContain(p.risk);
    }
  });
});

describe("GUARD_PATTERNS coverage", () => {
  for (const guardType of ALL_GUARD_TYPES) {
    it(`has at least one entry for ${guardType}`, () => {
      const found = GUARD_PATTERNS.filter((p) => p.type === guardType);
      expect(found.length).toBeGreaterThan(0);
    });
  }

  it("every coverage value is 'full' or 'partial'", () => {
    for (const p of GUARD_PATTERNS) {
      expect(["full", "partial"]).toContain(p.coverage);
    }
  });
});

describe("READ_ONLY_PATTERNS sanity", () => {
  it("has at least one HTTP read pattern", () => {
    const found = READ_ONLY_PATTERNS.filter((p) => p.match.methodHttp?.includes("GET"));
    expect(found.length).toBeGreaterThan(0);
  });

  it("has at least one ORM find pattern", () => {
    const found = READ_ONLY_PATTERNS.filter((p) =>
      p.match.attrExact?.some((a) => a.toLowerCase().includes("find")) ||
      p.match.attrContains?.some((a) => a.toLowerCase().includes("find"))
    );
    expect(found.length).toBeGreaterThan(0);
  });
});

describe("SIDE_EFFECT_PATTERNS scoping invariant", () => {
  /**
   * A pattern using attrExact or attrContains MUST also have a scoping
   * condition (objContains, objExact, funcContains, nameContains, sqlContains,
   * decoratorContains, importContains, or kwargContains).
   *
   * Otherwise, the pattern will catch-all and produce false positives. For
   * example, `attrExact: ["create"]` without any scope will match
   * stripe.charges.create, openai.chat.completions.create, prisma.user.create,
   * nodemailer.transporter.create — most of which are NOT database writes.
   */
  it("no pattern with attrExact/attrContains lacks a scoping condition", () => {
    const violations: string[] = [];

    for (const p of SIDE_EFFECT_PATTERNS) {
      const usesAttr =
        (p.match.attrExact && p.match.attrExact.length > 0) ||
        (p.match.attrContains && p.match.attrContains.length > 0);

      if (!usesAttr) continue;

      const hasScope =
        (p.match.objContains && p.match.objContains.length > 0) ||
        (p.match.objExact && p.match.objExact.length > 0) ||
        (p.match.funcContains && p.match.funcContains.length > 0) ||
        (p.match.nameContains && p.match.nameContains.length > 0) ||
        (p.match.nameExact && p.match.nameExact.length > 0) ||
        (p.match.sqlContains && p.match.sqlContains.length > 0) ||
        (p.match.decoratorContains && p.match.decoratorContains.length > 0) ||
        (p.match.importContains && p.match.importContains.length > 0) ||
        (p.match.kwargContains && p.match.kwargContains.length > 0);

      if (!hasScope) {
        violations.push(
          `[${p.category}] attrExact=${JSON.stringify(p.match.attrExact)} attrContains=${JSON.stringify(p.match.attrContains)} — NO SCOPE`
        );
      }
    }

    expect(
      violations,
      `Found ${violations.length} unscoped patterns:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  /**
   * Generic substrings in nameContains/objContains can over-match.
   * Forbidden values include common English words that appear in unrelated
   * method names (e.g. "exec" matches ".execute()", "send" matches
   * ".sendStatus()" in Express, "post" matches ".postProcess()").
   *
   * If a pattern needs one of these, it MUST be paired with another scoping
   * condition strong enough to disambiguate.
   */
  it("dangerous generic substrings are paired with stronger scoping", () => {
    const DANGEROUS_GENERICS = [
      "exec",       // matches .execute, .executeQuery, .execAsync, .executablePath
      "eval",       // matches addSensitiveValue, resolveOverrideValue (substring)
      "client",     // matches OpenAI client, Anthropic client, generic httpClient
      "create",     // not in nameContains, but flagged for awareness
      "send",       // matches sendStatus, sendFile, sendBeacon
      "post",       // matches postProcess, postRender
      "put",        // matches putStr, putAt
      "save",       // matches savePoint, saveLayer
      "db",         // matches any Map/cache/store named db (from OpenClaw FP audit)
      "agent",      // matches any object property named agent (too generic alone)
      "run",        // matches runScript, runtimeError, runwayCheck (substring)
    ];

    const violations: string[] = [];

    for (const p of SIDE_EFFECT_PATTERNS) {
      // Check nameContains
      const nameValues = p.match.nameContains ?? [];
      for (const v of nameValues) {
        if (DANGEROUS_GENERICS.includes(v.toLowerCase())) {
          // Must have at least one OTHER scoping condition besides nameContains
          const otherScope =
            (p.match.objContains?.length ?? 0) > 0 ||
            (p.match.objExact?.length ?? 0) > 0 ||
            (p.match.funcContains?.length ?? 0) > 0 ||
            (p.match.importContains?.length ?? 0) > 0 ||
            (p.match.kwargContains?.length ?? 0) > 0;

          if (!otherScope) {
            violations.push(
              `[${p.category}] nameContains has generic "${v}" with no other scope`
            );
          }
        }
      }

      // Check objContains
      const objValues = p.match.objContains ?? [];
      for (const v of objValues) {
        if (DANGEROUS_GENERICS.includes(v.toLowerCase())) {
          const otherScope =
            (p.match.attrExact?.length ?? 0) > 0 ||
            (p.match.attrContains?.length ?? 0) > 0 ||
            (p.match.funcContains?.length ?? 0) > 0 ||
            (p.match.importContains?.length ?? 0) > 0;

          if (!otherScope) {
            violations.push(
              `[${p.category}] objContains has generic "${v}" with no narrowing attr/func`
            );
          }
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} generic-substring violations:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  /**
   * Pattern ordering: since the scanner breaks on the first match,
   * more specific patterns must precede less specific ones within the array.
   * Specifically: any pattern with funcContains must precede patterns of OTHER
   * categories that match purely on attrExact/attrContains, because
   * funcContains is more specific.
   *
   * This test enforces that llm_call patterns using funcContains
   * (chat.completions.create) appear BEFORE database_write patterns using
   * attrExact: ["create"].
   */
  it("llm_call patterns precede database_write patterns in catalog order", () => {
    const firstLlmCall = SIDE_EFFECT_PATTERNS.findIndex(p => p.category === "llm_call");
    const firstDbWrite = SIDE_EFFECT_PATTERNS.findIndex(p => p.category === "database_write");

    expect(firstLlmCall).toBeGreaterThanOrEqual(0);
    expect(firstDbWrite).toBeGreaterThanOrEqual(0);
    expect(
      firstLlmCall < firstDbWrite,
      "llm_call patterns must come before database_write in SIDE_EFFECT_PATTERNS array (first-match-wins)"
    ).toBe(true);
  });

  /**
   * Same ordering rule for payment vs other categories that could overlap.
   * Payment is the highest-stakes category and must win against any overlap.
   */
  it("payment patterns precede database_write and destructive in catalog order", () => {
    const firstPayment = SIDE_EFFECT_PATTERNS.findIndex(p => p.category === "payment");
    const firstDbWrite = SIDE_EFFECT_PATTERNS.findIndex(p => p.category === "database_write");
    const firstDestructive = SIDE_EFFECT_PATTERNS.findIndex(p => p.category === "destructive");

    expect(firstPayment).toBeGreaterThanOrEqual(0);
    expect(firstPayment < firstDbWrite).toBe(true);
    expect(firstPayment < firstDestructive).toBe(true);
  });
});
