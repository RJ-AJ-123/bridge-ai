# Non-agentic three-stage pipeline in MVP

## Status

accepted

## Context

The dominant pattern for LLM-driven products in 2025–2026 is an agent loop: a model with tool access plans, calls tools in an order it chooses, observes results, and iterates. BridgeAI's task — gather public information, build a Graph, score Items, render a Report — has a fixed shape and well-known steps. We have to decide whether to use an agentic loop or a fixed pipeline for the MVP.

## Decision

The MVP runs a **fixed, deterministic three-stage pipeline**: `Extract → Enrich → Build Graph + Score + Render`. Stages execute in order. The LLM does not choose what to call next; the surrounding code does.

The long-term plan is a **controlled Agentic workflow** (`Plan → Search → Extract → Build Graph → Score → Recommend Actions`), but only after the fixed pipeline is stable, tested, and compliance-verified.

## Considered options

- **Single-prompt one-shot.** All inputs in one call, structured Report out. Rejected — Graph + Items + Evidence will not fit cleanly with consistent quality, the User cannot correct Extract mid-flow, and debugging is impossible when a Report goes wrong.
- **Fully agentic with free tool calls.** Rejected for MVP. Non-deterministic step order makes testing brittle. Token costs are unpredictable. Compliance review of an agent's tool-usage path is materially harder than reviewing a fixed pipeline. None of the freedom an agent offers is actually needed when the task shape is fixed.
- **Fixed three-stage pipeline.** Chosen.

## Consequences

- The User can review and edit `ExtractedQuery` before Enrichment runs. This is a product-visible affordance that an agentic system cannot easily offer.
- Each stage is independently testable, prompt-tunable, and replayable. Failures are localised.
- Compliance bounds (no login bypass, no private scraping, no biometric inference) are enforced at the tool surface, which is a finite list. An agent would still need this enforcement, but its execution paths are harder to audit.
- We accept that we are not exploring "what could agents do here" during MVP. The risk is that we discover agentic value only after building the fixed pipeline. Acceptable — the fixed pipeline is the foundation an agent would orchestrate anyway.
- Reconsider this decision once: (a) the fixed pipeline is stable, (b) we have a concrete reason an agent would do better, and (c) we have a compliance story for variable execution paths.
