# Medical UI/UX Evaluation — Wrist Fracture AI Demo
**Evaluator role:** Radiologist / clinical peer reviewer perspective  
**Date:** 2026-04-21  
**Screenshots reviewed:** 01_empty, 02_pred_sample, 03_pred_14846298, 04_pred_16254840

---

## 1. Verdict

This UI reads as a well-crafted editorial data visualization — not a clinical decision-support tool. The Fraunces variable serif at 66px for the percentage numerals is the single most damaging choice: its soft, ink-trap-heavy, optically expressive letterforms are designed for magazine headlines and literary publishing. Any radiologist who has used Aidoc, Arterys, Siemens syngo.via, or a standard PACS viewer will immediately register the mismatch at a gut level before consciously analyzing why. The film-grain SVG overlay baked into the body background (line 35 of style.css), the radial-gradient logo-dot with a conic glow, and the "SOFT" axis pushed to 40-60 on the gauge operator glyph compound the editorial feel. The dark theme color palette and panel structure are directionally correct — the bones of a PACS-style layout are present — but the typographic choices completely undermine credibility. For a journal submission, reviewers will see "slick startup demo" before they see "rigorous clinical AI." This must be fixed before submission.

---

## 2. Top 3 Must-Fix Items

### FIX 1 — Replace Fraunces with IBM Plex Sans (or Inter) everywhere

**Problem:** `--font-display: "Fraunces"` at line 19 propagates into `.num` (line 470), `.pct` (line 479), `.gauge-op` (line 513), `.fxcard-num` (line 404), and `.topbar h1` (line 337). The 66px numerals rendered in Fraunces with `font-variation-settings: "SOFT" 25` look like a magazine's data journalism piece. Clinical tools use geometric or humanist grotesque numerals with tabular figures — no serifs, no ink traps, no expressive axes.

**Fix:**
```css
/* style.css line 19 — replace entirely */
--font-display: "IBM Plex Sans", "Inter", ui-sans-serif, system-ui, sans-serif;
--font-body:    "IBM Plex Sans", "Inter", ui-sans-serif, system-ui, sans-serif;
```

On `.num` (line 469-477): remove all `font-variation-settings` referencing "SOFT" — that axis does not exist on IBM Plex Sans. Use:
```css
.num {
  font-family: var(--font-display);
  font-size: 64px;
  font-weight: 300;           /* thin weight reads cleanly at large size */
  line-height: 0.9;
  letter-spacing: -0.02em;
  font-feature-settings: "tnum", "lnum";   /* tabular, lining — mandatory for clinical numerics */
  color: var(--ink);
}
```

On `.gauge-op` (line 513): the multiplication operator `x` rendered in Fraunces italic at 30px with `"SOFT" 60` is the most "art magazine" element on the page. Change to:
```css
.gauge-op {
  font-family: var(--font-mono);   /* monospaced x operator reads as technical, not decorative */
  font-size: 18px;
  font-weight: 400;
  color: var(--muted);
  opacity: 0.5;
  padding-top: 48px;
}
```

Google Fonts load: replace `Fraunces` import with `IBM+Plex+Sans:wght@300;400;500;600` or `Inter:wght@300;400;500;600`.

---

### FIX 2 — Remove the film-grain overlay and the conic logo-dot glow

**Problem:** Lines 33-36 in style.css apply an SVG `feTurbulence` fractalNoise texture over the entire body background using `background-blend-mode: screen`. This is a deliberate editorial/cinematic texture technique. No clinical software uses this. The conic-gradient logo-dot with `box-shadow: 0 0 24px rgba(94,198,255,0.35)` (line 51-52) is the visual signature of a consumer SaaS product landing page.

**Fix:**
```css
/* style.css lines 33-36 — remove the background-image dual-layer entirely */
html, body {
  background: #0a0d12;   /* flat dark, no gradient needed — matches PACS standard */
  color: var(--text);
  font-family: var(--font-body);
  min-height: 100vh;
}
```

For the logo-dot (lines 49-53), replace the conic gradient with a flat, muted indicator:
```css
.logo-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: #7dd3fc;          /* keep the accent cyan but small and flat */
  box-shadow: none;             /* remove glow entirely */
}
```
Or remove the logo-dot altogether and let the text brand "Wrist Fracture AI" stand alone in a clean sans-serif.

---

### FIX 3 — Replace wide-letterspaced small-caps labels with plain uppercase or sentence case

**Problem:** `.gauge-label` (line 449) uses `letter-spacing: 0.18em` + `text-transform: uppercase` + `font-size: 11px`. `.pane-head h2` (line 360) uses `letter-spacing: 0.22em` + `text-transform: uppercase` + `font-size: 11px`. `.tier` (line 424) uses `letter-spacing: 0.22em` + `text-transform: uppercase` + `font-size: 9.5px`. This combination — micro uppercase with extreme tracking — is a hallmark of editorial/fashion design. At 9.5px with 0.22em tracking the tier pill "LOW CONFIDENCE" is both hard to read at a glance and looks like a clothing label, not a clinical alert. The `--text: #f3efe4` warm paper white (line 7) reinforces the print editorial feel.

