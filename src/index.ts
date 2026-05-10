/**
 * Public API for diplomat-agent-ts.
 *
 * Re-exports the primary scanner entry point, analyzer utilities,
 * all reporter functions, and all model types.
 */

// Scanner
export { scan, scanFile } from "./scanner/ast-scanner.js";
export type { ScanOptions } from "./scanner/ast-scanner.js";

// Analyzer
export { applyMissingHints, applyMissingHintsToAll } from "./analyzer/checks.js";
export { applyOwasp, mapToolToOwasp } from "./analyzer/owasp.js";

// Reporters
export { generateToolcallsYaml, generateJson, generateTerminal } from "./reporter/index.js";

// Models (re-export all types for library consumers)
export type {
  SideEffectCategory,
  GuardType,
  GuardCoverage,
  RiskScore,
  ToolStatus,
  SideEffect,
  Guard,
  Tool,
  ScanSummary,
  ScanResult,
} from "./models.js";
