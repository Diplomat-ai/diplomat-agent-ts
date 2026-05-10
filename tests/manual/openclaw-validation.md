# Manual Validation — OpenClaw Protocol v0.1.0

**Validator:** ___________________________  
**Date:** ___________________________  
**diplomat-agent-ts version:** 0.1.0  
**Node version:** ___________________________  

---

## Checklist Pre-validation

- [ ] `npm run build` passes (0 errors)
- [ ] `npm run lint` passes (0 warnings)
- [ ] `npm test` passes (all tests green)

---

## Section 6.1 — Scanner Validation

### 6.1.1 Stripe Payment Detection

Run:
```bash
node dist/cli.js tests/fixtures/unguarded-payment-stripe --format json | jq '.tool_calls[0]'
```

Expected output (key fields):
- `status`: `"no_checks"`
- `side_effects[0].category`: `"payment"`
- `owasp_agentic` contains `"ASI-02"` and `"ASI-03"`
- `missing_hints` is non-empty

Result: PASS / FAIL  
Notes: ___________________________

---

### 6.1.2 Guard Detection (Zod + Auth)

Run:
```bash
node dist/cli.js tests/fixtures/guarded-input-validation-zod --format json | jq '.tool_calls[0]'
```

Expected output:
- `status`: `"partial_checks"`
- `guards` contains an entry with `type: "input_validation"`
- `side_effects[0].category`: `"payment"`

Result: PASS / FAIL  
Notes: ___________________________

---

### 6.1.3 Annotation Detection

Run:
```bash
node dist/cli.js tests/fixtures/annotation-confirmed --format json | jq '.tool_calls[0]'
```

Expected output:
- `status`: `"confirmed"`
- `confirmed` field contains the review reason

Result: PASS / FAIL  
Notes: ___________________________

---

### 6.1.4 False Positive Check

Run:
```bash
node dist/cli.js tests/fixtures/false-positive-checker --format json | jq '.summary'
```

Expected output:
- `total`: `0`
- No tool_calls

Result: PASS / FAIL  
Notes: ___________________________

---

### 6.1.5 Read-only Operations

Run:
```bash
node dist/cli.js tests/fixtures/readonly-only --format json | jq '.summary'
```

Expected output:
- `total`: `0`

Result: PASS / FAIL  
Notes: ___________________________

---

## Section 6.2 — CLI Validation

### 6.2.1 Exit Code — Unchecked Tools

Run:
```bash
node dist/cli.js tests/fixtures/unguarded-payment-stripe --fail-on-unchecked; echo "exit: $?"
```

Expected: exit code `1`

Result: PASS / FAIL  
Notes: ___________________________

---

### 6.2.2 Exit Code — All Confirmed

Run:
```bash
node dist/cli.js tests/fixtures/annotation-confirmed --fail-on-unchecked; echo "exit: $?"
```

Expected: exit code `0`

Result: PASS / FAIL  
Notes: ___________________________

---

### 6.2.3 YAML Registry Output

Run:
```bash
node dist/cli.js tests/fixtures/unguarded-payment-stripe --format registry | head -20
```

Expected:
- First line: `spec_version: '1.0'` or `spec_version: "1.0"`
- Contains `tool_calls:` section
- Contains `ASI-02`

Result: PASS / FAIL  
Notes: ___________________________

---

### 6.2.4 Output to File

Run:
```bash
node dist/cli.js tests/fixtures/unguarded-payment-stripe --output-registry /tmp/toolcalls-test.yaml
cat /tmp/toolcalls-test.yaml | head -5
```

Expected: file written, contains `spec_version`

Result: PASS / FAIL  
Notes: ___________________________

---

### 6.2.5 NO_COLOR Support

Run:
```bash
NO_COLOR=1 node dist/cli.js tests/fixtures/unguarded-payment-stripe | cat -v
```

Expected: no `^[[` (ANSI escape sequences) in output

Result: PASS / FAIL  
Notes: ___________________________

---

## Section 6.3 — All 12 Side-Effect Categories

| Category | Fixture | Detected | Status |
|---|---|---|---|
| payment | unguarded-payment-stripe | ☐ | |
| database_write | unguarded-database-write-prisma | ☐ | |
| database_delete | unguarded-database-delete | ☐ | |
| http_write | unguarded-http-fetch | ☐ | |
| llm_call | unguarded-llm-openai | ☐ | |
| agent_invocation | unguarded-agent-invocation | ☐ | |
| email | unguarded-email-nodemailer | ☐ | |
| messaging | unguarded-messaging-slack | ☐ | |
| publish | unguarded-publish-s3 | ☐ | |
| dynamic_code | unguarded-dynamic-code-eval | ☐ | |
| file_delete | unguarded-file-delete-fs | ☐ | |
| destructive | unguarded-destructive-exec | ☐ | |

Run each with:
```bash
node dist/cli.js tests/fixtures/<fixture-dir> --format json | jq '.tool_calls[0].side_effects[0].category'
```

---

## Section 6.4 — All 7 Guard Types

| Guard Type | Fixture | Detected | Status |
|---|---|---|---|
| input_validation | guarded-input-validation-zod | ☐ | |
| rate_limit | guarded-rate-limit-nestjs | ☐ | |
| auth_check | guarded-auth-check-nestjs | ☐ | |
| approval_step / confirmation | guarded-approval-step | ☐ | |
| idempotency_key | guarded-idempotency-key | ☐ | |
| retry_bound | guarded-retry-bound | ☐ | |
| confirmation | guarded-confirmation | ☐ | |

Run each with:
```bash
node dist/cli.js tests/fixtures/<fixture-dir> --format json | jq '.tool_calls[0].guards'
```

---

## Final Sign-off

- [ ] All sections PASS
- [ ] No regressions from previous version
- [ ] Ready to tag v0.1.0 and publish to npm

**Sign-off:** ___________________________  
**Date:** ___________________________  
