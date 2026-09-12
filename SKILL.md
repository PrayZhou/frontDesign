---
name: component-driven-frontend
description: Use when designing or implementing React interfaces that require component-system or visual-design judgment, such as reusing a design system, selecting UI library or Registry components, or turning a product brief into a polished page; do not use for logic-only React bugs or isolated one-line style edits.
---

# Component-Driven Frontend

Turn product intent into a source-verified component plan, then implementation that fits the project. Do not treat novelty as design quality.

## Route boundary

Do not use this workflow for logic-only React bugs such as reducer or state-transition defects. Do not use it for an isolated one-line style edit whose exact value and target are already specified, such as changing one button to red, when no component-system or design judgment is needed.

Use a **lightweight path** only when a bounded edit genuinely requires component-system or design judgment—for example choosing a semantic color token, preserving a component variant, or checking an accessibility state. Inspect only the affected component and tokens, state the narrow intent, implement the edit, and run its relevant check. Enter the full route below only if the task expands into component selection, composition, or page-level visual direction.

## Authority and invariants

Apply evidence in this order: explicit user requirements; brand and accessibility rules; Figma, Code Connect, or other supplied design truth; the project's current tokens, components, and foundation; verified official source material; this skill's defaults. Stop and surface contradictions instead of silently overriding a higher authority.

Use **exactly one foundation design system and at most one visual enhancer**. Keep an existing foundation. Do not import an overlay, form, or other primitive from a second foundation just because it looks better. Charts, icons, tables, motion engines, and notification utilities are capability libraries, not foundations or visual enhancers; still account for them as dependencies.

Never assume a named component exists. A project file, configured registry result, callable MCP result, or current official source must verify it.

## Route

The machine-readable structure contract is [component-plan.schema.json](schemas/component-plan.schema.json). It covers JSON shape and enums; the runtime validator remains authoritative for foundation/source policy, capability dependencies, lifecycle completeness, and source verification. Use [visual reference cards](references/visual-reference-cards.md), [research ingestion](references/research-ingestion.md), [content and data](references/content-and-data.md), and [responsive/performance](references/performance-responsive.md) to improve visual quality without copying unverifiable galleries.

1. Inspect before choosing:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/inspect-project.mjs --root . --json
   ```

   If no repository is available, label the stack and foundation as assumptions and defer exact component names. Read [source adapters](references/source-adapters.md) when choosing where to look.

2. Read [design intent](references/design-intent.md), [visual language](references/visual-language.md), and [research ingestion](references/research-ingestion.md). Resolve explicit user/brand evidence before using Skill defaults. When the brief does not already prescribe a visual direction, propose 2–4 materially different Style Directions, compare their strengths and tradeoffs, and select exactly one before continuing. Derive one visual language from that selection; never combine multiple directions in one implementation. Then briefly output:

   ```text
   Design Intent
   Product: ... | Audience: ... | Core task: ...
   Visual direction: ... | Density: ... | Principles: ...
   ```

   Emotional intent is optional. When the brief asks for feeling, atmosphere, or immediate appeal—or when the page performs brand expression, first-visit conversion, narrative content, or product demonstration—derive it with `Derive emotional intent` in [design intent](references/design-intent.md) and also output:

   ```text
   Emotional Intent
   Goal: ... | Rationale: ...
   Carriers: ... | Avoid: ...
   QA questions: ...
   ```

   Label an inferred goal `Assumption — user may override`. Emotional intent never authorizes a second foundation, an extra enhancer, or decorative effects that the content hierarchy does not justify.

3. Before components, apply only relevant [reference cards](references/visual-reference-cards.md) and define content realism, token rhythm, responsive transformations, data questions, and effect/performance boundaries. Read [content and data](references/content-and-data.md) and [responsive/performance](references/performance-responsive.md). Map each page region to capabilities before names. Read [component selection](references/component-selection.md), then query the project and only relevant verified sources:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source project --query 'data table' --root . --json
   node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source shadcn --query 'dialog' --root . --json
   node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source magicui --query 'hero' --root . --json
   node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source aceternity --query 'background' --root . --json
   ```

   Treat `requires-command` as an unexecuted next action, not evidence of availability.

4. Produce the full JSON contract described in [component selection](references/component-selection.md), plus this concise summary:

   ```text
   Component Plan
   Foundation: ... | Enhancer: .../none | New dependencies: .../none
   Region -> need -> chosen source/component -> content/states -> responsive/a11y/performance notes
   Rejected/custom: candidate and reason, or none
   ```

5. Validate before implementation:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/validate-component-plan.mjs --file <plan.json> --strict
   # Add --root <project> or --verify-sources to verify project-sourced components.
   ```

   Fix every error and warning. Do not implement an invalid plan.

6. Implement with the verified API and existing tokens. Read [composition patterns](references/composition-patterns.md) for the applicable page type. Apply the approved shape, material, and interaction systems without turning every region into the same container. Inspect generated changes before accepting them.

7. Run engineering checks and rendered review using [visual QA](references/visual-qa.md). Compare desktop and mobile output against the Design Intent and Component Plan, then iterate.

## Stop points

Stop for user authorization before destructive overwrite, replacing local component files, or migrating the foundation/design system. Stop component selection when required source truth is unavailable; report what was and was not verified rather than fabricating a candidate. Stop the completion claim when rendered desktop and mobile output has not been inspected; report visual QA as incomplete even if lint, tests, or build pass.

Gradients, glass, Bento layouts, beams, glows, and animation are optional techniques. Use one only when the Design Intent and content hierarchy justify it—never as a default synonym for “premium.”
