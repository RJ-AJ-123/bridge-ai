"use client";

import { useState } from "react";

type SubmissionResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

export function NewQueryForm() {
  const [mode, setMode] = useState<"company" | "city">("company");
  const [goal, setGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, goal }),
      });
      const body = await res.json();
      setResult({ ok: res.ok, status: res.status, body });
    } catch (err) {
      setResult({ ok: false, status: 0, body: { error: String(err) } });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} aria-label="new-query-form" style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "company" | "city")}
            data-testid="mode-select"
          >
            <option value="company">company</option>
            <option value="city">city</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Goal</span>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={4}
            placeholder="e.g. find the procurement decision-maker for AI tooling at Acme"
            data-testid="goal-input"
          />
        </label>

        <button type="submit" disabled={submitting || goal.trim().length === 0} data-testid="submit-button">
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </form>

      {result && (
        <section style={{ marginTop: "2rem" }} aria-label="result">
          <h2>Response (HTTP {result.status})</h2>
          <pre
            data-testid="result-json"
            style={{
              background: "#0b1020",
              color: "#e0e7ff",
              padding: "1rem",
              borderRadius: "0.5rem",
              overflowX: "auto",
              fontSize: "0.85rem",
            }}
          >
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </section>
      )}
    </>
  );
}
