# BridgeAI MVP — PRD

Status: ready-for-agent
Labels: feature

Source documents this PRD synthesises:

- [CONTEXT.md](../../CONTEXT.md) — domain glossary
- [docs/design.md](../../docs/design.md) — design decisions (§1–§10)
- [docs/adr/0001-graph-storage-shared-plus-private.md](../../docs/adr/0001-graph-storage-shared-plus-private.md)
- [docs/adr/0002-non-agentic-three-stage-pipeline.md](../../docs/adr/0002-non-agentic-three-stage-pipeline.md)

All terms below (Mode, User, Query, Goal, ExtractedQuery, Graph, Entity, Edge, Evidence, Opportunity Item, Suggested Action, Score, Score Dimension, Decision Role, Entry Path, EnrichmentBundle) follow `CONTEXT.md` definitions exactly.

---

## 1. Problem Statement

> _In the User's voice._

When I am trying to **enter a target organisation** (as a salesperson or BD lead) or **find traction in a new city** (as a newly arrived professional), I face the same problem: I roughly know what I want, but I do not know **who** to engage, **how** to reach them, or **which** of the many directions in front of me is worth my next hour.

Today I cobble together LinkedIn lookups, Google searches, news scans, event listings, and warm-intro tracing — each in a separate tab, none of it joined up, no evidence trail, no ranking. The result is a vague "feeling" about who to approach, and many cold messages that go nowhere because the wrong person was targeted, the timing was off, or the angle was generic.

There is no tool that combines (a) public-source intelligence about my target, (b) explicit relationship-graph reasoning, and (c) per-Opportunity scoring with attributed Evidence into a single Report I can act on.

## 2. Solution

> _In the User's voice._

I give BridgeAI a **Mode** (Company or City), a **Goal** in plain language, and a **Target** (a company in Company-mode; City + Industry + Skills in City mode). Optionally I attach materials I already have (emails, PDFs, notes) and list relationships I already have.

BridgeAI shows me what it understood (`ExtractedQuery`) so I can correct any misreading. Then it fetches public information from sources it tells me about, builds a typed **Graph**, and produces a **Report** with six sections: my Goal restated, the key people/organisations, the Opportunity Items grouped by type, the Evidence behind each, the Credibility of each, and a ranked list of next actions. Every claim is source-attributed; I can click through to the original page for any fact.

Every step is deterministic and inspectable. BridgeAI does not act on my behalf — it only tells me what to do next.

## 3. 产品定位 (Product positioning)

BridgeAI is an **Opportunity Intelligence + Relationship Pathfinding** tool for individual operators.

| BridgeAI is                                                           | BridgeAI is **not**                                              |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| A per-Query intelligence service: one Goal in, one Report out         | A CRM (no deal stages, pipeline, forecasting, quota tracking)    |
| A reasoning layer over **public** information + the User's own context | A contact/lead database for sale                                 |
| An evaluator of **Opportunities** (Items)                             | An evaluator of **persons** (no "is this person worth knowing")  |
| A producer of Suggested Actions the User decides whether to take     | An outbound automation tool (no sending emails/DMs/calls)        |
| A web product                                                         | A browser extension / desktop app                                |
| A structured Report producer                                          | A free-form chat product                                         |

See `docs/design.md` §1, §8 for the full positioning and non-goals discussion.

## 4. 目标用户 (Target users)

Two operator personas. Both are **individual operators**, not teams.

### Persona A — Sales / BD operator (Company-mode)

- **Who:** account executives, BDRs, founders selling B2B, agency biz-dev leads.
- **Goal in BridgeAI:** identify the right person inside a target organisation and the best path to them.
- **Decision frequency:** weekly to daily.
- **Willingness to pay:** high — wrong target costs them weeks of wasted outreach.
- **Operating mode:** `company`.

### Persona B — Individual seeking opportunities in a new city (City mode)

- **Who:** recently arrived professionals, expats, career-changers, solo operators relocating cities.
- **Goal in BridgeAI:** find the right events, communities, and people to engage with given their skills + industry + goal.
- **Decision frequency:** weekly during the settling-in phase (typically the first 3 months in a new city).
- **Willingness to pay:** moderate — pain is real but episodic.
- **Operating mode:** `city`.

Neither persona operates as a team in MVP. No shared workspaces, no role-based permissions, no public Report sharing.

## 5. 核心场景 (Core scenarios)

### Scenario 1 — Sales/BD entering a target organisation

A salesperson at an AI-tooling vendor wants to sell into Acme Corp's engineering organisation.

