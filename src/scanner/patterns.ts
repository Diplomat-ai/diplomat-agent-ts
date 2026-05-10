/**
 * Catalogue of side-effect and guard patterns for AST scanning.
 *
 * Patterns are data, not logic. Each entry describes what to look for in
 * TypeScript AST call nodes and how to categorize it. Extend this file to
 * add new patterns.
 *
 * Adapted from `diplomat_agent/scanner/patterns.py`. Python ecosystem
 * libraries (SQLAlchemy, Pydantic, Celery) are replaced with their
 * TypeScript/Node equivalents (Prisma, Zod, BullMQ, etc.).
 */

import type {
  GuardCoverage,
  GuardType,
  RiskScore,
  SideEffectCategory,
} from "../models.js";

// ---------------------------------------------------------------------------
// Pattern types
// ---------------------------------------------------------------------------

/**
 * What the matcher tests against an AST CallExpression.
 * Mirrors `match` dict in patterns.py.
 */
export interface PatternMatch {
  /** Receiver/object name must contain one of these (lowercased). */
  objContains?: string[];
  /** Receiver/object name must equal one of these exactly (lowercased). */
  objExact?: string[];
  /** Last attribute (method) name must contain one of these. */
  attrContains?: string[];
  /** Last attribute (method) name must equal one of these exactly. */
  attrExact?: string[];
  /** Full dotted path (e.g. "stripe.refunds.create") must contain one of these. */
  funcContains?: string[];
  /** For standalone calls (no receiver): function name must contain one of these. */
  nameContains?: string[];
  /** Full call name must equal one of these exactly (lowercased). Use for short generic
   *  names like "eval" or "exec" that would over-match via includes(). */
  nameExact?: string[];
  /** For .query() / .execute(): first argument string must contain one of these (uppercased). */
  sqlContains?: string[];
  /** For fetch / axios: HTTP method must be one of these (uppercased). */
  methodHttp?: string[];
  /** For decorators: decorator name must contain one of these. */
  decoratorContains?: string[];
  /** For comparison expressions: variable name must contain one of these. */
  compareContains?: string[];
  /** For imports: package name must contain one of these. */
  importContains?: string[];
  /** Required keyword argument names (lowercased). */
  kwargContains?: string[];
}

export interface SideEffectPattern {
  category: SideEffectCategory;
  risk: RiskScore;
  match: PatternMatch;
}

export interface GuardPattern {
  type: GuardType;
  coverage: GuardCoverage;
  match: PatternMatch;
}

export interface ReadOnlyPattern {
  match: PatternMatch;
}

// ---------------------------------------------------------------------------
// Orchestrator decorators
// ---------------------------------------------------------------------------

/**
 * Decorators that mark a function as auto-retried by an orchestrator.
 * If a function carries one of these, it MUST have explicit idempotency
 * or retry-bound guards, otherwise it is flagged.
 *
 * TypeScript-adapted from patterns.py ORCHESTRATOR_DECORATORS.
 */
export const ORCHESTRATOR_DECORATORS: string[] = [
  // Temporal (TypeScript SDK)
  "activity",
  "@activity",
  // BullMQ
  "Process",
  // Inngest
  "createFunction",
  // Trigger.dev
  "task",
  // Zeplo / Hatchet
  "step",
  "workflow",
];

// ---------------------------------------------------------------------------
// Side-effect patterns
// ---------------------------------------------------------------------------

