import { describe, it, expect } from "vitest";
import { matchCall } from "../../src/scanner/matcher.js";
import type { CallParts } from "../../src/scanner/matcher.js";

const makeParts = (overrides: Partial<CallParts> = {}): CallParts => ({
  fullName: "",
  objName: "",
  attrName: "",
  kwargNames: new Set(),
  firstArgStr: "",
  httpMethod: "",
  ...overrides,
});

describe("matchCall — objContains", () => {
  it("matches when objName contains the target string", () => {
    const parts = makeParts({ objName: "stripe.refunds", attrName: "create" });
    expect(matchCall(parts, { objContains: ["stripe"] })).toBe(true);
  });

  it("does not match when objName does not contain the target", () => {
    const parts = makeParts({ objName: "logger", attrName: "create" });
    expect(matchCall(parts, { objContains: ["stripe"] })).toBe(false);
  });

  it("is case-insensitive (lowercased internally)", () => {
    const parts = makeParts({ objName: "stripe.refunds", attrName: "create" });
    // Parts are already lowercased by extractCallParts; match values are lowercased by matchCall
    expect(matchCall(parts, { objContains: ["STRIPE"] })).toBe(true);
  });

  it("ORs multiple values within objContains", () => {
    const parts = makeParts({ objName: "paypal.payment", attrName: "execute" });
    expect(matchCall(parts, { objContains: ["stripe", "paypal"] })).toBe(true);
  });
});

describe("matchCall — attrExact", () => {
  it("matches exact method name", () => {
    const parts = makeParts({ attrName: "create" });
    expect(matchCall(parts, { attrExact: ["create"] })).toBe(true);
  });

  it("does not match partial method name", () => {
    const parts = makeParts({ attrName: "createMany" });
    expect(matchCall(parts, { attrExact: ["create"] })).toBe(false);
  });
});

describe("matchCall — attrContains", () => {
  it("matches when attrName contains the target", () => {
    const parts = makeParts({ attrName: "createMany" });
    expect(matchCall(parts, { attrContains: ["create"] })).toBe(true);
  });

  it("does not match unrelated attr", () => {
    const parts = makeParts({ attrName: "delete" });
    expect(matchCall(parts, { attrContains: ["create"] })).toBe(false);
  });
});

describe("matchCall — objExact", () => {
  it("matches exact object name", () => {
    const parts = makeParts({ objName: "stripe", attrName: "charges" });
    expect(matchCall(parts, { objExact: ["stripe"] })).toBe(true);
  });

  it("does not match partial object name", () => {
    const parts = makeParts({ objName: "stripe.refunds", attrName: "create" });
    expect(matchCall(parts, { objExact: ["stripe"] })).toBe(false);
  });
});

describe("matchCall — multiple conditions are AND'd", () => {
  it("all conditions must be true", () => {
    const parts = makeParts({ objName: "stripe.refunds", attrName: "create" });
    expect(
      matchCall(parts, { objContains: ["stripe"], attrExact: ["create"] })
    ).toBe(true);
  });

  it("fails if any condition is false", () => {
    const parts = makeParts({ objName: "stripe.refunds", attrName: "list" });
    expect(
      matchCall(parts, { objContains: ["stripe"], attrExact: ["create"] })
    ).toBe(false);
  });
});

describe("matchCall — sqlContains", () => {
  it("matches uppercased SQL keywords in firstArgStr", () => {
    const parts = makeParts({ attrName: "query", firstArgStr: "INSERT INTO USERS" });
    expect(
      matchCall(parts, { attrExact: ["query"], sqlContains: ["INSERT"] })
    ).toBe(true);
  });

  it("does not match non-matching SQL", () => {
    const parts = makeParts({ attrName: "query", firstArgStr: "SELECT * FROM users" });
    expect(
      matchCall(parts, { attrExact: ["query"], sqlContains: ["INSERT"] })
    ).toBe(false);
  });
});

describe("matchCall — methodHttp", () => {
  it("matches HTTP method extracted from options", () => {
    const parts = makeParts({ fullName: "fetch", attrName: "fetch", httpMethod: "POST" });
    expect(
      matchCall(parts, { nameContains: ["fetch"], methodHttp: ["POST", "PUT"] })
    ).toBe(true);
  });

  it("does not match wrong HTTP method", () => {
    const parts = makeParts({ fullName: "fetch", attrName: "fetch", httpMethod: "GET" });
    expect(
      matchCall(parts, { nameContains: ["fetch"], methodHttp: ["POST", "PUT"] })
    ).toBe(false);
  });
});

describe("matchCall — nameContains", () => {
  it("matches standalone function names", () => {
    const parts = makeParts({ fullName: "eval", attrName: "eval" });
    expect(matchCall(parts, { nameContains: ["eval"] })).toBe(true);
  });
});

describe("matchCall — empty match returns true (vacuously)", () => {
  it("an empty match object matches everything", () => {
    const parts = makeParts({ attrName: "anything" });
    expect(matchCall(parts, {})).toBe(true);
  });
});

describe("matchCall — funcContains", () => {
  it("matches against fullName when funcContains is used", () => {
    const parts = makeParts({ fullName: "stripe.refunds.create", attrName: "create" });
    expect(matchCall(parts, { funcContains: ["refunds.create"] })).toBe(true);
  });
});
