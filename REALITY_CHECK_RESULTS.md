# Reality Check — diplomat-agent-ts benchmark results

**What this document is:** raw scan results from 3 open-source TypeScript AI agent codebases (4 scan scopes), with full transparency on what the scanner found, what we got wrong before publication, and what the scanner doesn't see.

**What this document is not:** a claim that these projects are insecure. These are open-source codebases that teams fork and build on. The guardrails are expected to be added by each team. `diplomat-agent-ts` checks whether they were.

> Scanner version: v0.1.0 · Node.js ≥ 20 · 2 runtime dependencies (`ts-morph`, `yaml`) · static analysis only
> Scan date: 2026-05-15

---

## Before you read: what we fixed pre-publication

We believe in showing our work. Two things happened during pre-publication review of this benchmark that we want to be explicit about — both are signals of the rigor we apply to our own scanner, not failures.

**Pattern correction in v0.1.0 (SPEC FIX 5).** An early scan of Mastra showed 202 tool calls in `packages/` with 155 categorized as `publish`. Manual review of 10 random `publish` findings revealed that 4 out of 10 were false positives — deployment-management methods (`cancelDeploy`, `pollServerDeploy`, `listDeployments`) being matched by the `publish` pattern's overly broad `nameContains: ["deploy"]` rule. We tightened the pattern to require exact name matching for the `deploy` token, added regression fixtures and tests (197 passing), and re-scanned. The corrected Mastra `packages/` number is **185 total tool calls, 162 unguarded (88%)** — 17 fewer total, 39 fewer `publish` findings. Every number in this report reflects the post-fix scanner. The pre-fix numbers and the bug that produced them are documented in the commit history.

**OpenClaw commit pinning.** OpenClaw is an active codebase. To make this benchmark reproducible by anyone — not just by us, with our local copy — we pinned the OpenClaw scan to a specific public commit (`49d9996d`). The exact reproduction command in this document includes the checkout step. Anyone running it gets identical numbers.

**Known false positives we did not fix.** Two are worth flagging up front:

