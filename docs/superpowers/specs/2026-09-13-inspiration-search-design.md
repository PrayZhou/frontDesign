# Inspiration Search — Design

Date: 2026-09-13
Status: approved (pending written-spec review)

## Background

`component-driven-frontend` deliberately does not browse for design inspiration. It states
that visual reference research is separate from installable component discovery
(`references/research-ingestion.md`), that its reference cards are principles rather than a
gallery (`references/visual-reference-cards.md`), and that online sources return
`requires-command` instead of being executed (`references/source-adapters.md`). Remembered
gallery items are explicitly listed as non-evidence in `SKILL.md`.

We want to add a controlled entry point that lets the agent search other designs and
excellent design work to inspire its own direction, without weakening the evidence
discipline the skill is built on.

## Goal

Give the skill a first-class **inspiration search** capability with two independent channels:

- **Inspiration channel** → feeds `designIntent.styleDirections` and transferable principles.
- **Component channel** → feeds `region.selection` candidates.

The channels never share a candidate pool.

## Non-goals

- No change to `schemas/component-plan.schema.json`.
- No change to `scripts/lib/plan-validator.mjs`.
- No automatic component installation or file overwrite.
- No copying of layouts, brand marks, copy, or assets from any source.
- No new plan document type; inspiration persists through existing anchors.

## Confirmed decisions

1. Two separate channels (inspiration vs components), never merged.
2. Full-autonomy web search: the agent executes searches with its native web tools; the
   skill scripts stay offline.
3. Three-tier source trust model (T1/T2/T3).
4. Output reuses existing anchors: `designIntent.styleDirections` and
   `designIntent.evidence` (no new artifact type).
5. Mechanism: one reference doc + one offline script (plus its lib module).

## Architecture

New files:

- `references/inspiration-search.md` — the normative spec for the capability.
- `scripts/inspiration-search.mjs` — offline CLI entry point.
- `scripts/lib/inspiration-planner.mjs` — tier data, search-plan generation, evidence
  normalization.

Changed files:

- `SKILL.md` — add pre-steps to Route steps 2 and 3; note the capability in Route boundary
  and Authority.
- `references/research-ingestion.md` — cross-link inspiration references into the evidence
  protocol.
- `references/visual-reference-cards.md` — state that cards may be distilled from T3 while
  still not owning another product's design.
- `references/source-adapters.md` — point the component channel at the added T1 sources.
- `references/component-selection.md` — state that `selection.source` must never be a T3
  visual-inspiration source.

All new files must be linked from `SKILL.md` (or another referenced doc). Orphan assets are
not acceptable — see "Verification".

## Three-tier trust model

| Tier | Representative sources | Allowed use | Forbidden |
|---|---|---|---|
| T1 — official / registry | shadcn registry, 21st.dev, MagicUI, Aceternity, OriginUI, HeroUI/Mantine/MUI/Ant Design official docs | Produce **component candidates** (still verified against official docs or registry) | Asserting existence from memory |
| T2 — real products / official design-system cases | Real product sites and public design-system docs, Figma Community official publications, Mobbin (real product screenshots) | Serve as **design evidence** that informs Style Directions | Copying layout, brand, copy, or assets |
| T3 — inspiration aggregators | Dribbble, Behance, Awwwards, Godly, Land-book, Refero, Layers | Distill **transferable principles only** (hierarchy, composition, token, content, interaction, QA) | Copying visuals; becoming a `selection` candidate |

## Reference spec content

`references/inspiration-search.md` defines:

- Trigger conditions: the brief gives no visual direction, or the user explicitly asks for
  inspiration.
- The three-tier table above, with each tier's allowed use and prohibitions.
- The five-step flow: `plan → search → capture → normalize → synthesize`.
  - `plan`: the script emits a tiered search plan (query × target site × tier × allowed use).
  - `search`: the agent performs the actual search with its native web tools.
  - `capture`: record URL, publisher, retrieval time, license note, and the narrow claim
    (reuse the seven protocol rules in `research-ingestion.md`).
  - `normalize`: the script converts captured references into schema-conformant evidence
    records.
  - `synthesize`: distill into Style Direction candidates and reference cards; never copy.
- Explicit boundaries with existing docs, restating that inspiration is not a component
  candidate.

## Script interface

`scripts/inspiration-search.mjs` is read-only and offline — it performs no network access.
The agent performs the real search.

