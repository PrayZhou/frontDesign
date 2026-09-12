# Source Adapters

Use source truth that is available now. Discovery is read-only with respect to project files; installation is a separate, authorized action.

## Inspect project truth

Run:

```bash
node .agents/skills/component-driven-frontend/scripts/inspect-project.mjs --root . --json
node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source project --query 'dialog' --root . --json
```

Trust discovered component paths, dependencies, design systems, `components.json`, registries, and theme files only within the reported confidence and warnings. `globals.css` alone is not Tailwind evidence; require a Tailwind dependency/config or a Tailwind directive/import. Application frameworks take priority over build-tool signals, so a Remix + Vite project reports Remix as primary while retaining Vite in `framework.detected`. When several foundations are detected, `activeFoundation` remains `null` with a conflict warning; inspect the relevant page and imports before resolving it. If no repository exists, mark all project facts unknown and do not fix a stack or component name.

## Query shadcn-compatible registries

The wrapper does not execute network commands. It returns `status: "requires-command"`, an empty candidate list, warnings, and a shell-quoted `nextActions` command.

```bash
node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source shadcn --query 'data table' --root . --json
node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source magicui --query 'animated hero' --root . --json
node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source aceternity --query 'background' --root . --json
```

When network discovery is authorized and available, run only the returned search command. Its current forms are:

```bash
npx shadcn@latest search 'data table'
npx shadcn@latest search @magicui -q 'animated hero'
npx shadcn@latest search @aceternity -q 'background'
```

For Magic UI or Aceternity, require the corresponding `@magicui` or `@aceternity` registry configuration reported from `components.json`; otherwise treat the result as unavailable until configured. Search output verifies availability; a remembered gallery name does not. Do not run `shadcn add` during discovery.

For an obtained shadcn-registry JSON file, normalize and rank it offline:

```bash
node .agents/skills/component-driven-frontend/scripts/query-components.mjs --source registry-file --registry-file <registry.json> --query 'toast' --json
```

The CLI's `registry-file` source is deliberately namespace-neutral. Its candidates use `installCommand: null` and carry a warning because a local JSON file does not prove a trusted install namespace. Do not transform that source label into `@registry-file/...`; obtain and verify the Registry's real namespace separately. A successful query may still return zero candidates when no normalized name, capability, or description token matches.

## Stay within installed foundations

The inspector detects these package signals:

| Foundation | Package evidence | Read-only confirmation |
|---|---|---|
| HeroUI | `@heroui/react` or `@nextui-org/react` | `npm ls @heroui/react @nextui-org/react --depth=0 --json` |
| Mantine | `@mantine/core` | `npm ls @mantine/core --depth=0 --json` |
| MUI | `@mui/material` | `npm ls @mui/material --depth=0 --json` |
| Ant Design | `antd` | `npm ls antd --depth=0 --json` |

Run the matching command only after detecting that package manager/project. A nonzero `npm ls` means presence was not confirmed; it is not permission to install. Query current project wrappers with `--source project`, then inspect local imports and type declarations for actual usage. Use current official documentation or a verified MCP result for catalog/API details. Prefer that same foundation's primitive; do not substitute shadcn or another foundation for forms, overlays, or navigation.

There is no online catalog adapter in this skill for HeroUI, Mantine, MUI, or Ant Design. If local source and a current official source are both unavailable, stop selection and report the unverified capability. Never infer exports from memory.

## Use MCP as an optional adapter

Inspect available callable tools first. When supported by the runtime, use `list_mcp_resources` and `list_mcp_resource_templates` for relevant configured servers, then read only the selected resource. Prefer a purpose-built component/Figma/Code Connect tool over generic search. Treat tool absence, authentication failure, stale output, or an unrelated server as `unavailable`; continue with local/official sources or stop that selection. MCP is an enhancement, never a prerequisite and never proof until its result names the component and source.

For every candidate, retain the stable fields documented in [component selection](component-selection.md): source, exact name, description/retrieval context, capabilities, dependencies, Registry dependencies, verified install command or `null`, documentation URL or `null`, discovery-only `relevanceScore`, and warnings. Do not convert `requires-command`, an empty result, or a failed command into a candidate, and do not present discovery relevance as the separate final-fit score.
