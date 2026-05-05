# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The repository ships as one product. `frontend` (`frontend/package.json`) and
`backend` (`backend/API/api.py`) share a single version and bump together
(lockstep), even when only one side changes in a release. Tags use the form
`v<version>`.

## [Unreleased]

## [1.1.0] - 2026-05-06

### Changed

- Visual redesign of the frontend to a Stripe Dashboard-inspired aesthetic:
  full-bleed hero header with brand mark + live backend status chip, layered
  duotone shadows, Stripe purple primary (`#635bff`) on a faint cool-purple
  page wash, KPI stat-card row above the results table, numbered step badges
  (1–4) on every workflow section, Bot icon brand mark.
- Introduced a CSS-variable design-token system in
  `frontend/app/globals.css` (`--background`, `--surface`, `--foreground`,
  `--primary`, status colors, radii, layered shadows, `.step-badge`,
  `.hero-backdrop`, `.eyebrow`, status-dot utilities). Every component now
  consumes tokens, so a future palette swap is a one-place edit.
- Typography ladder: 15px html base, h1 ~30px bold tracking-tight, h3
  base-weight semibold, tabular-nums on every number column / counter / row
  index / progress percentage.

### Added

- Vitest + React Testing Library frontend test harness — first 5 suites
  (40 tests) covering `profileUtils` (including the load-bearing legacy
  profile migration), `csvParser`, `ColumnTags`, `OutputSchemaBuilder`, and
  the `ResultsTable` schema-derived columns regression guard.
- `frontend` job added to `.github/workflows/test.yml` (lint + vitest,
  parallel to the existing backend pytest job).
- `BackendStatusChip` in the hero — pulls `model` and `llm_profile` from
  `/api/agent-status` and renders a live "Connected · local · gemma-4-31B-it"
  pill. Falls back to "Offline" if the status fetch fails.
- README tutorial video embed at the top
  ([youtu.be/wnuQufwRAXE](https://youtu.be/wnuQufwRAXE)).
- Repo conventions (first time, since the repo just went public):
  `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`.

### Fixed

- `FileUpload`: the entire dashed drop zone is now clickable. Previously
  only the inline "Click to upload" link triggered the file picker; the
  rest of the box did nothing despite visually inviting clicks. Outer div
  is now `role="button"` with full-area click + Enter/Space keyboard
  activation.

### Unchanged (intentionally)

- All HTTP API contracts (request / response shapes, defaults, error shape,
  `submit_result` tool-call protocol) are identical to v1.0.0.
- All component props, JSX layout / order, state shape, and runtime
  behavior are unchanged. The redesign is a className / CSS-variable /
  additive-element pass — no behavioral surface moved.
- Worker-pool concurrency, profile JSON shape, and CSV parsing all behave
  identically.

## [1.0.0] - 2026-04-XX — Initial public release

### Added

- Initial public Apache-2.0 release of Knowledge Robot — Next.js frontend +
  Python Flask backend agentic AI for repetitive knowledge-work tasks.

[Unreleased]: https://github.com/dimknaf/knowledge-robot/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/dimknaf/knowledge-robot/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dimknaf/knowledge-robot/releases/tag/v1.0.0
