import { NextResponse } from "next/server";

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

  return NextResponse.json({
    echo: { mode: payload.mode, goal: payload.goal },
    report: buildStubReport(payload),
  });
}