export const SIDE_EFFECT_PATTERNS: SideEffectPattern[] = [
  // ============================================================
  // ORDER MATTERS. The scanner uses first-match-wins.
  // Specific patterns (funcContains, narrow objContains) MUST come
  // before generic patterns (broad objContains, attrExact).
  // High-stakes categories (payment, dynamic_code) MUST come first
  // to win against any overlap with lower-stakes categories.
  // ============================================================

  // -----------------------------------------------------------------------
  // 1. PAYMENT (highest stakes, irreversible monetary effects)
  //
  // NOTE: nameContains patterns like "refund", "charge" may match internal
  // business methods (e.g. quotaCharge.refund()) that are not actual payment
  // operations. Known false positive rate from Python version: ~22% on
  // payment patterns across 16 real repos. Acceptable trade-off vs missing
  // real payment calls. The TS rate may differ — to be measured on OpenClaw.
  // -----------------------------------------------------------------------
  {
    // PayPal SDK v2 (checkout-server-sdk): client.execute(request) where
    // client = new PayPalHttpClient(...). Scoped by import so as not to
    // match other .execute() business methods.
    category: "payment",
    risk: 3,
    match: {
      importContains: ["@paypal", "paypal-rest-sdk"],
      attrContains: ["execute"],
    },
  },
  {
    category: "payment",
    risk: 3,
    match: {
      objContains: ["stripe"],
      attrContains: [
        "create", "capture", "refund", "charge", "transfer",
        "payout", "payment", "subscription",
      ],
    },
  },
  {
    category: "payment",
    risk: 3,
    match: {
      funcContains: [
        "stripe.refunds.create", "stripe.charges.create",
        "stripe.paymentintents.create", "stripe.transfers.create",
        "stripe.payouts.create", "stripe.customers.create",
        "stripe.subscriptions.create",
      ],
    },
  },
  {
    category: "payment",
    risk: 3,
    match: {
      objContains: ["paypal", "braintree", "adyen", "square", "mollie"],
      attrContains: ["payment", "charge", "capture", "refund", "sale", "execute"],
    },
  },
  {
    category: "payment",
    risk: 3,
    match: {
      nameContains: ["refund", "charge", "payout", "paymentcreate", "transferfunds"],
    },
  },

  // -----------------------------------------------------------------------
  // 2. DYNAMIC CODE EXECUTION (highest stakes, code injection risk)
  //
  // eval() and new Function() can execute arbitrary code.
  // node:vm module also allows arbitrary execution in a new context.
  // -----------------------------------------------------------------------
  {
    // Bare eval(...) — must be the call name itself, not a substring of larger
    // names like "addSensitiveValue" or "resolveOverrideValue" which contain
    // the letters "eval" by accident. nameExact prevents those false positives.
    category: "dynamic_code",
    risk: 3,
    match: {
      nameExact: ["eval"],
    },
  },
  {
    category: "dynamic_code",
    risk: 3,
    match: {
      objExact: ["vm"],
      attrContains: ["runinThisContext", "runinnewcontext", "runincontext",
        "runInThisContext", "runInNewContext", "runInContext"],
    },
  },

  // -----------------------------------------------------------------------
  // 3. FILE_DELETE / DESTRUCTIVE (irreversible local effects)
  // -----------------------------------------------------------------------
  {
    category: "file_delete",
    risk: 3,
    match: {
      objContains: ["fs"],
      attrExact: ["unlink", "unlinkSync", "rm", "rmSync", "rmdir", "rmdirSync"],
    },
  },
  {
    category: "file_delete",
    risk: 3,
    match: {
      nameContains: ["rimraf"],
    },
  },
  {
    // Node.js path-based delete
    category: "file_delete",
    risk: 3,
    match: {
      objContains: ["path", "fspromises"],
      attrExact: ["unlink", "rm", "rmdir"],
    },
  },
  {
    category: "destructive",
    risk: 3,
    match: {
      objContains: ["child_process"],
      attrExact: ["exec", "execSync", "execFile", "execFileSync", "spawn", "spawnSync", "fork"],
    },
  },
  {
    category: "destructive",
    risk: 3,
    match: {
      // Bare execa() calls (imported as a function, no receiver).
      // Note: "exec" is intentionally NOT in this list — it would match
      // .execute() business methods. To detect bare exec() calls, use a
      // scoped pattern with importContains instead.
      nameContains: ["execa"],
    },
  },
  {
    // Bare exec()/spawn()/fork() — exact match avoids hitting names like
    // extractWindowsExecutablePath() which contain "exec" as a substring.
    category: "destructive",
    risk: 3,
    match: {
      importContains: ["child_process", "node:child_process"],
      nameExact: ["exec", "spawn", "fork"],
    },
  },
  {
    // Longer variant bare calls: execSync, execFile, execFileSync, spawnSync,
    // and common async wrappers like execAsync (promisify(exec)).
    // These strings are discriminating — no common utility function accidentally
    // contains "execsync", "execfile", "spawnsync" or "execasync".
    category: "destructive",
    risk: 3,
    match: {
      importContains: ["child_process", "node:child_process"],
      nameContains: ["execSync", "execFile", "spawnSync", "execAsync"],
    },
  },
  {
    // Docker / Kubernetes SDK delete/stop/kill
    category: "destructive",
    risk: 3,
    match: {
      objContains: ["docker", "k8s", "kubernetes"],
      attrContains: ["remove", "kill", "stop", "delete", "destroy", "scale"],
    },
  },

  // -----------------------------------------------------------------------
  // 4. LLM_CALL (specific funcContains MUST precede database_write attrExact)
  // -----------------------------------------------------------------------
  {
    // OpenAI: chat.completions.create()
    category: "llm_call",
    risk: 2,
    match: {
      funcContains: ["chat.completions.create", "completions.create"],
    },
  },
  {
    // Anthropic: client.messages.create() — scoped by import to avoid
    // matching Twilio's client.messages.create() as an LLM call.
    category: "llm_call",
    risk: 2,
    match: {
      importContains: ["@anthropic-ai", "anthropic-ai", "@anthropic"],
      objContains: ["messages"],
      attrExact: ["create"],
    },
  },
  {
    // Ollama
    category: "llm_call",
    risk: 2,
    match: {
      objContains: ["ollama"],
      attrExact: ["chat", "generate"],
    },
  },
  {
    // Custom LLM wrappers
    category: "llm_call",
    risk: 2,
    match: {
      nameContains: [
        "llmapi", "llmhandler", "llmcall",
        "callllm", "getllmresponse", "invokellm",
      ],
    },
  },
  {
    // .invoke() / .ainvoke() / .generate() on llm or model objects
    category: "llm_call",
    risk: 2,
    match: {
      objContains: ["llm", "model"],
      attrExact: ["invoke", "ainvoke", "generate"],
    },
  },

  // -----------------------------------------------------------------------
  // 5. AGENT_INVOCATION
  // -----------------------------------------------------------------------
  {
    // LangChain / LangGraph: graph.invoke(), chain.invoke(), agentExecutor.invoke(), etc.
    category: "agent_invocation",
    risk: 2,
    match: {
      objContains: ["graph", "chain", "pipeline", "agent", "executor", "workflow", "runnable"],
      attrExact: ["invoke", "stream"],
    },
  },
  {
    category: "agent_invocation",
    risk: 2,
    match: {
      objContains: ["agent"],
      attrExact: ["generate", "execute", "run"],
    },
  },
  {
    // OpenAI Agents SDK Node: Runner.run()
    category: "agent_invocation",
    risk: 2,
    match: {
      objContains: ["runner"],
      attrExact: ["run"],
    },
  },
  {
    // Generic sub-agent invocation patterns
    category: "agent_invocation",
    risk: 2,
    match: {
      objContains: ["graph", "chain", "pipeline", "agent", "workflow"],
      attrExact: ["run"],
    },
  },
  {
    // Custom agent runners using descriptive method names like
    // runEmbeddedPiAgent, runEmbeddedAgent, executeAgent, invokeAgent.
    // The receiver must contain "agent" or "runtime" (scoping condition).
    category: "agent_invocation",
    risk: 2,
    match: {
      objContains: ["agent", "runtime"],
      attrContains: ["runembedded", "executeagent", "invokeagent", "callagent"],
    },
  },

  // -----------------------------------------------------------------------
  // 6. DATABASE_DELETE (irreversible, before write)
  // -----------------------------------------------------------------------
  {
    // Prisma: keep "prisma" as objContains since it's specific enough.
    // Drop "db" — too generic, matches any variable named db (Map, cache,
    // even "sandbox_backend_factories" which contains the letters "db").
    category: "database_delete",
    risk: 3,
    match: {
      objContains: ["prisma"],
      attrExact: ["delete", "deleteMany"],
    },
  },
  {
    // Drizzle: scope to files that import drizzle-orm to avoid false positives.
    category: "database_delete",
    risk: 3,
    match: {
      importContains: ["drizzle-orm", "drizzle"],
      objContains: ["db"],
      attrExact: ["delete"],
    },
  },
  {
    // Mongoose
    category: "database_delete",
    risk: 3,
    match: {
      importContains: ["mongoose"],
      attrExact: ["deleteOne", "deleteMany", "findOneAndDelete", "remove"],
    },
  },
  {
    // Sequelize
    category: "database_delete",
    risk: 3,
    match: {
      importContains: ["sequelize"],
      attrExact: ["destroy", "truncate"],
    },
  },
  {
    // TypeORM repository delete
    category: "database_delete",
    risk: 3,
    match: {
      objContains: ["repository", "repo"],
      attrExact: ["delete", "remove"],
    },
  },
  {
    category: "database_delete",
    risk: 3,
    match: {
      attrExact: ["query", "execute"],
      sqlContains: ["DELETE FROM", "TRUNCATE", "DROP TABLE"],
    },
  },

  // -----------------------------------------------------------------------
  // 7. DATABASE_WRITE — ORMs (Prisma, Drizzle, TypeORM, Mongoose, Sequelize, Knex)
  // -----------------------------------------------------------------------
  {
    // Prisma: keep "prisma" as objContains since it's specific enough.
    // Drop "db" — too generic, matches Map/cache/store variables erroneously.
    category: "database_write",
    risk: 2,
    match: {
      objContains: ["prisma"],
      attrExact: ["create", "createMany", "update", "updateMany", "upsert"],
    },
  },
  {
    // Drizzle: scope to files that import drizzle-orm to avoid false positives.
    category: "database_write",
    risk: 2,
    match: {
      importContains: ["drizzle-orm", "drizzle"],
      objContains: ["db"],
      attrExact: ["insert", "update"],
    },
  },
  {
    // TypeORM repository pattern
    category: "database_write",
    risk: 2,
    match: {
      importContains: ["typeorm"],
      objContains: ["repository", "repo"],
      attrExact: ["save", "insert", "update"],
    },
  },
  {
    // Mongoose model methods
    category: "database_write",
    risk: 2,
    match: {
      importContains: ["mongoose"],
      attrExact: ["save", "create", "updateOne", "updateMany", "findOneAndUpdate"],
    },
  },
  {
    // Sequelize
    category: "database_write",
    risk: 2,
    match: {
      importContains: ["sequelize"],
      attrExact: ["create", "bulkCreate", "update", "upsert"],
    },
  },
  {
    // Knex query builder
    category: "database_write",
    risk: 2,
    match: {
      objContains: ["knex"],
      attrExact: ["insert", "update"],
    },
  },
  {
    // Raw SQL via .query() / .execute() with INSERT/UPDATE
    category: "database_write",
    risk: 2,
    match: {
      attrExact: ["query", "execute"],
      sqlContains: ["INSERT", "UPDATE"],
    },
  },

  // -----------------------------------------------------------------------
  // 8. MESSAGING / EMAIL / PUBLISH / HTTP_WRITE (lowest specificity, last)
  //    Messaging precedes Email because ambiguous "messages" receiver names
  //    (e.g. twilioClient.messages) must resolve to messaging, not email.
  // -----------------------------------------------------------------------

  // Messaging (Slack, Discord, Twilio, WhatsApp, Telegram)
  {
    // Slack Web API
    category: "messaging",
    risk: 2,
    match: {
      objContains: ["slack", "webclient", "chat"],
      attrContains: ["postMessage", "post_message", "send"],
    },
  },
  {
    // Discord.js
    category: "messaging",
    risk: 2,
    match: {
      objContains: ["discord", "channel", "user", "webhook"],
      attrExact: ["send"],
    },
  },
  {
    // Twilio
    category: "messaging",
    risk: 2,
    match: {
      objContains: ["twilio", "messages"],
      attrExact: ["create"],
    },
  },
  {
    // WhatsApp / Telegram
    category: "messaging",
    risk: 2,
    match: {
      objContains: ["whatsapp", "telegram", "bot"],
      attrContains: ["sendMessage", "send_message"],
    },
  },

  // Email
  {
    // Nodemailer
    category: "email",
    risk: 2,
    match: {
      objContains: ["nodemailer", "transporter", "transport"],
      attrExact: ["sendMail", "send"],
    },
  },
  {
    // SendGrid
    category: "email",
    risk: 2,
    match: {
      objContains: ["sendgrid", "mail"],
      attrExact: ["send"],
    },
  },
  {
    // Mailgun
    category: "email",
    risk: 2,
    match: {
      objContains: ["mailgun", "messages"],
      attrContains: ["create", "send"],
    },
  },
  {
    // AWS SES
    category: "email",
    risk: 2,
    match: {
      objContains: ["ses"],
      attrContains: ["sendEmail", "sendRawEmail", "sendTemplatedEmail"],
    },
  },
  {
    // Resend
    category: "email",
    risk: 2,
    match: {
      objContains: ["resend"],
      attrExact: ["send"],
    },
  },
  {
    // Postmark
    category: "email",
    risk: 2,
    match: {
      objContains: ["postmark", "postmarkapp"],
      attrContains: ["send"],
    },
  },

  // Publish / Upload (S3, GCS, Azure Blob, pub/sub queues)
  {
    // AWS S3 (both v2 .putObject()/.upload() and v3 .send(PutObjectCommand))
    category: "publish",
    risk: 2,
    match: {
      objContains: ["s3"],
      attrContains: ["putObject", "upload", "send"],
    },
  },
  {
    // GCS / Azure Blob
    category: "publish",
    risk: 2,
    match: {
      objContains: ["bucket", "blob"],
      attrContains: ["save", "upload", "put"],
    },
  },
  {
    // Pub/Sub queues
    category: "publish",
    risk: 2,
    match: {
      objContains: ["pubsub", "queue", "topic"],
      attrExact: ["publish"],
    },
  },
  {
    // Exact deploy() call — nameExact prevents cancelDeploy / getDeploymentStatus
    // / redeployApp etc. from matching (those are management calls, not publish ops).
    category: "publish",
    risk: 2,
    match: {
      nameExact: ["deploy"],
    },
  },
  {
    // Generic upload / push helpers (these substrings are distinct enough to be safe)
    category: "publish",
    risk: 2,
    match: {
      nameContains: ["uploadFile", "pushContent"],
    },
  },

  // HTTP Write (POST / PUT / PATCH / DELETE)
  {
    category: "http_write",
    risk: 2,
    match: {
      objContains: ["axios"],
      attrExact: ["post", "put", "patch", "delete"],
    },
  },
  {
    // got library
    category: "http_write",
    risk: 2,
    match: {
      objContains: ["got"],
      attrExact: ["post", "put", "patch", "delete"],
    },
  },
  {
    // node-fetch / global fetch with method option
    category: "http_write",
    risk: 2,
    match: {
      nameContains: ["fetch"],
      methodHttp: ["POST", "PUT", "PATCH", "DELETE"],
    },
  },
  {
    // ky, superagent
    category: "http_write",
    risk: 2,
    match: {
      objContains: ["ky", "superagent", "request"],
      attrExact: ["post", "put", "patch", "delete"],
    },
  },
];

