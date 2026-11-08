# Premium Craft

"Premium" is rarely an effect. It is proportion, restraint, and material accuracy repeated
consistently. Begin with the actual words, pictures and people in the brief. The ranges below are starting points for a working layout. Keep a wider pause, uneven image sequence or softer division when the rendered page shows what it does for the experience.

## Set the type scale

- Use 3–4 levels per page: `display`, `title`, `body`, `label`. Add `mono` only for code, IDs,
  or dense numeric tables.
- Reuse existing type tokens. If the project lacks a scale, try a starting ratio such as **1.2** for a dense product or **1.333** for editorial contrast, then inspect the real title and body together.
- Starting sizes: display 32–48 product / 48–72 marketing; title 20–24; body 15–17; label 12–13.
- Line height: display 1.05–1.15; title 1.2–1.3; body 1.5–1.65; label 1.3–1.4.
- Letter spacing: display −0.02 to −0.01em; body 0 to +0.005em; label +0.01 to +0.04em;
  all-caps +0.06em.
- Measure: body 45–75ch, display 20–35ch, form fields 30–40ch.
- Weight budget: two weights plus one for emphasis. Avoid a 300 weight on light surfaces and
  avoid synthesized bold.

### Fit the type to its container

Use relative units for text and respect the browser's base font size. A fluid heading can use `clamp()` with rem bounds and a rem-plus-viewport middle term. Adjust its line breaks against the actual column. In a product workspace, the recommended account can be larger than the page title; a neighboring queue heading should read as a section. For Chinese prose, start around 28–38 full-width characters per line where space permits and check punctuation and mixed Latin names in the rendered font.

Size panels around the content and its padding. Use a maximum measure for explanations, let a dialog grow vertically when a label wraps, and make long dialogs scroll with a reachable close action. On a tablet, three short metrics can share a row under the main story; on a phone, label–value pairs can stack below it. Check the box that receives taps as well as the visible text or icon. Aim for a 44px tap target for frequent touch actions.

Numbers and tables:

- Use `font-variant-numeric: tabular-nums` wherever digits stack vertically.
- Align numbers right, labels left, units muted and one size smaller.
- Reserve column width for the longest realistic value instead of truncating it.

Chinese and mixed scripts:

- Body 15–16px with line height 1.6–1.75; avoid thin weights below 16px.
- Keep letter spacing at 0 for CJK; add tracking only to Latin labels.
- Use full-width punctuation in Chinese copy; do not mix half-width commas.
- Pair CJK with a family that has real CJK glyphs; fall back explicitly rather than letting
  the browser pick a thin substitute.

Font loading: prefer the project's existing variable font, load with `font-display: swap`, and
use `size-adjust`/metric overrides on the fallback so text does not shift.

## Build a spacing rhythm

- Base unit 4px, structural rhythm 8px. Use one scale: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Spacing encodes relationship: **1 step** inside a control group, **2 steps** between groups,
  **4–8 steps** between sections.
- Page gutters: 16px mobile, 24–32px tablet, 32–48px desktop. Content max width 1120–1280px.
- Section padding: 64–96px desktop, 40–56px mobile. Card padding 20–28px.
- Row heights by density: compact 32–36px, comfortable 44–48px, spacious 56–64px.
- Pick one alignment axis per composition. Centering everything is a look, not a hierarchy.
- Vertical rhythm matters more than horizontal: keep headings, body, and actions on the same
  step increments so the page reads as one system.

## Layer surfaces, not shadows

Three layers are enough; add `overlay` only for real floating content.

| Layer | Light | Dark |
|---|---|---|
| canvas | `#fafafa`–`#ffffff` | `#0a0a0a`–`#111111` |
| surface | `#ffffff` | `#141414`–`#18181b` |
| raised | surface + one shadow | surface + lighter border |
| overlay | surface + stronger shadow | surface + stronger shadow |

- Borders: 1px at `rgb(0 0 0 / 0.06–0.10)` in light, `rgb(255 255 255 / 0.08–0.12)` in dark.
  Prefer a border over a shadow for containment; use shadows only for real lift.
- Shadow recipe (two layers, low alpha):
  `0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.18)`.
- In dark mode raise surfaces with lightness, not with pure black canvas plus pure white text.
  Body text on dark sits around `#f4f4f5`, not `#ffffff`.
