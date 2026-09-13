# Agent contribution guide

## Source of truth

Read [`_docs/specs.md`](_docs/specs.md) before planning or changing the product. It is the authority for the MVP scope, architecture, visual design, reliability model, and acceptance criteria. Keep the implementation database-portable and do not add explicitly out-of-scope features without a GitHub issue that changes the scope.

## Required GitHub issue workflow

Every task must have a GitHub issue before an agent starts work. The issue is the source of truth for the task's goal, scope, acceptance criteria, constraints, and definition of done.

1. Confirm the issue exists and read it in full before making changes.
2. Update the issue when work starts with the task details: intended approach, scope, acceptance criteria, and any assumptions or dependencies.
3. Do the work in a dedicated branch named for the issue, for example `feature/123-project-board` or `fix/123-board-action-retry`.
4. Keep the issue updated with meaningful work notes, including important design choices, validation performed, blockers, and scope changes.
5. Commit the completed work to the issue branch and push it.
6. Raise a pull request linked to the issue. The PR must describe the change, list validation evidence, and use a closing reference such as `Closes #123` where appropriate.
7. Request review. Do not merge or close the issue before the PR has been approved and merged.
8. After approval and merge, update the GitHub issue with completion work notes: what was done, relevant validation results, the PR link, and any follow-up work. Confirm that the linked, merged PR closes the issue; close it manually only if automatic closure did not occur.

Do not work around this lifecycle by implementing an untracked task, committing directly to the default branch, or reporting completion only locally.

## Engineering rules

- Keep changes focused on one issue. Preserve unrelated edits already present in the working tree.
- Prefer small, reviewable commits with clear messages that reference the issue number.
- Do not add dependencies, secrets, generated build artefacts, or local environment files without documenting the reason in the issue and PR.
- Do not commit `.env` files, credentials, tokens, or local database files. Update `.env.example` only with non-secret placeholders when configuration changes.
- Keep frontend API access in the service layer; React components must not call `fetch` or Axios directly.
- Keep business logic out of FastAPI route handlers; use the API, schema, service, repository, model, and worker separation defined in the specification.
- Use SQLAlchemy abstractions that work with both SQLite and PostgreSQL. Do not depend on vendor-specific core behaviour.
- Board movement must remain durable: persist a `BoardAction` before acknowledging a move, enforce idempotency, process actions FIFO with one worker, and recover pending or stale actions safely.
- Preserve optimistic frontend updates and reconciliation on failed actions.

## Quality checks

Before raising a PR, run the relevant backend and frontend tests, formatting/linting, type checks, and a Docker Compose smoke test when the changed area supports it. Verify every acceptance criterion in the issue, not just the happy path. Include exact commands and results in both the PR and the final GitHub issue work note.

For UI changes, verify responsive board scrolling, keyboard/focus behaviour, visible feedback states, and the Tasklane visual system: light neutral surfaces, restrained green accent, sparse indigo, compact typography, and no gradients or heavy shadows.