1. They open BridgeAI, sign in via magic link.
2. They select **Company-mode** and create a new Query:
   - Target Organisation: `Acme Corp` (with optional website URL).
   - Goal: _"Find the procurement decision-maker for AI tooling, or the engineering lead who owns the budget for a $30k–$100k tools purchase."_
   - Known relationships: _"I know [Person C], a former Acme engineer"_ (with LinkedIn URL).
   - Materials: an attached PDF of an earlier email exchange with a different Acme contact.
3. BridgeAI runs **Extract** and shows the parsed `ExtractedQuery`. The salesperson corrects two fields — the budget range (BridgeAI parsed "$30k" as the upper bound; they fix it to be the lower bound) and adds an industry hint.
4. BridgeAI runs **Enrich**: fetches Acme's site (`/`, `/about`, `/team`, `/customers`), runs a news search for "Acme Corp AI hiring 2026", scrapes Acme's careers page, finds a public partner-page mention of Acme at a recent conference.
5. BridgeAI runs **Build Graph → Score → Render** and produces the Report.
6. The salesperson reads the Report:
   - **§1 Goal summary** confirms BridgeAI understood the request.
   - **§3 Key people and organisations** ranks 4 candidates: Person A (likely champion, AI team lead), Person B (likely budget-owner, CTO), Person D (a department head whose team is hiring ML platform engineers — strong timeliness signal), and Acme itself with a brief profile.
   - **§5 Opportunity types and items** groups the top 8 Items: 3 of type `referral` (intros via Person C and via two public conference contacts), 2 of type `sales` (direct outreach paths), 2 of type `collaboration` (Acme is recruiting partners for a public initiative), 1 of type `resource-match` (their open-source repo).
   - **§6 Evidence per Item** lets them click through to the LinkedIn page, the Acme careers post, the partner-page URL.
   - **§7 Credibility** flags one of the `referral` Items as low (the connector relationship is inferred from a single source).
   - **§9 Recommended next actions** ranks: (1) request intro from Person C to Person A; (2) respond as a vendor to the ML platform lead hiring req; (3) comment on Person B's recent keynote talk.
7. The salesperson picks action #1, copies Person C's LinkedIn URL, and opens LinkedIn manually to send the intro request. BridgeAI does not send the message.

### Scenario 2 — Individual seeking opportunities in a new city

A product-and-growth professional has just moved to Singapore.

1. They open BridgeAI, sign in.
2. They select **City mode** and create a new Query:
   - City: `Singapore`.
   - Industry: `AI products, cross-border e-commerce`.
   - Skills: `product, growth, ML`.
   - Goal: _"Meet potential clients, partners, or investors in the next 3 months."_
   - Known relationships: empty.
3. BridgeAI runs **Extract**, shows `ExtractedQuery`. They confirm.
4. BridgeAI runs **Enrich**: fetches Eventbrite / Lu.ma / Meetup listings for Singapore + AI/e-commerce, fetches profiles of major local organisers and venues, runs a news search for recent Singapore AI + cross-border e-commerce news, fetches public industry organisations and chambers.
5. BridgeAI builds the Graph, scores Items, renders the Report.
6. The user reads the Report:
   - **§3** ranks 5 key Entities: 3 recurring meetup series, 2 industry organisations.
   - **§5** groups 10 Items: 4 `recruitment`/`collaboration` Items based on hiring posts in the local scene; 3 `referral` Items via attending events where target archetypes are speaking; 2 `sales` Items for companies publicly seeking partners; 1 `resource-match` for an accelerator with a relevant cohort.
   - **§6** shows the source URL for each event date, organiser, and guest list.
   - **§9** ranks: (1) attend Event X next Tuesday (high timeliness, score ≥ 75); (2) join Community Y this month; (3) tailored outreach to the founder of a publicly-seeking-partners company.
7. The user picks (1) and adds Event X to their calendar.

## 6. User Stories

Numbered list. Where the story is mode-specific, it is tagged `[Company]` or `[City]`; un-tagged stories apply to both modes.

### Sign-in and account

1. As a User, I want to sign in via magic-link email, so that I don't have to manage another password.
2. As a User, I want a single-provider OAuth alternative (e.g. Google), so that I can sign in faster if I prefer.
3. As a User, I want to see my past Queries and their Reports, so that I can re-check what BridgeAI told me last week.
4. As a User, I want my uploaded materials and notes to be scoped to my account only, so that no other User can see them.

### Creating a Query

