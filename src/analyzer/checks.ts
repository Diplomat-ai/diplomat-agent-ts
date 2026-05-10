/**
 * Missing hint computation.
 *
 * For each tool, determines which expected guards are absent and produces
 * human-readable hint strings to populate `tool.missingHints`.
 *
 * Mirrors `checks.py` from the Python version.
 */

import type { Tool, SideEffectCategory, GuardType } from "../models.js";

/**
 * For each side-effect category, the guard types that are expected.
 * Mirrors EXPECTED_CHECKS in checks.py.
 */
export const EXPECTED_CHECKS: Record<SideEffectCategory, GuardType[]> = {
  payment: ["input_validation", "rate_limit", "auth_check", "idempotency_key"],
  database_write: ["input_validation", "auth_check"],
  database_delete: ["confirmation", "auth_check"],
  http_write: ["input_validation", "rate_limit"],
  llm_call: ["rate_limit", "retry_bound"],
  agent_invocation: ["auth_check", "retry_bound"],
  email: ["rate_limit", "input_validation"],
  messaging: ["rate_limit"],
  publish: ["auth_check", "input_validation"],
  dynamic_code: ["input_validation"],
  file_delete: ["confirmation", "auth_check"],
  destructive: ["input_validation", "auth_check"],
};

/**
 * Map (category, missing guard type) → human-readable hint.
 */
export const HINT_MESSAGES: Record<string, string> = {
  "payment:input_validation": "no bounds on amount",
  "payment:rate_limit": "no rate limit",
  "payment:auth_check": "no auth check",
  "payment:idempotency_key": "no idempotency key",
  "database_write:input_validation": "no input validation",
  "database_write:auth_check": "no auth check",
  "database_delete:confirmation": "no confirmation step",
  "database_delete:auth_check": "no auth check",
  "http_write:input_validation": "no input validation",
  "http_write:rate_limit": "no rate limit",
  "llm_call:rate_limit": "no rate limit",
  "llm_call:retry_bound": "no retry bound",
  "agent_invocation:auth_check": "no auth check",
  "agent_invocation:retry_bound": "no retry bound",
  "email:rate_limit": "no rate limit",
  "email:input_validation": "no input validation",
  "messaging:rate_limit": "no rate limit",
  "publish:auth_check": "no auth check",
  "publish:input_validation": "no input validation",
  "dynamic_code:input_validation": "no input validation on dynamic code",
  "file_delete:confirmation": "no confirmation step",
  "file_delete:auth_check": "no auth check",
  "destructive:input_validation": "no input validation",
  "destructive:auth_check": "no auth check",
};

/**
 * Compute missing hints for a single tool.
 * Mutates the tool in place by populating `missingHints`.
 *
 * Confirmed tools get empty missingHints (matches Python behavior).
 */
export function applyMissingHints(tool: Tool): void {
  if (tool.status === "confirmed") {
    tool.missingHints = [];
    return;
  }

  const presentGuardTypes = new Set(tool.guards.map(g => g.type));
  const seenCategories = new Set<SideEffectCategory>();
  const hints: string[] = [];

  for (const se of tool.sideEffects) {
    if (seenCategories.has(se.category)) continue;
    seenCategories.add(se.category);

    const expected = EXPECTED_CHECKS[se.category] ?? [];
    for (const guardType of expected) {
      if (!presentGuardTypes.has(guardType)) {
        const key = `${se.category}:${guardType}`;
        const hint = HINT_MESSAGES[key];
        if (hint && !hints.includes(hint)) {
          hints.push(hint);
        }
      }
    }
  }

  tool.missingHints = hints;

  // Update status: if guards present → partial_checks; no guards + hints → no_checks
  if (tool.guards.length > 0) {
    tool.status = "partial_checks";
  } else if (hints.length > 0) {
    tool.status = "no_checks";
  }
}

/**
 * Apply to a list. Convenience wrapper.
 */
export function applyMissingHintsToAll(tools: Tool[]): void {
  for (const tool of tools) {
    applyMissingHints(tool);
  }
}
