---
name: component-driven-frontend
description: Use when designing, critiquing, or implementing a web interface where content hierarchy, composition, visual direction, 3D interaction, motion, or responsive behavior needs judgment. Applies to product tools, portfolios, editorial pages, and existing design systems across frontend stacks.
---

# Component-Driven Frontend

Start with the visitor’s purpose and the material they have to work with. A support lead deciding whom to call, an editor selecting a photograph, and a reader following an argument need different first screens.

## Choose the deliverable

| Request | Work to do | Finish with |
| --- | --- | --- |
| Design from a brief | Identify the audience decision or reading experience. Arrange representative content in sketches when the direction is open. | The selected composition, its tradeoff, and how it changes on a narrow screen. A design brief can end here. |
| Critique an existing page or screenshot | Trace the visible reading order. Locate the specific point where it diverges from the intended experience. Work within the supplied viewport and state. | A prioritized observation, its effect on the visitor, a concrete revision, and a way to check it. For feedback-only requests, deliver the critique in chat. |
| Implement or revise | Inspect the project, retain the approved direction, and implement using its stack, tokens and components. Develop a composition first if the brief is open. | The working change and evidence from the relevant rendered viewport and interaction. |

For a bounded visual edit, inspect the affected element and check its state in context. A tone correction can be just as small: change the exact line, crop, pause or feedback that makes the encounter feel mechanical. Use the project’s normal workflow for exact-value edits and logic defects. The skill’s component-plan scripts target React component work. Design and critique require only the brief or visible surface.

## Make the editorial decision

1. **Name one purpose.** Is the visitor here to act, understand, or explore? Write the intended result in the visitor’s language. “Identify the account that needs a call and open its details” and “notice how the distance to the subject changes across three photographs” lead to different layouts. Include a primary control when the task calls for one.
2. **Edit the content.** Put the actual headline, image, account, quotation or number that earns first position on the canvas. Identify what explains it, what can wait, and what can be removed. Preserve provenance and mark invented sample data. With missing material, state a narrow assumption or ask for the asset that changes the decision.
3. **Compose before choosing components.** For an open, page-level brief, show two small first-viewport sketches using the same copy, data and pictures. Change the reading structure: one image versus a contact sheet, a decision beside its evidence versus a comparison table. Record what the eye meets first, where it goes next, and what the arrangement sacrifices. Select the one that serves the brief. An approved reference or localized change can go straight to refinement. Use [composition and critique](references/composition-and-critique.md) for sketch formats and worked judgments.
4. **Resolve the narrow layout.** Choose the next-best crop, line break, column order or disclosure for the same material. Keep essential information and the relationship between image and caption, evidence and decision, or heading and paragraph.
5. **Review what was rendered.** Compare the intended reading order with a first viewport at its actual size. During implementation, identify one consequential mismatch, revise it, and revisit the same viewport and content. In a feedback-only critique, describe that follow-up as a proposed check. Record the visible difference or the reason to retain the first version. Qualify a hypothesis about reader speed or preference until it has been tested with people.

Explicit user requirements, approved design, brand and accessibility constraints guide each decision. Where the brief is open, make a defensible choice from the content. Ask for preferences when the choice meaningfully changes the outcome. Use [design intent](references/design-intent.md) for user-stated feelings and [visual language](references/visual-language.md) when a product needs a reusable system.

## Size the type and the view together

