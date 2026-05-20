import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/middleware";
import { extractCompanyQuery } from "@/lib/extract/extract";
import { upsertExtracted } from "@/lib/extract/repository";
import type { CompanyQueryInput } from "@/lib/extract/types";
import type { LlmClient } from "@/lib/llm/client";
import { getDefaultLlmClient } from "@/lib/llm/factory";
import { prisma } from "@/lib/db";
import { createQuery, listQueries } from "@/lib/queries/repository";
import { assertTransition } from "@/lib/queries/state-machine";

type CompanyPayload = {
  mode: "company";
  goal: string;
  target: { name: string; url?: string };
  knownRelationships?: string[];
  hints?: CompanyQueryInput["hints"];
};

type ValidationOk = { ok: true; payload: CompanyPayload };
type ValidationErr = { ok: false; message: string };

function validateCompanyPayload(value: unknown): ValidationOk | ValidationErr {
  if (value === null || typeof value !== "object") {
    return { ok: false, message: "body must be a JSON object" };
  }
  const v = value as Record<string, unknown>;
  if (v.mode === "city") {
    return { ok: false, message: "city-mode intake is not available yet (coming in slice #06)" };
  }
  if (v.mode !== "company") {
    return { ok: false, message: "mode must be 'company' (city-mode coming in slice #06)" };
  }
  if (typeof v.goal !== "string" || v.goal.trim().length === 0) {
    return { ok: false, message: "goal must be a non-empty string" };
  }
  if (!v.target || typeof v.target !== "object") {
    return { ok: false, message: "target is required for company-mode" };
  }
  const target = v.target as Record<string, unknown>;
  if (typeof target.name !== "string" || target.name.trim().length === 0) {
    return { ok: false, message: "target.name is required for company-mode" };
  }
  const knownRelationships = Array.isArray(v.knownRelationships)
    ? v.knownRelationships.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
  const hints = (v.hints && typeof v.hints === "object" ? v.hints : {}) as CompanyQueryInput["hints"];

  return {
    ok: true,
    payload: {
      mode: "company",
      goal: v.goal.trim(),
      target: {
        name: target.name.trim(),
        ...(typeof target.url === "string" && target.url.trim().length > 0
          ? { url: target.url.trim() }
          : {}),
      },
      knownRelationships,
      hints,
    },
  };
}

/**
 * Inner handler — accepts the LLM client explicitly so tests can inject a stub.
 * Per ADR-0002 + PRD §11.4: this is the only place the route knows about a
 * specific LlmClient; pipeline modules use the interface, not the factory.
 */
export async function createQueryAndExtract(
  request: Request,
  llm: LlmClient,
): Promise<Response> {
  const session = await getUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const v = validateCompanyPayload(raw);
  if (!v.ok) {
    return NextResponse.json({ error: v.message }, { status: 400 });
  }
  const payload = v.payload;

  // Persist Query in draft, then transition draft → extracting before calling Stage 1.
  const queryRow = await createQuery({
    userId: session.userId,
    mode: "company",
    payload: {
      goal: payload.goal,
      target: payload.target,
      knownRelationships: payload.knownRelationships ?? [],
      hints: payload.hints ?? {},
    },
  });
  assertTransition(queryRow.state, "extracting");
  await prisma.query.update({
    where: { id: queryRow.id },
    data: { state: "extracting" },
  });

  try {
    const extracted = await extractCompanyQuery({
      llm,
      input: {
        mode: "company",
        goal: payload.goal,
        target: payload.target,
        knownRelationships: payload.knownRelationships ?? [],
        hints: payload.hints ?? {},
      },
    });
    await upsertExtracted({
      queryId: queryRow.id,
      extracted,
      userEdited: false,
    });
    assertTransition("extracting", "extracted");
    await prisma.query.update({
      where: { id: queryRow.id },
      data: { state: "extracted" },
    });

    return NextResponse.json({
      queryId: queryRow.id,
      state: "extracted",
      extracted,
    });
  } catch (err) {
    assertTransition("extracting", "failed");
    await prisma.query.update({
      where: { id: queryRow.id },
      data: { state: "failed" },
    });
    return NextResponse.json(
      {
        queryId: queryRow.id,
        error: "stage-1 extract failed",
        retryable: true,
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  return createQueryAndExtract(request, getDefaultLlmClient());
}

export async function GET(request: Request): Promise<Response> {
  const session = await getUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const queries = await listQueries(session.userId);
  return NextResponse.json({
    queries: queries.map((q) => ({
      id: q.id,
      mode: q.mode,
      state: q.state,
      payload: q.payload,
      createdAt: q.createdAt.toISOString(),
    })),
  });
}
