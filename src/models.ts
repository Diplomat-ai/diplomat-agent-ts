/**
 * Core data models for diplomat-agent-ts.
 *
 * These types mirror the Python version (`diplomat_agent/models.py`)
 * adapted to TypeScript idioms. Names and semantics match exactly so that
 * the toolcalls.yaml output is interoperable between Python and TypeScript scans.
 */

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Side-effect category: a function that calls an action of this category
 * has the potential to change the real world (or external state).
 *
 * Mirrors `SideEffect.category` values in the Python version.
 */
export type SideEffectCategory =
  | "payment"
  | "database_write"
  | "database_delete"
  | "http_write"
  | "llm_call"
  | "agent_invocation"
  | "email"
  | "messaging"
  | "publish"
  | "dynamic_code"
  | "file_delete"
  | "destructive";

/**
 * Guard type: a control mechanism that mitigates the risk of a side effect.
 *
 * Mirrors `Guard.type` values in the Python version.
 */
export type GuardType =
  | "input_validation"
  | "rate_limit"
  | "auth_check"
  | "approval_step"
  | "idempotency_key"
  | "retry_bound"
  | "confirmation";

/**
 * How fully a guard mitigates the side effect.
 * - "full": the guard alone is sufficient for its check type
 * - "partial": the guard is present but incomplete (e.g. manual `if` check
 *              vs a Pydantic/Zod validator)
 */
export type GuardCoverage = "full" | "partial";

/**
 * Risk score for a side-effect pattern.
 * - 1: low (rare-impact actions)
 * - 2: medium (typical write operations, LLM calls)
 * - 3: high (payments, deletes, dynamic code execution)
 */
export type RiskScore = 1 | 2 | 3;

/**
 * Final classification status for a tool (function with side effects).
 * - "no_checks": at least one side effect, zero detected guards
 * - "partial_checks": some guards detected, but missing expected ones
 * - "confirmed": acknowledged via `// checked:ok` annotation
 */
export type ToolStatus = "no_checks" | "partial_checks" | "confirmed";

// ---------------------------------------------------------------------------
// Domain entities
// ---------------------------------------------------------------------------

/**
 * A detected side effect within a function body.
 */
export interface SideEffect {
  category: SideEffectCategory;
  risk: RiskScore;
  /** Code excerpt of the call site, max 120 chars, no trailing line numbers. */
  code: string;
  /** Absolute line number in the source file. Used for diagnostics, not for
   *  diff-stable output. */
  line: number;
}

/**
 * A detected guard within a function body or its decorators.
 */
export interface Guard {
  type: GuardType;
  coverage: GuardCoverage;
  /** Code excerpt of the guard expression, max 120 chars. */
  code: string;
  /** Absolute line number where the guard was detected. */
  line: number;
}

/**
 * A "tool" is any function that has at least one side effect. The scanner
 * records its side effects, the guards detected in the same scope, and a
 * final classification status.
 *
 * Mirrors `Tool` in the Python version.
 */
export interface Tool {
  /** Function or method name. */
  function: string;
  /** Path relative to the scan root. */
  file: string;
  /** Line number of the function/method declaration. */
  line: number;
  sideEffects: SideEffect[];
  guards: Guard[];
  /** Human-readable hints describing missing governance.
   *  Examples: "no bounds on amount", "no rate limit". */
  missingHints: string[];
  /** OWASP Agentic Top 10 codes (e.g. ["ASI-02", "ASI-03"]). Populated by the
   *  analyzer step, not the scanner. */
  owaspAgentic: string[];
  /** If the tool is annotated `// checked:ok — reason`, the reason is stored
   *  here and `status` becomes "confirmed". */
  confirmed?: string;
  /** Final classification, computed after side-effect detection and guard
   *  matching. */
  status: ToolStatus;
}

// ---------------------------------------------------------------------------
// Scan result
// ---------------------------------------------------------------------------

/**
 * Summary statistics for a complete scan.
 */
export interface ScanSummary {
  total: number;
  noChecks: number;
  partialChecks: number;
  confirmed: number;
}

/**
 * Top-level result of a scan, returned by the scanner module.
 */
export interface ScanResult {
  /** ISO 8601 UTC timestamp of when the scan was generated. */
  generated: string;
  /** Version of diplomat-agent-ts that produced this result. */
  version: string;
  /** Spec version of the toolcalls.yaml format. Currently "1.0". */
  specVersion: "1.0";
  /** Path that was scanned (relative or absolute, as provided to the CLI). */
  path: string;
  /** Always "typescript" for this scanner. Allows multi-language interop with
   *  the Python version. */
  language: "typescript";
  summary: ScanSummary;
  tools: Tool[];
}
