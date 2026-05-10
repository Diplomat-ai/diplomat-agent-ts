/**
 * AST-based scanner for detecting side effects and guards in TypeScript files.
 *
 * Walks all .ts/.tsx files in a directory, parses them with ts-morph,
 * finds functions with side effects, and returns Tool objects.
 *
 * Mirrors `ast_scanner.py` from the Python version.
 */

import path from "node:path";
import fs from "node:fs";
import {
  Project,
  SyntaxKind,
  type SourceFile,
  type FunctionDeclaration,
  type MethodDeclaration,
  type ArrowFunction,
  type FunctionExpression,
  type CallExpression,
  type Node,
} from "ts-morph";
import type { Guard, SideEffect, Tool, ToolStatus } from "../models.js";
import {
  SIDE_EFFECT_PATTERNS,
  READ_ONLY_PATTERNS,
  GUARD_PATTERNS,
  EXCLUDED_DIRS,
  EXCLUDED_FILE_PATTERNS,
} from "./patterns.js";
import {
  extractCallParts,
  matchCall,
  matchDecorators,
  matchImports,
  matchCompare,
} from "./matcher.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScanOptions {
  /** Absolute or relative path to scan. */
  path: string;
  /** Optional tsconfig.json path. If omitted, uses defaults. */
  tsConfigPath?: string;
}

/**
 * Main scan function. Walks the project, extracts tools, returns the list.
 * Mirrors `scan_directory()` in ast_scanner.py.
 */
export async function scan(options: ScanOptions): Promise<Tool[]> {
  const rootPath = path.resolve(options.path);

  const projectOptions = options.tsConfigPath
    ? { tsConfigFilePath: options.tsConfigPath, skipAddingFilesFromTsConfig: false }
    : {
        compilerOptions: {
          target: 99, // ESNext
          allowJs: true,
          skipLibCheck: true,
        },
        skipAddingFilesFromTsConfig: true,
      };

  const project = new Project(projectOptions);

  if (!options.tsConfigPath) {
    // Manually add files respecting exclusion rules
    const files = collectFiles(rootPath);
    project.addSourceFilesAtPaths(files);
  }

  const tools: Tool[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    // Skip files outside the target path or in excluded dirs/patterns
    if (!filePath.startsWith(rootPath)) continue;
    if (shouldExcludeFile(filePath)) continue;

    const relativePath = path.relative(rootPath, filePath);
    const fileImports = extractImports(sourceFile);
    const fileTools = processSourceFile(sourceFile, relativePath, fileImports);
    tools.push(...fileTools);
  }

  return tools;
}

/**
 * Scan a single file given its text. Useful for tests.
 */
export function scanFile(filePath: string, sourceText: string, projectRoot: string): Tool[] {
  const project = new Project({
    compilerOptions: { target: 99, allowJs: true, skipLibCheck: true },
    useInMemoryFileSystem: true,
  });
  const sourceFile = project.createSourceFile(filePath, sourceText);
  const relativePath = path.relative(projectRoot, filePath);
  const fileImports = extractImports(sourceFile);
  return processSourceFile(sourceFile, relativePath, fileImports);
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!shouldExcludeDir(entry.name)) {
          results.push(...collectFiles(fullPath));
        }
      } else if (entry.isFile()) {
        if ((entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) && !shouldExcludeFile(fullPath)) {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // Ignore unreadable directories
  }
  return results;
}

function shouldExcludeDir(name: string): boolean {
  return EXCLUDED_DIRS.includes(name) || name.startsWith(".");
}

function shouldExcludeFile(filePath: string): boolean {
  return EXCLUDED_FILE_PATTERNS.some(pat => filePath.endsWith(pat));
}

// ---------------------------------------------------------------------------
// Import collection
// ---------------------------------------------------------------------------

function extractImports(sourceFile: SourceFile): string[] {
  const imports: string[] = [];
  for (const decl of sourceFile.getImportDeclarations()) {
    imports.push(decl.getModuleSpecifierValue().toLowerCase());
  }
  return imports;
}

// ---------------------------------------------------------------------------
// Source file processing
// ---------------------------------------------------------------------------

type FunctionLike =
  | FunctionDeclaration
  | MethodDeclaration
  | ArrowFunction
  | FunctionExpression;

function processSourceFile(
  sourceFile: SourceFile,
  relativePath: string,
  fileImports: string[],
): Tool[] {
  const tools: Tool[] = [];

  // Top-level and nested functions
  const functionLikes = collectFunctionLikes(sourceFile);

  for (const fn of functionLikes) {
    const tool = processFunctionLike(fn, relativePath, fileImports);
    if (tool != null) {
      tools.push(tool);
    }
  }

  return tools;
}

