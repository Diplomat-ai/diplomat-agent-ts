/**
 * Pure pattern-matching engine.
 *
 * Stateless. Takes extracted call parts and a PatternMatch, returns boolean.
 * Mirrors `_matches_pattern()` in ast_scanner.py.
 */

import type { CallExpression, Node } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { PatternMatch } from "./patterns.js";

// ---------------------------------------------------------------------------
// Call parts
// ---------------------------------------------------------------------------

/**
 * Extracted call expression parts used by the matcher.
 * Mirrors the `_call_parts` return tuple in Python.
 */
export interface CallParts {
  /** Full dotted name: "stripe.refunds.create", "fetch", "self.repo.create" — lowercased. */
  fullName: string;
  /** Object/receiver part: "stripe.refunds", "", "self.repo" — lowercased. */
  objName: string;
  /** Last attribute (method) name: "create", "fetch", "create" — lowercased. */
  attrName: string;
  /** Set of keyword argument names for this call (lowercased). */
  kwargNames: Set<string>;
  /** First positional arg as uppercased string (for SQL detection). Empty if not a string literal. */
  firstArgStr: string;
  /** HTTP method extracted from { method: "POST" } option object, if any. Uppercased. */
  httpMethod: string;
}

/**
 * Extract CallParts from a ts-morph CallExpression node.
 * Mirrors `_call_parts()` in Python plus kwarg/HTTP-method extraction.
 */
export function extractCallParts(node: CallExpression): CallParts {
  const expr = node.getExpression();

  let fullName: string;
  let objName: string;
  let attrName: string;

  if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
    // Build a left-to-right dotted string from the chain.
    const parts: string[] = [];
    let cur: Node = expr;
    while (cur.getKind() === SyntaxKind.PropertyAccessExpression) {
      const pae = cur.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      parts.unshift(pae.getName());
      cur = pae.getExpression();
    }
    // cur is now the root (Name / CallExpression for constructor calls / etc.)
    if (cur.getKind() === SyntaxKind.Identifier) {
      parts.unshift(cur.asKindOrThrow(SyntaxKind.Identifier).getText());
    } else if (cur.getKind() === SyntaxKind.CallExpression) {
      // Constructor: new ClassName(args).method()
      const innerExpr = cur.asKindOrThrow(SyntaxKind.CallExpression).getExpression();
      if (innerExpr.getKind() === SyntaxKind.Identifier) {
        parts.unshift(innerExpr.asKindOrThrow(SyntaxKind.Identifier).getText());
      } else if (innerExpr.getKind() === SyntaxKind.PropertyAccessExpression) {
        parts.unshift(innerExpr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName());
      }
    } else if (cur.getKind() === SyntaxKind.ThisKeyword) {
      parts.unshift("this");
    } else if (cur.getKind() === SyntaxKind.RegularExpressionLiteral) {
      // Regex literal receiver: /pattern/.exec(s). Setting a distinct prefix
      // prevents nameExact: ["exec"] from classifying these as subprocess calls.
      parts.unshift("<regex>");
    }

    attrName = parts[parts.length - 1].toLowerCase();
    objName = parts.slice(0, -1).join(".").toLowerCase();
    fullName = parts.join(".").toLowerCase();
  } else if (expr.getKind() === SyntaxKind.Identifier) {
    const name = expr.asKindOrThrow(SyntaxKind.Identifier).getText().toLowerCase();
    fullName = name;
    objName = "";
    attrName = name;
  } else {
    // Other: new expressions, etc.
    fullName = expr.getText().toLowerCase().replace(/\s+/g, "");
    objName = "";
    attrName = fullName;
  }

  return {
    fullName,
    objName,
    attrName,
    kwargNames: extractKwargNames(node),
    firstArgStr: extractFirstArgStr(node),
    httpMethod: extractHttpMethod(node),
  };
}

/**
 * Extract keyword argument names (object property names in the last object-literal arg).
 * In JS/TS, named args are passed as object literals: stripe.refunds.create({ amount, reason }).
 */
function extractKwargNames(node: CallExpression): Set<string> {
  const names = new Set<string>();
  for (const arg of node.getArguments()) {
    if (arg.getKind() === SyntaxKind.ObjectLiteralExpression) {
      const obj = arg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
      for (const prop of obj.getProperties()) {
        if (prop.getKind() === SyntaxKind.PropertyAssignment) {
          const pa = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
          names.add(pa.getName().toLowerCase());
        } else if (prop.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
          const spa = prop.asKindOrThrow(SyntaxKind.ShorthandPropertyAssignment);
          names.add(spa.getName().toLowerCase());
        }
      }
    }
  }
  return names;
}

