# Visual QA

Visual QA is a rendered review against the approved Design Intent, selected Style Direction, content model, and responsive contract. A passing build is not visual approval.

## Required review matrix

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

When the plan declares `emotionalIntent.qaQuestions`, those questions join this rendered review.

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

## Reporting

Report engineering verification separately from rendered verification. Include the `Emotional checks` line only when the plan declares emotional intent; omit the line entirely otherwise, matching the emotional review above:

```text
Engineering checks: lint / typecheck / build
Rendered checks: desktop / tablet / mobile / 320px / 200% zoom / keyboard / reduced motion
Emotional checks: observations per declared question
Visual QA status: complete | incomplete
Open issues: ...
```

If desktop and mobile output were not actually inspected, state exactly:

```text
Visual QA incomplete
```
