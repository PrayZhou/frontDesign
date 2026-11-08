# Component implementation

Use this route for a React implementation that needs component selection or a multi-region component plan. Carry the chosen composition and content from the design brief into the plan. For a bounded change use the lightweight route in the [skill entry point](../SKILL.md).

## Authority and invariants

Apply evidence in this order: explicit user requirements; brand and accessibility rules; Figma, Code Connect, or other supplied design truth; the project's current tokens, components, and foundation; verified official source material; this skill's defaults. Stop and surface contradictions instead of silently overriding a higher authority.

Use **exactly one foundation design system and at most one visual enhancer**. Keep an existing foundation. Do not import an overlay, form, or other primitive from a second foundation just because it looks better. Charts, icons, tables, motion engines, and notification utilities are capability libraries, not foundations or visual enhancers; still account for them as dependencies.

Never assume a named component exists. A project file, configured registry result, callable MCP result, or current official source must verify it.

## Route

The machine-readable structure contract is [component-plan.schema.json](../schemas/component-plan.schema.json). It covers JSON shape and enums; the runtime validator remains authoritative for foundation/source policy, capability dependencies, lifecycle completeness, and source verification. Use [visual reference cards](visual-reference-cards.md), [research ingestion](research-ingestion.md), [content and data](content-and-data.md), and [responsive/performance](performance-responsive.md) to improve visual quality without copying unverifiable galleries.

Command paths below assume the skill is installed at `.agents/skills/component-driven-frontend/`. When running from this repository, drop that prefix and use `scripts/<name>.mjs`.

1. Inspect before choosing:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/inspect-project.mjs --root . --json
   ```

   If no repository is available, label the stack and foundation as assumptions and defer exact component names. Read [source adapters](source-adapters.md) when choosing where to look.

   When the project ships supplied brand assets, extract the palette instead of guessing it:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/brand-colors.mjs --root . --json
   ```

   It reads the theme tokens with their contrast against the background token and the dominant colors of PNG assets, then flags brand colors that have no token. Add a role, or record why the color is used directly.

   When the work spans more than one page, inventory the route map before designing the shell:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/inspect-shell.mjs --root . --json
   ```

   When outside references would settle a composition question or the user asks for inspiration, run the inspiration channel and read [inspiration search](inspiration-search.md):

   ```bash
   node .agents/skills/component-driven-frontend/scripts/inspiration-search.mjs --channel inspiration --brief '<brief>' [--emotion '<stated feeling>'] --json
   ```

   Pass `--emotion` when the user has already named the feeling they want.

   Execute the searches it plans with your web tools, then normalize what you actually captured into `designIntent.evidence`. A source that was not retrieved is not evidence, and no source may be copied.

2. Read [design intent](design-intent.md), [visual language](visual-language.md), [premium craft](premium-craft.md), and [research ingestion](research-ingestion.md). Carry forward the selected first-viewport sketch, its reading order and tradeoff. A supplied design can serve as the selected composition. Keep its existing constraints. Use `designIntent.purpose` and `coreTask` to record what the visitor should accomplish or understand. For an action-led page, record the visible control’s accessible name in `primaryAction`. Name one to three outcomes a rendered review can investigate.

   Reuse the project’s type tokens. If the project lacks a scale and the composition needs one, derive a starting scale from a ratio:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/type-scale.mjs --body 16 --ratio 1.25 --format css
   ```

   Declare the color pairs the page must verify in `designIntent.contrastPairs`; the validator fails any pair below its target before implementation starts.

   Emotional intent is optional, but when it appears the user's own words outrank your inference. When the brief leaves mood open, use the actual copy, imagery and audience to choose an appropriate starting point. Ask about mood when a choice materially changes the composition and the available evidence leaves the choice unresolved. Then derive it with `Derive emotional intent` in [design intent](design-intent.md) and output:

   ```text
   Emotional Intent
   Source: user-stated | inferred
   Goal: ... | Rationale: ...
   Carriers: ... | Avoid: ...
   QA questions: ...
   ```

   A user-stated feeling is explicit user evidence and a hard constraint: record `designIntent.emotionalIntent.source: "user-provided"` and keep the user's words in `userPhrase`, and do not label it `Assumption — user may override`. Reject any Style Direction or component candidate that conflicts, recording the reason in that direction's `tradeoffs` or the region's `rejectedCandidates`. An inferred feeling stays soft: record `source: "inferred"` and label the goal `Assumption — user may override`; it orders and justifies but does not reject.

   Emotional intent never authorizes a second foundation, an extra enhancer, or decorative effects that the content hierarchy does not justify.