5. As a User, I want to pick **Company-mode** or **City mode** at the start of a Query, so that BridgeAI knows which inputs to ask for.
6. As a Company-mode User, I want to enter a Target Organisation by name (and optionally URL), so that BridgeAI knows what company I am targeting. `[Company]`
7. As a City-mode User, I want to enter `(City, Industry, Skills)` as separate fields, so that BridgeAI can scope Enrichment accordingly. `[City]`
8. As a User, I want to write my Goal as free text, so that I can express it naturally without fighting a form.
9. As a User, I want to optionally list known relationships, so that BridgeAI can include them when proposing Entry Paths.
10. As a User, I want to optionally upload attachments (emails, PDFs, screenshots, prior contracts), so that BridgeAI has the context I already have.
11. As a User, I want to optionally supply structured hints (budget range, timeline, preferred Decision Role), so that BridgeAI weights its analysis accordingly.

### ExtractedQuery preview

12. As a User, I want BridgeAI to show me what it understood from my input before fetching anything, so that I can catch misreadings cheaply.
13. As a User, I want to edit any field in the `ExtractedQuery` (especially the resolved Target, parsed signals, and `unknowns`), so that errors don't propagate to Enrichment.
14. As a User, I want to confirm or cancel the Query at the `ExtractedQuery` step, so that I am explicitly opting in to the cost of Enrichment.

### Enrichment transparency

15. As a User, I want to see which sources BridgeAI fetched, so that I can verify it pulled from public, reasonable places.
16. As a User, I want each fetched source to show a status (fetched / blocked-by-robots / unreachable / login-required), so that I know what was available.
17. As a User, I want to never see content from sources that require login, so that I trust BridgeAI is not bypassing access controls.

### Reading the Report

18. As a User, I want a one-paragraph Goal summary at the top, so that I can confirm BridgeAI understood me.
19. As a User, I want to see a ranked list of key people and organisations, so that I know who to focus on.
20. As a Company-mode User, I want each ranked Person to show their likely Decision Role(s), so that I know whether they're the decision-maker, influencer, user-buyer, budget-owner, champion, or blocker. `[Company]`
21. As a User, I want Opportunity Items grouped by Opportunity Type (`sales`, `collaboration`, `referral`, `recruitment`, `investment`, `resource-match`), so that I can scan by category.
22. As a User, I want each Item to show a Suggested Action, so that I know the concrete next step.
23. As a User, I want each Item's Evidence list, with URL + snippet + fetched-at, so that I can verify every claim.
24. As a User, I want each Item's per-dimension Score breakdown (8 dimensions), so that I can see *why* it ranks where it does.
25. As a User, I want each Item's Credibility surfaced, so that I can discount low-evidence Items appropriately.
26. As a User, I want a top-level Recommended Next Actions list (across all Items), so that I see the few things I should do first.

### Persistence and history

27. As a User, I want my Query, my `ExtractedQuery` edits, and my final Report to be archived, so that I can revisit them later.
28. As a User, I want to delete a Query (and its associated private context), so that I can remove records of work I no longer want stored.
29. As a User, I want to know that my private attachments and notes are never shared with other Users, so that I can paste in sensitive context safely.

### Compliance and safety

30. As a User, I want BridgeAI to refuse to surface any claim without Evidence, so that I am never given a hallucinated "fact."
31. As a User, I want BridgeAI to refuse to attempt biometric identification, location tracking, or login bypass, so that I'm not surprised by ToS violations on my account.
32. As a User, I want Items that are vetoed (low credibility, high risk) to be filtered out of the main Report in MVP rather than presented confusingly. `[MVP only — v1.x will show them in §8]`

### Errors and edges

33. As a User, when Enrichment finds nothing meaningful (e.g. the Target Organisation has no public website and no news), I want BridgeAI to say so explicitly rather than fabricate Items.
34. As a User, when Stage 1, 2, or 3 fails, I want to see which stage failed and a way to retry from that stage, so that a transient fetch failure doesn't waste my whole Query.
35. As a User, when an attachment cannot be parsed (corrupt PDF, image OCR failure), I want to see that the attachment was skipped, so I can re-upload.

## 7. 用户流程 (User flow)

### Happy path

```
[ Sign in ] → [ New Query ] → [ Choose Mode ]
       ↓
[ Fill Query form: Goal + Target + (optional) knownRelationships, materials, hints ]
       ↓
[ Submit ] → [ Stage 1: Extract ] → [ Preview ExtractedQuery ]
       ↓                                      ↓
       ↓                                [ User edits or confirms ]
       ↓                                      ↓
       ←────────────────────────────────  [ Confirm ]
       ↓
[ Stage 2: Enrich ] (progress shown per source)
       ↓
[ Stage 3a: Build Graph ] → [ Stage 3b: Generate Items ] → [ Stage 3c: Score Items ] → [ Stage 3d: Render Report ]
       ↓
[ Report displayed ] → [ User reads / clicks Evidence links / copies Suggested Actions ]
       ↓
[ Report archived under the User's account ]
```

