"use client";

import { useState } from "react";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      window.location.href = "/sign-in";
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={busy} data-testid="sign-out-button">
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