**Fix for labels:**
```css
.gauge-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;    /* reduced from 0.18em — readable but still structured */
  color: var(--ink-dim);
  font-weight: 500;
}

.pane-head h2 {
  font-size: 11px;
  letter-spacing: 0.08em;    /* reduced from 0.22em */
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
}

.tier {
  font-size: 10px;
  letter-spacing: 0.06em;    /* reduced from 0.22em */
  text-transform: uppercase;
  font-weight: 600;           /* heavier so it registers at small size */
  padding: 3px 8px;
  border-radius: 3px;         /* change from 2px — squarer is more clinical */
}
```

For body text color, change `--text: #f3efe4` (line 7) to `--text: #e8eaed`. The warm "paper" tint reinforces editorial print aesthetics. Clinical tools use a cooler, neutral near-white.

---

## 3. Nice-to-Have Polish

1. **`--radius: 14px` (line 16) is too consumer-SaaS rounded.** Clinical panels and cards use tighter radii. Change to `--radius: 6px` and `.fxcard border-radius` (line 383) from `10px` to `6px`. The `.card border-radius` (line 254) should go from `12px` to `6px` as well.

2. **The `x` operator between the two gauges is clever but gimmicky for a clinical context.** In syngo.via and similar tools, dual metrics are presented as a two-column labeled table, not a formula. Consider replacing `x` with a thin vertical rule (`border-left: 1px solid var(--border)`) between the two gauge columns to create a clean separator rather than an implied mathematical expression.

3. **The animated glow on `.gauge-fill` (line 507, `box-shadow: 0 0 8px`) and `.bar-fill` (line 311, `box-shadow: 0 0 12px`) looks like a gaming UI.** Remove or reduce glow effects on progress bars to `box-shadow: none`. The fill color alone is sufficient for clinical readability.

4. **The `.bd-row.is-predicted` background gradient (lines 583-591) uses `color-mix(in oklab, var(--c) 7%, transparent)` which creates a subtle tinted row highlight.** This is fine in principle, but the predicted row should be distinguished primarily by font-weight and a left-border accent color (`border-left: 2px solid var(--c)`) rather than a background wash, which is harder to read on dark panels under poor monitor calibration conditions (common in radiology reading rooms with specialized display hardware).

5. **The `JOINT PROBABILITY` meta-row label uses dotted leaders (lines 541-550, `background-image: radial-gradient circle` dot pattern).** This is a print typography technique (leader dots in tables of contents). Replace with a simple flex spacer and a right-aligned value, matching the tabular layout conventions of clinical reporting systems.

---

## 4. Recommended Font Stack

### Body and UI labels
**IBM Plex Sans** — designed by Bold Monday for IBM, used in clinical data tools, developer tools, and scientific dashboards. Has a mechanical, precise quality without being cold. Excellent tabular numeral support.
```
Google Fonts: IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400
CSS: font-family: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
```

### Display / large numerics (replacing Fraunces entirely)
**IBM Plex Sans** at `font-weight: 300` for large percentage numerals. A thin-weight sans at 64px reads as precise and instrument-grade. No separate display face is needed — using the same typeface at a lighter weight for numerics and heavier weight for labels creates a clean, disciplined hierarchy without introducing expressive type contrast.

Alternative if a distinct display face is desired: **DM Sans** (`font-weight: 200` for numerals) — neutral, slightly geometric, no editorial connotations, good lining figure support.
```
Google Fonts: DM+Sans:ital,opsz,wght@0,9..40,200;0,9..40,400;0,9..40,500
```

### Monospaced (coordinates, model names, metadata values)
**IBM Plex Mono** — pairs with IBM Plex Sans visually and is used extensively in clinical and scientific tools for data values, coordinates, and system identifiers.
```
Google Fonts: IBM+Plex+Mono:wght@400;500
CSS: font-family: "IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
```

---

## Summary Reference: CSS Lines to Change

| Issue | File | Line(s) | Current value | Replace with |
|---|---|---|---|---|
| Fraunces font-display | style.css | 19 | `"Fraunces", serif` | `"IBM Plex Sans", sans-serif` |
| Fraunces font-body | style.css | 20 | `"General Sans"` | `"IBM Plex Sans", sans-serif` |
| Film-grain SVG overlay | style.css | 33-36 | dual background-image | single flat `background: #0a0d12` |
| Logo dot conic glow | style.css | 51-52 | conic-gradient + box-shadow glow | flat color dot, no glow |
| Warm text color | style.css | 7 | `#f3efe4` | `#e8eaed` |
| Gauge label tracking | style.css | 453 | `letter-spacing: 0.18em` | `letter-spacing: 0.08em` |
| Pane-head tracking | style.css | 364 | `letter-spacing: 0.22em` | `letter-spacing: 0.08em` |
| Tier pill tracking | style.css | 427 | `letter-spacing: 0.22em` | `letter-spacing: 0.06em` |
| Border radius | style.css | 16 | `--radius: 14px` | `--radius: 6px` |
| Gauge-op Fraunces | style.css | 513-519 | Fraunces 30px SOFT 60 | mono 18px no glow |
| Num class Fraunces SOFT | style.css | 471 | `"SOFT" 25` | remove — use font-weight: 300 |
| Bar fill glow | style.css | 311 | `box-shadow: 0 0 12px` | remove |
| Gauge fill glow | style.css | 507 | `box-shadow: 0 0 8px` | remove |

