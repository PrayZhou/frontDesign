# Content and Data

Content is part of layout, hierarchy, and interaction. Design with representative content before polishing effects.

## Content model

Record the user's content units, expected length, priority, and fallback:

- labels and headings: short, long, localized, and wrapped cases;
- values: realistic ranges, units, dates, numbers, and unavailable values;
- actions: one primary action plus clearly subordinate alternatives;
- status copy: loading, empty, error, permission, offline, partial, and success;
- ownership: who edits, confirms, retries, or dismisses the content.

Never use invented testimonials, customer counts, performance claims, or metrics as proof. If content is unknown, design an honest placeholder that does not imply a fact.

## State coverage

Every data-backed region should preserve its geometry across loading, empty, error, and success. Add permission, offline, partial, or stale states when the product can encounter them. Empty states explain why the region is empty and what the user can do next; errors explain the problem and offer recovery when possible.

Avoid replacing an entire page with a spinner when only one region is pending. Preserve user input and context across retry and failure.

## Data visualization

Start with the question:

1. What comparison, trend, distribution, or relationship must the user understand?
2. What data state and time range apply?
3. Which mark and encoding communicate that question with the least cognitive load?
4. What text summary or table alternative provides the same conclusion without the graphic?
5. How will color, labels, sorting, and responsive layout remain interpretable?

Charts are not decoration. Do not use color as the only distinction, hide axes that establish meaning, or imply precision the data cannot support. On mobile, preserve the question and key values; move detail into a disclosure or accessible table rather than shrinking labels until they are unreadable.

When chart work is substantial, defer detailed mark/palette guidance to the repository's dedicated dataviz Skill, while this Skill still requires the question, states, text alternative, and responsive behavior in the plan.

## Content QA

Before acceptance, test long labels, empty arrays, error copy, localized number/date formats, 200% zoom, 320px width, and keyboard navigation. Check that truncation has an accessible full value and that important actions remain visible.
