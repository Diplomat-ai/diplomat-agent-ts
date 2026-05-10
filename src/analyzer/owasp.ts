/**
 * OWASP Agentic Top 10 mapping.
 *
 * Takes a list of Tools and populates `owaspAgentic` codes from
 * side-effect category mappings and missing-hint mappings.
 *
 * Mirrors `owasp.py` from the Python version.
 */

import type { Tool, SideEffectCategory } from "../models.js";

/**
 * Maps side-effect categories to OWASP Agentic codes.
 * Mirrors EFFECT_MAPPING in owasp.py.
 */
export const EFFECT_MAPPING: Record<SideEffectCategory, string[]> = {
  payment: ["ASI-02", "ASI-03"],
  database_write: ["ASI-02"],
  database_delete: ["ASI-02", "ASI-03"],
  http_write: ["ASI-02"],
  llm_call: ["ASI-02", "ASI-05"],
  agent_invocation: ["ASI-02", "ASI-04", "ASI-10"],
  email: ["ASI-02"],
  messaging: ["ASI-02"],
  publish: ["ASI-02"],
  dynamic_code: ["ASI-02", "ASI-03"],
  file_delete: ["ASI-02", "ASI-03"],
  destructive: ["ASI-02", "ASI-03"],
};

/**
 * Maps missing hint substrings to additional OWASP codes.
 * Mirrors MISSING_CHECK_MAPPING in owasp.py.
 */
export const MISSING_CHECK_MAPPING: Record<string, string[]> = {
  "no rate limit": ["ASI-06"],
  "no auth check": ["ASI-01"],
  "no confirmation": ["ASI-03"],
  "no retry bound": ["ASI-06"],
};

/**
 * Compute the deduplicated, sorted OWASP codes for a single tool.
 */
export function mapToolToOwasp(tool: Tool): string[] {
  if (tool.status === "confirmed") return [];

  const codes = new Set<string>();

  // From side-effect categories
  for (const se of tool.sideEffects) {
    const mapping = EFFECT_MAPPING[se.category] ?? [];
    for (const code of mapping) codes.add(code);
  }

  // From missing hints
  for (const hint of tool.missingHints) {
    for (const [key, mapped] of Object.entries(MISSING_CHECK_MAPPING)) {
      if (hint.includes(key)) {
        for (const code of mapped) codes.add(code);
      }
    }
  }

  return [...codes].sort();
}

/**
 * Apply to a list. Mutates each tool in place.
 */
export function applyOwasp(tools: Tool[]): void {
  for (const tool of tools) {
    tool.owaspAgentic = mapToolToOwasp(tool);
  }
}
