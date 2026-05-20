import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { confirmExtractedForUser } from "@/lib/extract/repository";
import { getQuery } from "@/lib/queries/repository";
import { assertTransition, isLegalTransition } from "@/lib/queries/state-machine";

type Context = { params: { id: string } };

export async function POST(request: Request, ctx: Context): Promise<Response> {
  const session = await getUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const query = await getQuery({ id: ctx.params.id, userId: session.userId });
  if (!query) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (!isLegalTransition(query.state, "confirmed")) {
    return NextResponse.json(
      { error: `cannot confirm from state '${query.state}'` },
      { status: 409 },
    );
  }

  const confirmedExtracted = await confirmExtractedForUser({
    queryId: query.id,
    userId: session.userId,
  });
  if (!confirmedExtracted) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  assertTransition(query.state, "confirmed");
  await prisma.query.update({
    where: { id: query.id },
    data: { state: "confirmed" },
  });

  return NextResponse.json({ queryId: query.id, state: "confirmed" });
}
