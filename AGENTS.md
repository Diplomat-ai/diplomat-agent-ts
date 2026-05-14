# AGENTS.md — Guidance for AI coding agents

This file documents conventions, architecture, and validation commands for AI
agents (Claude, Cursor, Copilot, etc.) contributing to **diplomat-agent-ts**.

---

## Project at a glance

diplomat-agent-ts is a **static analyser** that scans TypeScript codebases for
unguarded AI agent tool calls — calls that produce side-effects (database
writes, file deletes, HTTP requests, payments, etc.) without a human-approval
guard in scope.

```
src/
  cli.ts                    # CLI entry point (manual arg parsing, no commander)
  index.ts                  # Public API re-exports
  models.ts                 # Core types: Tool, ScanResult, ScanSummary, PatternMatch
  scanner/
    ast-scanner.ts          # Main scanner: walks TS AST via ts-morph
    interprocedural.ts      # Inter-procedural call graph (callers of callers)
    matcher.ts              # Pattern matching engine
    patterns.ts             # Low-level AST helper predicates
  analyzer/
    checks.ts               # Computes `checked` / `unchecked` status per call
    owasp.ts                # Maps tool types to OWASP Agentic Top-10 categories
    scenarios.ts            # Scenario grouping logic
  reporter/
    index.ts                # Selects and calls the right reporter
    terminal.ts             # Coloured terminal output
    json.ts                 # JSON reporter
    registry.ts             # toolcalls.yaml SBOM reporter
tests/
  fixtures/                 # One sub-directory per scenario (guarded / unguarded)
  *.test.ts                 # Vitest unit + integration tests
toolcalls.yaml              # Pattern catalog / SBOM spec (documented in docs/)
```

---

## Key architecture invariants

1. **No runtime dependencies** beyond `ts-morph` and `yaml`. Do not add any
   others without explicit discussion.

2. **Guard detection lives in `analyzer/checks.ts`**.  A “guard” is an
   expression that appears in the scope of the call: `// checked:ok` annotation,
   a `confirmed`/`approved`/`authorized` boolean check, a rate-limit, an
   idempotency key, etc.  See `src/analyzer/checks.ts` for the full list.

3. **Patterns live in `toolcalls.yaml`** (authoritative) and are mirrored as
   programmatic matchers in `src/scanner/patterns.ts`.  Keep both in sync.

4. **Exit codes are contractual** (documented in `cli.ts` header):
   - `0` — scan ran (issues may exist)
   - `1` — `--fail-on-unchecked` was set and at least one unchecked call found
   - `2` — bad arguments / path not found

5. **The scanner deliberately detects patterns in `tests/fixtures/`**.  Running
   `node dist/cli.js scan ./src` without `--fail-on-unchecked` is the correct
   dogfood check — it will report findings in fixtures but exit 0.

---

## How to add a new pattern

1. Add an entry to `toolcalls.yaml` under the correct category.
2. Add a matcher in `src/scanner/patterns.ts` (use `objContains`, `objExact`,
   `attrContains`, or `attrExact` — **not** `obj`/`attr`).
3. Add a guarded fixture in `tests/fixtures/guarded-<name>/` and an unguarded
   one in `tests/fixtures/unguarded-<name>/`.
4. Run `npm test` — all existing tests must stay green.

---

## Validation commands

```bash
npm run build          # TypeScript compile (tsc)
npm run lint           # ESLint 9 flat config on src/**/*.ts
npm test               # Vitest (includes unit, integration, e2e)

# Dogfood check — must exit 0
node dist/cli.js scan ./src

# Full JSON output for inspection
node dist/cli.js scan ./src --format json
```

---

## Common pitfalls for AI agents

- **Do not add `// checked:ok` to fixture files** that are intentionally
  unguarded — it will flip their test assertion.
- **Do not change exit codes** without updating `cli.test.ts` and docs.
- **ESLint uses flat config** (`eslint.config.js`).  Legacy `.eslintrc.json`
  won’t work.
- **`process` must be imported** from `node:process` in ESM files — it is not a
  global in this build.
- **`tsconfig.json` excludes `tests/`** — Vitest uses esbuild transform
  separately.  Type errors inside tests won’t surface via `tsc`.
- **`FunctionDeclaration` has no `getDecorators()`** in ts-morph 28 — only
  `MethodDeclaration` does.

---

## Coding conventions

- TypeScript strict mode. No `any` unless unavoidable (use `unknown` + narrowing).
- Single-file modules — keep files small and focused.
- No barrel re-exports beyond `src/index.ts`.
- Prefer `node:` prefix for built-in imports (`node:fs`, `node:path`, etc.).
- Tests live next to their subject or under `tests/`; fixtures are self-contained
  directories with a single TypeScript file and a `package.json`.

---

## Lore / rationale

The project maps to the **OWASP Agentic Top-10 (2025)** threat taxonomy.
Each detected tool call is tagged with a category (`AT-01` through `AT-10`).
The methodology is documented in `docs/METHODOLOGY.md`.
The pattern-to-threat mapping is in `docs/owasp-agentic-mapping.md`.
