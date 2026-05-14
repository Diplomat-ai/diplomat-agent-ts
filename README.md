# diplomat-agent-ts

[![npm version](https://img.shields.io/npm/v/@diplomat-ai/diplomat-agent-ts?style=flat-square&color=0969da&label=npm)](https://www.npmjs.com/package/@diplomat-ai/diplomat-agent-ts)
[![Node 20+](https://img.shields.io/badge/node-%3E%3D20-3FB950?style=flat-square)](https://nodejs.org)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-6E7681?style=flat-square)](LICENSE)
[![OWASP Agentic](https://img.shields.io/badge/OWASP-Agentic_Top_10-E3B341?style=flat-square)](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
[![CI](https://img.shields.io/github/actions/workflow/status/Diplomat-ai/diplomat-agent-ts/ci.yml?style=flat-square&label=CI&color=3FB950)](https://github.com/Diplomat-ai/diplomat-agent-ts/actions)

> **You shipped a TypeScript AI agent. Do you know every function it can call that writes to a database, sends an email, charges a card, or deletes data — and which ones have zero checks?**

`diplomat-agent-ts` runs a static AST scan and tells you exactly that. Two dependencies. 8 seconds on a 1,500-file agent codebase.

```bash
npm install -D @diplomat-ai/diplomat-agent-ts
npx diplomat-agent-ts scan ./src
```

<p align="center">
  <img src="./docs/assets/before-after.svg" alt="Before diplomat-agent-ts: you can't see what your agent can do. After: every tool call is mapped, classified by side effect, and tagged with OWASP Agentic codes — diffable in PRs." width="900"/>
</p>

## What it looks like

<p align="center">
  <img src="./docs/assets/terminal-hero.svg" alt="diplomat-agent-ts terminal output showing one unguarded chargeCustomer call with missing bounds, rate limit, and approval step (mapped to OWASP ASI-01, ASI-02, ASI-03, ASI-06), one unguarded deleteUserData call, and one confirmed sendWelcomeEmail call annotated with checked:ok." width="900"/>
</p>

## Why this matters for AI agents

In a web app, a human clicks a button. The UI has validation, confirmation dialogs, rate limits per session.

In an agent, an LLM decides which functions to call, with what arguments, how many times. It doesn't know your business rules. It can loop, hallucinate arguments, or get prompt-injected.

**Without guards in the code, there's nothing between the LLM's decision and the real-world consequence.**

We scanned the [OpenClaw](https://github.com/openclaw/openclaw) agent codebase (8,005 TypeScript files, 32 seconds). **425 tool calls had real side effects. 335 of them (79%) had zero checks.** Not a single one was confirmed.

## What it detects

40+ patterns across 12 side-effect categories:

| Category | Examples (TS-native) | Required guards |
|---|---|---|
| `payment` | `stripe.charges.create()`, `stripe.refunds.create()` | bounds, rate limit, approval |
| `database_write` | Prisma `.create()` / `.update()`, Mongoose `.save()` | input validation, rate limit |
| `database_delete` | Prisma `.delete()`, Mongoose `.deleteOne()`, raw `DELETE` | batch protection, confirmation |
| `http_write` | `axios.post()`, `fetch(POST)`, `got.put()` | rate limit, retry bound |
| `email` | `nodemailer.sendMail()`, `resend.emails.send()`, `sgMail.send()` | rate limit |
| `messaging` | `twilio.messages.create()`, `slack.chat.postMessage()` | rate limit |
| `agent_invocation` | `agent.run()`, `graph.invoke()`, `Runner.run()` | input validation, approval |
| `llm_call` | `openai.chat.completions.create()`, `anthropic.messages.create()` | — |
| `publish` | `s3.send(PutObjectCommand)`, `client.publish()` | approval |
| `dynamic_code` | `eval()`, `new Function()`, `vm.runInNewContext()` | confirmation |
| `file_delete` | `fs.rm()`, `fs.unlink()`, `fs-extra.remove()` | confirmation |
| `destructive` | `execSync()`, `spawnSync()`, `execa()` | confirmation |

**What counts as a guard:** input validation (Zod, Yup, class-validator), rate limiting (NestJS `@Throttle`, custom decorators), auth checks (NestJS guards, middleware), confirmation steps, idempotency keys, retry bounds. Full catalog in [`src/scanner/patterns.ts`](./src/scanner/patterns.ts).

## Quick start

```bash
# Scan a directory
diplomat-agent-ts scan ./src

# Generate the toolcalls.yaml SBOM (commit this)
diplomat-agent-ts scan ./src --output-registry toolcalls.yaml

# Fail CI when new unguarded tool calls appear
diplomat-agent-ts scan ./src --fail-on-unchecked

# JSON output for IDE agents, automation, custom dashboards
diplomat-agent-ts scan ./src --format json
```

The scanner emits:
- A coloured ANSI report to stdout (default)
- `toolcalls.yaml` — a diff-stable registry of every detected tool call (with `--output-registry`)
- JSON — `snake_case` field names, interoperable with the [Python scanner](https://github.com/Diplomat-ai/diplomat-agent) (`--format json`)

## Integrate everywhere

### CI — block unguarded PRs

```yaml
# .github/workflows/diplomat.yml
- name: Diplomat governance scan
  run: npx -y @diplomat-ai/diplomat-agent-ts scan ./src --fail-on-unchecked
```

Exit code `1` if any tool call has `no_checks` status. Exit `0` otherwise — even if `partial_checks` exist (they're warnings, not blockers).

### Pre-commit hook

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: diplomat-agent-ts
        name: diplomat governance scan
        entry: npx -y @diplomat-ai/diplomat-agent-ts scan ./src --fail-on-unchecked
        language: system
        pass_filenames: false
```

### IDE — review what the copilot wrote

The scanner runs locally in under 10 seconds on typical agent codebases. Ask Claude Code, Copilot, or Cursor to run it after generating tool-calling code:

> "Run `diplomat-agent-ts scan ./src` and fix any unguarded tool calls."

## Acknowledge a tool call

When a function is intentionally unguarded or protected outside the static-analysis scope, mark it inline:

```ts
// checked:ok — protected by middleware/approval.ts
export async function chargeCustomer(amount: number, customerId: string) {
  return stripe.charges.create({ amount, currency: "usd", customer: customerId });
}
```

`diplomat:ok` and `canary:ok` are accepted as aliases. The next scan moves the call to `confirmed` status with an empty `missing_hints` list. The annotation appears in the YAML registry so reviewers can audit *why* something was confirmed.

## `toolcalls.yaml` — a behavioral SBOM

Like `package-lock.json`, but for what your agent can *do*, not what it depends on:

```yaml
spec_version: "1.0"
language: typescript

summary:
  total: 12
  no_checks: 8
  partial_checks: 3
  confirmed: 1

tool_calls:
  - function: chargeCustomer
    file: src/payments.ts
    line: 42
    actions:
      - "return stripe.charges.create({ amount, currency, customer })"
    checks: []
    missing:
      - no bounds on amount
      - no rate limit
      - no idempotency key
    owasp: [ASI-01, ASI-02, ASI-03, ASI-06]
```

Commit it. Diff it in PRs. When your agent gains a new capability, the change shows up in review — before it ships.

Spec → [`docs/toolcalls-yaml-spec.md`](./docs/toolcalls-yaml-spec.md)

## OWASP Agentic Top 10 mapping

Every flagged finding is tagged with one or more codes from the OWASP Agentic Security Initiative Top 10:

| Code | Risk | When it fires |
|---|---|---|
| `ASI-01` | Excessive Agency | Side effect with no auth check |
| `ASI-02` | Tool Misuse | Any side effect (baseline tag) |
| `ASI-03` | Privilege Compromise | Payments, deletes, destructive ops with no confirmation |
| `ASI-04` | Resource Overload | Agent invocations without bounds |
| `ASI-05` | Cascading Hallucination | LLM call chained to side effect |
| `ASI-06` | Identity Spoofing | Missing rate limit or retry bound |
| `ASI-10` | Overreliance | Nested agent invocations |

Full mapping in [`src/analyzer/owasp.ts`](./src/analyzer/owasp.ts).

## Architecture

<p align="center">
  <img src="./docs/assets/architecture.svg" alt="Internal architecture of diplomat-agent-ts in three lanes: SCANNER (patterns.ts, matcher.ts, ast-scanner.ts producing Tool[]), ANALYZER (checks.ts, owasp.ts producing ScanResult), REPORTER (registry.ts, json.ts, terminal.ts). Contribution hints at the bottom: add patterns in patterns.ts only, change matching logic in matcher.ts with tests, new output formats as new files in reporter/." width="1000"/>
</p>

Three pure stages, no shared state. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for full guidelines.

## Benchmarks

Real codebases, real numbers:

| Repo | TS files | Tool calls | No checks | Partial | Time |
|---|---|---|---|---|---|
| [OpenClaw](https://github.com/openclaw/openclaw) (`src/`) | 8,005 | 425 | 335 (79%) | 90 (21%) | 32s |
| [OpenClaw](https://github.com/openclaw/openclaw) (`src/agents/`) | 1,594 | 110 | 84 (76%) | 26 (24%) | 7s |

Run the benchmarks yourself:

```bash
git clone --depth 1 https://github.com/openclaw/openclaw /tmp/openclaw
npx -y @diplomat-ai/diplomat-agent-ts scan /tmp/openclaw/src --format json | jq .summary
```

## Output formats

| Format | Flag | Use case |
|---|---|---|
| Terminal (default) | — | Human review |
| JSON | `--format json` | IDE agents, dashboards, automation |
| YAML registry | `--format registry` *or* `--output-registry FILE` | `toolcalls.yaml` SBOM, PR diffs |

## Known limitations

- **Static analysis only** — no runtime detection. If a guard is added by middleware or a gateway outside the file, annotate with `// checked:ok — protected by [where]`.
- **Intra-procedural** — guard detection looks at the same function or its immediate decorators. Cross-file guard chains require an annotation.
- **TypeScript / JavaScript only** — for Python agents, use [diplomat-agent](https://github.com/Diplomat-ai/diplomat-agent).
- **ORM patterns require the import** — Mongoose, Sequelize, and TypeORM use generic method names (`.save()`, `.create()`), so the patterns are scoped to files that import the ORM. Re-exported models may be missed.

Full limitations and pattern refinement history → [`docs/limitations.md`](./docs/limitations.md)

## Roadmap

- [x] AST scanner with 40+ patterns across 12 categories
- [x] `toolcalls.yaml` behavioral SBOM with diff-stable output
- [x] OWASP Agentic Top 10 mapping
- [x] CI integration (`--fail-on-unchecked`)
- [x] `// checked:ok` annotations (with `diplomat:ok` / `canary:ok` aliases)
- [x] Validated against OpenClaw (8,005 files, 32s)
- [ ] Inter-procedural decorator resolution (v0.2)
- [ ] SARIF 2.1.0 output (v0.2)
- [ ] `--diff-only` for changed files (v0.2)
- [ ] MCP server scanning (v0.3)
- [ ] VS Code extension with inline diagnostics

## Requirements

- Node.js ≥ 20
- 2 runtime dependencies: `ts-morph` (TypeScript compiler wrapper), `yaml`

## Sibling projects

- [**diplomat-agent**](https://github.com/Diplomat-ai/diplomat-agent) — the original Python scanner
- **diplomat-gate** — runtime governance: `CONTINUE` / `REVIEW` / `STOP` decisions in < 1ms
- **diplomat.run** — hosted control plane with hash-chained audit trail

## Contributing

PRs welcome. The architecture above tells you exactly where things live. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) first — it explains the "patterns are data, not logic" rule that keeps the matcher simple.

## License

Apache 2.0 — Copyright 2026 Diplomat Services SAS. See [`LICENSE`](./LICENSE).