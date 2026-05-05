<!--
  PR title MUST be a Conventional Commits subject (see CONTRIBUTING.md).
  Examples:
    feat(frontend): …
    fix(backend): …
    docs(repo): …
-->

## Summary

<!-- One or two sentences. What does this PR change, and why does it matter? -->

## Motivation

<!-- The problem, ticket, incident, or user feedback that prompted the change. -->

## Changes

<!-- Bullet list of what was actually modified. Group by side: frontend / backend / repo. -->

-

## Screenshots

<!--
  REQUIRED for any frontend visual change. Drop before/after pairs of every
  screen the change touches. Skip this section ONLY for backend / docs / CI PRs.
-->

## Test plan

<!--
  How did you verify the change locally? Commands run + manual smoke walk.
  Examples:
    - [ ] `cd frontend && npm run lint`
    - [ ] `cd frontend && npm run test`
    - [ ] `cd backend && pytest tests/ -v`
    - [ ] Manual: uploaded sample-data3.csv, ran 3 rows with concurrency 2
-->

- [ ]

## Versioning

<!-- Tick all that apply. -->

- [ ] No version bump (chore / docs / refactor / test only)
- [ ] Frontend bump (`frontend/package.json`) — new version: `_._._`
- [ ] Backend bump (`backend/API/api.py` `version` literal) — new version: `_._._`
- [ ] `CHANGELOG.md` updated in this PR

## Breaking changes

<!-- Anything that downstream consumers (API callers, profile JSON readers) must adapt to. Default: None. -->

None.

## Checklist

- [ ] PR title follows Conventional Commits
- [ ] Branch name follows `<type>/<short-description>`
- [ ] Local lint + tests pass for the side(s) I changed
- [ ] No `.env` / API keys / secrets committed
- [ ] Screenshots included for frontend visual changes