Choose the first read, section heading, body and metadata using actual copy. Pair each role with the space it needs. A reading column needs a comfortable line length, a comparison table needs room for the longest value, and a dialog needs room for its action at larger text sizes. On a wide screen, cap the reading measure. At intermediate widths, regroup supporting information. On a phone, stack or disclose secondary content and keep labels legible and controls easy to hit. Check the longest title, a wrapped button and an open detail view at desktop, tablet, phone and 320px widths, then enlarge the text. Use the [type and spacing guidance](references/premium-craft.md#set-the-type-scale) for starting proportions.

## Give the first draft a human tone

Start here even when the brief says nothing about mood. Look at the moment a person meets the page. What are they carrying into it, and what could the design give them here? A supervisor opening a blocked delivery may want to know who is already helping. A reader turning the page after a quiet line may want a little space to stay with it.

Start with one detail that belongs to the material. Put the ongoing work and its owner beside the blocker. Give a portrait enough space to meet the subject’s eyes before revealing the next image. Let a short line of dialogue stand on its own where it occurs in a story. Try the detail in the actual page and experience the transition into and out of it, including at phone width. Read the copy aloud. Cut any line whose only job is to announce how the visitor ought to feel.

Give the main subject room. Start with the content and its action on a plain canvas. Use a close gap for a label and its value, a wider pause between decisions, and shared alignment for supporting information. During review, try removing one repeated explanation or nested surface. Keep the simpler version when the next step remains clear. On a phone, let optional context open on demand; keep errors, essential instructions and the main action visible.

Use the product palette, glass and motion selectively. A soft gradient can draw the eye to the subject. Reserve glass for an actual overlay and let motion accompany the action that opens it. A photograph or a line of type can carry the opening on its own. Preserve opaque and reduced-motion alternatives. See [material and motion](references/visual-language.md#use-glass-as-a-material).

When revising a visual the user prefers, keep the reference beside a still frame at the same size. Identify the outline, open space and surface detail that carry its character, then check them again after changing the renderer or adding motion.

For a new product, derive the object from something its users handle and the motion from something they do. Hide the logo and imagine swapping the scene into the last project. If it still fits equally well, revisit the geometry or the action that drives it.

Use depth when it reveals something about the product. Identify what the visitor sees in the first pose and what becomes clear after a turn, selection or cutaway. Choose the lightest medium that preserves that relationship. For a 3D viewer, procedural model, or motion-led hero, use the [spatial design guide](references/spatial-design.md) to shape the geometry, camera, material, controls and static fallback.

For framed controls, start with softly rounded corners and a larger radius on the enclosing surface. A field on a writing line can take its shape from the page. Keep radio indicators circular. For an existing brand, use its shape tokens. See the [radius scale and radio pattern](references/visual-language.md#build-shape-rhythm).

Design the product’s controls as a family. Start with a cue already present in the product, such as the ruling on a manuscript or the alignment of a signal readout. Work through an actual action, editable field and choice or setting where the task uses them. Decide what they share and how the primary action, text entry and selected state each read at a glance. Compare their silhouettes and feedback with the accent color temporarily removed. Use the [control family guidance and working examples](references/visual-language.md#derive-a-control-family) for the detailed pass.

Design the label, icon and hit area as one control. An arrow can suggest movement or carry the product’s visual character. Fit its direction, stroke, optical alignment, spacing and interaction to the action at the rendered size. A quieter sibling can use a smaller mark or a text label alone. Check the [action label and icon guidance](references/iconography-and-imagery.md#choose-the-action-label-first) when selecting or reviewing controls.

Treat a request for “more feeling” as permission to exercise judgment. Preserve any feeling the user actually names. When choosing the particular mood yourself, record it as an inference and revise it if the material points elsewhere. On a small change, a sentence explaining the choice and a before/after view or interaction are enough. Use the existing [emotional intent fields](references/design-intent.md#derive-emotional-intent) when a plan or generated review is useful.

## Implement in the host project

- **HTML, Vue, Svelte or another frontend stack.** Follow the project’s native patterns and tests. A static feature may consist of semantic sections, figures and typography alone. Inspect the available sources before naming a component.
- **React component work.** Follow the [component implementation route](references/component-implementation.md) for project inspection, source verification, the version 1 component plan, accessibility, dependency policy and rendered CI checks. Keep the existing foundation. A migration or destructive replacement needs specific authorization.
- **Rendered QA.** Apply [visual QA](references/visual-qa.md) to the surface actually available. With a runnable page, check desktop and mobile and exercise its real controls. With a single supplied screenshot, report observations at that size and label other behavior as unverified.

A short visual brief can be written in prose. When a generated checklist helps, give `visual-qa-plan.mjs` a JSON file with `designIntent.product`, `coreTask`, `purpose` (`act`, `understand`, or `explore`), and optionally `composition` containing `firstRead`, `readingOrder` and `tradeoff`. The same optional fields work in existing component plans. Run from the skill directory:

```bash
node scripts/visual-qa-plan.mjs --file brief.json
```
