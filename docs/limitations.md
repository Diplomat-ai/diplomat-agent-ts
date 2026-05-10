# Limitations

## Pattern Refinement History

Each entry below documents a pattern correction applied during testing. These
refinements are part of the "patterns are data, not logic" design principle —
when a real-world false positive or false negative is found, the catalog is
refined, not the matcher.

### v0.1.0-rc1 — 2026-05-10

**Removed `"client"` from `database_write` and `database_delete` objContains.**

Was matching `client.chat.completions.create()` (OpenAI SDK) and
`client.messages.create()` (Anthropic SDK), classifying LLM calls as database
writes. Fix: scoped to `["prisma", "db"]` only. Generic `client` receiver is
covered by category-specific patterns elsewhere.

**Removed `"client"` from `http_write` objContains.**

Was matching SDK clients (`openai.client`, `anthropic.client`, custom API
clients) instead of HTTP libraries. Fix: scoped to `["axios"]`. The `got` and
`fetch` libraries have their own dedicated patterns.

**Removed `"exec"` from bare `nameContains` in destructive.**

Was matching `.execute()`, `.executeQuery()`, `.executeAsync()` business
methods (PayPal SDK, database drivers, query builders). Fix: kept `execa`
(unique library name) and added an `importContains: ["child_process"]`-scoped
pattern for `exec` and `spawn`.

**Added `importContains` scoping to Mongoose, Sequelize, and TypeORM patterns.**

Mongoose, Sequelize, and TypeORM use generic method names (`.save()`,
`.create()`, `.update()`) that match unrelated code. Fix: each ORM's patterns
now require the corresponding package to be imported in the file.

**Reordered SIDE_EFFECT_PATTERNS to enforce first-match-wins priority.**

`llm_call` patterns now precede `database_write` patterns, preventing
`client.chat.completions.create()` from being falsely classified as a database
write. `payment` patterns remain first (highest stakes). Messaging patterns
precede email patterns to prevent `client.messages.create()` (Twilio) from
matching the Mailgun email pattern via the generic `"messages"` receiver name.

### Known trade-offs

- **Cross-file ORM detection may miss split usage.** If a file imports a
  Mongoose model from another file (without re-importing `mongoose` itself),
  the patterns will not flag its `.save()` calls. Workaround: ensure
  `import mongoose` appears in files using Mongoose models, or use the
  `// checked:ok` annotation.
- **Generic `client.fetch()` calls are not flagged as `http_write`.**
  If a custom HTTP client uses the name `client`, its writes are not detected.
  Workaround: rename to `httpClient`, `apiClient`, or a more specific name.
- **Bare `exec()` detection requires `child_process` import in the same file.**
  If `exec` is imported via a re-export barrel, the `importContains` scoping
  will not trigger. The existing `objContains: ["child_process"]` pattern still
  covers the common `child_process.exec()` call form.

### v0.1.0-rc2 — 2026-05-10

**Added compareContains-based patterns for confirmation and approval_step guards.**

The original GUARD_PATTERNS catalog detected `confirm()`, `awaitApproval()`, etc.
as function calls only. Real-world code often uses `if (userConfirmed) throw`
or `if (approved === true)` patterns instead. Added partial-coverage variants
using compareContains to catch these. Coverage is "partial" because manual
flag checks are weaker than dedicated approval functions.

**JSON reporter aligned with toolcalls.yaml spec_version 1.0 (snake_case).**

Internal types remain camelCase (TypeScript convention); the JSON reporter now
converts at the boundary so JSON consumers see the same field names as YAML
consumers. Both formats are now fully isomorphic.

**Arrow function expression bodies are now scanned.**

Functions written as `const charge = (x) => stripe.charges.create(x)` were
silently missed because ts-morph's getDescendantsOfKind does not include the
root node, and an arrow function's body IS the call expression. Fixed in
ast-scanner.ts by checking the body kind explicitly.

### v0.1.0-rc3 — 2026-05-10 (post OpenClaw validation)

After validation on OpenClaw (876k LOC, 14k files, commit 49d9996d), 3 false
positives out of 10 audited (30%) were traced to substring matching on short
generic names. SPEC FIX 3 introduces stricter scoping via a new `nameExact`
field.

**Added `nameExact` to PatternMatch.**

Substring matching via `nameContains: ["eval"]` matched accidental occurrences
in names like `addSensitiveValue` (lowercased contains "eval") and
`resolveChatModelOverrideValue`. The new `nameExact` field requires the full
call name to exactly equal the value, eliminating substring false positives.
Used for short generic names where substring matching is fundamentally fragile.

**Rewrote `dynamic_code` eval pattern to use `nameExact`.**

