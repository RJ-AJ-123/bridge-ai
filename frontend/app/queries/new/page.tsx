import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/server";

import { SignOutButton } from "../sign-out-button";
import { NewQueryForm } from "./new-query-form";

export default async function NewQueryPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>New BridgeAI query (Company-mode)</h1>
        <SignOutButton />
      </header>
      <p style={{ color: "#555" }}>
        Stage 1 — Extract — runs after you submit. You will be shown the parsed
        ExtractedQuery before Stage 2 (Enrichment) starts. See your{" "}
        <a href="/queries">past queries</a>.
      </p>

      <NewQueryForm />
    </main>
  );
}
