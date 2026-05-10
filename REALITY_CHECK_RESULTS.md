# Reality check results — v0.1.0

This document tracks how `diplomat-agent-ts` performs on real-world
TypeScript codebases. Numbers are reproducible — every run below can be
re-executed with the commands shown.

## Methodology

We pick public TypeScript agent codebases, run the scanner, and record:
- Total tool calls with side effects
- How many had no guards detected (`no_checks`)
- How many had partial guards (`partial_checks`)
- Scan time on standard CI hardware (GitHub Actions, Ubuntu, Node 20)

We do not modify the target codebase. We report what the scanner sees on
the unmodified source. Findings reflect the current pattern catalog —
they will shift as the catalog evolves.

## v0.1.0 results

Scanned with `diplomat-agent-ts` v0.1.0 (post-SPEC FIX 5).  
Reproducible artifacts in [`benchmarks/v0.1.0/`](./benchmarks/v0.1.0/).

### OpenClaw — full `src/` subtree

```bash
git clone https://github.com/Diplomat-ai/openclaw /tmp/openclaw
node dist/cli.js scan /tmp/openclaw/src --format json | jq .summary
```

| Metric | Value |
|---|---|
| TypeScript files scanned | 7,882 |
| Tool calls with side effects | 418 |
| `no_checks` | 331 (79%) |
| `partial_checks` | 87 (21%) |
| `confirmed` | 0 |
| Wall time | ~5s (M-series) / ~32s (Ubuntu CI) |

### OpenClaw — `src/agents/` subtree only

A focused scan on the OpenClaw agent subsystem.

```bash
node dist/cli.js scan /tmp/openclaw/src/agents --format json | jq .summary
```

| Metric | Value |
|---|---|
| TypeScript files scanned | 1,565 |
| Tool calls with side effects | 102 |
| `no_checks` | 78 (76%) |
| `partial_checks` | 24 (24%) |
| `confirmed` | 0 |
| Wall time | ~2s (M-series) / ~7s (Ubuntu CI) |

### Mastra — `packages/` subtree

[Mastra](https://github.com/mastra-ai/mastra) is a production TypeScript AI
agent framework. This scan covers the full `packages/` monorepo (all internal
packages — core, deployer, integrations, etc.), commit `38b87960`.

```bash
git clone --depth 1 https://github.com/mastra-ai/mastra /tmp/mastra
node dist/cli.js scan /tmp/mastra/packages --format json | jq .summary
```

| Metric | Value |
|---|---|
| TypeScript files scanned | 2,787 |
| Tool calls with side effects | 185 |
| `no_checks` | 162 (88%) |
| `partial_checks` | 23 (12%) |
| `confirmed` | 0 |
| Wall time | ~5s (M-series) |

Top side-effect categories:
- `publish` — dominant (deployment operations throughout `@mastra/deployer`)
- `http_write` — REST API calls in integration packages
- `llm_call` — Anthropic/OpenAI calls in `@mastra/core`

**Pattern fix note:** SPEC FIX 5 eliminated 39 false positives from `@mastra/deployer`
by replacing `nameContains: ["deploy"]` with `nameExact: ["deploy"]`. Deployment
management methods (`cancelDeploy`, `listDeployments`, `getDeployStatus`, etc.)
are read/control operations and should not be flagged as publish side-effects.
A 10/10 manual sample confirmed all 39 were genuine FPs. See `benchmarks/v0.1.0/MANIFEST.md`.

## How to reproduce

1. Clone this repo and `npm install && npm run build`.
2. Clone any TypeScript codebase you want to scan into `/tmp/target`.
3. Run `node dist/cli.js scan /tmp/target --format json | jq .summary`.
4. To inspect specific findings: `node dist/cli.js scan /tmp/target --format registry > toolcalls.yaml`.

## Roadmap for v0.2

- Add at least 3 more open-source TypeScript agent codebases to this report
  (Mastra example apps, OpenAI Agents SDK TS examples, LangGraph.js demos)
- Track score deltas across releases automatically via the
  `.github/workflows/openclaw-benchmark.yml` workflow

## Notes

These numbers are not a critique of the scanned projects. Most "unguarded"
calls are in code that runs in trusted contexts (CI, build scripts, dev
tooling) where governance checks are intentionally absent. The scanner
flags **detection candidates** that humans then review — not failures.

The goal is not to count flags. The goal is to make sure that when an AI
agent is reasoning about which function to call next, you know which
of those functions can charge a card, delete data, or send an email
on behalf of a user.
