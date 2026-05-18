# Testing conventions

The bootstrap slice (issue #01) introduces the first tests. Everything below is the **prior art** for later slices — when you add tests, follow these conventions.

## Where tests live

| Test type | Location | Filename pattern | Runner |
| --- | --- | --- | --- |
| Unit / module integration | colocated with source | `*.test.ts` | Vitest |
| End-to-end smoke | `frontend/tests-e2e/` | `*.spec.ts` | Playwright |

Colocating unit tests with the module they test (e.g. `lib/stub-report.ts` and `lib/stub-report.test.ts` next to each other) keeps the contract and its check visible on the same file listing. Playwright specs are isolated because they have a different runner, different lifecycle, and a different mental model.

## Running

| Command | What it runs |
| --- | --- |
| `pnpm test` | Vitest, one-shot. CI uses this. |
| `pnpm --filter frontend test:watch` | Vitest in watch mode (for local TDD loops). |
| `pnpm test:e2e` | Playwright (requires `pnpm exec playwright install chromium` once; starts the production build, then Chromium). |
| `pnpm lint` | `next lint` (ESLint via `eslint-config-next`). |
| `pnpm typecheck` | `tsc --noEmit`. |

## What to test (and what not to)

Test the **observable contract** of a module, not its internals. Concretely:

- **DO** drive tests through the module's exported interface. Build inputs, invoke, assert on outputs.
- **DO NOT** mock collaborators owned by the module under test. If you find yourself reaching for `vi.mock("./internals")`, the test is coupling to implementation.
- **DO NOT** assert on call counts of internal functions or on the shape of internal data structures.
- **DO NOT** bypass the interface to verify side effects (e.g., reading the database directly to check what a service wrote — instead, read it back through the service).

For LLM-dependent code (Stage 1 Extract, dimension scoring), follow PRD §12.3: only smoke-test through the full pipeline; don't write brittle assertions on stage-1 outputs in isolation. Pure aggregation / shaping / resolution logic (e.g., `score` weighted aggregation, `graph-build` entity-resolution rules) **is** in scope for tight unit tests because it's deterministic.

## TDD loop

The skill in `.agents/skills/tdd/` is the canonical reference. Short version:

1. Write **one** failing test for the next behavior. Run it. Confirm it fails for the right reason (not a syntax error, not a missing import — a real assertion failure).
2. Write the **minimal** code that makes it pass. No speculative features, no anticipating future tests.
3. Refactor only after green. Run tests after each refactor step.
4. Repeat — one test at a time, vertical slices, not horizontal "all tests first, all code second."

## E2E scope

Playwright covers **end-to-end smoke only**. The single test in this slice (`tests-e2e/queries.spec.ts`) proves the form submits, the API echoes, and the stub Report renders. It is **not** a substitute for unit tests of the pipeline modules — those land in their respective slices.

E2E specs are gated on a built app (`next build` + `next start`), not on `next dev` — closer to production behavior, and avoids HMR flake.

## Database in tests

The bootstrap slice does not touch the database from test code yet (the route handler doesn't persist anything). When tests start needing the database, the convention is:

- Use a **dedicated test database** (e.g., `bridgeai_test`) populated by `prisma migrate deploy` before the suite runs.
- Tests own their fixtures — they create the rows they read; they do not assume seed data from previous tests.
- The Postgres service container in `.github/workflows/ci.yml` provides the test database in CI. Locally, `docker-compose up postgres` is the standard.

This document evolves with the codebase. When a slice introduces a new testing pattern (e.g., snapshot tests for Report renders, LLM response replay), update this doc in the same PR.