function collectFunctionLikes(sourceFile: SourceFile): FunctionLike[] {
  const results: FunctionLike[] = [];

  // Named function declarations (top-level and nested)
  for (const fn of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
    results.push(fn);
  }
  // Class methods
  for (const cls of sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration)) {
    for (const method of cls.getMethods()) {
      results.push(method);
    }
  }
  // Arrow functions assigned to top-level or module-level variable declarations
  for (const varDecl of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const init = varDecl.getInitializer();
    if (init?.getKind() === SyntaxKind.ArrowFunction) {
      results.push(init.asKindOrThrow(SyntaxKind.ArrowFunction));
    }
    if (init?.getKind() === SyntaxKind.FunctionExpression) {
      results.push(init.asKindOrThrow(SyntaxKind.FunctionExpression));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Function analysis
// ---------------------------------------------------------------------------

function processFunctionLike(
  node: FunctionLike,
  file: string,
  fileImports: string[],
): Tool | null {
  const body = getBody(node);
  if (!body) return null;

  // Step 1: collect call expressions in body.
  // For arrow functions with expression bodies, the body itself may be a
  // CallExpression. getDescendantsOfKind does not include the node itself,
  // so we check the body and prepend it if it's a call.
  const callExprs: CallExpression[] = body.getDescendantsOfKind(SyntaxKind.CallExpression);
  if (body.getKind() === SyntaxKind.CallExpression) {
    callExprs.unshift(body as CallExpression);
  }

  // Step 2: detect side effects
  const sideEffects: SideEffect[] = [];
  const seenSideEffects = new Set<string>();

  for (const callExpr of callExprs) {
    const parts = extractCallParts(callExpr);

    // Skip read-only calls
    if (READ_ONLY_PATTERNS.some(p => matchCall(parts, p.match))) continue;

    // First-match-wins. The order of SIDE_EFFECT_PATTERNS encodes category
    // priority — see the comment at the top of patterns.ts. Do not change the
    // loop to "all-matches"; doing so would require a separate precedence policy
    // that this version of diplomat-agent-ts intentionally avoids in favor of
    // declarative ordering.
    //
    // When a pattern declares importContains, it is checked as an additional
    // AND condition so that import-scoped patterns (e.g. Mongoose, Anthropic)
    // do not fire in files that never imported the relevant library.
    for (const pattern of SIDE_EFFECT_PATTERNS) {
      const importOk = !pattern.match.importContains || matchImports(fileImports, pattern.match);
      if (importOk && matchCall(parts, pattern.match)) {
        const line = callExpr.getStartLineNumber();
        const key = `${pattern.category}:${line}`;
        if (!seenSideEffects.has(key)) {
          seenSideEffects.add(key);
          sideEffects.push({
            category: pattern.category,
            risk: pattern.risk,
            code: codeExcerpt(callExpr, 120),
            line,
          });
        }
        break; // one match per call site
      }
    }
  }

  if (sideEffects.length === 0) return null;

  // Step 3: collect guards
  const guards: Guard[] = [];
  const seenGuards = new Set<string>();

  function addGuard(type: string, coverage: string, code: string, line: number): void {
    const key = `${type}:${line}`;
    if (!seenGuards.has(key)) {
      seenGuards.add(key);
      guards.push({
        type: type as Guard["type"],
        coverage: coverage as Guard["coverage"],
        code,
        line,
      });
    }
  }

  // 3a: decorator-level guards
  const decoratorNames = getDecoratorNames(node);
  for (const pattern of GUARD_PATTERNS) {
    if (matchDecorators(decoratorNames, pattern.match)) {
      const dec = decoratorNames.find(d =>
        pattern.match.decoratorContains?.some(s => d.toLowerCase().includes(s.toLowerCase()))
      ) ?? "";
      addGuard(pattern.type, pattern.coverage, `@${dec}`, getStartLine(node));
    }
  }

  // 3b: import-level guards (file-scope)
  for (const pattern of GUARD_PATTERNS) {
    if (matchImports(fileImports, pattern.match)) {
      const imp = fileImports.find(i =>
        pattern.match.importContains?.some(s => i.toLowerCase().includes(s.toLowerCase()))
      ) ?? "";
      addGuard(pattern.type, pattern.coverage, `import "${imp}"`, 0);
    }
  }

  // 3c: call guards in body
  for (const callExpr of callExprs) {
    const parts = extractCallParts(callExpr);
    for (const pattern of GUARD_PATTERNS) {
      if (
        pattern.match.decoratorContains === undefined &&
        pattern.match.importContains === undefined &&
        pattern.match.compareContains === undefined
      ) {
        if (matchCall(parts, pattern.match)) {
          addGuard(pattern.type, pattern.coverage, codeExcerpt(callExpr, 120), callExpr.getStartLineNumber());
        }
      }
    }
  }

  // 3d: if/ternary compare guards
  const ifStatements = body.getDescendantsOfKind(SyntaxKind.IfStatement);
  for (const ifStmt of ifStatements) {
    const condText = ifStmt.getExpression().getText();
    for (const pattern of GUARD_PATTERNS) {
      if (matchCompare(condText, pattern.match)) {
        addGuard(
          pattern.type,
          pattern.coverage,
          `if (${condText.slice(0, 80)})`,
          ifStmt.getStartLineNumber(),
        );
      }
    }
  }

  // Step 4: detect // checked:ok annotation
  const confirmed = extractCheckedOkAnnotation(node);

  // Step 5: classification
  let status: ToolStatus;
  if (confirmed != null) {
    status = "confirmed";
  } else if (guards.length === 0) {
    status = "no_checks";
  } else {
    status = "partial_checks";
  }

  return {
    function: getFunctionName(node),
    file,
    line: getStartLine(node),
    sideEffects,
    guards,
    missingHints: [],
    owaspAgentic: [],
    confirmed,
    status,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBody(node: FunctionLike): Node | null {
  if (node.getKind() === SyntaxKind.ArrowFunction) {
    const af = node as ArrowFunction;
    const body = af.getBody();
    // Arrow functions can have expression bodies (no braces)
    return body ?? null;
  }
  const body = (node as FunctionDeclaration | MethodDeclaration | FunctionExpression).getBody();
  return body ?? null;
}

function getFunctionName(node: FunctionLike): string {
  if (node.getKind() === SyntaxKind.FunctionDeclaration) {
    return (node as FunctionDeclaration).getName() ?? "<anonymous>";
  }
  if (node.getKind() === SyntaxKind.MethodDeclaration) {
    return (node as MethodDeclaration).getName();
  }
  if (node.getKind() === SyntaxKind.ArrowFunction || node.getKind() === SyntaxKind.FunctionExpression) {
    // Try to get the variable name it's assigned to
    const parent = node.getParent();
    if (parent?.getKind() === SyntaxKind.VariableDeclaration) {
      const name = (parent as import("ts-morph").VariableDeclaration).getName();
      if (name) return name;
    }
    return "<anonymous>";
  }
  return "<anonymous>";
}

function getStartLine(node: FunctionLike): number {
  return node.getStartLineNumber();
}

function getDecoratorNames(node: FunctionLike): string[] {
  if (node.getKind() === SyntaxKind.MethodDeclaration) {
    return (node as MethodDeclaration).getDecorators().map(d => d.getName());
  }
  // FunctionDeclaration, ArrowFunction, FunctionExpression: no TS decorator support
  // without experimentalDecorators — return empty.
  return [];
}

/**
 * Return a short code excerpt for a node (trimmed, max maxLen chars).
 * Mirrors `_src()` in Python.
 */
function codeExcerpt(node: CallExpression, maxLen: number): string {
  const sourceFile = node.getSourceFile();
  const startLine = node.getStartLineNumber();
  const lineText = sourceFile.getFullText().split("\n")[startLine - 1] ?? "";
  const trimmed = lineText.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

/**
 * Look for `// checked:ok — reason` either:
 *  - In the 3 lines before the function declaration, OR
 *  - Anywhere inside the function body (standalone comment before a side effect)
 *
 * Returns the reason string if found, undefined otherwise.
 * Mirrors the diplomat:ok / checked:ok detection in Python.
 */
function extractCheckedOkAnnotation(node: FunctionLike): string | undefined {
  const sourceFile = node.getSourceFile();
  const fullText = sourceFile.getFullText();
  const startPos = node.getStart();
  const endPos = node.getEnd();

  const markers = ["checked:ok", "diplomat:ok", "canary:ok"];

  function parseMarker(line: string): string | undefined {
    for (const marker of markers) {
      const idx = line.indexOf(marker);
      if (idx !== -1) {
        let after = line.slice(idx + marker.length).trim();
        for (const prefix of ["—", "–", "-"]) {
          if (after.startsWith(prefix)) {
            after = after.slice(prefix.length).trim();
            break;
          }
        }
        return after || marker;
      }
    }
    return undefined;
  }

  // Check 3 lines before the function declaration
  const textBefore = fullText.slice(0, startPos);
  const linesBefore = textBefore.split("\n");
  for (const line of linesBefore.slice(-3).reverse()) {
    const result = parseMarker(line);
    if (result !== undefined) return result;
  }

  // Also scan the function body for inline / standalone checked:ok comments
  const bodyText = fullText.slice(startPos, endPos);
  for (const line of bodyText.split("\n")) {
    const result = parseMarker(line);
    if (result !== undefined) return result;
  }

  return undefined;
}

