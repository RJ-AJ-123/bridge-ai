import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/middleware";
import { saveUserEditedExtractedForUser } from "@/lib/extract/repository";
import type { ExtractedQueryCompany } from "@/lib/extract/types";

type Context = { params: { id: string } };

export async function PATCH(request: Request, ctx: Context): Promise<Response> {
  const session = await getUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!isObject(body) || !isObject(body.extracted)) {
    return NextResponse.json({ error: "body must include `extracted`" }, { status: 400 });
  }

  const parsed = parseEditedExtracted(body.extracted);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const saved = await saveUserEditedExtractedForUser({
    queryId: ctx.params.id,
    userId: session.userId,
    extracted: parsed.value,
  });
  if (!saved) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    extracted: saved.extracted,
    userEdited: saved.userEdited,
    confirmedAt: saved.confirmedAt?.toISOString() ?? null,
  });
}

type ParseOk = { ok: true; value: ExtractedQueryCompany };
type ParseErr = { ok: false; message: string };

function parseEditedExtracted(v: unknown): ParseOk | ParseErr {
  if (!isObject(v)) return { ok: false, message: "extracted must be an object" };
  if (v.mode !== "company") return { ok: false, message: "only Company-mode is supported in this slice" };
  if (!isObject(v.target) || v.target.kind !== "company" || typeof v.target.name !== "string" || v.target.name.trim().length === 0) {
    return { ok: false, message: "extracted.target.name is required" };
  }
  if (typeof v.goalRestated !== "string" || v.goalRestated.trim().length === 0) {
    return { ok: false, message: "extracted.goalRestated must be a non-empty string" };
  }
  if (!Array.isArray(v.parsedKnownRelationships)) {
    return { ok: false, message: "extracted.parsedKnownRelationships must be an array" };
  }
  if (!Array.isArray(v.unknowns)) {
    return { ok: false, message: "extracted.unknowns must be an array" };
  }

  const signals = isObject(v.signals) ? v.signals : {};
  return {
    ok: true,
    value: {
      mode: "company",
      target: {
        kind: "company",
        name: v.target.name.trim(),
        url: typeof v.target.url === "string" && v.target.url.trim().length > 0 ? v.target.url.trim() : null,
      },
      goalRestated: v.goalRestated.trim(),
      parsedKnownRelationships: v.parsedKnownRelationships
        .filter(isObject)
        .filter((r): r is Record<string, unknown> & { display_name?: unknown; displayName?: unknown } => true)
        .map((r) => {
          const name = typeof r.displayName === "string" ? r.displayName : typeof r.display_name === "string" ? r.display_name : "";
          const note = typeof r.note === "string" ? r.note : undefined;
          return note ? { displayName: name, note } : { displayName: name };
        })
        .filter((r) => r.displayName.length > 0),
      signals: {
        budgetLowerUsd: numberOrUndef(signals.budgetLowerUsd),
        budgetUpperUsd: numberOrUndef(signals.budgetUpperUsd),
        timeline: stringOrUndef(signals.timeline),
        preferredDecisionRole: stringOrUndef(signals.preferredDecisionRole),
      },
      unknowns: v.unknowns.filter((u): u is string => typeof u === "string"),
    },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function numberOrUndef(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function stringOrUndef(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
