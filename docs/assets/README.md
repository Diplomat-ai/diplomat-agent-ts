# Visual assets

Source files for the README visuals and GitHub social preview.

## Files

| File | Format | Used in | Source |
|---|---|---|---|
| `terminal-hero.svg` | SVG | README — "What it looks like" | Hand-authored, mirrors real CLI output |
| `before-after.svg` | SVG | README — main hook | Hand-authored |
| `architecture.svg` | SVG | README — Architecture section | Hand-authored, matches `src/` layout |
| `og-card.svg` | SVG | Source for `og-card.png` | Hand-authored, 1200×630 |
| `og-card.png` | PNG 1200×630 | GitHub Settings → Social preview | Generated from `og-card.svg` |

## Regenerating `og-card.png`

After editing `og-card.svg`:

```bash
npx -y svgexport docs/assets/og-card.svg docs/assets/og-card.png 1200:630
file docs/assets/og-card.png  # must report "1200 x 630"
```

Then re-upload `og-card.png` in **GitHub repo Settings → General → Social preview**.

## Editing the SVGs

The SVGs are hand-authored XML — no design tool needed. Open in any text editor.

**Color palette used across all assets** (matches the source code lane colors):

| Role | Hex | Where |
|---|---|---|
| Scanner (purple) | `#534AB7` | `architecture.svg` |
| Analyzer (teal) | `#0F6E56` | `architecture.svg`, "after" panel |
| Reporter (coral) | `#993C1D` | `architecture.svg` |
| Flag red | `#F85149` / `#DA3633` | terminal + cards |
| Confirmed green | `#3FB950` | terminal + cards |
| OWASP amber | `#E3B341` | terminal + OG card accent |
| Terminal bg | `#1B1F23` / `#161B22` | terminal mockups |
| Dark canvas bg | `#0D1117` | OG card |

## Reproducing the OpenClaw benchmark in `og-card.svg`

The numbers `425 tool calls · 335 unguarded · 90 partial · 8,005 files · 32s` in the OG card come from a real scan. To re-verify after a release:

```bash
git clone --depth 1 https://github.com/openclaw/openclaw /tmp/openclaw
cd diplomat-agent-ts && npm run build
node dist/cli.js /tmp/openclaw/src --format json | jq '.summary'
```

If the numbers shift significantly, update both `og-card.svg` and the Benchmarks section of the main README.