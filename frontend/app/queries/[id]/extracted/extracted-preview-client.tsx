"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ExtractedQueryCompany } from "@/lib/extract/types";

type Props = {
  queryId: string;
  initialState: string;
  initialExtracted: ExtractedQueryCompany | null;
  initialConfirmedAt: string | null;
};

export function ExtractedPreviewClient({
  queryId,
  initialState,
  initialExtracted,
  initialConfirmedAt,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<string>(initialState);
  const [extracted, setExtracted] = useState<ExtractedQueryCompany | null>(initialExtracted);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(initialConfirmedAt);
  const [busy, setBusy] = useState<"save" | "confirm" | "cancel" | "retry" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (state === "confirmed" || confirmedAt) {
    return (
      <section data-testid="enrichment-placeholder" style={{ marginTop: "1rem" }}>
        <h2>Enrichment coming soon</h2>
        <p>
          Stage 2 (Enrich) lands in slice #04. Your confirmed ExtractedQuery is
          stored; once Enrichment ships, this page will show fetch progress and
          then the Report.
        </p>
        <p>
          <a href="/queries">← back to your queries</a>
        </p>
      </section>
    );
  }

  if (state === "cancelled") {
    return (
      <section data-testid="cancelled-message" style={{ marginTop: "1rem" }}>
        <p>This query was cancelled.</p>
        <p>
          <a href="/queries/new">Start a new query →</a>
        </p>
      </section>
    );
  }

  if (state === "failed" || !extracted) {
    return (
      <section data-testid="extract-failed" style={{ marginTop: "1rem" }}>
        <h2>Stage 1 (Extract) failed</h2>
        <p>
          The LLM call did not return a parseable response. Your input is saved;
          you can retry without re-entering it.
        </p>
        {error && (
          <p role="alert" style={{ color: "#b91c1c" }}>
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy !== null}
          data-testid="retry-extract-button"
          onClick={async () => {
            setBusy("retry");
            setError(null);
            const res = await fetch(`/api/queries/${queryId}/retry-extract`, { method: "POST" });
            const data = await res.json();
            if (res.ok) {
              setExtracted(data.extracted as ExtractedQueryCompany);
              setState("extracted");
            } else {
              setError(data?.detail ?? data?.error ?? `HTTP ${res.status}`);
            }
            setBusy(null);
          }}
        >
          {busy === "retry" ? "Retrying…" : "Retry Extract"}
        </button>
      </section>
    );
  }

  function update(patch: Partial<ExtractedQueryCompany>) {
    setExtracted((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function save() {
    if (!extracted) return;
    setBusy("save");
    setError(null);
    const res = await fetch(`/api/queries/${queryId}/extracted`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ extracted }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? `HTTP ${res.status}`);
    } else {
      setExtracted(data.extracted as ExtractedQueryCompany);
    }
    setBusy(null);
  }

  async function confirm() {
    setBusy("confirm");
    setError(null);
    // Save first so any in-flight edits are persisted before we transition to confirmed.
    if (extracted) {
      await fetch(`/api/queries/${queryId}/extracted`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extracted }),
      });
    }
    const res = await fetch(`/api/queries/${queryId}/confirm`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? `HTTP ${res.status}`);
    } else {
      setState("confirmed");
      setConfirmedAt(new Date().toISOString());
      router.refresh();
    }
    setBusy(null);
  }

  async function cancel() {
    setBusy("cancel");
    setError(null);
    const res = await fetch(`/api/queries/${queryId}/cancel`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? `HTTP ${res.status}`);
    } else {
      setState("cancelled");
      router.refresh();
    }
    setBusy(null);
  }

  return (
    <section style={{ marginTop: "1rem", display: "grid", gap: "1rem" }} aria-label="extracted-preview">
      <p style={{ color: "#555" }}>
        BridgeAI parsed your input as follows. Edit any field that BridgeAI
        misread, then <strong>confirm</strong> to proceed to Stage 2 (Enrich),
        or <strong>cancel</strong> to discard this query.
      </p>

      <fieldset style={fieldset}>
        <legend>Target</legend>
        <label style={inlineLabel}>
          <span>Name</span>
          <input
            value={extracted.target.name}
            onChange={(e) =>
              update({ target: { ...extracted.target, name: e.target.value } })
            }
            data-testid="edit-target-name"
          />
        </label>
        <label style={inlineLabel}>
          <span>URL</span>
          <input
            value={extracted.target.url ?? ""}
            onChange={(e) =>
              update({
                target: { ...extracted.target, url: e.target.value || null },
              })
            }
            data-testid="edit-target-url"
          />
        </label>
      </fieldset>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Goal (canonicalised)</span>
        <textarea
          value={extracted.goalRestated}
          onChange={(e) => update({ goalRestated: e.target.value })}
          rows={3}
          data-testid="edit-goal"
        />
      </label>

      <fieldset style={fieldset}>
        <legend>Parsed known relationships</legend>
        {extracted.parsedKnownRelationships.length === 0 && (
          <p style={{ color: "#666" }}>(none parsed)</p>
        )}
        {extracted.parsedKnownRelationships.map((rel, idx) => (
          <div key={idx} style={{ display: "flex", gap: "0.5rem" }}>
            <input
              value={rel.displayName}
              onChange={(e) =>
                update({
                  parsedKnownRelationships: extracted.parsedKnownRelationships.map((r, i) =>
                    i === idx ? { ...r, displayName: e.target.value } : r,
                  ),
                })
              }
              placeholder="display name"
              data-testid={`edit-rel-name-${idx}`}
              style={{ flex: 1 }}
            />
            <input
              value={rel.note ?? ""}
              onChange={(e) =>
                update({
                  parsedKnownRelationships: extracted.parsedKnownRelationships.map((r, i) =>
                    i === idx ? { ...r, note: e.target.value } : r,
                  ),
                })
              }
              placeholder="note"
              data-testid={`edit-rel-note-${idx}`}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() =>
                update({
                  parsedKnownRelationships: extracted.parsedKnownRelationships.filter(
                    (_, i) => i !== idx,
                  ),
                })
              }
            >
              remove
            </button>
          </div>
        ))}
        <button
          type="button"
          data-testid="add-rel-button"
          onClick={() =>
            update({
              parsedKnownRelationships: [
                ...extracted.parsedKnownRelationships,
                { displayName: "" },
              ],
            })
          }
        >
          + add relationship
        </button>
      </fieldset>

      <fieldset style={fieldset}>
        <legend>Signals</legend>
        <label style={inlineLabel}>
          <span>Budget lower (USD)</span>
          <input
            type="number"
            value={extracted.signals.budgetLowerUsd ?? ""}
            onChange={(e) =>
              update({
                signals: {
                  ...extracted.signals,
                  budgetLowerUsd: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
            data-testid="edit-budget-lower"
          />
        </label>
        <label style={inlineLabel}>
          <span>Budget upper (USD)</span>
          <input
            type="number"
            value={extracted.signals.budgetUpperUsd ?? ""}
            onChange={(e) =>
              update({
                signals: {
                  ...extracted.signals,
                  budgetUpperUsd: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
            data-testid="edit-budget-upper"
          />
        </label>
        <label style={inlineLabel}>
          <span>Timeline</span>
          <input
            value={extracted.signals.timeline ?? ""}
            onChange={(e) =>
              update({
                signals: { ...extracted.signals, timeline: e.target.value || undefined },
              })
            }
            data-testid="edit-timeline"
          />
        </label>
        <label style={inlineLabel}>
          <span>Preferred decision role</span>
          <input
            value={extracted.signals.preferredDecisionRole ?? ""}
            onChange={(e) =>
              update({
                signals: {
                  ...extracted.signals,
                  preferredDecisionRole: e.target.value || undefined,
                },
              })
            }
            data-testid="edit-decision-role"
          />
        </label>
      </fieldset>

      <fieldset style={fieldset}>
        <legend>Unknowns (BridgeAI did not parse these — fill in if you can)</legend>
        {extracted.unknowns.length === 0 && <p style={{ color: "#666" }}>(none)</p>}
        {extracted.unknowns.map((u, idx) => (
          <div key={idx} style={{ display: "flex", gap: "0.5rem" }}>
            <input
              value={u}
              onChange={(e) =>
                update({
                  unknowns: extracted.unknowns.map((x, i) => (i === idx ? e.target.value : x)),
                })
              }
              data-testid={`edit-unknown-${idx}`}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() =>
                update({ unknowns: extracted.unknowns.filter((_, i) => i !== idx) })
              }
            >
              remove
            </button>
          </div>
        ))}
        <button
          type="button"
          data-testid="add-unknown"
          onClick={() => update({ unknowns: [...extracted.unknowns, ""] })}
        >
          + add unknown
        </button>
      </fieldset>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          type="button"
          onClick={save}
          disabled={busy !== null}
          data-testid="save-button"
        >
          {busy === "save" ? "Saving…" : "Save edits"}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy !== null}
          data-testid="confirm-button"
        >
          {busy === "confirm" ? "Confirming…" : "Confirm → Enrich"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={busy !== null}
          data-testid="cancel-button"
        >
          {busy === "cancel" ? "Cancelling…" : "Cancel query"}
        </button>
      </div>

      {error && (
        <p role="alert" style={{ color: "#b91c1c" }} data-testid="preview-error">
          {error}
        </p>
      )}
    </section>
  );
}

const fieldset: React.CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  border: "1px solid #d4d4d8",
  padding: "0.75rem 1rem",
  borderRadius: "0.5rem",
};
const inlineLabel: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "10rem 1fr",
  gap: "0.5rem",
  alignItems: "center",
};
