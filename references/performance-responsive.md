# Responsive and Performance

A polished interface remains clear while its structure, content, and effects adapt to real devices.

## Responsive contract

Define behavior for desktop, tablet, mobile, and a 320px narrow case. Specify transformations, not only breakpoints:

- navigation becomes a labelled drawer or preserves essential links;
- multi-column content becomes a priority stack;
- secondary table columns move behind disclosure or contained scrolling;
- toolbars group, wrap, or expose an overflow action;
- dialogs fit the viewport and preserve focus return;
- touch targets remain at least 44 CSS px where practical.

Verify reading order, accessible names, no horizontal overflow, orientation changes, 200% zoom, and keyboard access. Mobile is a structural composition, not a smaller desktop screenshot.

## Visual performance

- Reuse project fonts and reserve space before fonts and images arrive.
- Give images dimensions, use responsive sources, and avoid layout shifts.
- Prefer transform and opacity for repeated motion.
- Bound blur, shadow, backdrop filtering, parallax, video, and pointer-driven effects.
- Do not re-render the whole page for high-frequency pointer or scroll events.
- Keep expensive client-only behavior near the region that needs it.
- Provide reduced-motion and reduced-transparency fallbacks.

Record new dependencies, large assets, client-only components, and expensive effects in the plan. A visual effect that is impossible to understand without animation is a quality defect.

## Budget questions

Before implementation, answer:

- What new package or asset is added, and why?
- Which region owns the interaction and its state?
- How many repeated animated elements can exist?
- What happens on slow network, low-power devices, and disabled motion?
- Does loading reserve the same layout space as the resolved content?

Use project performance tooling when available. If no measurements were run, report the performance review as an assumption rather than a completed benchmark.
