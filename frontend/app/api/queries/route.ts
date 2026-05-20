import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/middleware";
import { createQuery, listQueries } from "@/lib/queries/repository";
import { buildStubReport, type QueryMode } from "@/lib/stub-report";

type QueryPayload = {
  mode: QueryMode;
  goal: string;
};

function isValidPayload(value: unknown): value is QueryPayload {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.mode !== "company" && v.mode !== "city") return false;
  if (typeof v.goal !== "string" || v.goal.trim().length === 0) return false;
  return true;
}

export async function POST(request: Request): Promise<Response> {
  const session = await getUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!isValidPayload(payload)) {
    return NextResponse.json(
      { error: "request body must include mode ('company'|'city') and a non-empty goal" },
      { status: 400 },
    );
  }

  const row = await createQuery({
    userId: session.userId,
    mode: payload.mode,
    payload: { goal: payload.goal },
  });

  return NextResponse.json({
    queryId: row.id,
    echo: { mode: payload.mode, goal: payload.goal },
    report: buildStubReport(payload),
  });
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