```bash
# 1) Emit a tiered search plan
node scripts/inspiration-search.mjs --channel <inspiration|components> \
  --brief '<text>' [--intent <plan.json>] [--tiers T1,T2,T3] --json

# 2) Normalize captured references into evidence records
node scripts/inspiration-search.mjs --normalize --input <captured.json> [--out <evidence.json>] --json

# 3) Audit a plan for tier violations (T3 used as a selection source)
node scripts/inspiration-search.mjs --audit-plan <plan.json> --json
```

Plan output shape:

```json
{
  "channel": "inspiration",
  "status": "ok",
  "queries": [
    { "text": "dashboard information hierarchy", "tier": "T3", "purpose": "style-direction" }
  ],
  "targets": [
    {
      "site": "dribbble.com",
      "tier": "T3",
      "allowedUse": ["transferable-principle"],
      "forbidden": ["copy-layout", "component-candidate"]
    }
  ],
  "constraints": ["T3 sources must never become selection candidates"]
}
```

With `--channel components`, the plan uses the same envelope but each target carries
candidate-oriented guidance for its T1 source; the plan surfaces the no-install rule as a
constraint and emits no install command, while `requires-command` is returned by the
registry query in `query-components.mjs`.

`--normalize` emits an array of records matching
`schemas/component-plan.schema.json → $defs/evidence`, that is: `id`, `type`, `source`,
`claim`, `confidence`, `capturedAt`, plus optional `appliesWhen`, `freshness`,
`constraints`, `notes`. `type` is drawn from
`official-doc | observed-pattern | screenshot`. `capturedAt` uses the retrieval date
recorded on the captured reference when present, otherwise the current date.

Exit codes follow the existing convention: `0` success, `1` policy violation (audit), `2`
usage or parse error.

## Data flow and route integration

- Insert `2a. Inspiration search` ahead of Route step 2 (conditional): produces evidence
  that feeds the 2–4 Style Direction candidates. Candidates are re-derived, not copied from
  any single site.
- Insert `3a. Component source sweep` ahead of Route step 3: extends the existing
  `query-components.mjs --source shadcn|magicui|aceternity` with the added T1 sources; still
  returns `requires-command` and never auto-installs.
- Route step 5 is unchanged. `plan-validator.mjs` already validates
  `designIntent.evidence`, so no validator work is required.
- Persistence: `designIntent.evidence` (with `type: observed-pattern`) plus
  `designIntent.styleDirections`.

## Guardrails and error handling

- Fetch failure, login wall, authorization failure, robots disallow, or 404 → record a
  warning and `status: unavailable`; never fabricate.
- Conflicting sources → stop, name the conflict and the affected decision, follow the
  higher-authority source.
- T2 and T3 must never enter `selection`; never copy layout, brand, copy, or assets.
- Distill transferable rules only; never transplant a page.
- No automatic install, no automatic overwrite (existing Stop points apply).
- Network fully unavailable → degrade to parsing user-supplied URLs and screenshots only.
- Every external source retains URL, publisher, retrieval time, and license note.

## Verification

The repository has no test framework; the two JSON files in `examples/` are only run
manually.

1. The new script produces deterministic JSON for fixed inputs.
2. `--normalize` output, embedded in a fixture plan, passes
   `validate-component-plan.mjs --strict`.
3. Regression on the existing validator: the lib test asserts `validateComponentPlan`
   accepts a plan carrying normalized evidence. The `examples/` plans that earlier revisions
   of this spec named were removed from the workspace as a redundant asset, so they are no
   longer part of the regression set.
4. Manual end-to-end: given a real brief, the agent actually runs `2a` / `3a` and produces
   evidence.

Any fixture introduced must be referenced by a script or by `SKILL.md`; unreferenced assets
are treated as redundant.

## Risks and trade-offs

- **Full-autonomy search widens the skill's stance.** Mitigated by the tier model, the
  "distill, never copy" rule, and the audit command.
- **Tier enforcement is partly documentary.** Only the audit command mechanically catches
  T3 leaking into `selection`; the rest relies on the agent following the reference. Kept
  deliberately small to avoid a heavyweight rule engine.
- **Source lists change over time.** Tier data lives in `inspiration-planner.mjs`; updating
  it is a code change. Accepted for testability.

## Open questions

None.