### Decision points and exits

- **At ExtractedQuery preview:** User can `confirm`, `edit fields and confirm`, or `cancel`. Cancel discards the Query without running Enrichment (no cost incurred beyond Stage 1).
- **At Enrichment progress:** if a source fails (robots.txt-disallowed, unreachable, login-required), it is marked and the pipeline continues with what's available. The User can abort the whole Query from this screen.
- **At Report display:** the User has no further BridgeAI actions to take — the product hands off to the User's own tools (email, LinkedIn, calendar). The Report is archived automatically.

### Retry paths

- **Stage 1 failure** (LLM error, malformed Query): re-run Extract with the same input.
- **Stage 2 failure** (all sources unreachable): re-run Enrich after a delay; if still failing, surface the issue and let the User confirm the Query be cancelled.
- **Stage 3 failure** (LLM error during Score or Render): re-run from the failing sub-stage. Graph state is intermediate-cached during one Query lifecycle to enable resume.

## 8. MVP 范围 (MVP scope)

### 8.1 In-scope features

| Area              | Included                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Modes             | Both Company-mode and City mode on Day 1                                                         |
| Pipeline          | Three-stage `Extract → Enrich → (Build Graph + Score Items + Render Report)` per `ADR-0002`    |
| Report sections   | §1 Goal summary, §3 Key people and organisations, §5 Opportunity types and items, §6 Evidence per Item, §7 Credibility, §9 Recommended next actions |
| Scoring           | All 8 canonical Score Dimensions with default weights; weighted aggregate + veto rules         |
| Auth              | Magic link or single-provider OAuth (Google); one User per account; no team workspaces         |
| Persistence       | Query payloads, ExtractedQuery, final Report, per-User attachments and notes                   |
| Graph storage     | Two-layer per `ADR-0001`: global shared public layer + per-User private overlay                |
| Entity resolution | Naive: canonical-name match + URL match. Merge only when both agree.                           |
| Compliance        | All hard rules from `design.md` §9 enforced                                                    |
| UI                | Web, responsive; structured listings for entities; no graph visualisation in MVP               |

### 8.2 Sections deferred to v1.x

Underlying data is still computed and stored; only the rendering is deferred.

- §2 Relationship graph as a visualisation (mermaid/dagre static image).
- §4 Possible entry paths as a dedicated section.
- §8 Risk warnings as a dedicated section (vetoed Items are simply omitted from the MVP Report).
- §10 Open questions as a dedicated section (`ExtractedQuery.unknowns` is captured but not surfaced).

### 8.3 Things explicitly not in MVP

See `docs/design.md` §7.4, §7.5, §8 for the full lists. Briefly: no team workspaces, no RBAC, no public sharing, no agentic workflow, no per-User weight customisation, no scoring dimension beyond the canonical 8, no AI-written outbound copy, no sales analytics dashboards, no browser extensions, no internal-system integrations.

## 9. 报告结构 (Report structure)

The MVP Report contains six sections. Each section is fixed in shape; the data layer underneath is the **list of Opportunity Items** that Stage 3 produces.

### §1 Goal summary

```
- mode: "company" | "city"
- target: <mode-dependent string representation>
- goal_restated: <one paragraph of canonicalised goal in the User's voice>
- known_relationships: [<short strings>]
- materials_count: <integer, count of attachments accepted>
```

### §3 Key people and organisations

A ranked list. Each row:

```
- entity_id: <stable global ID>
- entity_type: "Organization" | "Person" | "Role" | "Event" | ...
- display_name: <string>
- short_profile: <1–3 sentences derived from Evidence>
- decision_roles (Company-mode only): [<one or more of: decision-maker, influencer, user-buyer, budget-owner, champion, blocker>]
- evidence_count: <integer>
- top_item_id: <ID of the highest-scored Opportunity Item targeting this entity>
- top_item_score: <0–100 integer>
```

Sort key: `top_item_score` descending. Cap at 10 entries in MVP.

### §5 Opportunity types and items

Items grouped by `opportunity_type`. Each Item:

```
- item_id: <stable per-Report ID>
- opportunity_type: "sales" | "collaboration" | "referral" | "recruitment" | "investment" | "resource-match"
- target_entity_ids: [<one or more entity IDs>]
- suggested_action: <1–3 sentence description of the next step>
- dimension_scores: { opportunity-value, match, decision-influence, relationship-distance,
                      credibility, action-feasibility, timeliness, risk-level }   # all 0–100
- weighted_score: <0–100 integer>
- evidence_ids: [<one or more evidence IDs>]
- credibility_label: "high" | "medium" | "low"  # derived from dimension_scores.credibility
```

