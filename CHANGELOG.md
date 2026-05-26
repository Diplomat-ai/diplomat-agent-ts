# Changelog

All notable changes to diplomat-agent-ts will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] — 2026-05-26

### Fixed
- Windows path normalization in `src/scanner/ast-scanner.ts`: `path.resolve()` returns backslashes on Windows but ts-morph's `getFilePath()` always returns forward slashes, so the `filePath.startsWith(rootPath)` filter dropped every source file and the scanner returned 0 findings. The published 0.1.0 tarball was affected; 0.1.1 ships the fix.

### Added
- `new Function(...)` detection in the `dynamic_code` category (risk 3, mapped to ASI-02 / ASI-03). The README listed it as a covered pattern since 0.1.0 but the scanner only matched `eval(...)` and `vm.runIn*` until now. New fixture: `tests/fixtures/unguarded-dynamic-code-new-function/`. Test count: 196 → 197.

### Docs
- Benchmarks table: added a methodology note clarifying that file counts are post-exclusion, not raw `git ls-files`, and that findings reproduce at the pinned commits.
- Aligned the three OpenClaw figures across README to one consistent value: 7,874 files, ~9 s on M-series / ~30 s on x86.
- Added pinned-commit links for OpenClaw `49d9996d`, Mastra `38b87964`, and OpenAI Agents JS `629d35af`.

## [0.1.0] — 2026-05-16

### Scanner
- AST scanner via ts-morph — walks TypeScript source files without a `tsconfig.json` dependency
- 40+ pattern matchers across 12 side-effect categories: `payment`, `database_write`, `database_delete`, `http_write`, `email`, `messaging`, `agent_invocation`, `llm_call`, `publish`, `dynamic_code`, `file_delete`, `destructive`
- Guard detection: input validation (Zod, Yup, class-validator), rate limiting (`@Throttle`, custom decorators), auth checks (NestJS guards), confirmation steps, idempotency keys, retry bounds, `// checked:ok` annotations (`diplomat:ok` / `canary:ok` aliases)
- Inter-procedural caller detection: flags functions that call guarded/unguarded tool functions
- Pattern precision fix (SPEC FIX 5): `nameExact: ["deploy"]` prevents `cancelDeploy` / `listDeployments` / `redeployApp` false positives from `@mastra/deployer` (39 FPs eliminated)
- Import-scoped ORM patterns: Mongoose, Sequelize, TypeORM `.create()` / `.save()` scoped to files that import the ORM to avoid generic-name FPs
- `excluded-test-files` and `excluded-node-modules` exclusions built-in

### Analyzer
- `checks.ts` — computes `confirmed` / `partial_checks` / `no_checks` status per tool call
- `owasp.ts` — maps each side-effect category to OWASP Agentic Security Initiative Top-10 codes (ASI-01 through ASI-10; ASI-07/08/09 are runtime scope, excluded from static)
- `scenarios.ts` — groups findings by scenario for the terminal reporter

### Reporter
- Terminal reporter: coloured ANSI output with missing-hints list per tool call
- JSON reporter: `snake_case` field names, interoperable with the Python `diplomat-agent` scanner
- YAML registry reporter (`toolcalls.yaml`): diff-stable behavioral SBOM — spec in `docs/toolcalls-yaml-spec.md`
- `--output FILE` and `--output-registry FILE` flags for writing reports to disk

### CLI (`src/cli.ts`)
- `diplomat-agent-ts scan [PATH]` — main entry point; PATH defaults to `.`
- `--format terminal|json|registry`
- `--output FILE` — write report to file
- `--output-registry FILE` — write `toolcalls.yaml`
- `--fail-on-unchecked` — exit 1 if any `no_checks` tool call found (CI gate)
- `--version` — prints semver from `package.json`
- `--help`
- Exit codes: `0` scan ran, `1` unchecked calls with `--fail-on-unchecked`, `2` bad arguments

### Tests (196 total, 18 files)
- Unit: patterns coverage, matcher logic, `extractCallParts`, analyzer, OWASP mapping
- Fixture regression: 51 fixture directories covering all 12 categories (guarded + unguarded)
- Integration: full pipeline scan
- E2E: CLI subprocess tests (exit codes, stdout content, output files)
- Perf: OpenClaw bench (TP/TN), scaling (< 30s for all 25 fixtures)
- Security: no-network guarantee, no-code-execution check
- Meta: dependency audit (`ts-morph` + `yaml` only), type-safety checks

### Infra
- GitHub Actions CI: Node 20 + 22 matrix, lint → build → test → scan-self dogfood
- `release.yml`: version-tag verification → GitHub Release → `npm publish --provenance`
- `openclaw-benchmark.yml`: weekly scheduled scan + release artifact upload
- Dependabot: GitHub Actions auto-updates (checkout/setup-node/upload-artifact/action-gh-release)
- Pre-commit hook via `.pre-commit-hooks.yaml`

### Fixed
- `@eslint/js` downgraded `^10→^9` to match `eslint@9` peer dependency (was breaking CI on Node 22 < 22.13.0)
- CI badge URL changed from shields.io to GitHub Actions native format
- Removed `/Users/josselin/` path leaks from `toolcalls.yaml` and `openclaw-src.json`
- Deleted stale `openclaw-agents.{json,yaml}` benchmark scope

### Benchmarks (v0.1.0 — `benchmarks/v0.1.0/`)
| Codebase (scope) | Type | TS files | Tool calls | `no_checks` |
|---|---|---|---|---|
| OpenClaw `src/` (pinned `49d9996d`) | Application | 7,874 | 419 | 332 (79%) |
| Mastra `packages/` | Framework | 2,777 | 185 | 162 (88%) |
| OpenAI Agents JS `packages/` | Framework | 426 | 33 | 31 (94%) |
| OpenAI Agents JS `examples/` | Examples | 302 | 32 | 28 (88%) |