- Elevation count ≤3 across the page. If every panel floats, nothing floats.
- Use the project's radius tokens. When choosing new ones, follow the [soft control, panel and dialog scale](visual-language.md#build-shape-rhythm). Reserve circular indicators for controls such as radio buttons.
- Place frosted glass where the backdrop varies visibly, such as an action strip over a focal gradient. Provide a solid base color for reduced transparency and browsers without blur.

## Time the micro-interactions

| Interaction | Duration | Easing |
|---|---|---|
| hover, press | 120ms | `cubic-bezier(.2,0,0,1)` |
| expand, collapse | 180ms | `cubic-bezier(.2,0,0,1)` |
| panel, drawer | 240ms | `cubic-bezier(.2,0,0,1)` |
| page or route transition | 320ms | enter `cubic-bezier(0,0,.2,1)`, exit `cubic-bezier(.4,0,1,1)` |

- Press feedback: 1px translate or scale to 0.99 plus a slightly darker surface. Never a bounce.
- Hover: 2–4% surface lightness change or 1px lift. Do not move content that carries text.
- Focus ring: 2px ring with 2px offset, ≥3:1 against both the control and the page surface.
- Animate `transform` and `opacity`; never animate `width`, `height`, or `top` for layout.
- Reduced motion keeps color, opacity, and state changes and removes travel above 4px.

## Tokenize the motion

Name the timings once, then reference them instead of writing `0.2s ease` per component:

```css
:root {
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-slow: 240ms;
  --ease-standard: cubic-bezier(.2, 0, 0, 1);
  --ease-enter: cubic-bezier(0, 0, .2, 1);
  --ease-exit: cubic-bezier(.4, 0, 1, 1);
}
```

| Token | Where it applies |
|---|---|
| `--motion-fast` | hover, press, focus ring, checkbox, toggle |
| `--motion-base` | expand/collapse, tab indicator, toast in/out |
| `--motion-slow` | drawer, dialog, sheet, route transition |

Reduced motion replaces travel with a short opacity change, keeps every state change, and
never removes the confirmation itself:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: var(--motion-fast) !important;
    scroll-behavior: auto !important;
  }
}
```

A motion token no component references is a token you do not need. Prefer the project's
existing duration variables when they exist; adding a parallel scale is how pages drift.

## Details to inspect in context

- Optical alignment: icons, quotation marks, and table numbers align to the text they serve.
- One icon set, one stroke width (1.5–2px), sizes 16/20/24, aligned to cap height.
- Images: fixed aspect ratios, `object-fit: cover`, deliberate focal crop, radius inherited from
  the panel tier, and a hairline inner border on light images so edges stay crisp.
- Tables: muted 12px uppercase header with tracking, one horizontal hairline per row, hover tint,
  sticky header, no zebra stripes, numeric columns right-aligned.
- Empty states: one sentence naming why it is empty plus one action. Never "No data".
- Loading: skeleton matches the final geometry; shimmer cycle 1.2–1.6s; no page-level spinner for
  local work.
- Buttons: verb + object ("Save changes"), one primary per view, secondary as outline or ghost,
  destructive visually separated.
- Copy: specific nouns and real numbers. One idea per sentence.

## Signals that read cheap — remove them

- Purple-to-blue gradient hero with no product evidence behind it.
- Three competing accent colors; glow halos; glass on every card.
- A large rounded container wrapped around every region, or nested borders with no hierarchy.
- Five font weights, four shadows, three radius scales, and an animation on every section.
- Everything centered; oversized headings used to fill space.
- Emoji as icons; inconsistent icon stroke; mixed icon families.
- Fake logos, invented testimonials, or metrics that imply unsupported proof.
- 12px gray-on-gray text; low-contrast placeholders as the only state styling.

## Review questions

1. Can every size, gap, radius, and shadow be traced to a token or a stated reason?
2. Does the page use at most three radius tiers and three elevation levels?
3. Is exactly one region the visual focus in the first viewport?
4. Do the type levels differ by more than a rounding step?
5. Is any text below 14px, or below 4.5:1 contrast, carrying real content? Run `check-contrast.mjs` against the theme tokens to answer the contrast half from values rather than from a screenshot.
6. Does every interactive element show hover, press, focus, and disabled states?
7. Would removing all shadows still leave a readable hierarchy?
8. Does the same rhythm hold at 320px, 200% zoom, and reduced motion?
9. Could this layout be pasted onto an unrelated product unchanged? If yes, it is still a template.
10. Can a visitor find the central action, subject or argument at the intended point in the reading order?