- The `destructive` pattern (which matches `child_process.execSync`, `child_process.spawn`, `execa`, etc.) is correctly scoped by import — it does not match arbitrary identifiers containing the substring `exec`. However, **on codebases whose domain is shell execution** (like OpenClaw, which is a shell-running agent), the `destructive` category will contain hundreds of findings by design. These are genuine `child_process` calls, not false positives in the pattern sense — they are by-design tool calls that exist because the product exists. Reviewers should not read "X destructive findings on OpenClaw" as "X security vulnerabilities."
- The `publish` pattern, even after SPEC FIX 5, still matches generic `pubsub.publish()` calls regardless of whether the publish target is internal (a process-local event bus, like Mastra's workflow event system) or external (a Kafka topic, an S3 upload). Mastra contributes ~115 internal-pubsub findings to the `publish` count that are framework primitives, not external publishing operations. Acknowledge these with `// checked:ok — internal pubsub` when adopting Mastra.

**Known scanner blind spots.** These are documented in detail at the bottom of this report. The short version: limited inter-procedural analysis (guards one frame up are invisible), import-scoped patterns only (re-exported ORM models slip through), no data-flow analysis (we see `execSync(cmd)`, not whether `cmd` is a constant or tainted input).

If you find something we missed or got wrong, [open an issue](https://github.com/Diplomat-ai/diplomat-agent-ts/issues). We'd rather fix it than pretend it's not there.

---

## On repo types

Not all repos in this benchmark are the same. We label each scan scope by type and let you draw your own conclusions:

- **Application** — a finished agent product that teams deploy. The tool calls were written by the team that built the product. Guards were theirs to add. OpenClaw falls here.
- **Framework** — code intended to be embedded inside other people's agents. The absence of guards is largely by design — frameworks provide primitives and expect downstream developers to add the governance. Mastra `packages/` and OpenAI Agents JS `packages/` fall here.
- **Examples** — starter code, demos, templates that developers copy as a starting point. Examples often skip guards on purpose for clarity, but they're also what gets copy-pasted into real products. The unguarded rate in examples matters because it transfers. OpenAI Agents JS `examples/` falls here.

The scanner treats all three identically.

---

## Summary

| | |
|---|---|
| Codebases scanned | 3 |
| Scan scopes | 4 |
| TypeScript files scanned | 11,379 |
| Total tool calls with side effects | 669 |
| Unguarded (zero checks) | 553 (83%) |
| Partially guarded | 116 (17%) |
| Fully guarded or acknowledged | 0 |

"Unguarded" means: the function has at least one side effect (DB write, HTTP call, subprocess, etc.) and zero detected guards (no input validation, no rate limit, no auth check, no approval gate, no retry bound, no idempotency key) within the same function.

---

## Results by scope

| Repo (scope) | Type | Commit | TS files | Tool calls | Unguarded | % | Partial | Scan time |
|---|---|---|---|---|---|---|---|---|
| **OpenClaw** (`src/`) | Application | `49d9996d` (pinned) | 7,874 | 419 | 332 | **79%** | 87 | ~9s |
| Mastra (`packages/`) | Framework | `38b87964` | 2,777 | 185 | 162 | 88% | 23 | ~5s |
| OpenAI Agents JS (`packages/`) | Framework | `629d35af` | 426 | 33 | 31 | 94% | 2 | ~1s |
| OpenAI Agents JS (`examples/`) | Examples | `629d35af` | 302 | 32 | 28 | 88% | 4 | <1s |

All commit SHAs and dates are reproducible — see the bottom of this document.

---

## By repo type

| Type | Scopes | Tool calls | Unguarded | % | What this means |
|---|---|---|---|---|---|
| Application | 1 (OpenClaw `src/`) | 419 | 332 | **79%** | Production agent code. The guards were theirs to add. |
| Framework | 2 (Mastra + OpenAI Agents JS) | 218 | 193 | **89%** | High by design — frameworks expose primitives and leave governance to downstream developers. |
| Examples | 1 (OpenAI Agents JS) | 32 | 28 | 88% | Starter code that teams copy into real products. The number that transfers. |

**On the Examples row** — this is a single codebase (32 findings) and represents one data point, not a statistical aggregate. The methodology section explains why we kept it visible despite the small sample. v0.1.1 will expand the Examples coverage with additional starter codebases.

**On the OpenAI Agents JS `packages/` scope** — 33 findings is a small absolute number compared to Mastra (185) or OpenClaw (419). This reflects the SDK's compact surface area: `packages/agents-core` is a focused runtime layer, not a sprawling monorepo. The 94% unguarded rate is informative but should be read in the context of a framework whose explicit role is to delegate governance to the embedding application.

**The relevant comparison** is **Application at 79%** vs **Framework at 89%**. The application number tells you what production-grade agent code looks like before governance is added. The framework number tells you what surface downstream developers must wrap. Both numbers are expected to be high in 2026 because the convention of intra-functional guarding (and the tools to enforce it) is still emerging — that's exactly why this scanner exists.

---

## What the scanner found, by category

Findings counted with overlap — a single tool call can match multiple side-effect categories.

| Category | Findings (approx.) | Present in scopes | What it detects |
|---|---|---|---|
| `destructive` | ~415 | 4 / 4 | `child_process.execSync()`, `spawn()`, `execFile()`, `execa()` |
| `file_delete` | ~210 | 3 / 4 | `fs.rm()`, `fs.unlink()`, `fsp.rm()` with destructive flags |
| `publish` | ~118 | 3 / 4 | `pubsub.publish()`, `topic.publish()`, deployment publish operations |
| `agent_invocation` | ~50 | 4 / 4 | `runner.run()`, `agent.stream()`, `agent.execute()` |
| `http_write` | ~80 | 4 / 4 | `fetch(POST/PUT/PATCH)`, `axios.post()` |
| `llm_call` | ~10 | 3 / 4 | `openai.chat.completions.create()`, `anthropic.messages.create()` |
| `database_delete` | ~3 | 1 / 4 | Prisma `.delete()`, Drizzle `.delete()` |
| `messaging` | ~1 | 1 / 4 | `twilio.messages.create()`, `slack.chat.postMessage()` |
| `dynamic_code` | ~2 | 1 / 4 | `eval()`, `vm.runInNewContext()`, `new Function()` |
| `payment` | 0 | 0 / 4 | `stripe.charges.create()`, etc. |

A few category-specific notes:

**`destructive` (~415 matches).** OpenClaw alone contributes the overwhelming majority. This is by design — OpenClaw is an agent that runs shell commands as its core function. Every `child_process.spawn()` and `execSync()` is a real tool call that does need governance, but the governance pattern OpenClaw uses (a sophisticated approval-routing infrastructure with `execApproval*` types and functions) is itself intra-functional. The scanner sees it as `partial_checks` in many places and `no_checks` in others, depending on whether the approval gate is in the same function as the `spawn()` call. For a codebase whose domain is "do shell exec, but only with approval", the high destructive count is the right signal — it's just not actionable line by line. It's actionable as a whole: "this codebase needs governance, and it has one."

**`publish` (~118 matches).** Mastra `packages/` contributes the bulk via `this.pubsub.publish('workflow.events.v2.${runId}', ...)` — an internal event bus. These are framework primitives. When you adopt Mastra and your scan shows ~100 `publish` findings from `@mastra/core`, that's expected — acknowledge with `// checked:ok — internal pubsub`. The pattern fixed in SPEC FIX 5 (removing `nameContains: ["deploy"]`) eliminated 39 unrelated false positives from `@mastra/deployer`'s management methods.

**`agent_invocation` (~50 matches).** This pattern fires on `runner.run(agent, ...)`, `agent.stream(...)`, and similar. In examples directories, almost every match is a legitimate demonstration of the SDK's primary entry point. In production application code, this same pattern is genuinely important to govern — an agent calling another agent in a loop without bounds is a real risk (`ASI-04`, `ASI-10`).

**`payment` (0 matches).** No Stripe or PayPal SDK usage was found in any of the 3 scanned codebases. None of the scanned projects accept payments directly. This is informative — it tells us the public TypeScript agent ecosystem hasn't yet built around the payment use case the way the Python ecosystem has. We expect this to change as more transactional agents ship.

---

## Interesting findings

These are real functions in real codebases, not synthetic examples. Three illustrative cases:

**OpenClaw — the approval system, flagged as `destructive`.** OpenClaw has a sophisticated `execApproval*` infrastructure that brokers shell commands through user approval gates. The scanner correctly identifies the underlying `spawn()` and `execSync()` calls as `destructive`, but because the approval gate often lives in a different function than the actual exec call, many of these findings show as `no_checks` despite the codebase having a fully-functional governance system. This is the canonical example of why intra-procedural analysis under-tells: the code is governed; the governance just doesn't fit in one function. v0.2 will add cross-function call-chain analysis.

**Mastra — `processWorkflowSleep()` in `@mastra/core/src/workflows/evented/workflow-event-processor/sleep.ts`.** Four chained `pubsub.publish('workflow.events.v2.${runId}', ...)` calls in a single function. This is Mastra's internal event bus — exactly the kind of framework primitive that's by-design unguarded. The takeaway for adopters: when you embed Mastra, scan it, see what shows up, and decide which of its primitives you want to wrap in your own code before they reach production.

**OpenAI Agents JS — `runner.run(agent, question)`.** The framework's primary entry point appears throughout examples without input validation, rate limits, or retry bounds. This is example code by design — the framing is "show how the SDK works." But the same pattern, copy-pasted into a production agent that takes `question` from an HTTP request body, is exactly the kind of `ASI-04` / `ASI-10` risk we built the scanner to surface. The examples are pedagogical, not production-grade. They should ideally also document what to add when shipping.

---

## How to read these numbers

**83% unguarded across the benchmark is not a vulnerability score. It's an inventory.**

Each unguarded tool call is a side effect that can reach production if no one decides what to do about it during the build. An `fs.rm` with `force: true` and no confirmation. A `fetch(POST)` with no rate limit. An `execSync` with no input validation. A `runner.run(agent, ...)` with no bounds. None of these are bugs today. Each one becomes a risk the moment an agent calls it autonomously in production.

The 83% tells you how much of that surface exists in the codebase before anyone decides what to do about it. Some of these tool calls will be protected by infrastructure (API gateways, IAM, network policies). Some will be protected by code in other layers the scanner can't see (middleware, service-layer validation, Next.js API route wrappers, NestJS guards). Some will reach production with no protection at all.

`diplomat-agent-ts` doesn't decide which is which. Your team does. The scanner gives you the inventory so you can make that decision deliberately — at design time, not after an incident.

That's what `// checked:ok — protected by [where]` is for. Every tool call gets a verdict: fix it, acknowledge it, or leave it for the next person to discover in production.

---

## Reproduce these results

```bash
npm install -g @diplomat-ai/diplomat-agent-ts

# Application — OpenClaw (pinned commit for reproducibility)
git clone https://github.com/openclaw/openclaw /tmp/openclaw
cd /tmp/openclaw && git checkout 49d9996d && cd -
diplomat-agent-ts scan /tmp/openclaw/src

# Framework — Mastra (HEAD at benchmark time: 38b87964)
git clone --depth 1 https://github.com/mastra-ai/mastra /tmp/mastra
diplomat-agent-ts scan /tmp/mastra/packages

# Framework + Examples — OpenAI Agents JS (HEAD at benchmark time: 629d35af)
git clone --depth 1 https://github.com/openai/openai-agents-js /tmp/openai-agents
diplomat-agent-ts scan /tmp/openai-agents/packages
diplomat-agent-ts scan /tmp/openai-agents/examples
```

Numbers in this report were measured at the specific commits above. OpenClaw is pinned because manual false-positive validation was performed at that commit state. Mastra and OpenAI Agents JS are scanned at the HEAD that was current on 2026-05-15; running against today's HEAD will produce different numbers if those repos have moved.

Full artifact files (JSON + YAML for each scope, plus the manifest) are in [`benchmarks/v0.1.0/`](./benchmarks/v0.1.0/). The manifest includes a consistency-check script that verifies every documented number against the actual artifact bytes — anyone can re-run it locally.

If you get materially different results, [open an issue](https://github.com/Diplomat-ai/diplomat-agent-ts/issues) — we'll update the benchmark or fix the regression.

---

## What `diplomat-agent-ts` doesn't detect (yet)

| Gap | Impact | Status |
|---|---|---|
| Cross-file call chain analysis | Misses guards one frame up; under-tells on codebases with separated approval/exec layers (OpenClaw is the canonical example) | Partial today (decorators on same class resolved). Full call-chain analysis on v0.2 roadmap. |
| Re-exported ORM models | Misses Mongoose / TypeORM / Drizzle patterns split across files | Known limitation. Workaround: `// checked:ok` annotation. |
| Data-flow on dynamic arguments | Can't tell if `execSync(cmd)` has constant or tainted `cmd` | By design — static analysis without taint tracking. |
| JSX / TSX server actions | Fires on React Server Actions but tuning is backend-first | Known. Frontend-specific tuning on v0.3 roadmap. |
| MCP server scanning | Doesn't follow tool definitions exposed via MCP servers | v0.3 roadmap. |
| Runtime-generated tool registration | Can't see tools registered dynamically at runtime | By design — static analysis only. |

---

## Methodology

- **Scanner:** `ts-morph` AST walker. Parses every `.ts` and `.tsx` file in the target path, excluding `node_modules/`, `dist/`, `build/`, `.next/`, `.turbo/`. Two runtime dependencies (`ts-morph`, `yaml`).
- **Detection:** 40+ patterns matching function calls with side effects across 12 categories (DB writes, DB deletes, HTTP writes, subprocess, payments, emails, messaging, file operations, LLM calls, agent invocations, publishing, dynamic code execution).
- **Guard detection:** checks for Zod / Yup / class-validator input validation, NestJS `@UseGuards` / `@Throttle` decorators, rate-limiter calls, auth checks (passport, jose, custom middleware), approval gates, idempotency keys, retry bounds — within the same function as the side effect.
- **Verdict logic:** `no_checks` = side effects present + zero guards detected; `partial_checks` = some guards but not full coverage; `confirmed` = annotated with `// checked:ok`, `// diplomat:ok`, or `// canary:ok`.
- **Scope:** intra-procedural. Each function is analyzed independently, with decorators on the same class resolved.
- **First-match-wins:** the pattern catalog is ordered, and the first matching pattern wins for a given call. Specific patterns (narrow `funcContains` with `importContains` scope) precede broad ones to prevent over-matching.

**On the absence of any `confirmed` findings.** None of the 669 findings in this benchmark were annotated with `// checked:ok`. That's not because the code is bad — it's because none of these projects have adopted diplomat-agent-ts annotations yet. As the convention spreads (or doesn't), this number will tell us something.

**On the keep-Examples-visible decision.** The Examples row in the by-type table is based on a single codebase (32 findings). That's a data point, not a statistical aggregate. We kept it visible because the question "what happens when developers copy-paste this into production" is the central one for any examples directory, and showing the number — with the caveat — is more useful than hiding it. v0.1.1 will expand Examples coverage.

**On the choice of repos.** We picked codebases that represent meaningful corners of the TypeScript agent ecosystem in mid-2026: an application (OpenClaw, a shell-running agent), a framework with a substantial monorepo (Mastra), and an emerging framework from a major provider (OpenAI Agents JS). The selection is biased toward repos where the scanner has the most to say, not toward repos that make the scanner look good or bad. v0.1.1 will expand to Vercel AI SDK, LangChain.js, and LangGraph.js.

**On the pre-publication fix.** The `publish` pattern bug surfaced during manual review *of this benchmark*. The temptation was to publish the inflated Mastra numbers (202 total, 174 unguarded) without acknowledging the FPs. We chose instead to fix the pattern, document the fix in the commit history, regenerate the benchmark, and publish the corrected numbers. The fact that we found a real bug while preparing the launch and chose to fix it before publication — rather than after — is what we want this scanner's track record to look like.

---

`diplomat-agent-ts` is open source (Apache 2.0). The scanner finds the problem. Diplomat governs it in production.

[**diplomat-gate**](https://github.com/Diplomat-ai/diplomat-gate) — runtime enforcement: `CONTINUE` / `REVIEW` / `STOP` in < 1ms.
[**diplomat.run**](https://diplomat.run) — hosted control plane with hash-chained audit trail.