// ---------------------------------------------------------------------------
// Read-only patterns (excluded from side-effect detection)
// ---------------------------------------------------------------------------

/**
 * Patterns that are explicitly read-only. If a call matches one of these
 * AND has no other side-effect match, it is excluded from the scan.
 *
 * Without this list, ~30% of fetch GET / DB SELECT calls would create noise.
 * Mirrors patterns.py READ_ONLY_PATTERNS.
 */
export const READ_ONLY_PATTERNS: ReadOnlyPattern[] = [
  // HTTP GET / HEAD / OPTIONS
  {
    match: {
      objContains: ["axios", "client"],
      attrContains: ["get", "head", "options"],
    },
  },
  {
    match: {
      nameContains: ["fetch"],
      methodHttp: ["GET", "HEAD", "OPTIONS"],
    },
  },
  // ORM / query reads
  {
    match: {
      attrExact: [
        "find", "findOne", "findFirst", "findUnique", "findMany",
        "select", "where", "filter", "all", "first", "last",
        "count", "exists", "get",
      ],
    },
  },
  // Raw SQL SELECT
  {
    match: {
      attrExact: ["query", "execute"],
      sqlContains: ["SELECT"],
    },
  },
];

// ---------------------------------------------------------------------------
// Guard patterns
// ---------------------------------------------------------------------------

