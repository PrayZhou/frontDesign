# Visual Language

Turn an approved visual direction into a coherent shape, material, and interaction system. Treat rounded corners, glass, glow, and motion as hierarchy tools—not a style preset.

## Resolve the selected direction

Style exploration may contain several candidates, but implementation must derive one visual language from the selected direction. The selected profile is planning metadata: it constrains shape, material, and interaction decisions but does not generate runtime code or authorize a second foundation. Record the selected direction's evidence and boundaries before resolving the three systems below.

## Resolve three systems

Before styling, make these decisions traceable to the Design Intent:

| System | Decide | Evidence of coherence |
|---|---|---|
| Shape | Radius tiers, edge character, nesting, and where no container is needed | Related controls share a tier; outer containers are not less rounded than their children |
| Material | Opaque/translucent surfaces, depth count, backdrop, border, shadow, and fallback | Each material marks a real layer or interaction boundary |
| Interaction | Hover, press, focus, scroll, and state-transition behavior | Motion communicates response, relationship, or continuity |

Do not infer that “premium” means rounded glass. Use the requested treatment when the user, brand, or approved Design Intent calls for it; otherwise select the systems that fit the product.

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

## Build shape rhythm

Use at most three intentional radius tiers:

- **Control:** buttons, inputs, badges, and compact interactive items.
- **Panel:** cards, list rows, menus, and local work areas.
- **Shell:** hero previews, application frames, and major conversion surfaces.

Scale the tier with size and grouping rather than repeating one radius everywhere. A child surface should usually use a smaller radius than its parent. Pills are reserved for tags, binary choices, compact status, or controls whose geometry benefits from a capsule—not every button.

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