`nameContains: ["eval"]` → `nameExact: ["eval"]`. Eliminates FPs on any camelCase
name ending in `...Value` or `...evalue`. The `nameContains: ["function"]` variant
was removed entirely: `new Function(...)` is a NewExpression (not a CallExpression)
and was not actually captured by the scanner, making the pattern dead code that
only generated FPs for `createFunction()` registration calls.

**Tightened destructive `child_process` patterns.**

`attrContains: ["exec", "spawn", "fork"]` on the object-scoped pattern changed to
`attrExact: [...]`. The bare `nameContains: ["exec", "spawn"]` (scoped via
`importContains`) was matching names like `extractWindowsExecutablePath()` (contains
"exec" via "executable") and `detectDefaultChromiumExecutableWindows()`. Replaced
with two patterns: `nameExact` for the canonical short names (`exec`, `spawn`,
`fork`), and a discriminating `nameContains` for longer variants (`execSync`,
`execFile`, `spawnSync`, `execAsync`) that don't accidentally match utility names.

**Removed bare `"db"` from `objContains` in `database_write`/`database_delete`.**

`"db"` as an object name is too generic — it matches any variable named `db`
regardless of type (Map, Set, in-memory cache, string store). Most critically,
`"sandbox"` contains the substring `"db"` (s-a-n-**d-b**-o-x), so
`SANDBOX_BACKEND_FACTORIES.delete()` was flagged as a database deletion.
Fix: Prisma patterns now require the receiver to be named `prisma` (drop the
`"db"` fallback). Drizzle patterns now require `importContains: ["drizzle-orm"]`
in addition to `objContains: ["db"]`. Trade-off: projects that alias Prisma under
a variable named `db` won't be detected — use the canonical `prisma` variable name
or add a `// checked:ok` annotation.

**Added `agent_invocation` pattern for `runEmbeddedAgent` variants.**

Custom agent runners using descriptive method names like `runEmbeddedPiAgent`
(found in OpenClaw `extensions/llm-task`) were missed. New pattern uses
`attrContains: ["runembedded", "executeagent", "invokeagent", "callagent"]` scoped
to `objContains: ["agent", "runtime"]`.

**Strengthened scoping invariant test.**

The `DANGEROUS_GENERICS` list in `patterns-coverage.test.ts` now includes
`"eval"`, `"db"`, `"agent"`, and `"run"` in addition to the original 7 entries.
The `otherScope` check for `objContains` was also expanded to accept
`attrContains` and `importContains` as valid scoping conditions (in addition to
the original `attrExact` and `funcContains`). This catches future patterns that
would reintroduce substring bugs.

### Known trade-offs

- **`execAsync` wrappers are caught via `nameContains: ["execAsync"]`.**
  Any project that promisifies exec under a different name (e.g. `promisifiedExec`,
  `runExec`) will not be detected. This is acceptable for v0.1.0; v0.2.0 will
  explore AST-level variable assignment tracking.
- **Prisma aliased under `db` is not detected.**
  If Prisma is instantiated as `const db = new PrismaClient()`, calls like
  `db.user.create()` won't match. Use `const prisma = new PrismaClient()` or
  add a project-level `// checked:ok` annotation.

### v0.1.0-rc4 — 2026-05-11 (OpenClaw FP audit)

**Eliminated `regex.exec()` false positives in the destructive category.**

The `nameExact: ["exec"]` pattern (scoped by `importContains: ["child_process"]`)
matched any `.exec()` call in a file that imported `child_process` for unrelated
reasons — including `RegExp.prototype.exec()` calls on inline regex literals like
`/^extensions\/([^/]+)\//.exec(normalized)`. These are pure read-only string
operations, not subprocess spawns.

Root cause: `extractCallParts` did not handle `RegularExpressionLiteral` receiver
nodes. For `/pattern/.exec(s)`, the regex literal fell through the switch,
producing `objName=""` and `fullName="exec"` — indistinguishable from a bare
`exec()` call at the pattern-data level.

Fix: added a `RegularExpressionLiteral` case to `extractCallParts` in
`matcher.ts` that sets `parts.unshift("<regex>")`, so these calls produce
`fullName="<regex>.exec"` and `objName="<regex>"`. Neither value matches any
existing destructive pattern.

Impact on OpenClaw scan: 17 fewer tools total; destructive category dropped from
471 to 454. All previously FP-flagged regex parsing functions
(`collectChangedExtensionIdsFromPaths`, `parseProcessList`,
`parseStartupTraceMetrics`, `resolveBetaVersion`, `loginFromUrl`,
`normalizeInstalledBinaryVersion`) are no longer in the report.
