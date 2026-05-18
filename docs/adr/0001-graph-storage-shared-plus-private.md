# Graph storage: global shared public layer + per-user private overlay

## Status

accepted

## Context

BridgeAI builds a typed entity-relationship Graph per Query. Across Queries from different Users (and across the same User's repeat Queries) many public Entities recur — the same companies, events, public profiles, news items. We need a storage model that:

- supports the long-term product vision in which the public-entity store is a platform asset (cross-Query reuse, increasing data quality over time)
- keeps the User's uploaded materials, notes, and private annotations strictly isolated from anyone else
- has clear compliance edges (no cross-user pollution, no accidental leakage of private context into shared data)

## Decision

Two-layer storage:

- **Global shared layer** — public Entities and Edges discovered by any User's Queries, deduplicated by canonical-name + URL match (MVP entity resolution; improvable later). Every claim carries Evidence.
- **Per-User private layer** — uploaded materials, hand-typed notes, private annotations, Query history, and any Entities derived from user-supplied content. Never merged into the global layer.

At Query time, the User's private layer **overlays** the global layer for that User's view only.

## Considered options

- **A. Ephemeral (rebuilt per Query, no persistence).** Simplest and most compliance-friendly, but no cross-Query reuse — wasteful at scale, undermines the platform-asset vision.
- **B. Per-User materialised only.** Each User has their own private graph that grows over time; nothing shared. Better for individual users, but each User pays the cold-start cost on every public Entity, and there is no path to a network-effect data product.
- **C. Global materialised, single layer.** Best data efficiency, but mixing user-supplied content into a shared store creates the worst-case compliance posture (cross-user pollution, inadvertent leaks).
- **D. Global shared public + per-User private overlay.** Chosen.

## Consequences

- Two distinct storage namespaces (and likely two distinct databases or schemas) must exist from day one. Retro-fitting this later would mean migrating live user data — much costlier than building it in.
- Entity resolution must be done conservatively: only merge when canonical-name **and** URL agree. False merges in the global layer are visible to all Users.
- Per-User isolation must be enforced at the query layer, not just by convention. Code review and tests must verify private context cannot leak.
- A naive MVP implementation suffices for entity resolution. We are committing to the architecture, not to the algorithm — the resolver can be improved without changing the storage shape.
