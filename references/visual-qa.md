# Visual QA

Visual QA is a rendered review against the approved Design Intent, selected Style Direction, content model, responsive contract, and declared success criteria. A passing build is not visual approval.

For critique of a supplied screenshot, inspect the available viewport and state. Anchor the recommendation to a visible detail and describe the follow-up check. For a surface you can render, compare the same viewport before and after the revision against the planned first read, sequence and tradeoff. Record the files or views actually inspected.

The checklist accepts a component plan or a standalone JSON visual brief as described in [the skill entry point](../SKILL.md). Generate it before looking at a runnable page:

```bash
node .agents/skills/component-driven-frontend/scripts/visual-qa-plan.mjs --file <plan.json> --out qa.md
```

It expands every region, state, viewport, accessibility contract, data question, success criterion, contrast pair, and emotional question into checkboxes, then ends with the report template below.

The repeatable half of the review can be automated without installing anything:

```bash
node .agents/skills/component-driven-frontend/scripts/visual-qa-plan.mjs --file <plan.json> --root . --emit playwright --out qa.spec.ts
```

At each viewport the spec checks document and region overflow, presses Tab until the primary action receives focus, and runs axe when the project has `@axe-core/playwright` installed. Set `designIntent.primaryAction` to the exact accessible name of one visible button or link on the route. A reading or exploration brief without a primary control omits the primary-action test. A declared primary action still gets a keyboard test. Older plans without an action and scans without an installed axe package are reported as skipped. An unreachable declared action or an axe violation fails the test. Multiple routes with different actions need route-specific locators in the emitted spec. Region assertions expect `data-qa-region="<id>"` on each wrapper.

The spec also captures reduced motion and leaves async-state geometry tests skipped until the project supplies fixtures. Use the checklist to review visual hierarchy, state feedback, and zoom.

## Contrast from tokens

Decide contrast before looking at the page, so a failure is a finding rather than a surprise:

```bash
node .agents/skills/component-driven-frontend/scripts/check-contrast.mjs --root . --list
node .agents/skills/component-driven-frontend/scripts/check-contrast.mjs --root . --pairs 'foreground:background,muted-foreground:background,primary:background' --json
```

`--list` derives the pairs the theme implies (`*-foreground` on its base surface, text on each surface, borders as UI boundaries). Text needs 4.5:1, large text and UI boundaries 3:1; `--level AAA` raises text to 7:1. The checker accepts hex, `rgb()`, `hsl()`, `oklab()`, and `oklch()`; resolve `color-mix()` to a concrete value first, and composite translucent surfaces over their real backdrop. A failing pair is a design finding to fix, not a threshold to lower.

A border pair that fails 3:1 matters only when the border is the only thing defining a control's boundary; decorative hairlines are exempt from non-text contrast. Record that decision in the review instead of silently ignoring the row.

## Visual regression baseline

The generated spec writes `qa/*.png`. Freeze an approved review as the baseline, then compare every later run against it:

```bash
node .agents/skills/component-driven-frontend/scripts/visual-regression.mjs --baseline qa/baseline --current qa --update
node .agents/skills/component-driven-frontend/scripts/visual-regression.mjs --baseline qa/baseline --current qa --threshold 0.02
```

- A capture with a different canvas size always fails; a pixel ratio alone would understate a reflow.
- `--threshold` is the share of changed pixels ignored as noise (default 2%). `--tolerance` is the per-channel delta treated as noise (default 12 of 255).
- Each failure reports a bounding box and a 64-bit difference hash, so "same layout, different color" reads differently from "different page".
- `missing` means a baseline capture has no current counterpart; `new` means a capture has no baseline. Neither is silently accepted.
- Run `--update` only after the review is approved. It copies, never deletes, and lists stale baseline files for you to remove deliberately.

## Implementation review matrix

Inspect the rendered page at:

- desktop: typically 1440 × 900;
- tablet: a representative intermediate width;
- mobile: typically 390 × 844;
- narrow: 320px wide;
- 200% browser zoom;
- reduced motion, and reduced transparency when material effects are used.

For each viewport, verify:

- the primary task and hierarchy remain obvious;
- content wraps without clipping or misleading truncation;
- no page-level horizontal overflow exists;
- navigation, tables, toolbars, dialogs, and charts transform as specified;
- touch targets are practical and actions remain reachable;
- loading, empty, error, partial, offline, and success states preserve context where applicable.

## Interaction and accessibility

Exercise the keyboard path from the document start. Check native semantics, labels, `aria-current`, form errors, live-region announcements, focus-visible treatment, dialog focus return, and escape behavior. Do not accept motion, color, blur, or position as the only state signal. Check contrast in the actual rendered material, including fallback surfaces.

## Data and content review

Use representative long and short labels, localized numbers/dates, empty collections, errors, and unavailable values. Chart regions must answer their documented question and expose an equivalent text summary or table. Confirm that important actions remain visible at 320px and 200% zoom.

## Material and performance review

Effects are optional. If glass, blur, shadows, parallax, video, or pointer-driven effects exist, verify that they have a bounded area, an opaque fallback, readable contrast, and a reduced-transparency path. Confirm that repeated motion uses transform/opacity where practical and does not require animation to understand the content. Record unmeasured performance claims as assumptions, not benchmark results.

## Emotional review

When a brief includes emotional intent, the generated review carries its source, intended experience, rationale, concrete design choices, treatments to avoid and review questions. Revisit the same moment at the same width. Describe the cue you can see or operate, and reserve claims about how people felt for an observed session.

When `emotionalIntent.source` is `user-provided`, those questions are mandatory: answer each against the user's stated feeling rather than a feeling you inferred. A failed answer is still a design finding, not an automatic build failure.

Record what is observed for each one—not a score, and not a claim that the feeling was achieved. Run these default checks alongside them:

```text
- Does the first viewport establish one clear focal point quickly?
- Can the user understand the next action without relying on decoration?
- Does the completed interaction preserve position, context, and confirmation?
- Does the intended feeling survive reduced motion, removed gradients, and opaque material fallbacks?
- Would this feeling still read as specific to this product if pasted onto an unrelated site?
```

A failed emotional question is a design finding, not an automatic build failure. Report it alongside the viewport and state results rather than in place of them, and leave this section out when the plan declares no emotional intent.

## Reporting an implementation review

For a screenshot critique, finish with the observed issue, proposed revision and follow-up check at the supplied size. For a completed implementation, report engineering verification separately from rendered verification. Include the `Emotional checks` line only when the plan declares emotional intent; omit the line entirely otherwise, matching the emotional review above. Include `Success criteria` whenever the plan declares them, and answer each one:

```text
Engineering checks: lint / typecheck / build
Rendered checks: desktop / tablet / mobile / 320px / 200% zoom / keyboard / reduced motion
Emotional checks: observations per declared question
Success criteria: answered per declared criterion
Visual QA status: complete | incomplete
Open issues: ...
```

An unanswered success criterion makes the review incomplete even when every viewport looks fine.

For a full page implementation whose desktop or mobile render is still uninspected, report:

```text
Visual QA incomplete
```
