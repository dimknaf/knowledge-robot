# Contributing to Knowledge Robot

Thanks for taking the time to contribute. This document captures the small set of
conventions we follow so that the public history stays readable.

## Branching

- The default branch is `master`.
- Branch off `master` for every change. Branch names follow the pattern
  `<type>/<short-description>`, e.g. `feat/csv-multi-row-paste`,
  `fix/firecrawl-truncation`, `docs/security-policy`,
  `redesign/professional-ui-v1.1`.

## Commit messages — Conventional Commits

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
Each commit subject is one of:

- `feat(scope): …` — user-visible feature change
- `fix(scope): …` — bug fix
- `docs(scope): …` — documentation only
- `refactor(scope): …` — code change, no behavior change
- `test(scope): …` — tests only
- `chore(scope): …` — tooling, deps, repo hygiene
- `ci(scope): …` — CI/CD configuration
- `perf(scope): …` — performance improvement

`scope` is optional but encouraged. Use `frontend`, `backend`, `repo`, or a
component name (e.g. `feat(frontend/results-table): …`).

## Pull requests

- One logical change per PR. Use squash-merge.
- The PR title MUST be a Conventional Commits subject — that line becomes the
  squash-merged commit on `master`.
- Use `.github/PULL_REQUEST_TEMPLATE.md`. Frontend visual changes require
  before/after screenshots.
- Both CI jobs (`backend` pytest, `frontend` lint+test) must be green before
  merge.

## Versioning — single shared version (lockstep)

The repository ships as one product. `frontend` and `backend` carry the
**same version number** and bump together (lockstep), even when only one side
changes in a given release.

- Frontend version lives in `frontend/package.json`.
- Backend version is the literal in `backend/API/api.py` (the `version` field
  of the `/health` response).

Both must be updated to the same value in the same PR that introduces the
release. Tags use the form `v<version>` (e.g. `v1.1.0`). Update
`CHANGELOG.md` in the same PR.

## Local checks before opening a PR

```powershell
# Frontend
cd frontend
npm run lint
npm run test
npm run build

# Backend
cd backend
pytest tests/ -v
```

If you cannot run one half (e.g. you only touched the frontend), say so in the
PR's Test Plan and lean on CI to cover the other side.

## Reporting a vulnerability

See `SECURITY.md`.
