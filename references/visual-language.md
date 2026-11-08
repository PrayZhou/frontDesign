# Visual Language

Turn an approved visual direction into a coherent shape, material, and interaction system. Use shape, light and motion to establish what the visitor sees first and what responds to input.

## Resolve the selected direction

Style exploration may contain several candidates, but implementation must derive one visual language from the selected direction. The selected profile is planning metadata: it constrains shape, material, and interaction decisions but does not generate runtime code or authorize a second foundation. Record the selected direction's evidence and boundaries before resolving the three systems below.

## Resolve three systems

Before styling, make these decisions traceable to the Design Intent:

| System | Decide | Evidence of coherence |
|---|---|---|
| Shape | Radius tiers, edge character, nesting, and where no container is needed | Related controls share a tier; outer containers are not less rounded than their children |
| Material | Opaque/translucent surfaces, depth count, backdrop, border, shadow, and fallback | Each material marks a real layer or interaction boundary |
| Interaction | Hover, press, focus, scroll, and state-transition behavior | Motion communicates response, relationship, or continuity |

For an open brief, establish the focal content and the space around it first. Pick a focal gradient where light helps direct the eye. Glass can wait for an overlay and motion for a change of state. Leave an effect out when the composition already reads clearly. Choose the hues from the material or brand. Position the lightest and darkest stops around the actual text, then check contrast at both extremes. Let an explicit brief, existing brand or accessibility preference determine any adaptation.

## Carry the emotional goal

Only when the plan declares `designIntent.emotionalIntent`: the selected style direction records `emotionalEffect`, stating how its shape, material, and interaction choices produce the declared feeling. Candidate directions do not need it—exploration metadata stays lightweight.

A region may declare `emotionalRole` plus an optional `emotionalContribution`, but only where it carries or shifts the page's feeling:

| `emotionalRole` | Use for |
|---|---|
| `focal` | The one region that must land the feeling first |
| `supporting` | Regions that reinforce it without competing |
| `neutral` | Regions that stay quiet so the focal region reads |
| `transition` | Regions that change pace or hand off between sections |

At most one region per page should be `focal`; a page of focal regions has no focus. Leave the field off regions that simply do their job. Express the feeling through the shape, material, and interaction systems already approved above—not through new effects added for emotional reasons.

When `emotionalIntent.source` is `user-provided`, the selected direction's `emotionalEffect` must state how its shape, material, and interaction satisfy the user's own words, and every candidate you reject for conflicting with them must carry that reason in its `tradeoffs`. Do not silently drop a conflicting candidate.

## Derive a control family

Look first at the host product’s controls, type, surfaces and focus treatment. For a new direction, choose a cue from the actual material or workflow. Carry that cue through geometry, type, spacing or feedback where it helps someone act. Keep sufficient visual separation between the action, the editable value and the control that changes a setting.

| Role | Design decision | Check with real content |
| --- | --- | --- |
| Button or action link | Decide which action deserves a filled surface. Align any mark to its label and let its movement follow the action. | Compare primary and secondary actions together. Try keyboard focus, press and any supported pending or disabled state. |
| Text or search input | Place a persistent label, choose a boundary that reads as editable and give the value room. Use type appropriate to the material, including tabular digits for instrument logs. | Enter, edit and clear a realistic value. Check empty, focused and filled states. Associate feedback with the field when validation applies. |
| Setting or choice | Use a switch for an immediate on/off setting, a radio group for exclusive options, or tabs for switching panels. Choose a track, thumb or selection mark that fits the surface. | Expose the selected state through position, shape or text as well as color. Keep the name stable when a switch changes. Test Space on the switch, arrow keys on radios, and a complete state change with reduced motion. |

A ruled search field can suit a reader marking a manuscript. A monospaced field can suit an engineer searching a log. Both need the same keyboard behavior, a visible focus indicator and an unmistakable result when the query matches nothing.

