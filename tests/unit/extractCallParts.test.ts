import { describe, it, expect } from "vitest";
import { Project, SyntaxKind } from "ts-morph";
import { extractCallParts } from "../../src/scanner/matcher.js";

const parseFirst = (source: string) => {
  const project = new Project({ useInMemoryFileSystem: true });
  const file = project.createSourceFile("test.ts", source);
  const call = file.getDescendantsOfKind(SyntaxKind.CallExpression)[0];
  if (!call) throw new Error("No CallExpression found in: " + source);
  return call;
};

describe("extractCallParts", () => {
  it("extracts a simple standalone call", () => {
    const call = parseFirst(`eval("x");`);
    const parts = extractCallParts(call);
    expect(parts.fullName).toBe("eval");
    expect(parts.objName).toBe("");
    expect(parts.attrName).toBe("eval");
  });

  it("extracts a two-level property access call", () => {
    const call = parseFirst(`stripe.charges.create({ amount: 100 });`);
    const parts = extractCallParts(call);
    expect(parts.fullName).toBe("stripe.charges.create");
    expect(parts.objName).toBe("stripe.charges");
    expect(parts.attrName).toBe("create");
  });

  it("lowercases all extracted names", () => {
    const call = parseFirst(`Stripe.Refunds.Create({});`);
    const parts = extractCallParts(call);
    expect(parts.fullName).toBe("stripe.refunds.create");
    expect(parts.attrName).toBe("create");
  });

  it("extracts kwarg names from an object literal first arg", () => {
    const call = parseFirst(`foo({ amount: 100, reason: "x" });`);
    const parts = extractCallParts(call);
    expect(parts.kwargNames.has("amount")).toBe(true);
    expect(parts.kwargNames.has("reason")).toBe(true);
  });

  it("extracts firstArgStr from a string literal (uppercased)", () => {
    const call = parseFirst(`db.query("INSERT INTO users VALUES (1)");`);
    const parts = extractCallParts(call);
    expect(parts.firstArgStr).toBe("INSERT INTO USERS VALUES (1)");
  });

  it("extracts httpMethod from fetch options object", () => {
    const call = parseFirst(`fetch("/api", { method: "POST" });`);
    const parts = extractCallParts(call);
    expect(parts.httpMethod).toBe("POST");
  });

  it("handles chained method calls — resolves to final attr", () => {
    const call = parseFirst(`stripe.refunds.create({ amount: 100 });`);
    const parts = extractCallParts(call);
    expect(parts.attrName).toBe("create");
  });

  it("handles a simple one-level method call", () => {
    const call = parseFirst(`prisma.user.create({ data: {} });`);
    const parts = extractCallParts(call);
    expect(parts.attrName).toBe("create");
    expect(parts.objName).toBe("prisma.user");
  });

  it("extracts shorthand kwarg names from object literal", () => {
    const call = parseFirst(`stripe.charges.create({ amount, currency });`);
    const parts = extractCallParts(call);
    expect(parts.kwargNames.has("amount")).toBe(true);
    expect(parts.kwargNames.has("currency")).toBe(true);
  });

  it("returns empty httpMethod when no method option present", () => {
    const call = parseFirst(`fetch("/api", { body: "x" });`);
    const parts = extractCallParts(call);
    expect(parts.httpMethod).toBe("");
  });

  it("returns empty firstArgStr for non-string first arg", () => {
    const call = parseFirst(`foo(someVar);`);
    const parts = extractCallParts(call);
    expect(parts.firstArgStr).toBe("");
  });
});
