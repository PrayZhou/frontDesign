<div align="center">

# Component-Driven Frontend

### Turn product intent into verified, expressive interfaces

<p>
  An agent skill for designing, critiquing and building web interfaces, from a reading page to a production React workspace.
</p>

<p>
  <a href="README.zh-CN.md">中文文档</a>
  ·
  <a href="SKILL.md">Skill instructions</a>
</p>

</div>

## What this skill does

Use the same content to explore different compositions, then select the one that serves the visitor’s purpose. A first-screen recommendation can help a support lead act immediately. A contact sheet helps an editor compare pictures. A long read needs enough room for a thought to unfold.

| Starting point | Deliverable |
| --- | --- |
| An open design brief | Two comparable first-screen sketches, a selected reading order, a narrow layout and the tradeoff. An approved direction can go straight to refinement. |
| A screenshot or existing surface | A critique anchored to the visible viewport, a concrete revision and a way to check it. |
| An implementation request | A working page in the project’s stack with rendered review. React component projects also use source verification, strict component plans and CI checks. |

Pure design and feedback work without a repository. A bounded component or token change keeps the existing composition. Use the project’s normal engineering workflow for logic defects and exact-value edits.

Build the first draft around a particular encounter. A supervisor wants to know who is handling a blocked delivery. A reader may linger after a line of dialogue. Revise the copy, pacing, image or response where that encounter happens, then inspect it at the same viewport. Give the first subject room, align related information and remove repeated explanations. Use a gradient if it helps locate the focal content. Glass and motion can wait until the visitor opens a detail view. Include solid and reduced-motion alternatives. New interfaces start with softly rounded buttons and fields, a larger radius on panels and dialogs, and circular radio indicators. Existing design systems supply their own shape tokens. [Shape and radio examples](references/visual-language.md#build-shape-rhythm)

Size type and its container together. The support desk pairs the handover with metrics on desktop, gives the metrics their own row on tablet and offers the metrics in a disclosure on a phone. Check wrapping, tap targets and enlarged browser text with real content. [Type, measure and component sizing](references/premium-craft.md#set-the-type-scale)

Design the mark and label together. An arrow can carry the product’s visual style when its stroke, spacing and movement suit the action. Give supporting controls a quieter treatment and keep keyboard focus visible. [Choosing action labels and icons](references/iconography-and-imagery.md#choose-the-action-label-first)

Derive controls, spatial form and motion from the product task. [Control design](references/visual-language.md#derive-a-control-family) · [Spatial design](references/spatial-design.md)

## Workflow

Name the visitor’s purpose → edit the material → compare actual first screens when the brief is open → choose the reading order → inspect the result at its rendered size. For component implementations, continue through source verification, plan validation, implementation and CI.

The complete operating instructions are in [`SKILL.md`](SKILL.md). Supporting
guidance lives in [`references/`](references/), while deterministic helpers and
validators live in [`scripts/`](scripts/).

## Repository layout

```text
.
├── README.md                         # English documentation
├── README.zh-CN.md                   # Chinese documentation
├── SKILL.md                          # Skill workflow and guardrails
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
Review the supplied 320px screenshot of a Chinese essay. Explain which figure
the caption appears to belong to, what in the spacing suggests that reading,
and one change I can try. I only need feedback.
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

## Checks

```bash
node --test
```

Runs the planner, validator, CLI, and component-query suites. The core CLI scripts are plain ESM and have no installation step. Validating a plan against a project also checks
the declared foundation, enhancer, installed dependencies, and every declared contrast
pair:

```bash
node scripts/validate-component-plan.mjs --file plan.json --root . --strict
```

If the project needs a starting type scale, derive one from a single ratio:

```bash
node scripts/type-scale.mjs --body 16 --ratio 1.25 --format css
```

The approved plan also generates the rendered-review checklist and an optional Playwright
spec, so visual QA is worked through instead of recalled:

```bash
node scripts/visual-qa-plan.mjs --file plan.json --root . --out qa.md
node scripts/visual-qa-plan.mjs --file plan.json --root . --emit playwright --out qa.spec.ts
node scripts/check-contrast.mjs --root . --pairs 'foreground:background,muted-foreground:background'
```

`check-contrast` reads the project's theme tokens (hex, `rgb()`, `hsl()`, `oklab()`, `oklch()`)
and fails below 4.5:1 for text and 3:1 for large text and UI boundaries.

Run the close-out checks locally with `node scripts/verify.mjs --plan plan.json --root .`. Missing optional inputs are reported as skipped. In a CI job, generate the build and captures first, then name the checks that must run.

```bash
node scripts/verify.mjs --plan plan.json --root . --require bundle,regression,i18n --json
```

`--require` accepts `plan`, `bundle`, `i18n`, and `regression`. A missing required input or a failed check exits 1. Warnings allow exit 0. An unknown name or an overlap with `--skip` exits 2. Required regression checks also fail when a new capture lacks its own baseline. Required bundle checks need measurable JS or CSS and any JS/CSS files referenced by the inspected route entries.

Both locale commands read flat catalogs (`en.json`) and language directories (`en/common.json`, `zh/admin/forms.json`). The relative filename supplies the namespace, so the last file’s `save` key is reported as `admin.forms.save`. Flat and nested catalogs can coexist. Files that define the same key in one locale produce an error identifying both paths.

The individual checks stay available:

```bash
node scripts/inspect-shell.mjs --root . --json
node scripts/brand-colors.mjs --root . --json
node scripts/plan-diff.mjs --before old-plan.json --after plan.json --fail-on foundation,regions
node scripts/visual-regression.mjs --baseline qa/baseline --current qa --update
node scripts/i18n-stress.mjs --dir locales --baseline en
node scripts/bundle-budget.mjs --root . --plan plan.json
```

`inspect-shell` inventories routes, layout chains, route groups, and segment states so a
multi-page shell starts from the real map. `visual-regression` decodes PNG captures with no
dependencies, fails on a changed canvas size, and reports a bounding box plus a difference hash;
`i18n-stress` checks key parity, placeholder drift, and text expansion against a baseline locale;
`bundle-budget` measures per-route first-load JS and shipped CSS against the plan's budget.

## License

See the repository license and project policy for usage terms.
