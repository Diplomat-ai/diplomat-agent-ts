# diplomat-agent-ts

> Scan TypeScript AI agent code for unguarded tool calls — pip wrapper for [`@diplomat-ai/diplomat-agent-ts`](https://github.com/Diplomat-ai/diplomat-agent-ts).

Requires Node.js >= 20 on PATH. The scanner runs via Node; this package is a zero-dependency Python shim.

## Install

```bash
pip install diplomat-agent-ts
```

## Usage

```bash
diplomat-agent-ts scan ./src
diplomat-agent-ts scan ./src --output-registry toolcalls.yaml
diplomat-agent-ts scan ./src --fail-on-unchecked   # for CI
diplomat-agent-ts scan ./src --format json
```

## Programmatic use

```python
from diplomat_agent_ts import run
run(["scan", "./src", "--format", "json"])
```

## Requirements

- Python >= 3.9
- Node.js >= 20 (install via [nodejs.org](https://nodejs.org) or [nvm](https://github.com/nvm-sh/nvm))

## Links

- [Full documentation and TypeScript-native install](https://github.com/Diplomat-ai/diplomat-agent-ts)
- [OWASP Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
