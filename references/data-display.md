# Data Display

Tables, metrics, and charts are the places where "premium" is easiest to fake and easiest
to lose. Density, alignment, and number formatting carry more quality than decoration.

## Tables

**Density tiers** — pick one per table and keep it:

| Tier | Row height | Cell padding | Use for |
|---|---|---|---|
| compact | 32–36px | 8–12px | operational scanning, expert tools |
| comfortable | 44–48px | 12–16px | default product tables |
| spacious | 56–64px | 16–20px | marketing, few rows, rich cells |

**Header**

- 12px, weight 500–600, muted foreground, optional uppercase with 0.04em tracking.
- Sticky when the table scrolls; one border under the header, none above.
- Sortable headers are buttons inside the full header cell, with `aria-sort` and a 12px
  chevron. The hit area covers the cell, not just the text.

**Rows**

- One horizontal hairline per row, low contrast. No vertical grid lines.
- Hover tint 2–4%; selected 6–8% plus a 2px accent edge. No zebra stripes by default.
- Row actions live at the end in an overflow menu. Four icon buttons per row is noise.
- Never truncate the identifier. Truncate descriptions to one or two lines and keep the full
  value available through a title or disclosure.

**Numbers**

- `font-variant-numeric: tabular-nums`, right-aligned, one unit convention per column.
- Consistent decimals; do not imply precision the source does not have.
- Missing values render as a muted `—`, not `0`, `null`, or an empty cell.

**Columns**

- Primary text flexible; numbers fixed width; actions 48–64px.
- Reserve width for the longest realistic value rather than truncating everything.
- Mobile: keep two or three priority columns plus a row disclosure, or switch to a card
  list. Comparison must survive the transformation.

**States**

- Loading: 5–8 skeleton rows with the real column widths, header stays.
- Empty: filter-aware copy plus a clear-filters action (see [state compositions](state-compositions.md)).
- Error: keep the header, offer retry, keep filters.
- Selection: checkbox column 40–48px, header checkbox with indeterminate state, selected
  count in the toolbar.

**Accessibility**

- Real `<table>` with `<caption>` or an accessible name; `scope` on headers.
- Sort and row actions carry names that include the row label.
- Keyboard: arrows move between cells or rows consistently; selection follows focus rules
  documented in the plan.

## Metrics

Anatomy: label (12–13px muted), value (24–32px, tabular), delta (12–13px with sign, arrow,
and color plus text), context (time range or comparison), optional sparkline.

- One comparison per metric. "vs last week" and "vs target" in the same card is noise.
- Do not decorate metrics with gradients, glows, or icons that add no meaning.
- Delta color is never the only signal: pair it with a sign and an arrow.
- Sparkline: no axes, 1.5px line, muted fill, no animation on load.

```text
┌────────────────────────────────┐
│ Accounts at risk               │
│ 128            ▲ 12 (10.4%)    │
│ vs last week · updated 4m ago  │
└────────────────────────────────┘
```

## Charts

Start from the question, then choose the mark:

1. What comparison, trend, distribution, or relationship must be understood?
2. What time range and data state apply?
3. Which mark and encoding answer it with the least cognitive load?
4. What text summary or table gives the same conclusion without the graphic?

Rules:

- One value axis. No dual axes; if two measures differ in scale, use two charts or an index.
- Direct labels beat a legend; show a legend only with more than one series.
- Gridlines: horizontal only, 1px, low contrast. Axis labels 12px.
- Categorical color: at most five series, never color as the only distinction.
- Do not hide axes that establish meaning, and do not imply precision the data cannot support.
- States: loading skeleton shaped like the chart, empty that restates the question, error with
  retry, and a no-data state that is distinct from empty.
- Every chart has a text alternative or an accessible table.
- Mobile: reduce tick count, keep the question and key values, and move detail into a
  disclosure rather than shrinking labels below 12px.

## Review checks

- Row heights, header treatment, and hairlines match one density tier.
- Numbers align, units are consistent, missing values are explicit.
- Every metric names its comparison and time range.
- Every chart has a question, a text alternative, and four states.
- The table or chart still answers its question at 320px.