Sort key within each type: `weighted_score` descending. Cap at 5 Items per type, 20 Items total.

### §6 Evidence per Item

Inline under each Item or as a separate list with cross-refs. Each Evidence row:

```
- evidence_id: <stable>
- url: <public URL>
- snippet: <verbatim extracted text, ≤ 500 chars>
- source_type: "website" | "news" | "hiring-post" | "event-listing" | "user-attachment" | ...
- fetched_at: <ISO 8601 timestamp>
```

### §7 Credibility

A per-Item label (`high` / `medium` / `low`) derived from the Item's `dimension_scores.credibility`:

- `credibility ≥ 70` → `high`
- `40 ≤ credibility < 70` → `medium`
- `30 ≤ credibility < 40` → `low`
- `credibility < 30` → Item is vetoed and omitted from §3/§5

### §9 Recommended next actions

The top **5** Items across all types, ranked by `weighted_score` descending. Each row:

```
- rank: 1..5
- item_id: <cross-ref into §5>
- suggested_action: <inherited from the Item>
- weighted_score: <0–100>
- one_line_rationale: <≤ 200 chars: which dimensions dominated the score>
```

## 10. 评分维度 (Scoring dimensions)

Eight canonical dimensions, all applied **at Opportunity Item level**. Each is scored 0–100.

| Dimension                | What it scores                                                              | Default weight |
| ------------------------ | --------------------------------------------------------------------------- | -------------: |
| `opportunity-value`      | Potential value of the Suggested Action if it succeeds                      |          0.20 |
| `match`                  | Fit between the User's Goal/skills and the target Entity                    |          0.15 |
| `decision-influence`     | Influence of the target Entity on the User's stated outcome                 |          0.15 |
| `relationship-distance`  | Graph distance from the User to the target (shorter = better)               |          0.10 |
| `credibility`            | Strength and freshness of supporting Evidence                               |          0.15 |
| `action-feasibility`     | How realistically the User can execute the Suggested Action                 |          0.10 |
| `timeliness`             | How time-sensitive the window is (event date, hiring window, news cycle)   |          0.05 |
| `risk-level`             | Compliance / reputational / failure risk (higher = worse)                  |          0.10 |

### Aggregation

```
weighted_score = round( Σ w_i · d_i'  )

where  d_i' = d_i                          for all dims except risk-level
       d'_{risk-level} = 100 − d_{risk-level}
       Σ w_i = 1.00
```

### Veto rules

- `credibility < 30` → Item dropped from §3 and §5 (would appear in §8 in v1.x).
- `risk-level > 70` → Item dropped from §3 and §5 (would appear in §8 in v1.x).
- `evidence.length == 0` → Item never created in the first place.

Weights are constants in MVP (per-User overrides are post-MVP).

## 11. Implementation Decisions

These are deliberate calls made during PRD synthesis. None contradicts `design.md` or the ADRs; they extend the design into module shapes and contracts.

### 11.1 Module decomposition

Modules below are **deep modules** in the John-Ousterhout sense: complex internals behind a small, stable interface. The interface is the contract; the internals are free to change.

1. **`query-intake`** — accepts a Query payload from the HTTP layer, validates the shape (Mode-aware), persists the Query, returns a Query ID. Stable interface: `submit(payload) → QueryId`.

2. **`extract`** — given a `Query`, returns an `ExtractedQuery`. Mode-aware internally. Stable interface: `extract(query) → ExtractedQuery`. Calls a cheap LLM (e.g. Haiku-tier) under the hood.

3. **`enrich`** — given an `ExtractedQuery`, returns an `EnrichmentBundle`. Internally a coordinator that dispatches to mode-specific source families. Stable interface: `enrich(extracted) → EnrichmentBundle`.

4. **`source-adapters/*`** — one shallow module per data-source family (website scraper, news search, event listings). Each adapter exposes `fetch(target) → list<Evidence>` and is independently mockable in tests.

5. **`graph-build`** — given an `ExtractedQuery + EnrichmentBundle + UserPrivateContext`, returns a typed Graph. Internally: entity resolution (naive canonical-name + URL match), edge typing, evidence attachment. Stable interface: `build(extracted, bundle, privateCtx) → Graph`.

6. **`items-generate`** — given a `Graph + ExtractedQuery`, returns a list of candidate `OpportunityItem`s with Suggested Actions, Opportunity Type, and an Evidence list. No scoring yet. Stable interface: `generate(graph, extracted) → Item[]`.

