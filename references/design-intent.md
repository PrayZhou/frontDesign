# Design Intent

Define intent before selecting components. Make each decision traceable to evidence, not to a fashionable demo.

## Resolve evidence

Use this hierarchy, highest first:

1. Follow explicit user requirements and acceptance criteria.
2. Follow brand rules, accessibility policy, content strategy, and supplied assets.
3. Follow Figma, Code Connect, annotated screenshots, and approved reference designs. When the brand arrives only as raster assets, extract the palette with `brand-colors.mjs` and treat a color with no matching token as a decision to record, not a token to invent.
4. Preserve the project's tokens, type scale, theme, layout conventions, and current foundation.
5. Use verified official component documentation and platform conventions.
6. Introduce a local design decision only where higher evidence is silent; label it as an assumption.

When evidence conflicts, stop and name the conflict, affected decision, and smallest choice the user must make. Never use this guide to override supplied design truth.

## Explore Style Directions

For an open page-level brief, compare two first-viewport sketches using the same real material. Vary the lead content, reading order, scale, crop or relationship between regions. State what each makes easier and what it costs. Select a direction from the brief and preserve a supplied visual direction. See [composition and critique](composition-and-critique.md).

## Record intent for a component plan

The full component plan uses the following fields. A design-only handoff can use the smaller brief in [the skill entry point](../SKILL.md).

| Field | Decide |
|---|---|
| `product` | Product/page type and business context |
| `audience` | Primary users, environment, and relevant ability constraints |
| `coreTask` | The single action or understanding the page must optimize |
| `visualDirection` | 2–4 grounded qualities plus explicit shape, material, interaction, and effect boundaries |
| `density` | `compact`, `comfortable`, or `spacious`, with a task-based reason |
| `principles` | 3–5 testable rules covering hierarchy, responsiveness, and access |

Examples set boundaries, not templates: “calm operational workspace; dense tables but generous section spacing; no decorative glow” or “editorial commerce; product imagery leads; restrained motion; no glass surfaces.” Do not copy their palettes or layouts.

## Name the outcome

The optional `purpose` identifies what the visitor comes to do: `act`, `understand`, or `explore`. Use `coreTask` for the actual decision, insight or experience. When an action is central, `primaryAction` names the button or link by its accessible name. A reading or exploration page may have navigation and still have no primary control. Its rendered review checks image sequence, reading order or comprehension against the brief.

Use `composition.firstRead` to name the specific focal material, `composition.readingOrder` for the intended sequence, and `composition.tradeoff` for the cost of the choice. Record one to three `successCriteria` that a reviewer can investigate. Distinguish a visible property (“both accounts and their risk reasons are visible at 320px”) from a user outcome that requires observation (“a new supervisor selects the right account in ten seconds”).

Before fixing type, spacing, surface, and motion values, read [premium craft](premium-craft.md)
for the ranges that make a page read as considered rather than assembled. Those ranges are
defaults to apply through the project's tokens, not a style to paste onto every page.

## Source the feeling

Record where the feeling comes from before deriving it.

| `source` | When | Binding | Label |
|---|---|---|---|
| `user-provided` | The user named the feeling, or picked one of the candidates you offered | Hard — conflicting Style Directions and candidates are rejected with a recorded reason | none |
| `inferred` (or absent) | You derived it from product, audience, and core task | Soft — it orders and justifies, but does not reject | `Assumption — user may override` |

When mood matters and the brief leaves it open, derive a provisional choice from the subject, audience and material. If the sketches lead to meaningfully different experiences and the evidence leaves the choice open, ask the user which serves their audience.

A comment such as “太生硬了，要有些情感” identifies a problem and leaves the particular mood open. Preserve that feedback in the rationale. If the designer chooses reassurance, curiosity or intimacy, mark that choice `inferred`. A precise request such as “我希望出错的人能安心” supplies the feeling directly.

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

The goal must describe an experience, not a standalone adjective. The validator's generic-descriptor list is `高级`, `高级感`, `现代`, `现代感`, `漂亮`, `好看`, `有质感`, `质感`, `令人惊艳`, `惊艳`, `简约`, `简洁`, `精致`, `大气`, `premium`, `modern`, `beautiful`, `stunning`, `clean`, `sleek`, `minimal`, `minimalist`, `elegant`, `polished`, `simple`. It reports `generic-emotional-goal` as a warning, never an error, and the check is deliberately narrow: it splits the goal on whitespace and `,，、/|+&和与`, then warns only when the result is 1–3 tokens and every token is in that list. So `premium modern` warns, a full sentence that happens to contain `premium` does not, and delimiter-free Chinese such as `高级感的现代页面` does not warn either because it tokenizes as one unlisted string. A silent run is therefore not approval—the goal must still describe the experience it produces for that audience, whether or not the warning fires. Label an inferred goal `Assumption — user may override`.

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

- **Typography:** Use the existing family and type scale unless the brief calls for a change. When a project lacks type tokens, `type-scale.mjs --body 16 --ratio 1.25` gives a starting scale to test against the actual content. Define display/body/label roles, readable measures, and a limited weight range; use size and spacing before decorative effects to establish hierarchy.
- **Color:** Start from existing semantic tokens. Assign colors by purpose—surface, text, border, action, status—and verify contrast with `check-contrast.mjs` rather than by eye. Record the pairs that must pass in `designIntent.contrastPairs` with a `contrastLevel`; the validator blocks a failing pair before implementation. Add a new accent only when it has a defined role.
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

Revise toward product-specific hierarchy, content, and interaction. In an open brief, use alignment and deliberate gaps to establish the reading order. Select any gradient, glass or motion according to the content or interaction it serves. Follow explicit brand or brief constraints when they specify a different treatment.
