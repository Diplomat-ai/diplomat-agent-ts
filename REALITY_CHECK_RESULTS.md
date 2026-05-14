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

### OpenClaw — full `src/` subtree

```bash
git clone --depth 1 https://github.com/Diplomat-ai/openclaw.git /tmp/openclaw
node dist/cli.js scan /tmp/openclaw/src --format json | jq .summary
```

| Metric | Value |
|---|---|
| TypeScript files scanned | 8,005 |
| Tool calls with side effects | 425 |
| `no_checks` | 335 (79%) |
| `partial_checks` | 90 (21%) |
| `confirmed` | 0 |
| Wall time | 32 seconds |

Top side-effect categories (count of detections):
- `destructive` — 399
- `file_delete` — 192
- `http_write` — 27
- `publish` — 5
- `agent_invocation` — 3
- `llm_call` — 2
- `database_delete` — 2

### OpenClaw — `src/agents/` subtree only

A more focused scan on the agent subsystem.

```bash
node dist/cli.js scan /tmp/openclaw/src/agents --format json | jq .summary
```

| Metric | Value |
|---|---|
| TypeScript files scanned | 1,594 |
| Tool calls with side effects | 110 |
| `no_checks` | 84 (76%) |
| `partial_checks` | 26 (24%) |
| `confirmed` | 0 |
| Wall time | 7 seconds |

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

These numbers are not a critique of the scanned projects. Most “unguarded”
calls are in code that runs in trusted contexts (CI, build scripts, dev
tooling) where governance checks are intentionally absent. The scanner
flags **detection candidates** that humans then review — not failures.

The goal is not to count flags. The goal is to make sure that when an AI
agent is reasoning about which function to call next, you know which
of those functions can charge a card, delete data, or send an email
on behalf of a user.
