# Tech stack: TypeScript + Next.js 14 (App Router) + Prisma + Postgres

## Status

accepted

## Context

BridgeAI MVP delivers a web product with three primary screens (New Query, ExtractedQuery review, Report viewer) plus a small HTTP/JSON API surface for Query intake, ExtractedQuery confirmation, status polling, and Report retrieval (PRD §11.6). The product is delivered as 11 vertical slices (`.scratch/mvp/issues/`); each slice spans frontend + API + data layer + tests.

We need a stack that:

- Lets a single contributor (or a very small team) ship a slice end-to-end without context-switching languages or repos.
- Has mature ORM + migration tooling — the storage schema in PRD §11.3 + ADR-0001 is non-trivial, and migrations must be a routine operation.
- Has first-class TypeScript support across frontend, API, and data access — type drift between layers is the most common source of regressions in this shape of product.
- Is conventional enough that ramping a new contributor takes hours, not days.

## Decision

- **Language:** TypeScript (strict mode) across frontend, API, and tooling.
- **Application framework:** Next.js 14 with the App Router. Frontend code under `frontend/app/`, API surface under `frontend/app/api/*/route.ts` as Route Handlers (no separate Node backend service).
- **ORM:** Prisma 5. Schema lives at `prisma/schema.prisma` (repo root); migrations under `prisma/migrations/`.
- **Database:** PostgreSQL 16.
- **Package manager:** pnpm 9 (workspace at repo root, single `frontend` workspace package).
- **Test runner (unit/integration):** Vitest. E2E: Playwright. ESLint via `next lint`. Type checking via `tsc --noEmit`.
- **LLM access:** behind the single `LlmClient.complete(prompt, schema)` interface mandated by ADR-0002 (not introduced in this slice; deferred to the slice that first needs it).

The repository layout is `frontend/` (Next.js app) + `prisma/` (schema + migrations) + `docs/` + `.github/workflows/` + `docker-compose.yml`. The `backend/` directory is retained as an empty placeholder; no Node service runs there.

## Considered options

### A. Python + FastAPI backend, Next.js or Vite frontend (two-language repo)

Mature in the AI/LLM ecosystem; richest set of agent / scraping libraries. Rejected for MVP:

- Two-language repo doubles the toolchain surface (two lockfiles, two CI lanes, two type systems, two test runners) for a one-or-two-person delivery.
- Schema drift between Pydantic models on the backend and TypeScript types on the frontend is exactly the failure mode we are trying to avoid.
- The compute-heavy AI work in this product is **per-Query, behind LLM APIs** — we're not training models, not running local inference, not doing heavy NumPy/pandas. Python's ecosystem advantages do not pay off here.
- Reconsidering this is cheap later: if a stage becomes Python-shaped (e.g., a complex OCR or graph-algorithm step), it can be carved out as a sidecar service without touching the rest of the stack.

### B. TypeScript + Hono (or Fastify) backend + separate Next.js frontend

Cleaner separation of concerns, faster cold starts for the API layer. Rejected for MVP:

- Two deploy targets, two dev servers, two ways to wire env vars and auth context — overhead the slice plan does not justify.
- Next.js Route Handlers cover the entire MVP API surface comfortably (PRD §11.6 is ~6 endpoints). The "slow framework" concerns that motivate Hono/Fastify do not apply at MVP request volumes.
- If a hot path later needs sub-Next.js latency, we can lift that route into a separate process without redesigning the rest of the system.

### C. Drizzle ORM instead of Prisma

Drizzle is leaner and has a sharper SQL-first ergonomic. Rejected for MVP:

- Prisma's migration workflow (`migrate dev` / `migrate deploy` / `migrate diff` / `prisma studio`) is more battle-tested for solo or small-team operation.
- Prisma's generated client gives stronger end-to-end types out of the box; Drizzle requires more hand-wiring of relations.
- ADR-0001's two-layer storage (global shared + per-User private) is enforced by a query-layer check that lives above the ORM. Either ORM can support it; Prisma's tooling overhead wins on operability.
- Reconsider Drizzle if Prisma's generated-client size or query overhead becomes a problem in profiled production runs.

### D. Next.js Pages Router instead of App Router

The Pages Router is more familiar to many TypeScript devs. Rejected:

- Next.js's roadmap has clearly migrated to the App Router. Adopting the Pages Router today would be deliberate technical debt.
- The App Router's Route Handlers are the cleanest way to colocate API routes with the rest of the app.

## Consequences

- A single `pnpm install` at repo root brings up the whole project. `pnpm dev` starts the Next.js dev server; `pnpm test` runs the Vitest suite; `pnpm test:e2e` runs Playwright; `pnpm lint` and `pnpm typecheck` are both wired to CI.
- The Prisma schema is the single source of truth for the storage shape. All schema changes go through `prisma migrate dev` locally, are committed under `prisma/migrations/`, and run via `prisma migrate deploy` in CI and production.
- Auth integration (issue #02) plugs into Next.js middleware + Route Handlers without requiring a separate backend.
- Source-fetching adapters (issues #04, #07) run inside Node Route Handlers. If a stage's runtime grows beyond what's appropriate inside a request lifecycle (e.g., > 60s), the stage can be moved to a background worker (BullMQ + a separate Node process) without re-architecting the rest.
- We accept that this stack does not pre-empt every future need. If the agentic workflow in ADR-0002 ever returns to the roadmap with serious Python tooling requirements, a Python sidecar is a non-blocking option.

## Open items (non-blocking on this ADR)

- Specific deployment target (Vercel, Fly.io, self-hosted) is not committed here — that decision lands when issue #11 (compliance/audit + OAuth) closes.
- The local LLM-provider abstraction (`LlmClient`) will be introduced by the first slice that needs an LLM call (#03 — Extract). Until then, no LLM dependencies are pulled into the tree.
