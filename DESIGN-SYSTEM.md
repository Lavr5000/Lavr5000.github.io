# AI Vibes — design system (site v3)

Single source of the visual language of ai-vibes.ru. Pages must not invent their own values:
everything below lives in `assets/tokens.css` and is consumed through `var(--…)`.

## Where things live

| What | File |
|---|---|
| Colours, fonts, spacing rhythm, easing | `assets/tokens.css` (first link of the `chrome:head` block, written by `scripts/build_chrome.py`) |
| Header, footer, pay modal | `assets/chrome.css` |
| Home, builders, offer pages | `assets/site3.css` |
| Realtor page | `rieltor/rieltor.css` |
| Legacy "work sheet" pages (blog, tools) | `assets/site2.css`, `assets/legal2.css` |
| Scroll scenes | `assets/scene2.js` + `assets/scene2/<name>.js`, posters `assets/scene2/<name>_{pc,tel}.webp` |

Rule: no colour literal (hex, rgb, named colour) outside `tokens.css`. Transparency is
`color-mix(in srgb, var(--token) P%, transparent)`. The gate metric `hex_outside_tokens` must be 0.

## Colour

Two surfaces alternate down the page: a dark **ink** stage and a light **paper** section.

| Role | Token | Use |
|---|---|---|
| Dark stage | `--ink`, `--ink-2`, `--ink-3` | page hero, scenes, raised cards on dark |
| Light section | `--paper`, `--paper-2`, `--sheet` | content bands, cards, document sheet |
| Text on dark | `--on-ink`, `--on-ink-2` | body / secondary |
| Text on light | `--on-paper`, `--on-paper-2` | body / secondary |
| Accent | `--brass`, `--brass-2` on dark; `--brass-deep` on light | CTA, numbers, markers |
| Status | `--ok` (included in price), `--danger`, `--danger-2` (errors) | |
| Lines | `--line-ink`, `--line-paper` | hairlines and borders |

Contrast: every text/background pair passes WCAG AA (gate `contrast_fail=0`). A component that
changes its background (for example a held tariff tile) must switch its text to the matching
`--on-*` pair in the same rule.

## Type

| Token | Family | Use |
|---|---|---|
| `--display` | Prata (serif) | h1–h3, tariff names, card titles; weight 400, letter-spacing -.012em |
| `--sans` | Golos Text 400/500 | body 17px / 1.6; mobile 15–16px |
| `--mono` | JetBrains Mono | prices, numbers, eyebrows (13px caps .1em), step counters; `tabular-nums` for money |

Fonts are self-hosted in `assets/fonts/` (no external sources: CSP `'self'`). Display sizes use
`clamp()`: h1 `clamp(28px,4vw,50px)`, tariff name `clamp(28px,3.4vw,40px)`.

## Rhythm and layout

| Token | Value | Use |
|---|---|---|
| `--wrap` | 1200px | content width |
| `--pad` | `clamp(16px,4vw,40px)` | side gutter (16px on phones) |
| `--gap` | `clamp(16px,2.4vw,28px)` | grid gap |
| `--band` | `clamp(56px,8vw,112px)` | vertical padding of a section |

Radii: 6px for captions and small cards, 8px for panels, 50% for dots. No horizontal scroll at
390px (gate `overflow_pages_m=0`).

## Motion

- Easing `--ease` (`cubic-bezier(.22,.61,.36,1)`), UI transitions .2s.
- Scroll scenes: a sticky full-screen stage (`.scene2-stage`) with captions flowing over it;
  captions sit on a veil `color-mix(--scene-veil 80%)`. Frame budget: p95 gap ≤ 33 ms.
- Without JavaScript or with `prefers-reduced-motion: reduce` the scene shows its static poster
  and all transitions are off; content is never hidden at rest (gates `hidden_nojs=0`,
  `hidden_at_rest_rm=0`).

## Checks

```
python scripts/build_chrome.py --check
python scripts/build_scene_posters.py --check
python scripts/d_snapshot.py compare ...   # visual diff of a refactor, worst <= 0.5 %
python tests/v3_gate.py --no-webkit        # GATE status=ok
```