export const GUARD_PATTERNS: GuardPattern[] = [
  // --- Input validation: Zod schemas ---
  {
    type: "input_validation",
    coverage: "full",
    match: {
      // z.number().min(0).max(10000) — detected via .min/.max attribute chain
      attrExact: ["min", "max", "length", "regex", "email", "url"],
      objContains: ["z", "schema"],
    },
  },
  {
    // zod .parse() / .safeParse() — schema validation
    type: "input_validation",
    coverage: "full",
    match: {
      objContains: ["schema", "z"],
      attrExact: ["parse", "safeParse"],
    },
  },
  // --- Input validation: Yup ---
  {
    type: "input_validation",
    coverage: "full",
    match: {
      objContains: ["yup", "schema"],
      attrExact: ["required", "min", "max", "matches"],
    },
  },
  // --- Input validation: class-validator decorators ---
  {
    type: "input_validation",
    coverage: "full",
    match: {
      decoratorContains: [
        "IsInt", "IsString", "IsEmail", "IsUrl", "IsNotEmpty",
        "Min", "Max", "Length", "Matches", "ValidateNested",
      ],
    },
  },
  // --- Input validation: manual if check (partial) ---
  {
    type: "input_validation",
    coverage: "partial",
    match: {
      compareContains: [
        "amount", "price", "value", "count", "limit",
        "quantity", "total", "max", "min",
      ],
    },
  },

  // --- Rate limit: NestJS ---
  {
    type: "rate_limit",
    coverage: "full",
    match: {
      decoratorContains: ["Throttle", "RateLimit", "UseInterceptors"],
    },
  },
  // --- Rate limit: imports ---
  {
    type: "rate_limit",
    coverage: "full",
    match: {
      importContains: [
        "express-rate-limit", "@nestjs/throttler", "bottleneck",
        "p-limit", "p-throttle", "rate-limiter-flexible",
      ],
    },
  },

  // --- Auth check: NestJS guards ---
  {
    type: "auth_check",
    coverage: "full",
    match: {
      decoratorContains: ["UseGuards", "Auth", "Authenticated", "Roles"],
    },
  },
  // --- Auth check: middleware names ---
  {
    type: "auth_check",
    coverage: "full",
    match: {
      nameContains: [
        "authenticateUser", "requireAuth", "checkAuth",
        "getServerSession", "auth",
      ],
    },
  },

  // --- Approval step ---
  {
    type: "approval_step",
    coverage: "full",
    match: {
      nameContains: [
        "requestApproval", "awaitConfirmation",
        "requireApproval", "awaitApproval",
      ],
    },
  },
  {
    // Manual approval check via if-statement on a flag named "approved" or similar
    type: "approval_step",
    coverage: "partial",
    match: {
      compareContains: ["approved", "approval", "isapproved"],
    },
  },

  // --- Idempotency ---
  {
    type: "idempotency_key",
    coverage: "full",
    match: {
      kwargContains: ["idempotencyKey", "idempotency_key"],
    },
  },
  {
    type: "idempotency_key",
    coverage: "partial",
    match: {
      nameContains: ["alreadyProcessed", "isProcessed", "hasBeenProcessed"],
    },
  },

  // --- Retry bound ---
  {
    type: "retry_bound",
    coverage: "full",
    match: {
      importContains: ["p-retry", "axios-retry", "async-retry"],
    },
  },
  {
    type: "retry_bound",
    coverage: "full",
    match: {
      kwargContains: ["retries", "maxRetries", "max_retries", "retryLimit"],
    },
  },

  // --- Confirmation ---
  {
    type: "confirmation",
    coverage: "full",
    match: {
      nameContains: ["confirm", "userConfirmed", "promptConfirm"],
    },
  },
  {
    // Manual confirmation check via if-statement on a flag like userConfirmed,
    // confirmed === true, !userConfirmed, etc.
    type: "confirmation",
    coverage: "partial",
    match: {
      compareContains: ["userconfirmed", "confirmed", "confirmation"],
    },
  },
];

// ---------------------------------------------------------------------------
// Excluded paths
// ---------------------------------------------------------------------------

/**
 * Directories never scanned. Mirrors EXCLUDED_DIRS in patterns.py.
 */
export const EXCLUDED_DIRS: string[] = [
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  ".git",
  "out",
];

/**
 * File patterns excluded from scanning. Mirrors EXCLUDED_FILE_PATTERNS.
 */
export const EXCLUDED_FILE_PATTERNS: string[] = [
  ".test.ts",
  ".test.tsx",
  ".spec.ts",
  ".spec.tsx",
  ".d.ts",
];
