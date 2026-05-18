# BridgeAI

The shared language for talking about **Opportunity Intelligence + Relationship Pathfinding** in BridgeAI. BridgeAI helps a User pursue a stated goal — entering a Target Organization (Company-mode) or finding opportunities in a city (City mode) — by constructing a typed entity-relationship Graph from public sources, surfacing ranked Opportunity Items with attributed Evidence, and recommending concrete next actions.

## Language

### Operating modes

**Mode**:
The operating context for a Query. Exactly one of `company` or `city`. Determines the shape of the starting input, which Enrichment sources apply, and which mode-specific vocabulary (e.g. Decision Role) is in play.
_Avoid_: "context" (overloaded), "scenario".

**Company-mode**:
The Query targets a specific organization the User wants to enter — e.g. sales/BD outreach, partnership exploration, recruitment outreach, investor approach, customer success, supplier sourcing. Starts from a Target Organization. Full name: "Company / Organization Opportunity mode".
_Avoid_: "Sales mode" (deprecated alias — see "Flagged ambiguities").

**City mode**:
The Query targets a (City, Industry, Skills, Goal) context where the User wants to find opportunities. No Target Organization at the start.

### Core nouns

**User**:
The operator of BridgeAI — the person issuing Queries and reading Reports. To be distinguished from `user-buyer` (a Decision Role inside a target organization in Company-mode).
_Avoid_: "actor", "operator".

**Query**:
The unit of input. One Query produces one Report. Carries Mode, Goal (free-text objective), Target (mode-dependent), known relationships, attached materials, and optional structured hints.
_Avoid_: "request", "brief" (deprecated — see "Flagged ambiguities"), "intake".

**Report**:
The unit of output for one Query. A structured document with ten fixed sections (see `docs/design.md` §3). References the Graph and the list of Opportunity Items.
_Avoid_: "analysis", "evaluation", "result".

**Goal**:
The User's stated objective in plain language — e.g. "find the procurement decision-maker for AI tooling at Acme", "meet potential clients and partners in Singapore for cross-border e-commerce". Always free text; never structured.
_Avoid_: "intent", "objective" (interchangeable but inconsistent).

### Graph terms

**Graph**:
A directed, typed entity-relationship graph built per Query. Public entities live in the shared global store; the User's private context overlays it. The substrate from which Opportunity Items are derived.

**Entity**:
A node in the Graph. Typed (Organization, Person, Role, Event, Job, NewsItem, Product, Project, Industry, Location, …) with a stable canonical ID. Every Entity carries Evidence.
_Avoid_: "node" (alone), "record".

**Edge**:
A typed directed relationship between two Entities — `works-at`, `speaks-at`, `partners-with`, `invests-in`, `supplies`, `sold-to`, `organized-by`, `attended`, `hired-into`, etc. Every Edge carries Evidence.
_Avoid_: "link", "relation" (alone), "connection".

**Evidence**:
A source-attributed claim supporting an Entity or Edge. Minimally: a public URL, the extracted snippet, a fetched-at timestamp. No claim enters the Graph without Evidence.
_Avoid_: "source" (alone), "citation".

**Decision Role** _(Company-mode only)_:
The role a Person plays in a target organization's buying process. One of: `decision-maker`, `influencer`, `user-buyer`, `budget-owner`, `champion`, `blocker`. Multiple Roles can apply to one Person.
_Avoid_: "stakeholder" (too generic), "end-user" (clashes with `User`).

**Entry Path**:
An ordered sequence of Edges through the Graph from the User (or a known connector of the User) to a target Entity. The substrate for "who/where to engage first" recommendations.
_Avoid_: "route", "introduction path".

### Output terms

**Opportunity Item**:
The atomic unit of scored output in a Report. An Item bundles: a target (Entity or Entry Path), a Suggested Action, an Opportunity Type, an Evidence list, and a Score with per-dimension breakdown. Every ranked section of the Report (key people/orgs, entry paths, opportunities by type, next actions) is a facet of the same underlying list of Items.
_Avoid_: "Opportunity" alone (ambiguous — see "Flagged ambiguities"), "candidate", "recommendation".

**Opportunity Type**:
The kind of opportunity an Item proposes. One of: `sales`, `collaboration`, `referral`, `recruitment`, `investment`, `resource-match`.

**Suggested Action**:
The concrete next step proposed by an Item — e.g. "request an introduction via [Person C]", "attend [Event X]", "send a tailored cold message to [Person A] mentioning [Project Y]".
_Avoid_: "recommendation" (overloaded), "next step" (vague).

**Score**:
A composite 0–100 rating for an Opportunity Item, computed by weighted-aggregating the eight Score Dimensions with veto rules applied (see `docs/design.md` §6).