3. Before components, apply only relevant [reference cards](visual-reference-cards.md) and define content realism, token rhythm, responsive transformations, data questions, and effect/performance boundaries. Read [content and data](content-and-data.md) and [responsive/performance](performance-responsive.md); multi-page work also reads [app shells](app-shells.md) before any region is chosen. Map each page region to capabilities before names. Read [component selection](component-selection.md), then query the project and only relevant verified sources:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source project --query 'data table' --root . --json
   node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source shadcn --query 'dialog' --root . --json
   node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source magicui --query 'hero' --root . --json
   node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source aceternity --query 'background' --root . --json
   ```

   Treat `requires-command` as an unexecuted next action, not evidence of availability. When the candidate space is still open, run the component channel first and read [inspiration search](inspiration-search.md) for the tiered source list:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/inspiration-search.mjs --channel components --brief '<brief>' --json
   ```

   When `designIntent.emotionalIntent.source` is `user-provided`, every candidate you reject for conflicting with the stated feeling must appear in the region's `rejectedCandidates` with that reason.

4. Produce the full JSON contract described in [component selection](component-selection.md), plus this concise summary:

   ```text
   Component Plan
   Foundation: ... | Enhancer: .../none | New dependencies: .../none
   Region -> need -> chosen source/component -> content/states -> responsive/a11y/performance notes
   Rejected/custom: candidate and reason, or none
   ```

5. Validate before implementation:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/validate-component-plan.mjs --file <plan.json> --strict
   # Add --root <project> or --verify-sources to verify project-sourced components, the
   # declared foundation and enhancer, and the install state of listed dependencies.
   ```

   Without a project root, foundation, enhancer, and dependency claims are unverified rather than assumed correct.

   Fix every error and warning. Do not implement an invalid plan.

   When you revise an approved plan, diff it before accepting the change so drift is visible instead of silent:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/plan-diff.mjs --before old-plan.json --after plan.json --fail-on foundation,enhancer,dependencies
   ```

6. Implement with the verified API and existing tokens. Read [composition patterns](composition-patterns.md) for the applicable page type, and take the type scale, spacing rhythm, surface layers, and motion timing from [premium craft](premium-craft.md). When the page carries tables, charts, metrics, icons, or asynchronous states, also read [data display](data-display.md), [iconography and imagery](iconography-and-imagery.md), and [state compositions](state-compositions.md). Apply the approved shape, material, and interaction systems without turning every region into the same container. Inspect generated changes before accepting them.

7. Generate the rendered review from the approved plan, then run engineering checks and the rendered review using [visual QA](visual-qa.md):

   ```bash
   node .agents/skills/component-driven-frontend/scripts/visual-qa-plan.mjs --file <plan.json> --root . --out qa.md
   node .agents/skills/component-driven-frontend/scripts/visual-qa-plan.mjs --file <plan.json> --root . --emit playwright --out qa.spec.ts --route / --route /settings
   node .agents/skills/component-driven-frontend/scripts/check-contrast.mjs --root . --pairs 'foreground:background,muted-foreground:background' --json
   node .agents/skills/component-driven-frontend/scripts/visual-regression.mjs --baseline qa/baseline --current qa --threshold 0.02
   node .agents/skills/component-driven-frontend/scripts/i18n-stress.mjs --dir locales --baseline en
   node .agents/skills/component-driven-frontend/scripts/bundle-budget.mjs --root . --plan <plan.json>
   node .agents/skills/component-driven-frontend/scripts/verify.mjs --plan <plan.json> --root .
   ```

   `qa.md` expands every region, state, viewport, accessibility contract, data question, success criterion, contrast pair, and emotional question. `--emit playwright` writes an optional spec skeleton that relies on the project's own Playwright install; `--route` repeats once per page in the shell, and `data-qa-region` attributes make its region assertions runnable. Contrast is decided from token values rather than by eye: fix failing pairs before claiming the page is done. After an approved review, refresh the baseline with `visual-regression.mjs --update`; a changed canvas size always fails, and a capture with no baseline is reported as new. When the page is localized, `i18n-stress` checks missing keys, placeholder parity, and expansion against the baseline locale. Finally, measure the production build: per-route first-load JS and shipped CSS are compared with the budget declared in the plan, and a violation is a design finding. `verify.mjs` runs the close-out checks in one pass — plan validation, build budget, localization, and regression — and reports an absent optional input as skipped. In CI, pass the applicable check names with `--require bundle,regression,i18n` to fail the job if a required input is missing. Work through the checklist, answer each success criterion explicitly, and compare output against the Design Intent and Component Plan before iterating.

## Stop points

Stop for user authorization before destructive overwrite, replacing local component files, or migrating the foundation/design system. Stop component selection when required source truth is unavailable; report what was and was not verified rather than fabricating a candidate. Stop the completion claim when rendered desktop and mobile output has not been inspected; report visual QA as incomplete even if lint, tests, or build pass.

Gradients, glass, Bento layouts, beams, glows, and animation are optional techniques. Use one only when the Design Intent and content hierarchy justify it—never as a default synonym for “premium.”
