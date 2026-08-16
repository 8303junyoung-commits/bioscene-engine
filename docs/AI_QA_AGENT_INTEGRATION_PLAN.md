# BioScene AI QA Agent Integration Plan

## Current architecture audit

- Application: Vite 7 + React 19 + React Flow, single-page editor with local autosave and optional Supabase collaboration.
- State: scene nodes, edges, molecule definitions, workspace, views, and undo/redo stacks are owned by `AppCanvas` in `src/App.tsx`.
- Tests: deterministic Node/Vite suites for core biology, migration, UniProt, and canvas presets. No browser test framework was present.
- Build: `pnpm build` runs TypeScript and Vite. GitHub Actions runs install, lint, tests, and build.
- Browser integration: no stable QA selectors and no controlled application-state interface existed.
- Gemini: no client dependency or API key usage existed in either production or development code.

## Proposed architecture

```text
QA runner
├── scenario loader and tag filter
├── Playwright controller
│   ├── browser primitives
│   ├── BioScene action helpers
│   ├── console/network collection
│   └── milestone screenshot manager
├── deterministic assertion engine
├── read-only window.__BIOSCENE_QA__ instrument panel
├── Gemini client (optional, QA-only process)
│   ├── visual reviewer
│   ├── failure analyst
│   ├── test planner
│   └── whitelist-only exploratory planner
├── hash cache and API budget
└── JSON/Markdown report generator and regression comparer
```

Production UI code never imports Playwright or Gemini. The only application-side addition is an opt-in, read-only state snapshot exposed when `VITE_BIOSCENE_QA=true` or while running the Vite development server.

## Dependencies

- `@playwright/test`: browser lifecycle, actions, screenshots, downloads, console and network events.
- Node built-ins: reporting, hashing, cache, fixtures, and Gemini REST calls.
- No Gemini SDK in the production dependency graph. The QA client uses the official `generateContent` REST endpoint with `x-goog-api-key`.

## Security and privacy

- `GEMINI_API_KEY` is read only by the Node QA process and is never exposed through `VITE_*` variables.
- `.env*` remains ignored; `.env.example` contains names and safe defaults only.
- External AI is off by default and requires both `QA_GEMINI_ENABLED=true` and `QA_EXTERNAL_AI=true`.
- Visual and exploratory fixtures use public molecules or synthetic construct names only.
- The Gemini action planner can select only fixed actions (`click`, `type`, `select`, `drag`, `press`, `wait`, `inspect`, `screenshot`) mapped to controlled Playwright helpers. It cannot execute JavaScript, shell commands, URLs, or arbitrary selectors.
- AI output is labelled `AI OBSERVATION`; deterministic assertions remain authoritative.

## Cost control

- Default model: `gemini-3.5-flash-lite`, configurable in one place through `GEMINI_MODEL`.
- Gemini is disabled for smoke and full deterministic runs.
- `QA_GEMINI_MAX_CALLS`, `QA_GEMINI_MAX_TOKENS`, and `QA_EXPLORATORY_MAX_STEPS` are enforced before requests.
- Screenshots are sent only at visual checkpoints, deterministic failures, and selected exploratory milestones.
- Prompt + screenshot hashes cache identical reviews locally.
- Gemini failure never prevents deterministic reports from being written.

## Test plan

Critical deterministic coverage starts with application launch, empty workspace creation, membrane creation/deletion, undo/redo, object move/duplicate, molecule setup, save/load persistence, and absence of unhandled browser errors. Full mode adds workspace resize, multiple membranes, scene scopes, molecule classification, antibody formats, and seeded stress actions.

Visual mode reviews canonical public/synthetic figures against overlap, clipping, alignment, label readability, biological silhouette identity, membrane/receptor placement, arrow clarity, hierarchy, and obvious UX confusion. It does not claim scientific truth.

Exploratory mode runs bounded missions with a maximum action count and duration. Each AI-selected action and concise rationale is recorded without chain-of-thought.

## Implementation phases

1. Playwright controller, stable selectors, read-only QA API, deterministic smoke suite, and reports.
2. Optional Gemini visual reviewer with structured output, cache, privacy switch, and budgets.
3. Whitelist-only Gemini exploratory missions and action traces.
4. Regression history, canonical baselines, visual diffs, seeded stress tests, and CI smoke gate.

## Definition of done

- `pnpm qa:smoke` launches an isolated app, creates an empty 16:9 workspace, draws/deletes/restores a membrane, opens molecule setup, verifies save/load state, and writes a structured report.
- `pnpm qa:full` runs all deterministic tags and fails when a critical scenario fails.
- `pnpm qa:visual` performs deterministic checkpoints and, only when explicitly enabled, obtains structured Gemini visual observations.
- `pnpm qa:explore` executes bounded, whitelisted missions and records actions, UX findings, screenshots, console errors, and network errors.
- Every run writes `QA_REPORT.md`, `QA_RESULT.json`, screenshots, `console.log`, and `network.log` under a timestamped report directory.
