# Benchmark artifacts — diplomat-agent-ts v0.1.0

Scanned on: 2026-05-15  
Scanner version: 0.1.0  
Scanner commit: see `git log --oneline -1` in this repo

All JSON and YAML artifacts in this directory were produced by running the
post-fix v0.1.0 scanner (`node dist/cli.js scan <path> --format json|registry`)
against unmodified clones of the target repositories.

---

## Scope 1 — OpenClaw `src/`

**Repository:** https://github.com/Diplomat-ai/openclaw  
**Commit:** 49d9996d3d99f5d05ce6e83b67b55ad0655ec6a5 (known as "diplomat-openclaw-main")  
**Scanned path:** `src/`  
**TypeScript files:** 7,882  
**Wall time:** ~5s (Apple M-series), ~32s (GitHub Actions Ubuntu)

| Metric | Value |
|---|---|
| `total` | 418 |
| `no_checks` | 331 (79%) |
| `partial_checks` | 87 (21%) |
| `confirmed` | 0 |

**Artifacts:** `openclaw-src.json`, `openclaw-src.yaml`

**Reproduce:**
```bash
git clone https://github.com/Diplomat-ai/openclaw /tmp/openclaw
cd diplomat-agent-ts && npm run build
node dist/cli.js scan /tmp/openclaw/src --format json | jq .summary
```

---

## Scope 2 — OpenClaw `src/agents/`

**Repository:** same as Scope 1  
**Scanned path:** `src/agents/` (agent subsystem only)  
**TypeScript files:** 1,565  
**Wall time:** ~2s (Apple M-series), ~7s (GitHub Actions Ubuntu)

| Metric | Value |
|---|---|
| `total` | 102 |
| `no_checks` | 78 (76%) |
| `partial_checks` | 24 (24%) |
| `confirmed` | 0 |

**Artifacts:** `openclaw-agents.json`, `openclaw-agents.yaml`

**Reproduce:**
```bash
node dist/cli.js scan /tmp/openclaw/src/agents --format json | jq .summary
```

---

## Scope 3 — Mastra `packages/`

**Repository:** https://github.com/mastra-ai/mastra  
**Commit:** 38b87960 ("Exclude tsup bundled config files from ESLint (#16634)")  
**Scanned path:** `packages/`  
**TypeScript files:** 2,787  
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
FPs. Pattern fix + regression test are in commit alongside these artifacts.

---

## Consistency check

All three artifact JSON files were generated on the same date (2026-05-15) by
version 0.1.0. To verify the artifacts match the MANIFEST numbers exactly:

```bash
python3 -c "
import json
expected = {
  'openclaw-src':     (418, 331, 87,  0),
  'openclaw-agents':  (102,  78, 24,  0),
  'mastra-packages':  (185, 162, 23,  0),
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
