# Contributing to diplomat-agent-ts

Thank you for your interest in contributing! diplomat-agent-ts is an open-source static analyser that flags unguarded AI agent tool calls. Contributions of all kinds are welcome.

---

## Table of contents

1. [Dev environment setup](#dev-environment-setup)
2. [Running the tests](#running-the-tests)
3. [How to add a new pattern](#how-to-add-a-new-pattern)
4. [How to add a new guard type](#how-to-add-a-new-guard-type)
5. [Reporting false positives](#reporting-false-positives)
6. [Commit style](#commit-style)
7. [Open bounties — patterns we want](#open-bounties--patterns-we-want)
8. [Example PRs by difficulty](#example-prs-by-difficulty)

---

## Dev environment setup

```bash
git clone https://github.com/Diplomat-ai/diplomat-agent-ts.git
cd diplomat-agent-ts
node --version          # must be >= 20
npm install
npm run build           # TypeScript compile → dist/
npm test                # 196 tests, should all pass
```

Self-scan dogfood check (must exit 0):
```bash
node dist/cli.js scan ./src
```

---

## Running the tests

```bash
npm test                         # all suites
npm test -- --reporter verbose   # verbose output
npm test tests/patterns.test.ts  # single file
```

Test structure:
| Directory | Contents |
|---|---|
| `tests/*.test.ts` | Unit tests for scanner, CLI, patterns, reporter |
| `tests/integration/` | Full-pipeline end-to-end integration |
| `tests/e2e/` | CLI subprocess tests (exit codes, file output) |
| `tests/perf/` | Throughput and scaling checks |
| `tests/security/` | No-network, no-exec guarantees |
| `tests/fixtures/` | One directory per scenario (guarded / unguarded) |

---

## How to add a new pattern

A pattern is a TypeScript call you want the scanner to recognise as a side-effect.

### Step 1 — Add an entry in `toolcalls.yaml`

`toolcalls.yaml` is the authoritative pattern catalog.  Every entry looks like:

```yaml
- id: stripe-charges-create
  category: payment
  description: "Stripe charge creation"
  match:
    obj: stripe
    attr: charges.create
```

Keys:
- `id` — unique kebab-case string
- `category` — one of: `payment`, `database_write`, `database_delete`, `http_write`, `email`, `messaging`, `agent_invocation`, `llm_call`, `publish`, `dynamic_code`, `file_delete`, `destructive`
- `match.obj` / `match.attr` — see matcher docs below

### Step 2 — Add a matcher in `src/scanner/patterns.ts`

Use the helper predicates — **do not** use bare string `obj` / `attr`:

| Helper | When to use |
|---|---|
| `objContains(s)` | Object name contains substring (e.g. `objContains("stripe")`) |
| `objExact(s)` | Object name must match exactly |
| `attrContains(s)` | Method / property chain contains substring |
| `attrExact(s)` | Method / property chain must match exactly |
| `nameContains(s)` | Standalone function name contains substring |
| `nameExact(s)` | Standalone function name must match exactly |

Example (adding a Stripe refunds pattern):

```ts
// in src/scanner/patterns.ts, inside the PATTERNS array:
{
  id: "stripe-refunds-create",
  category: "payment",
  description: "Stripe refund creation",
  match: { obj: objContains("stripe"), attr: attrExact("refunds.create") },
},
```

### Step 3 — Create fixtures

Add two directories under `tests/fixtures/`:

**`tests/fixtures/guarded-stripe-refund/`**
```
package.json   ({"name":"guarded-stripe-refund","version":"0.0.0","private":true})
index.ts       (a Stripe refund call wrapped in a confirmation check — scanner must find it WITH a guard)
```

**`tests/fixtures/unguarded-stripe-refund/`**
```
package.json   (same structure)
index.ts       (the same call with NO guard — scanner must flag it)
```

### Step 4 — Run the tests

```bash
npm run build && npm test
```

All 196 existing tests must stay green, and your new fixture should be automatically picked up by `tests/fixtures.test.ts`.

---

## How to add a new guard type

Guard detection lives exclusively in `src/analyzer/checks.ts`.  Guards are AST patterns that appear in the *lexical scope* of a tool call:

- Comment annotations: `// checked:ok`, `// diplomat:ok`, `// canary:ok`
- Boolean variables: `confirmed`, `approved`, `authorized`
- Rate-limit decorators: `@Throttle`, `@RateLimit`
- NestJS auth guards: `@UseGuards(...)`
- Idempotency keys: variable names containing `idempotency`
- Retry bounds: `maxRetries`, `retryLimit` variables

To add a guard:
1. Identify the AST shape (use ts-morph to explore it).
2. Add a predicate in `checks.ts` inside `isGuarded()`.
3. Add a `tests/fixtures/guarded-<your-guard>/` fixture that exercises it.
4. Verify `npm test` stays green.

---

## Reporting false positives

If diplomat-agent-ts flags a call that is genuinely safe, please open an issue with:
1. A minimal TypeScript file that reproduces the false positive.
2. The diplomat output (`--format json` paste is ideal).
3. Why the call is safe in your architecture.

We'll either add a fixture to prevent the regression or document the known limitation.

---

## Commit style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Cloudflare KV write pattern
fix: scope mongoose.create to files that import mongoose
chore: bump @eslint/js to 9.39.4
docs: document new guard types in METHODOLOGY.md
test: add fixture for guarded-redis-set
```

Breaking changes:
```
feat!: change JSON output schema for tool call entries

BREAKING CHANGE: `toolCalls` renamed to `tool_calls` for consistency
```

---

## Open bounties — patterns we want

The following side-effect families are commonly used in AI agent codebases but not yet covered.  Each is a **good first issue**:

### Database / cache
| Pattern | Library | Suggested ID |
|---|---|---|
| Redis `SET` / `DEL` / `HSET` | `ioredis`, `redis` | `redis-write`, `redis-delete` |
| DynamoDB `putItem` / `deleteItem` | `@aws-sdk/client-dynamodb` | `dynamodb-write`, `dynamodb-delete` |
| Firestore `set()` / `delete()` | `firebase-admin` | `firestore-write`, `firestore-delete` |
| Supabase insert / update / delete | `@supabase/supabase-js` | `supabase-write`, `supabase-delete` |

### Messaging / eventing
| Pattern | Library | Suggested ID |
|---|---|---|
| Kafka `producer.send()` | `kafkajs` | `kafka-produce` |
| SQS `sendMessage` | `@aws-sdk/client-sqs` | `sqs-send` |
| SNS `publish` | `@aws-sdk/client-sns` | `sns-publish` |
| Inngest `inngest.send()` / `step.run()` | `inngest` | `inngest-send`, `inngest-step` |
| Temporal workflow start | `temporalio` | `temporal-workflow-start` |

### API / RPC
| Pattern | Library | Suggested ID |
|---|---|---|
| GraphQL mutation via Apollo Client | `@apollo/client` | `graphql-mutation` |
| tRPC mutation call | `@trpc/client` | `trpc-mutation` |
| gRPC unary call (write methods) | `@grpc/grpc-js` | `grpc-write` |

### Cloud infrastructure
| Pattern | Library | Suggested ID |
|---|---|---|
| Cloudflare KV `put()` / `delete()` | `@cloudflare/workers-types` | `cf-kv-write`, `cf-kv-delete` |
| S3 `putObject` / `deleteObject` | `@aws-sdk/client-s3` | `s3-write`, `s3-delete` |
| Azure Blob upload / delete | `@azure/storage-blob` | `azure-blob-write`, `azure-blob-delete` |

### LLM / agent orchestration
| Pattern | Library | Suggested ID |
|---|---|---|
| LangChain tool `invoke()` | `langchain` | `langchain-tool-invoke` |
| CrewAI task execution (Python port) | N/A | `crewai-execute` |
| Vercel AI SDK `streamText` with tools | `ai` | `vercel-ai-tool-call` |

---

## Example PRs by difficulty

### Good first issue — add a new pattern

**Goal:** Detect `ioredis` `set()` / `del()` calls.

1. Add entry to `toolcalls.yaml`:
   ```yaml
   - id: redis-set
     category: database_write
     description: "Redis key write via ioredis"
     match:
       obj: redis
       attr: set
   ```
2. Add matcher in `src/scanner/patterns.ts`:
   ```ts
   { id: "redis-set", category: "database_write", description: "Redis key write via ioredis",
     match: { obj: objContains("redis"), attr: attrExact("set") } },
   ```
3. Create `tests/fixtures/unguarded-redis-set/index.ts`:
   ```ts
   import Redis from "ioredis";
   const redis = new Redis();
   async function cacheUser(id: string, data: string) {
     await redis.set(`user:${id}`, data);  // should be flagged
   }
   ```
4. Create `tests/fixtures/guarded-redis-set/index.ts` with an approval check.
5. `npm run build && npm test`

---

### Intermediate — new guard type

**Goal:** Recognise `if (userConfirmed)` guards (variable name check).

1. In `src/analyzer/checks.ts`, inside `isGuarded()`, add:
   ```ts
   if (name.toLowerCase().includes("confirmed")) return true;
   ```
2. Add `tests/fixtures/guarded-user-confirmed/index.ts`:
   ```ts
   const userConfirmed = await promptUser("Delete all records?");
   if (userConfirmed) {
     await db.delete(users);  // should NOT be flagged
   }
   ```
3. `npm test` — the fixture should register as guarded.

---

### Advanced — new output format

**Goal:** Add a Markdown reporter (`--format markdown`) that renders a table.

1. Create `src/reporter/markdown.ts` following the shape of `src/reporter/json.ts`.
2. Register it in `src/reporter/index.ts`.
3. Add a CLI test in `tests/e2e/cli.test.ts` verifying `--format markdown` output.
4. Document the format in `README.md`.

---

## License

By contributing, you agree that your code will be released under the [MIT License](LICENSE).
