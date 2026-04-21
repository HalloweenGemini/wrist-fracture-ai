# Medical UI/UX Re-evaluation — Wrist Fracture AI Demo (v3)
**Evaluator role:** Radiologist / clinical peer reviewer perspective
**Date:** 2026-04-21
**Prior report:** eval_medical.md
**Screenshots reviewed:** 01_empty, 02_pred_14846298 (5.5%/99.8%), 03_pred_16254840 (9.4%/83.3%), 04_pred_14846298 (25.3%/99.4%)

---

## 1. Verdict

The v3 revision is a substantial improvement. IBM Plex Sans at weight 300 for the large numerals is the right call — the figures now read as instrument output rather than editorial art. The removal of the film-grain overlay and conic glow cleans up the background considerably. The vertical rule separator between gauges is unambiguously better than the typographic multiplication operator. The border-radius reduction to 6px makes the panels feel structured rather than bubbly. At a first glance from a radiologist or journal reviewer, this now passes the basic credibility bar — it no longer reads as a consumer web app or a startup landing page.

That said, there are four residual problems that still undermine clinical readability before submission:

1. The dot-leader pattern in the meta-rows is still present (style.css lines 535-545) and still reads as print typography, not clinical software.
2. The `.badge-dot` glow was not removed — style.css line 263 still carries `box-shadow: 0 0 10px currentColor`. This affects the old `.card` component, which may still be rendered in some states.
3. The `.card` border-radius at line 248 is still `12px` — the only element in the UI with a large radius after the global change to 6px, making it visually inconsistent.
4. The comment on line 325 still reads "EDITORIAL PREDICTIONS CARD" — a cosmetic issue, but if the CSS is ever inspected during code review for a journal submission, this is an embarrassing artifact.

None of these are blockers, but items 1 and 3 are visible in the screenshots.

---

## 2. Residual Fixes (priority order)

### FIX 1 — Remove dot-leader from meta-rows (still present, lines 535-545)

The `background-image: radial-gradient(circle, ...)` dot-repeat pattern on `.meta-row::before` is the last remaining print-editorial element. It is visible in all three prediction screenshots between the "JOINT PROBABILITY" label and its value, and between "OPERATING POINT" and its coordinates. It signals "book design" to any clinical reader.

Replace the entire `::before` pseudo-element with a plain flex spacer:

```css
/* style.css lines 535-545 — replace entirely */
.meta-row::before {
  content: "";
  flex: 1;
  /* no background-image — plain gap between label and value */
}
```

That removes all dot leaders. Label left, value right, clean space between.

### FIX 2 — Remove `.badge-dot` glow (line 263)

```css
/* style.css line 263 — current */
box-shadow: 0 0 10px currentColor;

/* replace with */
box-shadow: none;
```

The `.badge-dot` is used in the older `.card` component. Even if this component is not currently rendered in the prediction flow, it will appear if a "no detection" or error state is triggered. The glow is inconsistent with the rest of the now-clean UI.

### FIX 3 — Fix `.card` border-radius (line 248, still 12px)

```css
/* style.css line 248 — current */
border-radius: 12px;

/* replace with */
border-radius: 6px;
```

This is the only remaining large-radius element. On the `.no-det` block (line 318) the radius is also still `12px` — fix that to `6px` as well.

### FIX 4 — Fix the comment on line 325

```css
/* current (line 325) */
/* EDITORIAL PREDICTIONS CARD — twin-gauge layout */

/* replace with */
/* PREDICTIONS CARD — twin-gauge layout */
```

Minor, but worth doing before any code is shown to reviewers.

---

## 3. What Is Working Well (do not change)

- **IBM Plex Sans weight 300 at 56px for numerals:** Correct. Reads as precise and instrument-grade. The `font-feature-settings: "tnum", "lnum"` on line 476-477 is the right call for clinical numeric alignment.
- **Vertical rule separator (1px, `var(--border-soft)`):** Better than any operator glyph. Clean, neutral, unambiguous column division.
- **Tier pills (LOW CONFIDENCE in danger red):** Now readable at `font-size: 10px` with `letter-spacing: 0.06em`. The `border-radius: 3px` is appropriately tight. Color coding (red/amber/green) matches standard clinical alert conventions.
- **`--text: #e8eaed` cool near-white:** Correct. No longer feels like printed paper.
- **`--radius: 6px` global:** Makes panels look like structured data containers, not UI cards.
- **`.bd-row.is-predicted` left border accent:** The 2px colored left border at line 577 is the right way to call out the predicted class — visible and unambiguous without a distracting background wash.
- **Animation duration reduction (.35s):** The entry animation on `.fxcard` is now subtle enough to not read as "product demo."
- **Legend chips at top-right:** Square markers (1px radius, no glow) are now properly clinical. The chip shape itself (999px border-radius pill) is slightly consumer-ish but acceptable — this is a navigation legend, not a clinical data element, so the softness is tolerable.

---

## 4. Nice-to-Have Polish (5 items)

1. **`.gauge-track` tick marks (lines 495-503):** The `repeating-linear-gradient` 10%-interval tick pattern is a nice scientific instrument detail that actually reads well in context. Keep it. If anything, increase tick opacity from `0.06` to `0.09` for slightly better readability on high-DPI displays.

2. **`--shadow: 0 10px 30px rgba(0,0,0,0.35)` (line 17):** Panel drop shadows at this scale are a consumer UI convention. Clinical tools typically use panel borders alone. Consider reducing to `--shadow: 0 2px 8px rgba(0,0,0,0.25)` or removing entirely — the `1px solid var(--border)` borders already delineate panels cleanly.

3. **`.btn` border-radius (line 98, still `10px`):** Buttons are the last place where the old consumer-SaaS rounding survives. Change to `border-radius: 4px` to match the 6px panel convention (buttons should be slightly tighter than panels).

4. **`backdrop-filter: blur(8px)` on `.topbar` (line 40):** Frosted-glass blur on the topbar is a consumer OS design pattern (macOS, iOS). Remove it — `background: rgba(10,15,22,0.95)` or just `background: var(--bg)` gives a cleaner, more professional header that matches PACS conventions.

5. **The `%` symbol on `.pct` (lines 480-486):** At 18px weight 400, the percent sign after the 56px weight-300 numeral is proportionally correct but slightly heavy relative to the numeral. Consider `font-weight: 300` to match the numeral weight, preventing the `%` from reading as bolder than the number it qualifies.

---

## Summary: Remaining CSS Lines to Change

| Issue | Line(s) | Current | Replace with |
|---|---|---|---|
| Dot-leader in meta-rows | 535-545 | `background-image: radial-gradient(...)` | remove background-image entirely |
| badge-dot glow | 263 | `box-shadow: 0 0 10px currentColor` | `box-shadow: none` |
| .card border-radius | 248 | `border-radius: 12px` | `border-radius: 6px` |
| .no-det border-radius | 318 | `border-radius: 12px` | `border-radius: 6px` |
| Comment text | 325 | "EDITORIAL PREDICTIONS CARD" | "PREDICTIONS CARD" |
| .btn border-radius (polish) | 98 | `border-radius: 10px` | `border-radius: 4px` |
| topbar backdrop-filter (polish) | 40 | `backdrop-filter: blur(8px)` | remove |
| .pct font-weight (polish) | 483 | `font-weight: 400` | `font-weight: 300` |
| panel shadow (polish) | 17 | `0 10px 30px rgba(0,0,0,0.35)` | `0 2px 8px rgba(0,0,0,0.25)` |
