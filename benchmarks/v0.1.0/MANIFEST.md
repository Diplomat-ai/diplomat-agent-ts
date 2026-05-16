# Benchmark artifacts — diplomat-agent-ts v0.1.0

Scanned on: 2026-05-15  
Scanner version: 0.1.0  
Scanner commit: see `git log --oneline -1` in this repo

All JSON and YAML artifacts in this directory were produced by running the
v0.1.0 scanner (`node dist/cli.js scan <path> --format json|registry`)
against unmodified public clones of the target repositories.

---

## Targets

| Codebase | URL | Commit SHA (full) | Note |
|---|---|---|---|
| openclaw | https://github.com/openclaw/openclaw | `49d9996d3d99f5d05ce6e83b67b55ad0655ec6a5` | Pinned commit — see note below |
| mastra | https://github.com/mastra-ai/mastra | `38b87964359268d634023a3d94e9f421ae3fcd05` | HEAD at benchmark time |
| openai-agents-js | https://github.com/openai/openai-agents-js | `629d35af99e1ba80fc968b0d062c070caed0683d` | HEAD at benchmark time |

> **On the pinned OpenClaw commit:** the OpenClaw scan is pinned to commit
> `49d9996d` for v0.1.0 reproducibility. This is the commit closest to the
> state on which manual false-positive validation was performed during
> SPEC FIX 5. The validation conclusions (publish pattern needed tightening;
> destructive pattern overcounts on shell-runner codebases by design) apply
> identically to this commit — the delta between the validated state and the
> pinned commit is 3 individual findings in the no_checks pool, none of which
> affect the FP analysis. Subsequent OpenClaw commits will produce different
> numbers; v0.1.1 will refresh.

---

## Scope 1 — OpenClaw `src/` (Application)

**Repository:** https://github.com/openclaw/openclaw  
**Commit:** `49d9996d3d99f5d05ce6e83b67b55ad0655ec6a5` (pinned — see note above)  
**Scanned path:** `src/`  
**TypeScript files:** 7,874  
**Wall time:** ~9s (Apple M-series)

| Metric | Value |
|---|---|
| `total` | 419 |
| `no_checks` | 332 (79%) |
| `partial_checks` | 87 (21%) |
| `confirmed` | 0 |

**Artifacts:** `openclaw-src.json`, `openclaw-src.yaml`

**Reproduce:**
```bash
git clone https://github.com/openclaw/openclaw /tmp/openclaw
git -C /tmp/openclaw checkout 49d9996d
cd diplomat-agent-ts && npm run build
node dist/cli.js scan /tmp/openclaw/src --format json | jq .summary
```

---

## Scope 2 — Mastra `packages/` (Framework)

**Repository:** https://github.com/mastra-ai/mastra  
**Commit:** `38b87964359268d634023a3d94e9f421ae3fcd05` (HEAD at benchmark time)  
**Scanned path:** `packages/`  
**TypeScript files:** 2,777  
**Wall time:** ~5s (Apple M-series)

| Metric | Value |
|---|---|
| `total` | 185 |
| `no_checks` | 162 (88%) |
| `partial_checks` | 23 (12%) |
| `confirmed` | 0 |

**Artifacts:** `mastra-packages.json`, `mastra-packages.yaml`

**Reproduce:**
```bash
git clone --depth 1 https://github.com/mastra-ai/mastra /tmp/mastra
cd diplomat-agent-ts && npm run build
node dist/cli.js scan /tmp/mastra/packages --format json | jq .summary
```

**Note — SPEC FIX 5 (deploy pattern precision):** A pre-fix scan of the same
commit yielded 202 findings (39 more). Those 39 were false positives: all came
from `@mastra/deployer` export functions whose names *contain* the substring
"deploy" (e.g. `cancelDeploy`, `getDeployStatus`, `listDeployments`) but are
management/query operations, not publish side-effects. The fix replaces
`nameContains: ["deploy"]` with `nameExact: ["deploy"]`, which only matches a
bare `deploy()` call. Manual audit confirmed 10/10 sampled items were genuine
FPs. Pattern fix + regression test are in the commit alongside these artifacts.

---

## Scope 3 — OpenAI Agents JS `packages/` (Framework)

**Repository:** https://github.com/openai/openai-agents-js  
**Commit:** `629d35af99e1ba80fc968b0d062c070caed0683d` (HEAD at benchmark time)  
**Scanned path:** `packages/`  
**TypeScript files:** 426  
**Wall time:** ~1s (Apple M-series)

| Metric | Value |
|---|---|
| `total` | 33 |
| `no_checks` | 31 (94%) |
| `partial_checks` | 2 (6%) |
| `confirmed` | 0 |

**Artifacts:** `openai-packages.json`, `openai-packages.yaml`

**Reproduce:**
```bash
git clone --depth 1 https://github.com/openai/openai-agents-js /tmp/openai-agents-js
cd diplomat-agent-ts && npm run build
node dist/cli.js scan /tmp/openai-agents-js/packages --format json | jq .summary
```

---

## Scope 4 — OpenAI Agents JS `examples/` (Examples)

**Repository:** https://github.com/openai/openai-agents-js  
**Commit:** `629d35af99e1ba80fc968b0d062c070caed0683d` (same clone as Scope 3)  
**Scanned path:** `examples/`  
**TypeScript files:** 302  
**Wall time:** <1s (Apple M-series)

| Metric | Value |
|---|---|
| `total` | 32 |
| `no_checks` | 28 (88%) |
| `partial_checks` | 4 (12%) |
| `confirmed` | 0 |

**Artifacts:** `openai-examples.json`, `openai-examples.yaml`

**Reproduce:**
```bash
# same clone as Scope 3 — no re-clone needed
node dist/cli.js scan /tmp/openai-agents-js/examples --format json | jq .summary
```

---

## Consistency check

All artifact JSON files were generated on 2026-05-15 by version 0.1.0.
To verify the artifacts match the MANIFEST numbers exactly:

```bash
python3 -c "
import json
expected = {
  'openclaw-src':     (419, 332, 87, 0),
  'mastra-packages':  (185, 162, 23, 0),
  'openai-packages':  ( 33,  31,  2, 0),
  'openai-examples':  ( 32,  28,  4, 0),
}
ok = True
for name, (total, no_checks, partial, confirmed) in expected.items():
    d = json.load(open(f'benchmarks/v0.1.0/{name}.json'))
    s = d['summary']
    match = (s['total'] == total and s['no_checks'] == no_checks
             and s['partial_checks'] == partial and s['confirmed'] == confirmed)
    print('OK' if match else 'MISMATCH', name, s)
    ok = ok and match
print('ARTIFACTS ALIGN WITH MANIFEST' if ok else 'DIVERGENCE DETECTED')
"
```
