import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/server";
import { listQueries } from "@/lib/queries/repository";

import { SignOutButton } from "./sign-out-button";

function summarizePayload(payload: unknown): string {
  if (payload && typeof payload === "object" && "goal" in payload) {
    const goal = (payload as { goal?: unknown }).goal;
    if (typeof goal === "string") return goal;
  }
  return "(no goal)";
}

export default async function QueriesPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const queries = await listQueries(session.userId);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Your queries</h1>
        <SignOutButton />
      </header>

      <p style={{ color: "#555" }}>
        Past queries are scoped to your account. Submit a new one from the{" "}
        <a href="/">home page</a>.
      </p>

      {queries.length === 0 ? (
        <p data-testid="queries-empty" style={{ marginTop: "2rem", color: "#666" }}>
          No queries yet. Head to the home page to create one.
        </p>
      ) : (
        <ul data-testid="queries-list" style={{ listStyle: "none", padding: 0, marginTop: "1.5rem", display: "grid", gap: "0.75rem" }}>
          {queries.map((q) => (
            <li
              key={q.id}
              data-testid="query-card"
              style={{ border: "1px solid #d4d4d8", borderRadius: "0.5rem", padding: "0.875rem 1rem" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#52525b" }}>
                <span>mode: <strong>{q.mode}</strong></span>
                <span>state: {q.state}</span>
                <time dateTime={q.createdAt.toISOString()}>{q.createdAt.toISOString()}</time>
              </div>
              <p style={{ margin: "0.5rem 0 0" }}>{summarizePayload(q.payload)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
