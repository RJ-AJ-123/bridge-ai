# BridgeAI — Design

This document captures the product scope and design decisions for BridgeAI. It is written incrementally as decisions are agreed during `/grill-with-docs` sessions. For the project glossary (terms only, no implementation), see [`../CONTEXT.md`](../CONTEXT.md).

> **Revision note.** Sections §1–§6 were rewritten after a major framing correction: BridgeAI is _not_ a single-engagement scoring tool. It is an **Opportunity Intelligence + Relationship Pathfinding** product. Earlier sections framed it around a freelancer evaluating a single prospective client; that framing has been replaced.

## 1. Product framing

BridgeAI is an AI-assisted **Opportunity Intelligence and Relationship Pathfinding** tool. Given a User's Goal and target context, it:

1. Constructs a typed entity-relationship **Graph** from public sources and the User's private context.
2. Enumerates ranked **Opportunity Items** from the Graph, scored on eight dimensions, each with attributed **Evidence**.
3. Produces a ten-section **Report** with concrete next actions.

It is **not**: a CRM, a generic LLM chat product, a lead-generation database, an HR/recruiting tool, a social-network scraper, an investment-research platform.

## 2. Operating modes

BridgeAI ships with two operating modes from day one. Both share the same pipeline architecture, Graph schema, scoring, and Report shape. They diverge only in Extract entry points and Enrichment sources.

### Mode 1 — Company-mode (entering a target organisation)

- **Typical scenarios:** sales/BD outreach into a target organisation; partnership exploration; recruitment outreach; investor approach; customer success deepening; supplier sourcing. Sales/BD is the MVP exemplar persona but the mode is not sales-specific.
- **Starting input:** Target Organization (name and optional URL) + Goal + optional known relationships + optional materials.
- **Enrichment sources:** organization website, public news, hiring posts, public partner/customer mentions, public event participation.
- **Mode-specific vocabulary:** Decision Role taxonomy (`decision-maker`, `influencer`, `user-buyer`, `budget-owner`, `champion`, `blocker`).

### Mode 2 — Individual seeking opportunities in a new city

- **Starting input:** (City, Industry, Skills, Goal) + optional known relationships + optional materials.
- **Enrichment sources:** event listings, organizer/venue public profiles, public guest/speaker lists, industry communities and associations, local industry news.
- **Mode-specific vocabulary:** Local Scene concepts (event, organizer, venue, recurring meetup series).

Mode is selected by the User at Query time; it is not inferred from input.

## 3. Core workflow and output shape

Single-shot Query → Report. One Query produces one Report. No "campaign", "deal", or "pipeline" lifecycle in MVP — Reports are archived but do not form a sequenced state machine.

### Input — the Query

A `Query` carries:

- **mode**: `company` | `city`
- **goal**: free-text statement of objective
- **target**: Company-mode requires a Target Organization (name + optional URL). City mode requires `(City, Industry, Skills)`.
- **knownRelationships** (optional): people/organizations the User already knows
- **materials** (optional): user-uploaded attachments (emails, PDFs, screenshots, prior contracts) which become part of the User's private context
- **hints** (optional): structured budget/timeline/role hints

### Stage A — Extracted preview

Before Enrichment runs, the `ExtractedQuery` is shown to the User for correction. Misreadings caught here cost a single edit; misreadings caught after Enrichment cost a full re-run.

### Output — the Report (ten fixed sections)

1. **Goal summary** — concise restatement of what BridgeAI understood the User wants.
2. **Relationship graph** — the constructed Graph (Entities + Edges + types), rendered as a visualisation and a structured listing.
3. **Key people and organisations** — top-ranked target Entities relevant to the Goal.
4. **Possible entry paths** — top-ranked Entry Paths.
5. **Opportunity types and items** — Items grouped by Opportunity Type (`sales`, `collaboration`, `referral`, `recruitment`, `investment`, `resource-match`).
6. **Evidence per Item** — for every Item, the list of source-attributed Evidence supporting it.
7. **Credibility** — confidence per Item, derived from Evidence quality.
8. **Risk warnings** — Items flagged by veto rules or labelled `caution`.
9. **Recommended next actions** — ranked Suggested Actions across top Items.
10. **Open questions** — explicit unknowns whose resolution would meaningfully change rankings.

