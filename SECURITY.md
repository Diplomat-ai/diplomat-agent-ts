# Security policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a vulnerability

Please **do not** open public issues for security vulnerabilities.

Use GitHub's private disclosure flow:
**https://github.com/Diplomat-ai/diplomat-agent-ts/security/advisories/new**

We aim to:
- Acknowledge receipt within 48 hours
- Provide an initial assessment within 7 days
- Publish a fix within 30 days for critical issues

## Scope

`diplomat-agent-ts` is a static analysis tool. The most relevant
vulnerability classes are:

- **Pattern bypass** — crafted code that the scanner fails to flag despite
  containing real side effects with no guards
- **False negatives on common SDKs** that lead to undetected real-world risk
- **Code execution via crafted TypeScript input** — we use `ts-morph` which
  parses but does not execute user code. Report any deviation from this
  guarantee.
- **Path traversal or arbitrary file read** during scanning. The scanner reads
  files under the path passed on the command line; reading outside that tree
  via symlinks or crafted imports is a vulnerability.
- **Denial of service** via crafted input that causes pathological parse
  times or memory usage.

## Out of scope

- Issues in the agent code itself that `diplomat-agent-ts` flags or fails to
  flag — these are bug reports, not vulnerabilities. Use the bug report
  template.
- Vulnerabilities in `ts-morph` or `yaml` (our two runtime dependencies).
  Report those to the upstream projects.
- Social engineering of maintainers.
