# Research Ingestion

Use research to improve a design decision, not to manufacture a component catalog. The default path is offline and evidence-first.

## Accepted evidence

- Explicit user requirements and brand rules.
- User-provided screenshots, Figma exports, annotations, and local documents.
- Current project tokens, components, and rendered output.
- Obtained official documentation or a URL explicitly supplied for review.
- Observed patterns recorded with a narrow claim and clear scope.

Do not treat model memory, an unexecuted search command, a remembered gallery item, or an unverified component name as source truth.

## Evidence record

```json
{
  "id": "evidence-id",
  "type": "user-brief|figma|screenshot|local-doc|official-doc|observed-pattern",
  "source": "Human-readable source description",
  "claim": "One narrow design or implementation claim",
  "appliesWhen": ["dashboard", "responsive"],
  "confidence": "high|medium|low",
  "capturedAt": "2026-09-12",
  "freshness": "current|needs-review|historical",
  "constraints": ["Do not override supplied brand guidance"],
  "notes": "Optional context"
}
```

## Protocol

1. Capture the smallest useful claim rather than copying a whole page.
2. Preserve provenance, date, scope, confidence, and freshness.
3. Separate user evidence from Skill defaults and internal principles.
4. When sources conflict, report the conflict and follow the higher-authority source.
5. Convert a reference into a transferable rule: hierarchy, composition, token rhythm, content behavior, interaction, or QA criterion.
6. Keep copyright-sensitive assets, brand marks, and copied layout out of reusable cards unless the user supplied permission and the implementation requires them.
7. Mark redirects, authentication failures, stale snapshots, missing licenses, and incomplete captures as warnings.

## External sources

The Skill does not automatically browse or install anything. If an external source is explicitly obtained, retain its URL, publisher, retrieval time, usage/license note, and the exact claim it supports. A source adapter may return `requires-command`, `offline`, `unavailable`, or `verification-failed`; none of these statuses is evidence that a reference exists.

Visual reference research is separate from installable component discovery. Do not turn a visual inspiration source into a Candidate, and do not turn a Registry Candidate into a visual-quality authority without inspecting its rendered behavior.
