# Visual Reference Cards

Use these cards as portable quality checks distilled from strong frontend work. They are principles, not a gallery, vendor catalog, or page templates. Apply only the cards that support the user's task and record the selected cards in the design rationale.

## How to use

1. Start with the user's job, content, brand evidence, and project foundation.
2. Select 3–6 relevant cards; do not apply every card to every page.
3. Convert each card into a concrete decision about hierarchy, composition, tokens, content, behavior, or QA.
4. Reject a card when it conflicts with explicit product or accessibility evidence.

## Cards

### hierarchy-task-first

**Intent:** Make the primary task or question obvious before decoration.

**Signals:** One dominant task; action sits near the object it affects; secondary content has lower emphasis.

**Avoid:** Equal-weight cards for unrelated content; multiple primary CTAs; decorative hero competing with the task.

**Implementation checks:** The task is identifiable without reading every label; mobile order preserves priority; emphasis is explainable by user value.

### composition-with-cadence

**Intent:** Create rhythm without turning every section into a bordered card.

**Signals:** A clear shell/content/actions structure; spacing and alignment group related content; contained and uncontained regions alternate intentionally.

**Avoid:** Card grids used as a default layout; nested borders with no hierarchy; identical containers repeated down the page.

**Implementation checks:** Every boundary has a semantic reason; at least one major region uses spacing rather than another box; parent surfaces are visually stronger than children.

### token-rhythm

**Intent:** Make visual consistency come from a small explainable token system.

**Signals:** A limited type scale, spacing rhythm, radius tiers, border vocabulary, and elevation levels.

**Avoid:** One-off pixel values everywhere; arbitrary color additions; child surfaces larger or louder than their parent.

**Implementation checks:** Typography, spacing, radius, and elevation decisions map to existing project tokens or have a documented reason; tokens survive responsive reflow.

### content-is-layout

**Intent:** Design against realistic content, not placeholder geometry.

**Signals:** Representative labels, values, names, dates, error copy, long and short text cases, and empty-state explanations.

**Avoid:** Lorem ipsum as the only test; truncating important labels without an alternative; fake metrics that imply unsupported proof.

**Implementation checks:** Long labels wrap or truncate intentionally; loading/empty/error/permission states fit; content remains understandable at 200% zoom and narrow widths.

### responsive-transformation

**Intent:** Preserve task priority while changing structure at smaller widths.

**Signals:** Columns become disclosure or scroll; navigation becomes a labelled drawer; actions re-order; dense controls group or collapse.

**Avoid:** Simply shrinking desktop; horizontal overflow; hiding essential actions without an alternative.

**Implementation checks:** Define desktop, tablet, mobile, and 320px behavior; preserve reading order, touch targets, focus, and accessible names.

### data-answers-a-question

**Intent:** Use data visualization to support a decision, not fill space.

**Signals:** The analytical question is named; mark and encoding fit the comparison; text summary or table alternative exists.

**Avoid:** Decorative charts; color as the only categorical distinction; misleading axes or unsupported precision.

**Implementation checks:** Chart has loading/empty/error states; non-visual alternative is present; responsive behavior preserves the question and labels.

### state-feedback-is-honest

**Intent:** Make every action and asynchronous transition understandable.

**Signals:** Immediate acknowledgement; pending state; meaningful progress or streaming; recoverable error; preserved context.

**Avoid:** Fake progress; full-page loading for local work; silent failures; clearing input after an error.

**Implementation checks:** Define trigger, state transition, feedback, retry/cancel behavior, live-region announcements, and reduced-motion equivalent.

### restrained-material

**Intent:** Use visual effects to communicate hierarchy or layer, not trend allegiance.

**Signals:** Opaque reading surfaces; glass only for real overlays/elevated layers; blur, glow, and gradient have explicit boundaries and fallbacks.

**Avoid:** Glass on every card; animated blur; purple-blue “premium” gradients without evidence; effects that reduce contrast.

**Implementation checks:** Material has contrast, fallback, depth rationale, and performance cost; no effect is required to understand the interface.

### accessible-feedback

**Intent:** Give keyboard, touch, and assistive-technology users the same operational result.

**Signals:** Native semantics; visible focus; labels; status/busy/live-region behavior; focus return after overlays.

**Avoid:** Hover-only actions; color-only status; div click targets; moving focus without a task reason.

**Implementation checks:** Keyboard path is documented; errors associate with inputs; dynamic updates are announced at the right politeness; reduced motion removes travel, not feedback.

### performance-as-aesthetic

**Intent:** Keep visual quality stable under real loading and interaction conditions.

**Signals:** Existing fonts/tokens reused; images have dimensions and responsive sources; repeated animation uses transform/opacity; expensive effects are bounded.

**Avoid:** Layout shifts from late assets; large always-on video; pointer handlers re-rendering the whole page; unbounded shadow/blur layers.

**Implementation checks:** New dependencies and asset costs are explicit; loading states reserve space; animation and blur have budgets and fallbacks.

## Reference record

When a card is adapted from a supplied screenshot, Figma file, official documentation, or observed product, preserve that evidence separately using [research-ingestion.md](research-ingestion.md). The card itself remains a reusable principle and must not claim ownership of another product's design. A card may be distilled from a tiered inspiration search; read [inspiration-search.md](inspiration-search.md) for which tiers may inform a card and which are forbidden.