7. **`score`** — given a list of Items, returns the same list with `dimension_scores`, `weighted_score`, and veto flags applied. Pure aggregation logic + a separate LLM-driven sub-module for dimension scoring. Stable interface: `score(items) → ScoredItem[]`.

8. **`report-render`** — given `(Query, ExtractedQuery, Graph, ScoredItem[])`, returns the 6-section MVP `Report` as structured JSON (the front-end renders to markdown/HTML). Stable interface: `render(...) → Report`.

9. **`storage/global-entity-store`** — append-merge layer for the global shared public Entities and Edges (per `ADR-0001`). Stable interface: `lookup(canonical, url) → Entity | null`, `upsert(entity, evidence) → EntityId`.

10. **`storage/user-private-store`** — per-User attachments, notes, Query/Report history. Strictly isolated. Stable interface: scoped to a single User ID.

11. **`auth`** — magic link + Google OAuth. Wraps an existing library; this is a shallow integration module, not a deep custom one.

12. **`web-ui`** — React/Next.js (or equivalent) frontend. Three primary screens: New Query, ExtractedQuery review, Report viewer. Plus an account / history screen.

13. **`api`** — HTTP/JSON layer. Routes for: create Query, fetch ExtractedQuery, confirm/edit ExtractedQuery, poll pipeline status, fetch Report, list Queries, delete Query. Stateless except for the auth context.

### 11.2 Pipeline state machine

A Query goes through these states. State transitions are authoritative — only valid transitions are allowed.

```
draft → extracting → extracted → (user-edits → extracted)* → confirmed
      → enriching → enriched
      → building-graph → scoring → rendering → done

Any state → cancelled  (User-initiated)
Any state → failed    (pipeline error, with stage and reason)
```

### 11.3 Storage schema (sketch)

Not file-pathed — these are schema shapes that must exist.

- **`queries`**: `(id, user_id, mode, payload_json, created_at, state, current_stage)`
- **`extracted_queries`**: `(query_id, extracted_json, user_edited: bool, confirmed_at)`
- **`enrichment_bundles`**: `(query_id, bundle_json, fetched_sources_json, fetched_at)`
- **`reports`**: `(query_id, report_json, rendered_at)`
- **`global_entities`**: `(id, type, canonical_name, normalized_url, attributes_json, created_at, updated_at)`
- **`global_edges`**: `(id, src_id, dst_id, type, attributes_json, created_at)`
- **`global_evidence`**: `(id, claim_target_id, claim_target_type: "entity"|"edge", url, snippet, source_type, fetched_at)`
- **`user_attachments`**: `(id, user_id, query_id, filename, content_type, text_extracted, uploaded_at)`
- **`user_notes`**: `(id, user_id, query_id, body, created_at)`

Global entity tables are write-shared across Users; user_* tables are write-isolated per User. Read isolation is enforced at the query layer.

### 11.4 LLM provider abstraction

A single internal interface, `LlmClient.complete(prompt, schema) → object`, that all stages call. Provider choice (model class — Haiku, Sonnet, Opus) is configured per stage in code, not selected at runtime by the LLM itself. This keeps `ADR-0002` enforceable: no model-driven tool-call decisions in MVP.

### 11.5 Source fetching

- All fetches go through one HTTP client with: `User-Agent: BridgeAI/<version>`, robots.txt check, redirect cap, content-type whitelist (`text/html`, `application/pdf`, `application/json`), size cap (e.g. 5 MB), timeout (e.g. 15 seconds).
- Login walls, paywalls, and CAPTCHAs cause the source to be marked `login-required` and skipped — never fetched.
- All fetches log: URL, status, fetched-at, byte size. Logs are part of the Query's audit trail.

### 11.6 API contract notes

- `POST /api/queries` → creates Query, runs Stage 1 synchronously (or returns a job handle if Extract is slow), returns the ExtractedQuery.
- `PATCH /api/queries/:id/extracted` → User-edited ExtractedQuery, transitions state to `confirmed`, kicks off Stage 2.
- `GET /api/queries/:id/status` → polled by the front-end during Stages 2–3 for progress.
- `GET /api/queries/:id/report` → fetched once `state == done`.
- `GET /api/queries` → list of the User's own past Queries.
- `DELETE /api/queries/:id` → cascades: deletes Query, ExtractedQuery, EnrichmentBundle, Report, user_attachments under that Query, user_notes under that Query. Global entities are **not** deleted (they belong to the shared layer).

### 11.7 What this PRD deliberately leaves open

Not load-bearing on MVP delivery; either decided later or framework-dependent.

