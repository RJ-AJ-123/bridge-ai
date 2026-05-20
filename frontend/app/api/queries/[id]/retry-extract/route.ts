import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { extractCompanyQuery } from "@/lib/extract/extract";
import { upsertExtracted } from "@/lib/extract/repository";
import type { CompanyQueryInput } from "@/lib/extract/types";
import type { LlmClient } from "@/lib/llm/client";
import { getDefaultLlmClient } from "@/lib/llm/factory";
import { getQuery } from "@/lib/queries/repository";
import { assertTransition, isLegalTransition } from "@/lib/queries/state-machine";

type Context = { params: { id: string } };

/**
 * Inner handler — accepts the LLM client explicitly so tests can inject a stub.
 */
export async function retryExtract(
  request: Request,
  ctx: Context,
  llm: LlmClient,
): Promise<Response> {
  const session = await getUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const query = await getQuery({ id: ctx.params.id, userId: session.userId });
  if (!query) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (!isLegalTransition(query.state, "extracting")) {
    return NextResponse.json(
      { error: `cannot retry extract from state '${query.state}'` },
      { status: 409 },
    );
  }

  const payload = query.payload as Record<string, unknown>;
  const input = toCompanyInput(payload);
  if (!input) {
    return NextResponse.json(
      { error: "stored query payload is not a valid Company-mode payload" },
      { status: 422 },
    );
  }

  assertTransition(query.state, "extracting");
  await prisma.query.update({ where: { id: query.id }, data: { state: "extracting" } });

  try {
    const extracted = await extractCompanyQuery({ llm, input });
    await upsertExtracted({ queryId: query.id, extracted, userEdited: false });
    assertTransition("extracting", "extracted");
    await prisma.query.update({ where: { id: query.id }, data: { state: "extracted" } });
    return NextResponse.json({ queryId: query.id, state: "extracted", extracted });
  } catch (err) {
    assertTransition("extracting", "failed");
    await prisma.query.update({ where: { id: query.id }, data: { state: "failed" } });
    return NextResponse.json(
      {
        queryId: query.id,
        error: "stage-1 extract failed",
        retryable: true,
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request, ctx: Context): Promise<Response> {
  return retryExtract(request, ctx, getDefaultLlmClient());
}

function toCompanyInput(payload: Record<string, unknown>): CompanyQueryInput | null {
  if (typeof payload.goal !== "string" || payload.goal.trim().length === 0) return null;
  const target = payload.target;
  if (!target || typeof target !== "object") return null;
  const t = target as Record<string, unknown>;
  if (typeof t.name !== "string" || t.name.trim().length === 0) return null;

  const knownRelationships = Array.isArray(payload.knownRelationships)
    ? payload.knownRelationships.filter((s): s is string => typeof s === "string")
    : [];
  const hints = (payload.hints && typeof payload.hints === "object" ? payload.hints : {}) as CompanyQueryInput["hints"];

  return {
    mode: "company",
    goal: payload.goal.trim(),
    target: {
      name: t.name.trim(),
      ...(typeof t.url === "string" && t.url.trim().length > 0 ? { url: t.url.trim() } : {}),
    },
    knownRelationships,
    hints,
  };
}
