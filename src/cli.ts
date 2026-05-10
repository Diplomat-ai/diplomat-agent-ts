#!/usr/bin/env node
/**
 * CLI entry point for diplomat-agent-ts.
 *
 * Parses arguments manually — no commander or yargs dependency.
 * Exit codes:
 *   0  scan succeeded (even if issues found)
 *   1  --fail-on-unchecked triggered
 *   2  bad arguments / path not found
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { URL } from "node:url";
import { scan } from "./scanner/ast-scanner.js";
import { applyMissingHintsToAll } from "./analyzer/checks.js";
import { applyOwasp } from "./analyzer/owasp.js";
import {
  generateTerminal,
  generateJson,
  generateToolcallsYaml,
} from "./reporter/index.js";
import type { ScanResult, ScanSummary, Tool } from "./models.js";

// ---------------------------------------------------------------------------
// Package version (read from package.json at runtime)
// ---------------------------------------------------------------------------

function readVersion(): string {
  try {
    const pkgPath = new URL("../package.json", import.meta.url);
    const raw = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// ---------------------------------------------------------------------------
// Argument parsing (no external dependency)
// ---------------------------------------------------------------------------

interface CliArgs {
  path: string;
  format: "terminal" | "json" | "registry";
  output: string | null;
  outputRegistry: string | null;
  failOnUnchecked: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): CliArgs | null {
  const args: CliArgs = {
    path: "",
    format: "terminal",
    output: null,
    outputRegistry: null,
    failOnUnchecked: false,
    help: false,
    version: false,
  };

  // Skip leading 'node' and script name
  const rest = [...argv];

  // Strip optional 'scan' subcommand (mirrors Python CLI)
  if (rest[0] === "scan") rest.shift();

  let i = 0;
  while (i < rest.length) {
    const arg = rest[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--version" || arg === "-v") {
      args.version = true;
    } else if (arg === "--fail-on-unchecked" || arg === "--fail-on-unguarded") {
      args.failOnUnchecked = true;
    } else if (arg === "--format") {
      const val = rest[++i];
      if (val !== "terminal" && val !== "json" && val !== "registry") {
        process.stderr.write(
          `Error: --format must be one of: terminal, json, registry\n`
        );
        return null;
      }
      args.format = val;
    } else if (arg.startsWith("--format=")) {
      const val = arg.slice("--format=".length);
      if (val !== "terminal" && val !== "json" && val !== "registry") {
        process.stderr.write(
          `Error: --format must be one of: terminal, json, registry\n`
        );
        return null;
      }
      args.format = val as "terminal" | "json" | "registry";
    } else if (arg === "--output") {
      args.output = rest[++i] ?? null;
    } else if (arg.startsWith("--output=")) {
      args.output = arg.slice("--output=".length);
    } else if (arg === "--output-registry") {
      args.outputRegistry = rest[++i] ?? null;
    } else if (arg.startsWith("--output-registry=")) {
      args.outputRegistry = arg.slice("--output-registry=".length);
    } else if (!arg.startsWith("-")) {
      args.path = arg;
    } else {
      process.stderr.write(`Warning: unknown flag: ${arg}\n`);
    }
    i++;
  }

  return args;
}

function printHelp(version: string): void {
  process.stdout.write(
    `diplomat-agent-ts v${version}

Scan your agentic TypeScript codebase for tool calls with real-world side
effects and no governance. No config required.

Usage:
  diplomat-agent [scan] [PATH] [options]

Arguments:
  PATH            Directory to scan (default: current directory)

Options:
  --format        Output format: terminal | json | registry (default: terminal)
  --output FILE   Write report to FILE instead of stdout
  --output-registry FILE
                  Write toolcalls.yaml to FILE (default: toolcalls.yaml)
  --fail-on-unchecked
                  Exit 1 if any unguarded tool call is found (for CI)
  --version       Print version and exit
  --help          Print this help and exit

Examples:
  diplomat-agent                     # scan current directory
  diplomat-agent scan ./src          # scan ./src
  diplomat-agent --format json       # JSON report
  diplomat-agent --format registry   # write toolcalls.yaml
  diplomat-agent --output-registry toolcalls.yaml --fail-on-unchecked
`
  );
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(tools: Tool[]): ScanSummary {
  let noChecks = 0;
  let partialChecks = 0;
  let confirmed = 0;
  for (const t of tools) {
    if (t.status === "no_checks") noChecks++;
    else if (t.status === "partial_checks") partialChecks++;
    else confirmed++;
  }
  return { total: tools.length, noChecks, partialChecks, confirmed };
}

// ---------------------------------------------------------------------------
// Output helper
// ---------------------------------------------------------------------------

function writeOutput(content: string, outputPath: string | null): void {
  if (outputPath === null) {
    process.stdout.write(content);
  } else {
    fs.writeFileSync(outputPath, content, "utf-8");
    process.stderr.write(`Report written to: ${outputPath}\n`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const version = readVersion();
  const args = parseArgs(argv);

  if (args === null) return 2;
  if (args.help) { printHelp(version); return 0; }
  if (args.version) { process.stdout.write(`diplomat-agent-ts ${version}\n`); return 0; }

  // Path is required (unless --help or --version was already handled)
  if (!args.path || args.path.length === 0) {
    process.stderr.write("Error: path argument is required\n");
    process.stderr.write("Usage: diplomat-agent-ts <path> [options]\n");
    process.stderr.write("Run 'diplomat-agent-ts --help' for details\n");
    return 2;
  }

  // Resolve scan path
  const scanPath = path.resolve(args.path);
  if (!fs.existsSync(scanPath)) {
    process.stderr.write(`Error: path not found: ${scanPath}\n`);
    return 2;
  }
  const stat = fs.statSync(scanPath);
  if (!stat.isDirectory()) {
    process.stderr.write(`Error: path is not a directory: ${scanPath}\n`);
    return 2;
  }

  // Run scan
  const tools = await scan({ path: scanPath });
  applyMissingHintsToAll(tools);
  applyOwasp(tools);

  const summary = buildSummary(tools);
  const result: ScanResult = {
    generated: new Date().toISOString(),
    version,
    specVersion: "1.0",
    path: args.path,
    language: "typescript",
    summary,
    tools,
  };

  // Always write toolcalls.yaml if --output-registry is set
  if (args.outputRegistry !== null) {
    const registryContent = generateToolcallsYaml(result);
    fs.writeFileSync(args.outputRegistry, registryContent, "utf-8");
    process.stderr.write(`Registry written to: ${args.outputRegistry}\n`);
  }

  // Format main output
  let reportContent: string;
  if (args.format === "json") {
    reportContent = generateJson(result) + "\n";
  } else if (args.format === "registry") {
    reportContent = generateToolcallsYaml(result);
  } else {
    reportContent = generateTerminal(result);
  }

  writeOutput(reportContent, args.output);

  return summary.noChecks > 0 && args.failOnUnchecked ? 1 : 0;
}

// Run when executed directly (ESM __filename check)
const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("cli.js") || process.argv[1].endsWith("cli.ts"));

if (isMain) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(
        `Fatal: ${err instanceof Error ? err.message : String(err)}\n`
      );
      process.exit(2);
    }
  );
}
