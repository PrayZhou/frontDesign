# Inspiration Search

Search other designs and excellent design work to inspire this page—without copying it and
without weakening evidence discipline. Search expands the evidence you may cite; it never
replaces verification.

## When to use

Run the inspiration channel only when the brief gives no visual direction, or when the user
explicitly asks for inspiration. Run the component channel when a region needs a candidate
the project and foundation do not already provide. Skip both when the direction is already
prescribed by the user, brand, or supplied design truth.

## Two channels, never merged

- **Inspiration channel** produces Style Direction candidates and transferable principles.
  It feeds `designIntent.styleDirections` and `designIntent.evidence`.
- **Component channel** produces component candidates. It feeds `region.selection`.

An inspiration source must never become a `selection` candidate. A registry candidate must
never become a visual-quality authority before its rendered behavior is inspected.

## Three-tier trust model

| Tier | Representative sources | Allowed use | Forbidden |
|---|---|---|---|
| T1 — official / registry | shadcn registry, 21st.dev, MagicUI, Aceternity, OriginUI, HeroUI/Mantine/MUI/Ant Design official docs | Produce component candidates, still verified against official docs or a registry | Asserting existence from memory |
| T2 — real products / official design-system cases | Real product sites and public design-system docs, Figma Community official publications, Mobbin | Serve as design evidence that informs Style Directions | Copying layout, brand, copy, or assets |
| T3 — inspiration aggregators | Dribbble, Behance, Awwwards, Godly, Land-book, Refero, Layers | Distill transferable principles only | Copying visuals; becoming a selection candidate |

### Aggregators and roundups

When a search result is an aggregator or roundup page that describes other real sites:

- Prefer retrieving the described **real product** directly and capture that as **T2 design
  evidence**.
- If that retrieval fails or is blocked, keep the roundup itself as **T3** and record it
  explicitly as a **second-hand** source: transferable principles only, and the `claim` must
  attribute the observation to the site it describes rather than presenting it as
  first-hand.
- Never treat the roundup page's own page design as the inspiration subject.

## Protocol

Run `plan → search → capture → normalize → synthesize`.

1. **Plan.** Emit a tiered search plan:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/inspiration-search.mjs --channel <inspiration|components> --brief '<text>' [--intent <plan.json>] --json
   ```

   Treat the plan as a starting point, not a fixed script. The plan's `targets` are
   preferred destinations, not an exhaustive list: a source that surfaces from a legitimate
   search but is absent from the list is still usable, classified by its own nature (see
   [Aggregators and roundups](#aggregators-and-roundups)) and never silently promoted.

   The tier registry covers representative sources only. When a captured host is not in it,
   `--normalize` applies the declared tier's default allowed use and marks the record as
   coming from an unregistered host.

2. **Search.** Perform the actual search with the runtime's web tools. Search only the tiers
   the plan selected. A search that was not executed is not evidence. The generated
   `queries` are seed strings, not the search to run: before searching, rewrite each around
   the **subject noun** of the brief (for a bakery brief, `bakery`, not `independent real
   product ui`). In a real run the literal `<adjective> real product ui` queries returned
   nothing useful, while the subject noun returned the only useful results.

3. **Capture.** For each reference, record URL, publisher, retrieval time, license note, and
   one narrow claim. Reuse the seven protocol rules in [research ingestion](research-ingestion.md).
   Mark login walls, authorization failures, robots disallows, redirects, and stale captures
   as warnings.

4. **Normalize.** Convert captured references into schema-conformant evidence records:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/inspiration-search.mjs --normalize --input <captured.json> [--out <evidence.json>] --json
   ```

   Append the records to `designIntent.evidence`.

5. **Synthesize.** Distill transferable rules into Style Direction candidates and
   [reference cards](visual-reference-cards.md). Describe relationships, hierarchy, and
   behavior—never transplant a page.

## What search must not do

- Do not copy layout, brand marks, copy, or assets from any tier.
- Do not let a T2 or T3 source enter `region.selection`.
- Do not fabricate a reference when a fetch fails or is blocked; record the failure.
- Do not install components during discovery. The component-channel plan emits tiered T1 sources
  and never an install command; the registry query run via `query-components.mjs` returns
  `requires-command`, and installation remains a separate authorized action.
- Do not treat a remembered gallery item or an unexecuted search as evidence.

## Audit

Before implementation, check the plan for tier violations:

```bash
node .agents/skills/component-driven-frontend/scripts/inspiration-search.mjs --audit-plan <plan.json> --json
```

A violation means a visual-inspiration source leaked into `region.selection`.

## Verification

- Normalized evidence passes `validate-component-plan.mjs --strict` once embedded in a plan.
- Every external source retains URL, publisher, retrieval time, and license note.