/**
 * Return the first positional argument as an uppercased string.
 * Used for SQL detection. Returns "" if not a string literal.
 */
function extractFirstArgStr(node: CallExpression): string {
  const args = node.getArguments();
  if (args.length === 0) return "";
  const first = args[0];
  if (first.getKind() === SyntaxKind.StringLiteral) {
    return first.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue().toUpperCase();
  }
  if (first.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
    return first.asKindOrThrow(SyntaxKind.NoSubstitutionTemplateLiteral).getLiteralValue().toUpperCase();
  }
  // Template literal with expressions: join constant parts
  if (first.getKind() === SyntaxKind.TemplateExpression) {
    const te = first.asKindOrThrow(SyntaxKind.TemplateExpression);
    let text = te.getHead().getLiteralText();
    for (const span of te.getTemplateSpans()) {
      text += span.getLiteral().getLiteralText();
    }
    return text.toUpperCase();
  }
  return "";
}

/**
 * Extract HTTP method from a fetch/axios call.
 * Looks for { method: "POST" } in the arguments.
 */
function extractHttpMethod(node: CallExpression): string {
  for (const arg of node.getArguments()) {
    if (arg.getKind() !== SyntaxKind.ObjectLiteralExpression) continue;
    const obj = arg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    for (const prop of obj.getProperties()) {
      if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue;
      const pa = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
      if (pa.getName().toLowerCase() !== "method") continue;
      const init = pa.getInitializer();
      if (!init) continue;
      if (init.getKind() === SyntaxKind.StringLiteral) {
        return init.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue().toUpperCase();
      }
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Pattern matching
// ---------------------------------------------------------------------------

/**
 * Test if a CallExpression's parts match a PatternMatch object.
 * All conditions are AND'ed. Within each condition, values are OR'ed.
 * Mirrors `_matches_pattern()` in Python.
 */
export function matchCall(parts: CallParts, match: PatternMatch): boolean {
  const { fullName, objName, attrName, kwargNames, firstArgStr, httpMethod } = parts;

  if (match.funcContains) {
    if (!match.funcContains.some(s => fullName.includes(s.toLowerCase()))) return false;
  }

  if (match.nameContains) {
    if (!match.nameContains.some(s => fullName.includes(s.toLowerCase()))) return false;
  }

  if (match.nameExact) {
    if (!match.nameExact.some(s => fullName === s.toLowerCase())) return false;
  }

  if (match.objContains) {
    if (!match.objContains.some(s => objName.includes(s.toLowerCase()))) return false;
  }

  if (match.objExact) {
    if (!match.objExact.some(s => objName === s.toLowerCase())) return false;
  }

  if (match.attrContains) {
    if (!match.attrContains.some(s => attrName.includes(s.toLowerCase()))) return false;
  }

  if (match.attrExact) {
    if (!match.attrExact.some(s => attrName === s.toLowerCase())) return false;
  }

  if (match.sqlContains) {
    if (!match.sqlContains.some(s => firstArgStr.includes(s.toUpperCase()))) return false;
  }

  if (match.methodHttp) {
    if (!match.methodHttp.some(m => httpMethod === m.toUpperCase())) return false;
  }

  if (match.kwargContains) {
    if (!match.kwargContains.some(k => kwargNames.has(k.toLowerCase()))) return false;
  }

  return true;
}

/**
 * Test if any decorator name matches a PatternMatch with decoratorContains.
 */
export function matchDecorators(decoratorNames: string[], match: PatternMatch): boolean {
  if (!match.decoratorContains) return false;
  return decoratorNames.some(d =>
    match.decoratorContains!.some(s => d.toLowerCase().includes(s.toLowerCase()))
  );
}

/**
 * Test if any import name matches a PatternMatch with importContains.
 */
export function matchImports(importNames: string[], match: PatternMatch): boolean {
  if (!match.importContains) return false;
  return importNames.some(imp =>
    match.importContains!.some(s => imp.toLowerCase().includes(s.toLowerCase()))
  );
}

/**
 * Test if a comparison expression text matches compareContains.
 */
export function matchCompare(compareText: string, match: PatternMatch): boolean {
  if (!match.compareContains) return false;
  const lower = compareText.toLowerCase();
  return match.compareContains.some(s => lower.includes(s.toLowerCase()));
}
