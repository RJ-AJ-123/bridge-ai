"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Relationship = { value: string; id: string };

function uid(): string {
  return Math.random().toString(36).slice(2);
}

export function NewQueryForm() {
  const router = useRouter();

  const [targetName, setTargetName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [relationships, setRelationships] = useState<Relationship[]>([
    { id: uid(), value: "" },
  ]);
  const [budgetLower, setBudgetLower] = useState("");
  const [budgetUpper, setBudgetUpper] = useState("");
  const [timeline, setTimeline] = useState("");
  const [decisionRole, setDecisionRole] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = {
      mode: "company" as const,
      goal: goal.trim(),
      target: {
        name: targetName.trim(),
        ...(targetUrl.trim() ? { url: targetUrl.trim() } : {}),
      },
      knownRelationships: relationships
        .map((r) => r.value.trim())
        .filter((v) => v.length > 0),
      hints: {
        ...(budgetLower ? { budgetLowerUsd: Number(budgetLower) } : {}),
        ...(budgetUpper ? { budgetUpperUsd: Number(budgetUpper) } : {}),
        ...(timeline.trim() ? { timeline: timeline.trim() } : {}),
        ...(decisionRole.trim() ? { preferredDecisionRole: decisionRole.trim() } : {}),
      },
    };

    try {
      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok || res.status === 502) {
        // 502 = stage-1 failed but the query is persisted; the preview page
        // shows the retry affordance.
        if (data.queryId) {
          router.push(`/queries/${data.queryId}/extracted`);
          return;
        }
      }
      setError(data?.error ?? `HTTP ${res.status}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function setRel(idx: number, value: string) {
    setRelationships((prev) => prev.map((r, i) => (i === idx ? { ...r, value } : r)));
  }
  function addRel() {
    setRelationships((prev) => [...prev, { id: uid(), value: "" }]);
  }
  function removeRel(idx: number) {
    setRelationships((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <form onSubmit={handleSubmit} aria-label="new-query-form" style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Mode</span>
        <select value="company" onChange={() => undefined} data-testid="mode-select">
          <option value="company">company</option>
          <option value="city" disabled>
            city — coming in slice #06
          </option>
        </select>
      </label>

      <fieldset style={fieldsetStyle}>
        <legend>Target organisation</legend>
        <label style={inlineLabel}>
          <span>Name *</span>
          <input
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            data-testid="target-name-input"
            required
            placeholder="Acme Corp"
          />
        </label>
        <label style={inlineLabel}>
          <span>URL (optional)</span>
          <input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            data-testid="target-url-input"
            placeholder="https://acme.example"
          />
        </label>
      </fieldset>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Goal *</span>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={4}
          required
          data-testid="goal-input"
          placeholder="e.g. find the procurement decision-maker for AI tooling at Acme"
        />
      </label>

      <fieldset style={fieldsetStyle}>
        <legend>Known relationships</legend>
        {relationships.map((rel, idx) => (
          <div key={rel.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              value={rel.value}
              onChange={(e) => setRel(idx, e.target.value)}
              placeholder="e.g. Person C — former Acme engineer"
              style={{ flex: 1 }}
              data-testid={`relationship-input-${idx}`}
            />
            <button type="button" onClick={() => removeRel(idx)} disabled={relationships.length === 1}>
              remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addRel} data-testid="add-relationship">
          + add relationship
        </button>
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend>Hints (optional)</legend>
        <label style={inlineLabel}>
          <span>Budget lower (USD)</span>
          <input
            type="number"
            value={budgetLower}
            onChange={(e) => setBudgetLower(e.target.value)}
            data-testid="budget-lower-input"
          />
        </label>
        <label style={inlineLabel}>
          <span>Budget upper (USD)</span>
          <input
            type="number"
            value={budgetUpper}
            onChange={(e) => setBudgetUpper(e.target.value)}
            data-testid="budget-upper-input"
          />
        </label>
        <label style={inlineLabel}>
          <span>Timeline</span>
          <input
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            placeholder="e.g. Q3 2026"
            data-testid="timeline-input"
          />
        </label>
        <label style={inlineLabel}>
          <span>Preferred decision role</span>
          <select
            value={decisionRole}
            onChange={(e) => setDecisionRole(e.target.value)}
            data-testid="decision-role-select"
          >
            <option value="">(any)</option>
            <option value="decision-maker">decision-maker</option>
            <option value="influencer">influencer</option>
            <option value="user-buyer">user-buyer</option>
            <option value="budget-owner">budget-owner</option>
            <option value="champion">champion</option>
            <option value="blocker">blocker</option>
          </select>
        </label>
      </fieldset>

      <button
        type="submit"
        disabled={submitting || goal.trim().length === 0 || targetName.trim().length === 0}
        data-testid="submit-button"
      >
        {submitting ? "Extracting…" : "Submit → preview"}
      </button>

      {error && (
        <p role="alert" data-testid="form-error" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}
    </form>
  );
}

const fieldsetStyle: React.CSSProperties = {
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
