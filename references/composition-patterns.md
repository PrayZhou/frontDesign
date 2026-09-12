# Composition Patterns

Compose around user tasks and state boundaries. Preserve the selected foundation's APIs and tokens.

## Separate responsibilities

- **Shell:** Own global navigation, page width, persistent utilities, breakpoints, and route-level landmarks. Keep business content out of shell components.
- **Content:** Own page hierarchy, data presentation, reading order, and empty/loading/error/success representation. Keep global navigation state out.
- **Actions:** Place primary actions near the object or decision they affect. Separate destructive actions, confirmation, permissions, and pending/error feedback.

Prefer compound components when a family shares context and semantics but consumers must compose parts—for example `DataTable.Root`, `DataTable.Toolbar`, and `DataTable.Pagination`. Keep the public parts small, expose controlled state where integration requires it, and do not hide essential semantics inside visual wrappers.

Use cards to group content that has a shared boundary, action, or comparison unit. Do not use a card merely to decorate every section. Prefer spacing, headings, dividers, or a grid when content already shares page context.

## Transform responsively

Specify a transformation, not “make responsive”:

- Reflow multi-column regions in a meaningful reading order.
- Convert a dense table to horizontal scroll, priority columns, or an alternate list only when comparison remains possible.
- Move secondary filters/actions into a drawer or disclosure while keeping the primary task visible.
- Collapse navigation labels without removing accessible names.
- Keep touch targets, sticky regions, overlays, and virtual keyboards within the viewport.

Do not independently hide desktop content and invent mobile content; keep one state/data source and change presentation.

## Assign state ownership

Keep server/cache state with the data layer, URL-shareable filters in the URL, form state within the form boundary, overlay open state at the closest coordinating owner, and purely visual ephemeral state local. Derive values instead of synchronizing duplicate state. Every async owner must expose loading, empty, error, and success to the content region that renders them.

## Choose the page pattern

### Dashboard

Use shell → page header/time scope → summary → primary analysis → supporting detail. Make one analytical question dominant. Treat metrics as a comparison group, not unrelated glowing cards. Keep filters close to affected data and give charts a textual summary.

### Marketing

Use promise → evidence → explanation → proof → decision/CTA. Let product content and brand imagery drive distinction. Keep repeated feature blocks scannable; use motion only to reveal relationships or demonstrate behavior.

### Settings

Group by user mental model and consequence. Use the foundation's forms, descriptions, validation, save feedback, and dialogs. Separate autosaved fields from explicit-save sections; isolate dangerous actions and explain impact.

### CRUD/workspace

Use collection controls → results → selection/detail → create/edit flow → feedback. Preserve filters and pagination where appropriate. Define permissions, optimistic/pending behavior, empty onboarding, errors, and destructive confirmation.

### Commerce

Use discovery → evaluation → selection → commitment → confirmation. Keep price, availability, variants, delivery/returns, and primary purchase action coherent. On mobile, preserve product context and totals around sticky actions; never let decoration compete with product evidence.

Across patterns, implement only regions justified by the brief and Component Plan. Reuse primitives before creating a new abstraction; extract a shared component only when repeated behavior and ownership are genuinely the same.
