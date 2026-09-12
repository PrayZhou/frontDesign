# Component Selection

Translate regions into capabilities, gather verified candidates, then select on fit. Do not start from component names.

## Build a capability map

Assign each region one or more capabilities:

| Capability | Includes |
|---|---|
| Navigation | shell, sidebar, tabs, breadcrumbs, pagination |
| Input/forms | field, select, date input, validation, submit |
| Data display | list, card, metric, timeline, media, description |
| Tables/charts | comparison, sorting, filtering, trends, data density |
| Overlay | dialog, drawer, popover, tooltip |
| Feedback | alert, toast, progress, skeleton, empty/error state |
| Layout | container, grid, split pane, disclosure, scrolling |
| Marketing | hero, proof, feature, pricing, CTA |
| Interaction | keyboard model, focus, selection, drag, command |

These are human planning categories. In Component Plan JSON, use only these canonical lowercase machine tokens so policy checks run:

```text
navigation, forms, controls, data, table, chart, metrics, overlay,
feedback, layout, marketing, interactive, async
```

Unknown or duplicate capability tokens are reported as validation warnings; strict validation blocks them. The structure contract is also available as [JSON Schema](../schemas/component-plan.schema.json). The schema covers shape and enums, while the runtime validator covers cross-field policy and project-context checks.

| Human category | Required JSON tokens |
|---|---|
| Navigation | `navigation`; also `interactive` when users operate it |
| Input/forms and controls | `forms` or `controls`, plus `interactive` |
| Data display | `data`; also `async` when data loads or mutates asynchronously |
| Tables/charts | `data`, `table` or `chart`; add `async` when applicable |
| Overlay | `overlay`, `interactive` |
| Feedback | `feedback`; add `async` for asynchronous feedback |
| Layout | `layout` |
| Marketing | `marketing`; add `interactive` for operable controls |
| Interaction | `interactive` |

`forms`, `controls`, and `overlay` require `interactive`. `table`, `chart`, and `metrics` require `data`. `interactive` triggers keyboard, focus, and semantics validation; either `data` or `async` triggers loading, empty, error, and success state coverage. Do not put human labels such as `Interaction` or `Data display` in `capabilities`; add every applicable machine token. Record responsive/accessibility behavior with the capability. Query independently when a region has unrelated needs.

## Gather in priority order

1. Reuse a suitable project component.
2. Use the current foundation's primitive or pattern.
3. Use the single compatible enhancer, if it adds a justified visual capability.
4. Compose verified primitives already selected.
5. Build custom only after documenting why verified candidates fail.

Keep one foundation and at most one enhancer. Prefer the existing foundation for forms, overlays, navigation, and other behavioral primitives. Recharts, TanStack Table, Lucide, Motion, and Sonner are capability libraries: track them in `dependencies`, never in `enhancer`.

## Keep discovery relevance separate from final fit

Every local query candidate has this stable shape:

```json
{
  "id": "source/component-name",
  "name": "component-name",
  "source": "project|shadcn|magicui|aceternity|registry-file",
  "description": "",
  "capabilities": [],
  "dependencies": [],
  "registryDependencies": [],
  "installCommand": null,
  "docsUrl": null,
  "relevanceScore": 0,
  "warnings": []
}
```

`relevanceScore` is a discovery-only lexical rank: exact normalized name +50, matching name token +15, capability token +12, description token +4, existing-project bonus +30, resolved active-foundation bonus +20, new dependency −2, and selected unresolved-cost warnings −5. A candidate must first match at least one normalized name, capability, or description token; project/foundation bonuses cannot make an unrelated result eligible. The value is deliberately not capped at 100 and must never be reported as final fit.

## Assess final fit and reject

After discovery, assess final fit separately using project consistency (30), capability/state fit (25), accessibility (15), Design Intent fit (15), responsive behavior (10), and dependency/client cost (5), for a distinct 100-point rubric. Record this assessment in the decision rationale, not in `relevanceScore`. Use final fit to order review, not to override rejection rules or judgment.

Reject a candidate regardless of final-fit assessment when it introduces another foundation, lacks verifiable source/API, misses a required state or keyboard/semantic behavior, conflicts with brand/tokens, requires an unauthorized overwrite/migration, or cannot work at a target viewport. Mark unknown dependency or client-only cost as unresolved; do not hide it in either ranking measure.

## Write the JSON contract

Style Direction is a page-level decision made before component selection. Explore 2–4 candidates when the brief leaves the visual direction open, select one stable `selectedStyleDirection` id, and carry only that profile into implementation. This does not relax the one-foundation and at-most-one-enhancer invariants.

Use this exact top-level shape:

```json
{
  "version": 1,
  "designIntent": {
    "product": "...",
    "audience": "...",
    "coreTask": "...",
    "visualDirection": "...",
    "density": "compact|comfortable|spacious",
    "principles": ["..."]
  },
  "foundation": "existing-system",
  "enhancer": null,
  "dependencies": [
    { "name": "package", "reason": "capability", "new": false }
  ],
  "regions": [
    {
      "id": "region-id",
      "need": "user need",
      "capabilities": ["data", "async", "interactive", "table"],
      "selection": { "source": "foundation", "component": "verified-table" },
      "reason": "why this candidate fits",
      "states": ["loading", "empty", "error", "success"],
      "responsive": "transformation at narrow widths",
      "accessibility": {
        "keyboard": "keyboard behavior",
        "focus": "focus behavior",
        "semantics": "roles, labels, or equivalent"
      }
    }
  ]
}
```

`selection.source` must be a project, foundation, enhancer, registry, or `custom` source. A T2 or T3 visual-inspiration source is never valid here; run `inspiration-search.mjs --audit-plan <plan.json>` to catch a leak. See [inspiration search](inspiration-search.md).

All six Design Intent fields are required, including non-empty `coreTask`. Use a string for `foundation`; use a string or `null` for `enhancer`. Every dependency object requires `name`, `reason`, and boolean `new`. Every region requires `id`, `need`, non-empty `capabilities`, non-empty `selection.source`, non-empty `selection.component`, `reason`, non-empty `states`, `responsive`, and `accessibility`. Selection sources may be `project`, `foundation`, `custom`, the declared foundation, or the declared enhancer; the `enhancer` alias is valid only when an enhancer is declared. A known foundation source that differs from `foundation`, or a known visual-enhancer source that differs from `enhancer`, is an error. Regions carrying `interactive` require non-empty `keyboard`, `focus`, and `semantics`. Regions carrying `data` or `async` must include all applicable `loading`, `empty`, `error`, and `success` states; strict validation treats omissions as blocking warnings.

For `selection.source: "custom"`, also add:

```json
{
  "customReason": "The exact capability or constraint no candidate meets.",
  "rejectedCandidates": ["source/name — concrete rejection reason"]
}
```

Describe the custom component's public interface, ownership of state, accessibility contract, responsive behavior, and test obligation in `reason` or the implementation record. Never use “more flexible” or “looks better” alone as a custom reason.
