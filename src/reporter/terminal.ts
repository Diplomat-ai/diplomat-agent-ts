/**
 * Terminal reporter — plain-text governance report for stdout.
 *
 * Uses raw ANSI codes (no chalk dependency). Colors are auto-disabled
 * when stdout is not a TTY, or when `useColor` is passed explicitly.
 *
 * Mirrors `reporter/terminal.py` from the Python version.
 */

import process from "node:process";
import type { ScanResult, Tool } from "../models.js";

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
} as const;

function colorize(text: string, codes: string[], useColor: boolean): string {
  if (!useColor) return text;
  return codes.join("") + text + ANSI.reset;
}

// ---------------------------------------------------------------------------
// Per-category expected guard rows
// ---------------------------------------------------------------------------

const CATEGORY_EXPECTED_GUARDS: Record<string, Array<[string, string]>> = {
  payment: [
    ["Bounds on amount:", "input_validation"],
    ["Rate limit:", "rate_limit"],
    ["Approval step:", "approval_step"],
  ],
  database_write: [
    ["Write protection:", "input_validation"],
    ["Rate limit:", "rate_limit"],
  ],
  database_delete: [
    ["Batch protection:", "input_validation"],
    ["Confirmation step:", "approval_step"],
  ],
  http_write: [
    ["Rate limit:", "rate_limit"],
    ["Retry bound:", "retry_bound"],
  ],
  email: [["Rate limit:", "rate_limit"]],
  publish: [["Approval step:", "approval_step"]],
  file_delete: [["Confirmation step:", "approval_step"]],
  destructive: [["Confirmation step:", "approval_step"]],
};

const CATEGORY_RISK_HINTS: Record<string, string> = {
  payment: "agent loop could execute 200 refunds in 10 min",
  database_delete: "single prompt could trigger mass deletion",
  database_write: "agent loop could write 200 records unvalidated",
  http_write: "agent could exhaust external API quota with 200 calls",
  email: "agent could send 200 messages — spam risk",
  publish: "agent could publish content without review",
  file_delete: "agent could delete critical files without confirmation",
};

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    payment: "Bounds on amount:",
    database_write: "Write protection:",
    database_delete: "Batch protection:",
    http_write: "Rate limit:",
    email: "Rate limit:",
    publish: "Approval step:",
    file_delete: "Confirmation step:",
    destructive: "Confirmation step:",
  };
  return labels[cat] ?? `${cat}:`;
}

// ---------------------------------------------------------------------------
// Tool block renderer
// ---------------------------------------------------------------------------

function renderToolBlock(tool: Tool, useColor: boolean): string {
  const lines: string[] = [];

  // Signature line
  const icon = tool.status === "confirmed" ? "✓" : "⚠";
  const sig = `${tool.function}()`;
  if (tool.status === "confirmed") {
    lines.push(colorize(`${icon} ${sig}`, [ANSI.green], useColor));
  } else if (tool.status === "partial_checks") {
    lines.push(colorize(`${icon} ${sig}`, [ANSI.yellow], useColor));
  } else {
    lines.push(colorize(`${icon} ${sig}`, [ANSI.red], useColor));
  }

  // Guard check rows
  const guardsByType = new Map(tool.guards.map((g) => [g.type, g]));
  const categories = [...new Set(tool.sideEffects.map((se) => se.category))];
  const seenRows = new Set<string>();

  for (const cat of categories) {
    const expectedRows = CATEGORY_EXPECTED_GUARDS[cat] ?? [
      [categoryLabel(cat), ""],
    ];
    for (const [label, guardType] of expectedRows) {
      const rowKey = `${label}::${guardType}`;
      if (seenRows.has(rowKey)) continue;
      seenRows.add(rowKey);
      const guard = guardsByType.get(guardType as never);
      if (guard) {
        const gv = `${guard.type.replace(/_/g, " ")} (${guard.coverage.toUpperCase()})`;
        lines.push(`  ${label.padEnd(24)}${gv}`);
      } else {
        lines.push(
          `  ${label.padEnd(24)}${colorize("NONE", [ANSI.red], useColor)}`
        );
      }
    }
  }

  // Risk hints for unguarded / partial
  if (tool.status !== "confirmed") {
    for (const cat of categories) {
      const hint = CATEGORY_RISK_HINTS[cat];
      if (hint) {
        lines.push(`  → Risk: ${hint}`);
      }
    }
  }

  // Missing hints
  if (tool.status === "no_checks" && tool.missingHints.length > 0) {
    lines.push(`  ⤷ ${tool.missingHints.join(" · ")}`);
  }

  // OWASP codes
  if (tool.owaspAgentic.length > 0) {
    lines.push(`  OWASP: ${tool.owaspAgentic.join(" · ")}`);
  }

  // Governance verdict
  const verdictLabels: Record<string, string> = {
    no_checks: "❌ UNGUARDED",
    partial_checks: "⚡ PARTIALLY GUARDED",
    confirmed: "✅ CONFIRMED",
  };
  const verdictStr = verdictLabels[tool.status] ?? tool.status;
  lines.push(`  Governance: ${verdictStr}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render the full governance report as a plain-text string.
 *
 * @param result  The scan result.
 * @param useColor  If undefined, auto-detects via `process.stdout.isTTY`.
 */
export function generateTerminal(
  result: ScanResult,
  useColor?: boolean
): string {
  const color = useColor ?? (process.stdout.isTTY === true);
  const lines: string[] = [];

  const w = (line = "") => lines.push(line);

  w(
    `${colorize("diplomat-agent", [ANSI.bold, ANSI.yellow], color)} — governance scan`
  );
  w();
  w(`Scanned: ${colorize(result.path, [ANSI.cyan], color)}`);
  w(`Tools with side effects: ${colorize(String(result.tools.length), [ANSI.bold], color)}`);
  w();

  if (result.tools.length === 0) {
    w("No tools with side effects detected.");
    w();
  } else {
    for (const tool of result.tools) {
      w(renderToolBlock(tool, color));
      w();
    }
  }

  w("─".repeat(40));

  const s = result.summary;
  const noChecksStr = colorize(
    `${s.noChecks} with no checks`,
    [ANSI.bold, ANSI.red],
    color
  );
  const partialStr = colorize(
    `${s.partialChecks} with partial checks`,
    [ANSI.bold, ANSI.yellow],
    color
  );
  const confirmedStr = colorize(
    `${s.confirmed} confirmed`,
    [ANSI.bold, ANSI.green],
    color
  );
  const totalStr = colorize(`(${s.total} total)`, [ANSI.dim], color);
  w(`RESULT: ${noChecksStr} · ${partialStr} · ${confirmedStr} ${totalStr}`);
  w();
  w("  Fix              → add validation in code, the next scan picks it up");
  w(`  Acknowledge      → add  ${colorize("// checked:ok", [ANSI.bold], color)}  in your source code`);
  w(
    `  Protected elsewhere → add  ${colorize("// checked:ok", [ANSI.bold], color)} — protected by [where]`
  );
  w(
    `  CI enforcement   → ${colorize("--fail-on-unchecked", [ANSI.bold], color)} blocks PRs with new unreviewed tool calls`
  );

  return lines.join("\n") + "\n";
}