- **Programming language and runtime.** Backend can be Python or TypeScript; both fit. Pick when the team is in place.
- **Database choice.** Likely Postgres for relational + a search/vector add-on; not constraining.
- **Specific LLM models.** Default to Anthropic Claude family (Haiku-tier for Extract, Sonnet/Opus for Score and Render). Provider can be swapped via `LlmClient`.
- **Search and scrape tool choice.** Tavily/Bing/Brave for search; firecrawl/playwright for scrape. Adapter-swappable.

## 12. Testing Decisions

> _A good test verifies a module's externally observable contract. It does not poke into internal state, does not mock things the module owns, and survives reasonable refactors of the module's internals._

### 12.1 Modules with mandatory unit tests in MVP

These are the **deep modules** with stable interfaces and pure-enough logic to be tested rigorously. Test the contract, not the implementation.

| Module                      | Test focus                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `score`                     | Pure aggregation math. Given fixed dimension scores + weights, asserted weighted_score and veto outcomes. No LLM involvement in the test. |
| `graph-build`               | Entity resolution rules: canonical-name + URL match merges; same-canonical-name-different-url does **not** merge; new Entity creation. Mocked storage. |
| `items-generate`            | Given a small handcrafted Graph + ExtractedQuery, asserted set of generated Items with stable IDs. Deterministic. |
| `report-render`             | Given fixed scored Items + ExtractedQuery + Graph, asserted Report JSON shape. Snapshot test acceptable here. |
| `source-adapters/*`         | Each adapter against a recorded fixture page. Robots.txt blocking, login-wall detection, content-type rejection are explicit cases. |
| `storage/global-entity-store` | Concurrent upserts converge to a single canonical Entity. Evidence accumulates. |
| `storage/user-private-store` | Read isolation: a query under User A's context cannot return User B's notes/attachments. Negative tests for cross-user reads. |

### 12.2 Modules with integration tests in MVP

Test through the API surface or higher. Mock LLM provider with a recorded response set; do not mock our own modules.

| Surface                                                                       | Test focus                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Full pipeline for a Company-mode happy path                                     | Submit Query → confirm ExtractedQuery → Report rendered. End-to-end. |
| Full pipeline for a City-mode happy path                                      | Same, City-mode inputs and fixtures.                                |
| ExtractedQuery edit path                                                      | User edits change downstream Report; cancellation discards.         |
| Source-failure resilience                                                     | Some Enrich sources fail; pipeline still produces a Report.         |
| Auth + isolation                                                              | User B cannot retrieve User A's Query, Report, attachments, or notes. |

### 12.3 What is deliberately not tested

- `extract` itself, beyond a smoke test: it's LLM-dependent and prompt-tuned; behavioural correctness is judged through downstream tests on the full pipeline, not on Stage 1 outputs in isolation.
- LLM-driven dimension scoring inside `score`: same reasoning. The aggregation math around it is tested; the dimension-scoring sub-module is asserted only at smoke level.
- `web-ui` rendering: visual / component tests are nice-to-have, not MVP gating.

### 12.4 Prior art

No prior tests exist in this repo (empty `backend/`, `frontend/`). The testing style above is the project's convention going forward. When tests are written, follow them as the prior art for subsequent work.

## 13. 验收标准 (Acceptance criteria)

The MVP is shippable when **all** of the following are true.

### 13.1 Functional

1. A new User can sign in via magic link **or** Google OAuth.
2. A signed-in User can create a Company-mode Query and reach a rendered Report within ≤ 90 seconds wall-clock for a typical input (one Target Organisation, ≤ 3 attachments).
3. A signed-in User can create a City-mode Query and reach a rendered Report within ≤ 120 seconds wall-clock.
4. The ExtractedQuery is shown to the User after Stage 1 and **before** Stage 2 begins. The User can edit any field and either confirm or cancel.
5. The rendered Report contains exactly six sections: §1, §3, §5, §6, §7, §9.
6. Every Opportunity Item in §5 has at least one Evidence row in §6, and every Evidence row has a valid `url`, non-empty `snippet`, and a `fetched_at` timestamp.
7. §9 contains exactly the top 5 Items by `weighted_score` from across §5.
8. §3 contains at most 10 Entities, ranked by their highest-scoring associated Item.
9. The 8 dimension scores are visible on every Item; the `weighted_score` matches the documented formula to within rounding (±1).
10. Items with `credibility < 30` or `risk-level > 70` do not appear in §3 or §5.
11. Items with zero Evidence are never created.

### 13.2 Persistence and history

12. A User can list their past Queries and re-open any past Report.
13. A User can delete a past Query; the Query, ExtractedQuery, EnrichmentBundle, Report, and any attachments/notes scoped to that Query are removed. Global Entities remain.

