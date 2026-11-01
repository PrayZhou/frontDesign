# State Compositions

States are layouts, not messages. A region that changes height when it fails breaks the
page around it, so every state keeps the geometry of the resolved content and explains
what happened.

## Rules that apply to every state

- Keep the region's header, toolbar, and columns when only the body changes.
- Preserve geometry: the loading, empty, error, and success states occupy the same box.
- One state per region. Never replace the whole page for a single pending section.
- Explain, then act: what happened, and the one thing the user can do next.
- Keep focus and scroll position; never clear input to show an error.

## Loading

- Prefer skeletons that mirror the final layout over a spinner. A spinner inside a 400px
  card tells the user nothing about what is coming.
- Shimmer cycle 1.2–1.6s. Skeleton color sits 4–6% away from the surface, radii match the
  real content.
- Delay before showing: 150–300ms, then keep the state visible for at least 300ms so it
  does not flash on fast responses.
- Reduced motion: a static tint, no shimmer.
- Row counts: 5–8 skeleton rows for tables; 3–4 lines for text blocks; card skeletons match
  the real card padding.

```text
┌──────────────────────────────────┐
│ ▨▨▨▨▨▨   (label, 12–13px)        │
│ ▨▨▨▨▨▨▨▨▨▨▨▨  (value, 24–32px)   │
│ ▨▨▨▨  ▨▨▨▨▨▨  (delta, 12–13px)   │
└──────────────────────────────────┘
```

## Empty

Anatomy, in order: an optional icon (24–32px, muted), a title in one sentence, an optional
body explaining why it is empty, exactly one action, and an optional secondary link.

- Distinguish first-run, filtered-empty, and permission-empty. The copy and the action
  differ: "Create your first report" vs "No results match these filters — clear them".
- Keep the toolbar visible so the user can change the filters that produced the empty state.
- Center block width 360–420px, gap 24px above the title and 12px between title and body.
- No large illustration over 30% of the region height; no "No data" as the whole message.

```text
        ┌───────────────────────────┐
        │        (icon 24–32)        │
        │   No results in this range │
        │  Adjust the date range or  │
        │  clear the filters.        │
        │        [ Clear filters ]   │
        └───────────────────────────┘
```

## Error

Anatomy: what failed, why if known, what to do, and a retry that is safe to click twice.

- Inline error for a field; region error for a section; page error only when nothing else
  can render.
- Keep user input, filters, and scroll. Offer retry plus one alternative (reload, contact,
  switch source).
- Show a request ID or timestamp when support will need it; never a raw stack trace.
- Partial and stale data: render what exists, mark it with a badge and "updated 4m ago",
  and offer refresh. Do not blank the region to admit the data is old.
- Offline: state it plainly, keep cached content readable, retry on reconnect.

```text
┌──────────────────────────────────┐
│ ⚠ Could not load account health    │
│ The data service did not respond.  │
│ [ Try again ]   [ View last data ] │
└──────────────────────────────────┘
```

## Success and progress

- Confirm near the object that changed; a toast only for non-blocking, out-of-view results.
- Destructive actions: preserve context, offer undo where possible, and never move focus
  unless the task is complete.
- Long operations: show step or percentage only when it is real. Never fake progress.

## Permission and not found

- Permission: say which permission is missing and who can grant it; do not pretend the
  resource does not exist when the user knows it does.
- Not found: keep global navigation, offer search or back, and avoid a dead end.

## Review checks

- Every state preserves the resolved geometry.
- The empty state names a cause and an action.
- The error state keeps input and scroll and offers retry.
- Loading is regional, not page-level, and does not flash.
- Reduced motion removes shimmer and travel but keeps the state.