**Important:** sections 3–9 are different facets of the same underlying list of Opportunity Items. They do not duplicate data; they project it.

## 4. Data sources

The Report's facts come from four layers, in this priority order:

### 4.1 The Query (always primary)

The Goal, target, known relationships, materials, and hints are the most authoritative inputs. If they contradict enrichment, the Query wins until the User confirms otherwise.

### 4.2 Mode-specific public enrichment (automated)

**Company-mode:**

- Target organisation's website — landing, about, team, customers, partners, pricing where public.
- Public news search — recent press, announcements, hiring news, funding news, leadership changes.
- The organisation's own careers page — for hiring signals and budget-formation cues.
- Public event participation — speakers/sponsors lists where the organisation is named.

**City mode:**

- Event listing platforms — Eventbrite, Lu.ma, Meetup, industry association calendars.
- Organiser and venue public profiles.
- Public guest and speaker lists where openly published.
- Local industry organisations, chambers, accelerators, co-working hubs.
- Local industry news in the (City, Industry) intersection.

Tooling guidance (non-load-bearing): a headless-browser-capable scraper (firecrawl, playwright) for sites; a search API (Tavily, Bing Search, or equivalent) for news/events. Pick what's cheap and reliable; swap freely.

### 4.3 User-supplied attachments (per-user private)

Emails, PDFs, screenshots, prior contracts, hand-typed notes. Stored in the User's private context. **Never** merged into the global shared layer.

### 4.4 Global shared entity store (cross-Query reuse)

Public Entities discovered by any User's prior Queries are merged into the global store using:

- **MVP entity resolution:** canonical-name match + URL match (naive, conservative — only merge when both signals agree).
- Stale Evidence is re-fetched on demand based on a per-source freshness policy (TBD per source).
- Entity merges are deterministic and reversible (record provenance of each merge).

Private (per-user) Entities **overlay** the global layer at query time — they are visible to that User only.

## 5. Pipeline architecture

Three deterministic stages in MVP. The order is fixed; no agentic looping in MVP. Long-term evolution is to a **controlled Agentic workflow** (`Plan → Search → Extract → Build Graph → Score → Recommend Actions`), but only after the fixed pipeline is stable, tested, and compliance-verified.

### Stage 1 — Extract

