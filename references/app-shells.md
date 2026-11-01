# App Shells

A shell is a contract between pages: the same navigation, the same header, the same content
width, the same places for loading and failure. It is decided once and reused, not re-invented
per page.

## Start from the route map

Inventory before designing:

```bash
node .agents/skills/component-driven-frontend/scripts/inspect-shell.mjs --root . --json
```

It reports the router, every route, the layout chain, route groups, dynamic segments, and which
segments declare `loading` / `error` / `not-found`. A section with several pages needs a shared
shell; a single page does not.

## Shell anatomy

| Region | Owns | Does not own |
|---|---|---|
| Global nav | product areas, account, workspace switcher | page-specific actions |
| Page header | title, breadcrumb, page actions, tabs | global navigation |
| Content | page hierarchy, data, states | shell chrome |
| Detail panel | selected record, contextual actions | list filtering |
| Status/meta bar | sync state, environment, last updated | primary actions |

Keep business content out of the shell. A shell that fetches page data couples every route to
one failure mode.

## Choose the navigation model

| Product | Model | Notes |
|---|---|---|
| Operational tool, 5–9 areas | sidebar + topbar | persistent sidebar, collapsible to icons, drawer under 1024px |
| Content or commerce, few areas | topbar + footer | horizontal nav, active underline, drawer under 900px |
| Deep workspace, many objects | sidebar + command palette | palette for navigation and actions, `⌘K` discoverable |
| Mobile-first | topbar + bottom nav (≤5 items) | bottom nav never scrolls away; overflow into "More" |
| Marketing | topbar + footer, no sidebar | nav collapses to a drawer with labelled trigger |

Rules that keep it coherent:

- One active state style. `aria-current="page"` plus a visible marker, not color alone.
- Navigation labels are nouns that match destination headings. Do not rename an area between
  the nav and the page title.
- Collapse the sidebar before hiding items. Icon-only mode keeps accessible names.
- The command palette is a shortcut, never the only path to a destination.

## Page templates per section

**Dashboard** — page header (time scope + refresh) → summary metrics → one dominant analysis →
supporting detail. Filters sit next to the data they affect. Each chart answers a named question.

**Collection → detail** — toolbar (search, filters, view switch) → table or list → detail panel or
route. On desktop a side panel preserves list context; on mobile the detail becomes a route.
Keep filters in the URL so back/forward and sharing work.

**Settings** — grouped by user mental model, not by backend resource. Autosave and explicit-save
sections are separated and labelled. Dangerous actions sit apart with a confirmation.

**Workspace / CRUD** — collection controls → results → selection → create/edit flow → feedback.
Define permissions, optimistic/pending behavior, and the empty onboarding state.

**Auth** — no shell navigation, one focal task, brand present but quiet, errors inline.

**Marketing** — promise → evidence → explanation → proof → decision. Repeated feature blocks stay
scannable; motion reveals relationships rather than decorating.

## Delegate states to the right segment

For Next App Router, put the boundary at the segment that owns the data:

- `layout.tsx` — shared chrome and providers, never page data.
- `page.tsx` — page composition and data.
- `loading.tsx` — route-level skeleton shaped like the page, not a spinner.
- `error.tsx` — segment failure with retry; keep the shell visible.
- `not-found.tsx` — missing record inside the shell.

Route-level loading must not replace the shell. If only one region is pending, use a region-level
Suspense boundary and keep nav, header, and filters interactive.

## Multi-page coherence

- One page-header pattern across routes: same title size, same breadcrumb position, same action
  slot. Pages that each invent a header read as different products.
- Breadcrumbs derive from the route map, not from hand-written strings.
- Route changes reset scroll; in-page navigation does not. Decide per app and keep it consistent.
- Selection survives navigation where the user expects it (detail panel, filters, table page).
- Transitions between sibling routes stay short (≤320ms) and never block input.
- Global state (workspace, account, theme) lives in the shell; URL state lives in the route.

## Responsive shell transformations

| Desktop | Narrow |
|---|---|
| Sidebar visible | Drawer with labelled trigger, focus trapped, Esc closes |
| Topbar actions inline | Overflow menu keeps destructive actions separated |
| Side panel detail | Detail route with back to list, preserving filters |
| Table with 6+ columns | Priority columns + row disclosure, or card list |
| Tabs visible | Tabs scroll or collapse into a select, never disappear |

Preserve reading order, focus return, and touch targets through every transformation.

## Shell accessibility

- One `banner`, one `navigation` landmark per nav, one `main` per page.
- Skip link to `#main` as the first focusable element.
- Focus moves to the new page heading after client-side navigation, announced once.
- Overlays restore focus to their trigger; drawers trap focus only while open.
- Mobile nav and account menus are operable by keyboard and have accessible names.

## Review checks

- Every route renders inside the same shell without layout shift at the seam.
- One active nav state, one page-title pattern, one breadcrumb source.
- Loading and error states keep the shell and the page header.
- Sidebar collapse, drawer, and overflow menu all keep accessible names.
- Route changes manage scroll, focus, and title consistently.
- No page fetches data inside the shell layout.
