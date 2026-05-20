import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/server";
import { getExtractedForUser } from "@/lib/extract/repository";
import type { ExtractedQueryCompany } from "@/lib/extract/types";
import { getQuery } from "@/lib/queries/repository";

import { SignOutButton } from "../../sign-out-button";
import { ExtractedPreviewClient } from "./extracted-preview-client";

type Props = { params: { id: string } };

export default async function ExtractedPreviewPage({ params }: Props) {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const query = await getQuery({ id: params.id, userId: session.userId });
  if (!query) {
    notFound();
  }

  const extracted = await getExtractedForUser({ queryId: query.id, userId: session.userId });
  const initialExtracted = (extracted?.extracted as ExtractedQueryCompany | undefined) ?? null;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Review what BridgeAI understood</h1>
        <SignOutButton />
      </header>
      <p style={{ color: "#555", fontSize: "0.85rem" }}>
        Query <code>{query.id}</code> — state <strong>{query.state}</strong>
      </p>

      <ExtractedPreviewClient
        queryId={query.id}
        initialState={query.state}
        initialExtracted={initialExtracted}
        initialConfirmedAt={extracted?.confirmedAt?.toISOString() ?? null}
      />
    </main>
  );
}
