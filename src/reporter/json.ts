/**
 * JSON reporter — produces the same canonical structure as registry.ts (YAML),
 * with snake_case field names matching toolcalls.yaml spec_version 1.0.
 *
 * The Python version exports JSON with snake_case fields (mirrors models.py
 * Pydantic field names). The TypeScript version uses camelCase internally
 * but converts at the reporter boundary for cross-format consistency.
 */

import type { ScanResult, Tool, SideEffect, Guard } from "../models.js";

interface JsonSideEffect {
  category: string;
  risk: number;
  code: string;
  line: number;
}

interface JsonGuard {
  type: string;
  coverage: string;
  code: string;
  line: number;
}

interface JsonTool {
  function: string;
  file: string;
  line: number;
  side_effects: JsonSideEffect[];
  guards: JsonGuard[];
  missing_hints: string[];
  owasp_agentic: string[];
  status: string;
  confirmed?: string;
  // Convenience aliases for spec_version 1.0 consumers (YAML-aligned)
  actions: string[];
  checks: JsonGuard[];
  missing: string[];
  owasp: string[];
}

interface JsonReport {
  generated: string;
  version: string;
  spec_version: "1.0";
  path: string;
  language: "typescript";
  summary: {
    total: number;
    no_checks: number;
    partial_checks: number;
    confirmed: number;
  };
  tool_calls: JsonTool[];
}

function toJsonSideEffect(se: SideEffect): JsonSideEffect {
  return { category: se.category, risk: se.risk, code: se.code, line: se.line };
}

function toJsonGuard(g: Guard): JsonGuard {
  return { type: g.type, coverage: g.coverage, code: g.code, line: g.line };
}

function toJsonTool(t: Tool): JsonTool {
  const sideEffects = t.sideEffects.map(toJsonSideEffect);
  const guards = t.guards.map(toJsonGuard);
  const out: JsonTool = {
    function: t.function,
    file: t.file,
    line: t.line,
    side_effects: sideEffects,
    guards,
    missing_hints: t.missingHints,
    owasp_agentic: t.owaspAgentic,
    status: t.status,
    // YAML-aligned aliases
    actions: t.sideEffects.map(se => se.code),
    checks: guards,
    missing: t.missingHints,
    owasp: t.owaspAgentic,
  };
  if (t.confirmed !== undefined) {
    out.confirmed = t.confirmed;
  }
  return out;
}

/**
 * Stringify the scan result as JSON in spec_version 1.0 snake_case format.
 */
export function generateJson(result: ScanResult, pretty = true): string {
  const report: JsonReport = {
    generated: result.generated,
    version: result.version,
    spec_version: result.specVersion,
    path: result.path,
    language: result.language,
    summary: {
      total: result.summary.total,
      no_checks: result.summary.noChecks,
      partial_checks: result.summary.partialChecks,
      confirmed: result.summary.confirmed,
    },
    tool_calls: result.tools.map(toJsonTool),
  };
  return pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
}