- **Input:** the Query (+ attached materials, OCR'd to text where needed).
- **Output:** `ExtractedQuery` — Mode-aware structured object: resolved Target, canonicalised Goal, parsed known relationships, mode-specific signals, and `unknowns` (fields the Query did not state).
- **User-visible:** yes — the User can edit `ExtractedQuery` before Stage 2 runs.
- **Suggested model class:** Haiku-tier (structured-output, cheap, fast).

### Stage 2 — Enrich

- **Input:** `ExtractedQuery`.
- **Output:** `EnrichmentBundle` — fetched documents, summarised search results, all source-attributed with URL + snippet + fetched-at.
- **Compliance bounded:** see §9. No login bypass, no scraping of private/gated data, no biometric inference, no unauthorised location tracking.
- **Suggested model class:** Haiku-tier for summarisation passes. Search/scrape steps are tool calls, not model calls.

### Stage 3 — Build Graph → Score Items → Render Report

Sub-stages, executed in order:

1. **Build Graph** — merge `ExtractedQuery` + `EnrichmentBundle` + User private context into a typed Graph. Run entity resolution against the global shared layer (canonical-name + URL match, MVP-naive).
2. **Generate Items** — enumerate candidate Opportunity Items from the Graph. Each Item = (target Entity or Entry Path) + Suggested Action + Opportunity Type + Evidence list. An Item with zero Evidence is dropped before scoring.
3. **Score Items** — apply the eight Score Dimensions to each Item via LLM evaluation (batched). Aggregate per §6.
4. **Render Report** — produce the 10-section Report by grouping/ranking the Items list. Structured fields as strict JSON; narrative fields as markdown.

**Suggested model class:** Sonnet 4.6 or Opus 4.7 for Score and Render (judgement-heavy, consistency-sensitive).

### Why not single-prompt, why not agentic (in MVP)

- **Single-prompt one-shot** — rejected. Graph + all Items + all Evidence will not fit cleanly with consistent quality. Debugging which stage misread becomes impossible. The User cannot correct Extract mid-flow.
- **Fully agentic with free tool calls** — rejected for MVP. Non-deterministic order makes testing hard, costs balloon, and compliance review of an agent's tool-usage path is much harder than reviewing a fixed pipeline. Reconsider once stages are stable.

## 6. Scoring

### 6.1 Dimensions (canonical, applied at Opportunity Item level)

| Dimension                | What it scores                                                              | Default weight |
| ------------------------ | --------------------------------------------------------------------------- | -------------: |
| `opportunity-value`      | Potential value of the Suggested Action if it succeeds                      |          0.20 |
| `match`                  | Fit between the User's Goal/skills and the target                           |          0.15 |
| `decision-influence`     | Influence of the target Entity on the User's stated outcome                 |          0.15 |
| `relationship-distance`  | Graph distance from the User to the target (shorter = better)              |          0.10 |
| `credibility`            | Strength and freshness of supporting Evidence                               |          0.15 |
| `action-feasibility`     | How realistically the User can execute the Suggested Action                 |          0.10 |
| `timeliness`             | How time-sensitive the window is (event date, hiring window, news cycle)   |          0.05 |
| `risk-level`             | Compliance / reputational / failure risk (higher = worse)                  |          0.10 |

Each dimension is scored 0–100. Weights sum to 1.00. Weights are defaults; per-User overrides are post-MVP.

### 6.2 Aggregation

For an Item with dimension scores `d_i` and weights `w_i`:

```
Score = Σ w_i · d_i'   where   d_i' = d_i for all dimensions
                                except d'_{risk-level} = 100 − d_{risk-level}
```

(Risk-level is inverted so higher risk lowers the Score.)

### 6.3 Veto rules

Any Item triggering any veto is downranked or labelled regardless of total Score:

- `credibility < 30` → label `low-evidence`. Hide from §3–§5 ranked lists. Show in §8 with explanation.
- `risk-level > 70` → label `high-risk`. Show in §8 only.
- `evidence.length == 0` → never enter the Report at all (an Item with no Evidence is not a valid Item).

### 6.4 What the eight dimensions cover (and don't)

- "Is this worth pursuing?" — `opportunity-value` × `match` × `decision-influence`.
- "Can I act on this?" — `relationship-distance` × `action-feasibility` × `timeliness`.
- "Should I trust this signal?" — `credibility` × `risk-level`.

If a User-visible criterion does not fit one of these eight, do not slide it in as a hidden tweak — propose a ninth dimension explicitly and run it through the same default-weight + veto process.

## 7. MVP scope

### 7.1 Modes — both on Day 1

Both **Company-mode** and **City mode** ship in the first release. They share the pipeline, Graph schema, scoring, and Report shape; only Extract entry points and Enrichment sources differ. Shipping only one mode first would force a single-mode scaffold that would be re-worked when the second mode lands — net negative.

### 7.2 Report sections in MVP

The MVP Report renders **6 of the 10 sections**:

| § | Section                              | In MVP? | Notes                                                                                       |
| - | ------------------------------------ | ------- | ------------------------------------------------------------------------------------------- |
| 1 | Goal summary                         | ✅      | Canonicalised restatement of the User's Goal.                                              |
| 2 | Relationship graph (visual)          | ❌ (v1.x) | Entities still appear as a structured list in §3. Static graph image (mermaid/dagre) post-MVP per §7.3. |
| 3 | Key people and organisations         | ✅      | Top-ranked Entities, rendered as a structured list.                                         |
| 4 | Possible entry paths                 | ❌ (v1.x) | Path-finding logic deferred; Company-mode value is still demonstrable without it.            |
| 5 | Opportunity types and items          | ✅      | The primary value section. Items grouped by Opportunity Type.                              |
| 6 | Evidence per Item                    | ✅      | Mandatory — without Evidence, an Item is not valid.                                        |
| 7 | Credibility                          | ✅      | Derived from `credibility` dimension. No extra logic; surfacing of an existing field.      |
| 8 | Risk warnings                        | ❌ (v1.x) | Veto rules still run internally; flagged Items are simply omitted from MVP §3 / §5 lists.  |
| 9 | Recommended next actions             | ✅      | Top-ranked Suggested Actions across top Items.                                             |
| 10 | Open questions                      | ❌ (v1.x) | `ExtractedQuery.unknowns` is captured but not surfaced in MVP.                             |

Sections deferred to v1.x are not "missing" — the underlying data (entry paths, vetoed items, unknowns, graph) is computed and stored, just not rendered. v1.x renders are then a UI feature, not a re-architecture.

### 7.3 Graph rendering

When §2 lands in v1.x, the form is: **structured Entity/Edge list + static graph image** (mermaid or dagre rendered server-side). Interactive graph (click-to-expand, drag, filter) is post-v1.x.

In MVP, Entities and Edges are visible as structured lists in §3 and inside each Item's evidence trail. No standalone graph view.

### 7.4 User accounts and persistence

MVP includes:

- **Lightweight authentication** — magic link or single-provider OAuth (e.g. Google). One identity per User; no team workspaces, no role/permission system.
- **Query and Report archiving** — each User can see their past Queries and Reports.
- **Per-User private context store** — uploaded materials and notes are scoped to the authenticated User.

MVP excludes:

- Team workspaces, organisations, shared collaboration.
- RBAC, fine-grained permissions, audit logs (beyond the standard webserver request log).
- Public sharing / report export to non-Users (a v1.x feature once compliance posture is reviewed).

### 7.5 Persistence scope

- **Stored:** Query payloads, ExtractedQuery, the rendered Report, per-User private Entities (uploaded materials, notes), and the global shared Entity store with Evidence.
- **Not stored long-term:** in-flight Graph fragments (re-derived from sources on archive replay if needed). Storing the Graph itself is post-MVP — its schema is the most likely thing to churn early, and migrations are cheap when there is no historical Graph data to migrate.

## 8. Non-goals

These items are **explicitly not in scope**. They will be pushed back on if proposed.

### 8.1 Permanent non-goals (product-shape decisions)

BridgeAI will not, in any release, become any of these:

- **CRM.** No deal stages, no pipeline view, no forecasting, no quota/commission tracking.
- **Lead/contact database for sale.** BridgeAI does not sell contact lists, emails, or "global people graphs."
- **Investment evaluation, valuation, or financial modelling.**
- **HR / recruiting tool.** No candidate evaluation, no performance scoring, no résumé ranking.
- **Generic LLM chat product.** Reports are structured. There is no free-form chat box as the product entry point.
- **Surveillance / tracking.** BridgeAI does not infer a Person's current location, daily routine, or movements.
- **Face search / biometric identification.** Person Entities are populated only from explicit public profiles and named mentions.
- **Bypass of login, paywall, CAPTCHA, or gated data.** (Also enforced in §9.)
- **Person-level "value" scoring.** Persons appear in the Graph only as Entities supporting Path-finding and Role-tagging. BridgeAI never scores "is this person worth knowing." Opportunity Items can target a Person, but the Score applies to the Item (the Suggested Action toward that Person), not to the Person.
- **Outbound automation.** BridgeAI does not send emails, LinkedIn DMs, or calls on the User's behalf. It only produces Suggested Actions; the User decides whether and how to act.
- **AI-written outbound copy.** BridgeAI does not generate ready-to-paste cold emails or DM scripts. Suggested Actions describe what to do and why; the wording is the User's.
- **Sales analytics dashboards.** No query-volume / conversion-rate / trend-line dashboards. BridgeAI is a per-Query intelligence tool, not a metrics product.
- **Internal-system integrations (CRM, HRIS, etc.).** No Salesforce, HubSpot, Slack, Notion, Jira connectors. The User pastes / uploads relevant context; BridgeAI does not pull from internal SaaS.
- **Browser extensions, desktop apps.** Web only.

### 8.2 Not in MVP, planned for v1.x

Already excluded from MVP (§7) and tracked here for visibility:

- Report §2 — relationship graph as a static visualisation (mermaid/dagre).
- Report §4 — Entry Paths as a dedicated section.
- Report §8 — Risk warnings as a dedicated section.
- Report §10 — Open questions as a dedicated section.
- Team workspaces, RBAC, shared collaboration.
- Public sharing / report export to non-Users.
- Controlled Agentic workflow (`Plan → Search → Extract → Build Graph → Score → Recommend Actions`).
- Per-User scoring-weight customisation.
- Additional Score Dimensions beyond the canonical eight.

### 8.3 Not in MVP and explicitly deferred (no committed release)

- **Active opportunity monitoring / subscription notifications** ("notify me when Acme hires for X"). Requires a scheduler, webhook infrastructure, push channels, and re-fetch policy. Re-open only when MVP usage data justifies the build.
- **Outbound automation and AI-written copy** (see §8.1) — these are permanent non-goals, not "later" features.

### 8.4 The README's "people and organisations" framing — resolved

The README mentions analysing _"opportunity value in people and organisations."_ This was a framing ambiguity earlier in design (also flagged in `CONTEXT.md`).

**Resolution:** BridgeAI evaluates **Opportunities** (as scored Opportunity Items), not individuals. Persons appear in the Graph as Entities — they can be the _target_ of an Opportunity Item (e.g. "request an introduction from Person C") — but the Score belongs to the Item, never to the Person. Person-level "is this person worth my time" evaluation is a permanent non-goal (§8.1).

A README rewrite is suggested but not blocking on this design pass.

## 9. Compliance constraints

Hard rules. No exceptions in MVP.

- **No scraping of private or gated data.** Pages requiring login are not fetched.
- **No bypass of login / CAPTCHA / paywall.** No automation of authenticated browsing.
- **No unauthorised location tracking.** No correlation of Entities to physical locations beyond what those Entities themselves publish.
- **No face search, no biometric inference.** Person Entities are populated only from explicit public profile pages and explicit named mentions; no image-based identification.
- **Source attribution is mandatory.** Every claim on every Entity or Edge carries Evidence (URL, snippet, fetched-at). Claims without Evidence are dropped, never best-guessed.
- **Respect robots.txt and site ToS** for organisation-level Enrichment. When a source explicitly disallows automated access, do not fetch.
- **User data isolation.** Per-user materials, notes, and Query history are stored in the per-User private layer and **never** merged into the global shared entity store.
- **No location tracking, no surveillance.** BridgeAI does not infer a Person's current location, daily routine, or movements from any source.

## 10. Architectural decisions of record

Foundational decisions that future contributors are most likely to question. See `docs/adr/` for details.

- [ADR-0001](./adr/0001-graph-storage-shared-plus-private.md) — Graph storage: global shared public layer + per-user private overlay.
- [ADR-0002](./adr/0002-non-agentic-three-stage-pipeline.md) — Non-agentic three-stage pipeline in MVP; agentic deferred to a controlled workflow once the pipeline is stable.
