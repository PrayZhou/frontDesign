<div align="center">

# Component-Driven Frontend

### Turn product intent into verified, expressive interfaces

<p>
  A design-aware Comate skill for planning and building polished React interfaces
  with verified components, coherent visual direction, and responsive visual QA.
</p>

<p>
  <a href="README.zh-CN.md">中文文档</a>
  ·
  <a href="SKILL.md">Skill instructions</a>
</p>

</div>

<p align="center">
  <img src="assets/warmth.png" alt="Warm, human-centered interface direction" width="31%" />
  <img src="assets/aiProduct.png" alt="AI product interface direction" width="31%" />
  <img src="assets/science.png" alt="Scientific and technical interface direction" width="31%" />
</p>

<p align="center">
  <em>Three visual directions. One evidence-driven component workflow.</em>
</p>

## What this skill does

`component-driven-frontend` helps turn a product brief into a practical component
plan and a production-ready implementation. It is designed for interfaces where
component selection, visual language, composition, responsive behavior, and
accessibility require real judgment.

The skill:

- inspects the existing project before choosing a foundation or component;
- turns product intent into an explicit visual direction;
- searches for inspiration without copying unverifiable references;
- verifies project components and source APIs before recommending them;
- limits the implementation to one foundation and at most one visual enhancer;
- produces and validates a machine-readable component plan;
- carries the plan into implementation and rendered desktop/mobile QA.

## When to use it

Use this skill when you are:

- designing or implementing a React page from a product brief;
- selecting components from an existing design system or registry;
- defining a visual direction for a new product surface;
- composing a dashboard, landing page, product shell, or content-heavy interface;
- improving a UI where responsive, accessibility, and visual-system decisions matter.

Do not use it for reducer bugs, state-transition defects, or an isolated style edit
whose exact target and value are already known.

## Workflow

```text
Project inspection
      ↓
Design intent + visual direction
      ↓
Content, responsive, and performance boundaries
      ↓
Verified component and source selection
      ↓
Validated component plan
      ↓
Implementation with existing tokens
      ↓
Rendered desktop/mobile visual QA
```

The complete operating instructions are in [`SKILL.md`](SKILL.md). Supporting
guidance lives in [`references/`](references/), while deterministic helpers and
validators live in [`scripts/`](scripts/).

## Visual directions

### Warmth

Human-centered interfaces with approachable rhythm, clear emotional intent, and
content that feels considered rather than mechanically assembled.

### AI product

Focused product surfaces where hierarchy, interaction states, data density, and
trustworthy system feedback are more important than decoration.

### Science

Technical interfaces that make complex information legible through disciplined
layout, evidence, progressive disclosure, and strong responsive behavior.

These images are visual references, not component sources. The skill uses them to
discuss direction and intent; it never treats an inspiration image as proof that
a component or API exists.

## Repository layout

```text
.
├── README.md                         # English documentation
├── README.zh-CN.md                   # Chinese documentation
├── SKILL.md                          # Skill workflow and guardrails
├── assets/                           # Visual references
│   ├── warmth.png                    # Warmth visual reference
│   ├── aiProduct.png                 # AI product visual reference
│   └── science.png                   # Science visual reference
├── references/                       # Detailed domain guidance
├── schemas/                          # Machine-readable plan contracts
└── scripts/                          # Inspection, search, and validation tools
```

## Example prompts

```text
Build a responsive analytics dashboard for operations teams.
Inspect the existing design system, propose two visual directions,
choose one, verify the available table and chart components, and produce
a validated component plan before implementation.
```

```text
Create a polished landing page for an AI writing product.
Use the user's stated feeling "calm and trustworthy", keep the existing
foundation, and review the rendered desktop and mobile states before
considering the work complete.
```

## Design principles

1. Evidence outranks novelty.
2. Existing project foundations should be preserved.
3. Inspiration informs direction; it does not authorize copying.
4. A named component must be verified before it is selected.
5. Content realism, responsive behavior, accessibility, and performance are part
   of visual quality.
6. A page is not complete until its rendered desktop and mobile states have been
   inspected.

## License

See the repository license and project policy for usage terms.