**Score Dimension**:
One axis of evaluation contributing to a Score. The eight canonical dimensions: `opportunity-value`, `match`, `decision-influence`, `relationship-distance`, `credibility`, `action-feasibility`, `timeliness`, `risk-level`.

### Pipeline terms

**Extract**:
Stage 1. Converts a Query into a structured `ExtractedQuery` (Mode-aware) — resolved Target, canonicalised Goal, parsed known relationships, mode-specific signals, and explicit unknowns. Shown to the User for correction before Stage 2 runs.

**Enrich**:
Stage 2. Fetches mode-specific public information (per `docs/design.md` §4.2), attaches Evidence to every claim, and produces an `EnrichmentBundle`. Bounded by the compliance rules in `docs/design.md` §9.

**Build Graph**:
Sub-stage of Stage 3. Merges `ExtractedQuery` + `EnrichmentBundle` + the User's private context into a typed Graph. Entity resolution against the global shared layer happens here.

**Score Items**:
Sub-stage of Stage 3. Enumerates candidate Opportunity Items from the Graph, scores each on the eight dimensions, aggregates with veto rules, and emits the ranked Items list consumed by the Report.

**ExtractedQuery**:
The structured representation of a Query produced by Stage 1. Mode-aware. Shown to the User for correction before Enrichment runs.

**EnrichmentBundle**:
The external facts gathered by Stage 2 — fetched documents, summarised search results — all source-attributed. Bundled together so Stage 3 receives one input object.

## Relationships

- A **User** issues many **Queries**; each Query carries exactly one **Mode** and one **Goal**.
- A **Query** produces exactly one **Graph** and exactly one **Report**.
- A **Graph** contains many **Entities** and **Edges**; every Entity and Edge carries **Evidence**.
- A **Report** contains an ordered list of **Opportunity Items**; each Item references one or more Entities (and optionally an **Entry Path**) plus its Evidence.
- An **Entity** lives in the global shared layer (public) or the User's private layer (uploads/notes); the private layer overlays the public layer for that User's Queries.
- A **Score** decomposes into the eight **Score Dimensions**.
- In Company-mode, an **Edge** ending at a Person can carry one or more **Decision Roles** for that Person inside the Target Organization.

## Example dialogue

> **User:** "I want to enter Acme Corp via their AI team. Who should I talk to?"
> **BridgeAI:** "Acme's AI team is led by [Person A], reporting to CTO [Person B]. The likely **decision-maker** for tools sized like yours is Person B. Two **Entry Paths** surfaced — both via public **Evidence**:
> (1) Person A spoke at [Event X] last month; [Person C], in your private context, also attended.
> (2) Acme posted a hiring req for 'ML platform lead' this week — a **timeliness** signal that budget is forming.
> Top **Opportunity Item**: request an intro from Person C to Person A. Type: `referral`. Score 78. Credibility: high (3 independent sources). Risk-level: low."

## Flagged ambiguities

- **"Opportunity"** — historically used to mean "a single prospective engagement". Resolved: canonical model distinguishes **Query** (the input) from **Opportunity Item** (a scored proposition inside the Report). Do not use "Opportunity" alone.
- **"Brief"** — earlier term for the input. Resolved: replaced by **Query**. _Avoid._
- **"Prospect"** — earlier top-level term. Resolved: subsumed under **Entity** (of type Organization, marked as Query target in Company-mode). Not a vocabulary item on its own.
- **"User" vs `user-buyer`** — `user-buyer` is a Decision Role inside a target organization (a Person who will use the purchased product). The **User** is the operator of BridgeAI. Always disambiguate.
- **"Trust" vs `credibility`** — earlier drafts used "Trust" as a scoring axis. Canonical name is `credibility`. _Avoid "Trust"._
- **"people and organizations"** (from `README.md`) — Resolved: BridgeAI evaluates Opportunities, not individuals. Persons appear only as Entities embedded in a Graph for the purpose of Path-finding and Role-tagging — never as standalone evaluation targets. See `docs/design.md` §8.
- **"Sales mode" → renamed to "Company-mode"** — earlier drafts named one of the two operating modes "Sales mode". Resolved: renamed to **Company-mode** (full name: "Company / Organization Opportunity mode"). The mode covers any opportunity targeting an organization — sales/BD outreach is one valid use case, but partnership exploration, recruitment outreach, investor approach, customer success, and supplier sourcing are equally in scope. Naming it "Sales mode" wrongly framed BridgeAI as a sales-only tool. Note: the Opportunity Type enum value `sales` is **unchanged** — it still names "sales" as one kind of opportunity an Item can propose. Use **Company-mode** for the operating mode; use `sales` only as an Opportunity Type value.
