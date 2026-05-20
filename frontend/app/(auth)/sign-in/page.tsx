"use client";

import { useState } from "react";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

export default function SignInPage({ searchParams }: { searchParams?: { error?: string } }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatus({ kind: "error", message: body.error ?? `request failed (${res.status})` });
        return;
      }
      setStatus({ kind: "sent" });
    } catch (err) {
      setStatus({ kind: "error", message: String(err) });
    }
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Sign in to BridgeAI</h1>
      <p style={{ color: "#555" }}>
        Enter your email. We&apos;ll send you a magic link — no password needed.
      </p>

      {searchParams?.error === "invalid_link" && (
        <p role="alert" style={{ color: "#b91c1c", marginTop: "1rem" }}>
          That magic link is invalid or has expired. Request a new one below.
        </p>
      )}

      <form onSubmit={handleSubmit} aria-label="sign-in-form" style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            data-testid="email-input"
            disabled={status.kind === "sending" || status.kind === "sent"}
          />
        </label>

        <button
          type="submit"
          disabled={status.kind === "sending" || status.kind === "sent" || email.trim().length === 0}
          data-testid="send-link-button"
        >
          {status.kind === "sending" ? "Sending…" : "Send magic link"}
        </button>
      </form>

      {status.kind === "sent" && (
        <p data-testid="sent-confirmation" style={{ marginTop: "1.5rem", color: "#15803d" }}>
          Check your email. In dev mode the link is also logged to the server console.
        </p>
      )}

      {status.kind === "error" && (
        <p role="alert" style={{ marginTop: "1.5rem", color: "#b91c1c" }}>
          {status.message}
        </p>
      )}
    </main>
  );
}