### 13.3 Isolation and compliance

14. Two test Users cannot see each other's Queries, Reports, attachments, or notes via any endpoint.
15. No Enrichment fetch reaches a URL marked disallowed by `robots.txt` for our User-Agent.
16. No Enrichment fetch attempts a login form, CAPTCHA solve, or paywall bypass. Sources requiring these are marked `login-required` and skipped.
17. No Person Entity is created from biometric inference, face-search, or location-tracking sources.
18. Every Entity and Edge in storage has at least one Evidence row linking to a public URL with a timestamp.

### 13.4 Architecture conformance

19. Storage matches `ADR-0001`: global Entities/Edges/Evidence are write-shared; user attachments and notes are write-isolated. Read isolation is enforced at the query layer (tested per §12.1).
20. The pipeline is non-agentic per `ADR-0002`: no LLM call inside the pipeline chooses what to do next; tool calls are dispatched by code, not by the model.
21. The `LlmClient.complete` interface is the only LLM entry point; switching providers requires editing one configuration, not the pipeline modules.

### 13.5 Quality bars

22. All modules listed in §12.1 have passing unit tests. All scenarios in §12.2 have passing integration tests.
23. A reader of `docs/design.md` + `CONTEXT.md` + this PRD can implement the MVP without re-interviewing the User.

## 14. 非目标 (Non-goals) / Out of Scope

The full list is in `docs/design.md` §8. Headline summary, do not re-litigate during implementation:

- No CRM, no contact database, no investment platform, no HR/recruiting tool, no generic LLM chat.
- No surveillance, location tracking, biometric inference, face search.
- No bypass of login / CAPTCHA / paywall.
- No outbound automation. No AI-written cold emails or DM copy.
- No sales analytics dashboards.
- No internal-system integrations (Salesforce, HubSpot, Slack, Notion, Jira).
- No browser extensions or desktop apps.
- No person-level "value" scoring.
- No team workspaces, RBAC, public sharing in MVP.
- No agentic workflow in MVP (deferred per `ADR-0002`).
- No per-User scoring-weight customisation in MVP.
- No additional Score Dimensions beyond the canonical 8.
- No active opportunity-monitoring / subscription notifications.

## 15. Further Notes

### 15.1 Open items that surfaced during PRD synthesis

These are non-blocking on MVP delivery but worth flagging:

- **README.md drift.** The repo's `README.md` still reads "AI-powered system for analyzing opportunity value in people and organizations." Per `docs/design.md` §8.4, BridgeAI does not evaluate persons. Suggest updating the README to match. Not blocking.
- **Specific source picks for City mode.** `design.md` §4.2 lists candidates (Eventbrite, Lu.ma, Meetup, industry chambers). MVP needs to commit to a specific minimum set per region. Recommend starting with Lu.ma + Meetup + a single regional industry-association directory per supported city, and expanding by data-quality feedback. Not blocking on the PRD.
- **Per-source freshness policy** for re-fetching Evidence on global Entities. MVP can be naive (re-fetch on demand only when a new Query references the Entity). A scheduled background refresher is post-MVP.
- **Cost ceiling per Query.** Not specified in `design.md`. Recommend a configurable per-Query token-cost cap with early termination if exceeded; surfaced as an `enrich-budget-exhausted` failure state. Implementation can default high in MVP and tighten with real usage data.

### 15.2 Module-shape decisions I made without re-interviewing

Flagged for the User's review:

- Splitting Stage 3 into four sub-modules (`graph-build`, `items-generate`, `score`, `report-render`) instead of treating "Stage 3" as one module. Rationale: each has a distinct testable contract; pure aggregation logic in `score` is much easier to verify in isolation; entity resolution in `graph-build` will likely evolve fastest.
- Treating each data-source family as a separate adapter module behind one `enrich` coordinator. Rationale: adapters fail and evolve independently; a single Enrich module would force coupled changes.
- Putting the LLM behind a single `LlmClient.complete(prompt, schema)` interface. Rationale: enforces `ADR-0002`'s non-agentic posture; lets every LLM-using module be tested with a recorded-response mock.

If any of these don't match expectations, the affected sections of §11 and §12 are where to push back.

### 15.3 Out-of-band

- Use `docs/agents/triage-labels.md` for label conventions. This PRD is labelled `feature` and `Status: ready-for-agent`.
- This PRD lives at `.scratch/mvp/PRD.md` per `docs/agents/issue-tracker.md`. Implementation issues will be created as `.scratch/mvp/issues/<NN>-<slug>.md` once the team begins breaking the work down.
