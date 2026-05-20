import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/server";

import { NewQueryForm } from "./new-query-form";
import { SignOutButton } from "./queries/sign-out-button";

export default async function Home() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>BridgeAI — new query</h1>
        <SignOutButton />
      </header>
      <p style={{ color: "#555" }}>
        Single-shot Query intake (stub). Stage 1/2/3 of the pipeline lands in later slices
        (issues #03–#05). See your past queries on the{" "}
        <a href="/queries">history page</a>.
      </p>

      <NewQueryForm />
    </main>
  );
}
