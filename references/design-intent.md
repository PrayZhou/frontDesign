# Design Intent

Define intent before selecting components. Make each decision traceable to evidence, not to a fashionable demo.

## Resolve evidence

Use this hierarchy, highest first:

1. Follow explicit user requirements and acceptance criteria.
2. Follow brand rules, accessibility policy, content strategy, and supplied assets.
3. Follow Figma, Code Connect, annotated screenshots, and approved reference designs.
4. Preserve the project's tokens, type scale, theme, layout conventions, and current foundation.
5. Use verified official component documentation and platform conventions.
6. Introduce a local design decision only where higher evidence is silent; label it as an assumption.

When evidence conflicts, stop and name the conflict, affected decision, and smallest choice the user must make. Never use this guide to override supplied design truth.

## Explore Style Directions

When the brief does not already provide a visual direction, propose 2–4 genuinely different candidates before implementation. Change at least two meaningful dimensions—shape, material, density, typography, color strategy, or interaction character—not just the palette. Name each direction, explain its evidence, strengths, tradeoffs, and effect boundaries, then select exactly one. Alternatives are exploration metadata, not simultaneous instructions.

## Write six fields

Produce all six fields in a compact Design Intent:

| Field | Decide |
|---|---|
| `product` | Product/page type and business context |
| `audience` | Primary users, environment, and relevant ability constraints |
| `coreTask` | The single action or understanding the page must optimize |
| `visualDirection` | 2–4 grounded qualities plus explicit shape, material, interaction, and effect boundaries |
| `density` | `compact`, `comfortable`, or `spacious`, with a task-based reason |
| `principles` | 3–5 testable rules covering hierarchy, responsiveness, and access |

Examples set boundaries, not templates: “calm operational workspace; dense tables but generous section spacing; no decorative glow” or “editorial commerce; product imagery leads; restrained motion; no glass surfaces.” Do not copy their palettes or layouts.

## Source the feeling

Record where the feeling comes from before deriving it.

| `source` | When | Binding | Label |
|---|---|---|---|
| `user-provided` | The user named the feeling, or picked one of the candidates you offered | Hard — conflicting Style Directions and candidates are rejected with a recorded reason | none |
| `inferred` (or absent) | You derived it from product, audience, and core task | Soft — it orders and justifies, but does not reject | `Assumption — user may override` |

When the brief names no feeling but the page needs one, offer 2–4 candidate feelings, each with a one-line rationale and the carriers that would express it, then let the user pick one or write their own. Never offer more than four, and never silently replace a user-stated feeling with your own.

For `user-provided`, copy the user's words verbatim into `userPhrase`; the `goal` still states the experience, not the adjective. `高级` must become an experience such as `confidence that the tool will not waste my time`.

## Derive emotional intent

`designIntent.emotionalIntent` is optional. A plan without it is valid and its absence is not a defect. Add it when the brief asks for feeling, atmosphere, or immediate appeal, or when the page carries brand expression, first-visit conversion, narrative content, or product demonstration. Derive it along this chain:

`user-stated feeling (if any) → product type → audience state → core task → pressure or expectation → desired feeling → carriers`

| Field | Decide |
|---|---|
| `goal` | The experience the page should produce for that audience in that state |
| `rationale` | Why that feeling follows from product, audience, or core task |
| `carriers` | The layers that produce it: `visual`, `content`, `interaction`, `structure`, `brand` |
| `avoid` | The treatments that would break the feeling |
| `qaQuestions` | Observable questions a rendered review can answer |

When `emotionalIntent` is present, all five fields are required. Fill in only the carrier layers the project actually uses—at least one—rather than inventing copy for the rest. A carrier key outside those five layers is not rejected: the schema allows it and the validator reports `unknown-emotional-carrier` as a warning, so the plan stays valid while the unrecognized layer stays visible for review. Keep to the five named layers unless you can explain why a new one is needed.

The goal must describe an experience, not a standalone adjective. The validator's generic-descriptor list is `高级`, `高级感`, `现代`, `现代感`, `漂亮`, `好看`, `有质感`, `质感`, `令人惊艳`, `惊艳`, `premium`, `modern`, `beautiful`, `stunning`, `clean`, `sleek`. It reports `generic-emotional-goal` as a warning, never an error, and the check is deliberately narrow: it splits the goal on whitespace and `,，、/|+&和与`, then warns only when the result is 1–3 tokens and every token is in that list. So `premium modern` warns, a full sentence that happens to contain `premium` does not, and delimiter-free Chinese such as `高级感的现代页面` does not warn either because it tokenizes as one unlisted string. A silent run is therefore not approval—the goal must still describe the experience it produces for that audience, whether or not the warning fires. Label an inferred goal `Assumption — user may override`.

```text
Product: independent bakery homepage
Audience state: first visit, deciding whether the brand is worth trying
Core task: understand what makes the bread different, then start an order
Goal: warm curiosity plus enough trust to place a first order
Carriers: natural light and real texture; specific ingredient detail; light exploratory feedback
Avoid: template gradients, slogan-only copy, decorative scroll animation
```

An emotional goal is not a budget for decoration. It adds no foundation and no enhancer, and every effect still needs the justification below. Read [visual language](visual-language.md) for how the selected direction and page regions carry the feeling.

## Set visual rules

- **Typography:** Keep the existing family unless brand evidence authorizes change. Define display/body/label roles, readable measures, and a limited weight range. Use size and spacing before decorative effects to establish hierarchy.
- **Color:** Start from existing semantic tokens. Assign colors by purpose—surface, text, border, action, status—and verify contrast. Add a new accent only when it has a defined role.
- **Spacing, shape, and material:** Use the project's spacing and radius scales. Let content relationships determine gaps. Define surface depth and fallback behavior before using translucency or blur. Do not wrap every region in a large rounded container. Read [visual language](visual-language.md) when shape or material affects the direction.
- **Interaction and motion:** State purpose, trigger, duration character, and reduced-motion behavior. Prefer state continuity and input feedback. A core product demonstration needs more than a whole-section fade. Read [visual language](visual-language.md) for the interaction inventory.
- **Responsive/accessibility:** Identify reading order, collapse behavior, touch targets, focus visibility, semantics, zoom/reflow, and reduced motion before implementation.

## Reject generic AI UI

Reject or revise the direction when any answer is “yes” without evidence:

- Does “premium” merely mean dark mode, purple/blue gradients, glass, glow, beams, or floating orbs?
- Is Bento used because it is trendy rather than because independent content units need a grid?
- Are oversized headings, pills, rounded cards, or shadows repeated without hierarchy?
- Are multiple font styles, accent colors, and animations competing for attention?
- Could the same visual direction be pasted onto an unrelated SaaS, portfolio, or storefront unchanged?
- Does decoration reduce contrast, scannability, performance, or reduced-motion support?

Revise toward product-specific hierarchy, content, and interaction. A gradient, glass surface, Bento composition, beam, or animation is acceptable only when a higher-ranked source or an explicit functional rationale supports it.
