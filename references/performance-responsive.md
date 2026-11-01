# Responsive and Performance

A polished interface remains clear while its structure, content, and effects adapt to real devices.

## Responsive contract

Define behavior for desktop, tablet, mobile, and a 320px narrow case. Specify transformations, not only breakpoints:

- navigation becomes a labelled drawer or preserves essential links;
- multi-column content becomes a priority stack;
- secondary table columns move behind disclosure or contained scrolling;
- toolbars group, wrap, or expose an overflow action;
- dialogs fit the viewport and preserve focus return;
- touch targets remain at least 44 CSS px where practical.

Verify reading order, accessible names, no horizontal overflow, orientation changes, 200% zoom, and keyboard access. Mobile is a structural composition, not a smaller desktop screenshot.

## Visual performance

- Reuse project fonts and reserve space before fonts and images arrive.
- Give images dimensions, use responsive sources, and avoid layout shifts.
- Prefer transform and opacity for repeated motion.
- Bound blur, shadow, backdrop filtering, parallax, video, and pointer-driven effects.
- Do not re-render the whole page for high-frequency pointer or scroll events.
- Keep expensive client-only behavior near the region that needs it.
- Provide reduced-motion and reduced-transparency fallbacks.

Record new dependencies, large assets, client-only components, and expensive effects in the plan. A visual effect that is impossible to understand without animation is a quality defect.

## Localization

Text is layout. Before accepting a page that ships more than one locale, run:

```bash
node .agents/skills/component-driven-frontend/scripts/i18n-stress.mjs --dir locales --baseline en
```

It reports missing keys, placeholder drift, empty values, and per-key expansion against the
baseline locale. Strings shorter than 12 characters are exempt from the ratio check, because
translations legitimately expand ("Save" → "Speichern"). Placeholders are compared as sets:
a locale that drops or renames `{count}` fails even when the sentence reads well.

`--pseudo` prints a pseudo-localized copy of the baseline map for injection, so the width
pressure can be screenshotted without translating anything. Use it when testing a layout that
must survive German, Finnish, or Russian.

## Production build budget

Visual quality that ships as 900 KB of JavaScript is not quality. Measure the real build, not the
source:

```bash
node .agents/skills/component-driven-frontend/scripts/bundle-budget.mjs --root . --budget-route 250 --budget-css 80
```

- The tool reads `.next/app-build-manifest.json` (App Router), `.next/build-manifest.json`
  (Pages Router), or falls back to `dist/assets`, `build/static`, `out/_next/static`.
- **Per-route first-load JS** is the sum of the chunks that route lists, shared chunks included.
  That is the number a user pays on first visit; a total across all routes means little. The Next
  manifest does not attribute CSS per route, so the CSS budget applies to the shipped total.
- Sizes are gzip (`KB = 1024 B`), with brotli and raw reported alongside. Budgets apply to gzip.
- Defaults: 250 KB per route, 80 KB shipped CSS. Anything larger needs an explicit reason, not a
  bigger number.
- Budgets can live in the plan: `designIntent.performanceBudget.maxFirstLoadKb` and `maxCssKb`,
  read with `--plan plan.json` so the promise and the build are checked against the same value.

Treat a violation like a contrast failure: it is a design finding. Remove the dependency, split
the route, or move heavy work to the server before raising the budget.

## Budget questions

Before implementation, answer:

- What new package or asset is added, and why?
- Which region owns the interaction and its state?
- How many repeated animated elements can exist?
- What happens on slow network, low-power devices, and disabled motion?
- Does loading reserve the same layout space as the resolved content?

Use project performance tooling when available. If no measurements were run, report the performance review as an assumption rather than a completed benchmark.
