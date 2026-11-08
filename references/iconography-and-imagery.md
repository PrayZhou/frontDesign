# Iconography and Imagery

Icons and images are where a polished layout starts to look assembled. One family, one
stroke, one crop logic, and deliberate alt text do more than any new illustration.

## Choose the action label first

Start with a specific action label. A directional mark can guide the eye or echo a brand motif. Choose its weight alongside the type, center the visible strokes against the letters, and balance the space between label, mark and outer edge. Make the whole control one keyboard and pointer target.

| Actual behavior | Treatment |
| --- | --- |
| Jump to a section on this page | A link labeled “进入演示” can use a short descending path to lead into the section. |
| Show source material in a dialog | A button labeled “查看原始记录”. Provide dialog semantics and return focus on close. |
| Change a table's sort order | Show the active direction beside the column name and expose it through `aria-sort`. |
| Open a new tab when that is significant | Communicate the change in the accessible link text. Follow an established external-link convention when one exists. |

In the signal demo, the main action uses a dot and a bent trace ending in an arrowhead. Its movement follows the path into the evidence section. The source-record action uses a smaller, stationary trace beside its label. These are choices for this product. In another project, start from its icon family and interaction language. Inspect the resting, hover, focus and pressed states at actual size. Reduced motion should preserve the complete silhouette and a visible focus ring.

When a screenshot singles out a small detail, locate its control and activate it. Check the other instances of that behavior, including the same action in a compact header. Carry the preference across those instances and verify an unrelated functional indicator still reads correctly.

## Keep one icon family

- Pick one family and one stroke weight. Mixing outline and filled icons in the same
  surface reads as an accident, not a style.
- Optical stroke: 1.5px at a 24px viewBox, 1.75px at 16px. Thinner disappears at small
  sizes; thicker makes icons shout next to 14–16px text.
- Sizes: 16 for inline-with-text and compact buttons, 20 for navigation and toolbars,
  24 for standalone actions and empty states. Do not scale an icon to an arbitrary size.
- Align icons to the text cap height, not the line box. Icons with built-in padding (play
  triangles, arrows) need a 1px optical nudge.
- Gap between icon and label: 8px at body size, 12px at title size. Keep it constant
  within a component family.

## Wire icons correctly

- Decorative icons: `aria-hidden="true"` and no name. The label carries the meaning.
- Meaningful icon-only controls: `aria-label`, a visible tooltip, and a 44×44 minimum hit
  area even when the glyph is 20px.
- Icons inherit `currentColor`. Disabled state uses opacity, not a different hue.
- No drop shadows, gradients, or two-tone fills unless the icon family ships them.
- Never use emoji as interface icons; rendering differs per platform and they cannot
  inherit weight or color reliably.

## Set imagery rules

| Use | Aspect ratio | Notes |
|---|---|---|
| Hero | 16:9 or 21:9 | One focal subject; crop survives 320px |
| Card media | 3:2 or 4:3 | Consistent across the grid |
| Thumbnail | 1:1 | Crop centered on the subject |
| Avatar | 1:1 | 24/32/40px, deterministic fallback initials |
| Product shot | 4:3 | Consistent frame and background |

- Always reserve space: `width`/`height` or `aspect-ratio`, never a bare `<img>`.
- Serve `srcset`/`sizes` with AVIF or WebP, quality 70–80, and a low-quality or dominant
  color placeholder. No layout shift on load.
- `object-fit: cover` with an intentional `object-position`: faces toward the top, products
  centered, never a random crop.
- Inherit the panel radius tier. Light images get a 1px inner border at `rgb(0 0 0 / 0.08)`
  so edges stay crisp on white.
- Do not place text over an image without a scrim; a 0 → 55% opacity gradient is enough.
- Product screenshots: capture at 2×, keep the browser chrome consistent, and never
  fabricate UI that the product does not have.
- Logos: one height (20–24px), consistent spacing, grayscale in proof rows. Only real logos.

## Write alt text

- Describe the information the image carries: "Revenue trend for Q3, up 12%", not
  "image of a chart".
- Decorative images get `alt=""`; a redundant caption does not need a second description.
- Charts also need a text or table alternative; the image alone never carries the finding.

## Review checks

- Every icon comes from the same family and stroke weight.
- Every icon-only control has an accessible name and a 44×44 target.
- Every image has reserved dimensions and no shift on load.
- The hero crop still reads at 320px.
- No placeholder gray box, broken logo, or stock photo of people pointing at a laptop.