Review the controls together at actual size and at phone width. Briefly remove the accent color: the field should still look editable, the selected position should still read, and the strongest action should still lead. If the controls could be moved unchanged between unrelated products, revisit the component whose proportions or feedback have the weakest connection to its task.

## Build shape rhythm

For a product that benefits from softly rounded surfaces and has no established shape tokens, try these proportions. A ruled editorial field or compact instrument latch can derive its edge directly from the material. Check the result on a real control with its label and focus ring visible.

| Element | Starting radius | How to use it |
| --- | --- | --- |
| Buttons, text fields and menu items | 10–12px | Use the same token for controls of similar height. |
| Cards, notices and menus | 16–20px | Give a grouped surface a little more curve than its nested controls. |
| Dialogs and large framed surfaces | 20–24px | Use the larger tier where there is enough padding to follow the curve. |

**Radio buttons.** Use native single-choice inputs with a shared name and clickable labels. Keep the native circular indicator and use `accent-color` to pick up the brand color. For example:

```html
<fieldset>
  <legend>Contact me by</legend>
  <label><input type="radio" name="contact" value="email" checked> Email</label>
  <label><input type="radio" name="contact" value="phone"> Phone</label>
</fieldset>
```

If the project already supplies a custom radio, keep its accessible input and keyboard behavior. Give both the outer ring and the selected dot equal inline and block dimensions, a 50% radius, and room to keep their shape beside a wrapping label. Verify that clicking the label selects the option, arrow keys move the selection, and keyboard focus is visible.

Avoid boxed-page syndrome:

- Group with spacing, alignment, or a shared background before adding another border.
- Prefer one outer boundary plus internal rhythm over a border around every row.
- Mix contained and uncontained regions so the page has cadence.
- Retain square or precise edges when they communicate data density, tooling, or brand character.

## Use glass as a material

Glass works only when there is visible depth behind it and the surface represents a layer. Use it for a focused preview, floating navigation, overlay, or elevated control group; keep ordinary reading content opaque or uncontained.

A complete glass surface defines:

1. A translucent semantic surface color derived from project tokens.
2. A backdrop with restrained color or luminance variation.
3. Blur and optional saturation within a small shared scale.
4. A low-contrast edge plus one subtle inner highlight.
5. A shadow that separates depth without turning every panel into a glowing tile.
6. An opaque fallback when backdrop filtering is unavailable.

Keep text and controls above a stable contrast floor; never depend on the background image to make copy readable. Avoid stacking several blurred ancestors, animating large blur regions, or applying glass to dense scrolling tables. Use `@supports` or an equivalent fallback strategy, and check reduced transparency/high-contrast platform behavior when the product targets it.

## Design interaction and motion

Inventory behavior by region before adding animation:

| Trigger | Useful response |
|---|---|
| Hover | Reveal affordance, depth, direction, or related detail |
| Press | Immediate compression, displacement, or state acknowledgment |
| Focus-visible | Non-motion outline or contrast change that survives reduced motion |
| Scroll/viewport | Reveal sequence, connection, or progress when it explains page structure |
| Async/state change | Preserve spatial continuity between pending, progress, result, and error |

A whole-section fade is an entrance treatment, not sufficient interaction design for a core product demonstration. Product previews should visibly connect input, current work, progress, and output. Repeated cards may stagger only when order matters. Keep motion on transform and opacity where possible, and avoid parallax or pointer tilt on touch input.

Every animated behavior defines a reduced-motion result. Preserve state, hierarchy, focus, and feedback while removing travel, parallax, continuous loops, or spatial disorientation. Keyboard and touch users must receive the same operational result without hover.

## Review gates

Before visual QA, answer:

- Can each radius tier and container boundary be explained by hierarchy?
- Does each glass surface have a backdrop, fallback, and readable content?
- Is at least one major region grouped without another decorative box?
- Does every operable region expose hover/press/focus behavior appropriate to its input modes?
- Does the core product interaction show state continuity beyond a generic fade?
- Do mobile, reduced-motion, and no-backdrop-filter states preserve the same task and reading order?

If an effect cannot pass these questions, simplify or remove it.
