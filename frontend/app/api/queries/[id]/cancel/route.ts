import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { getQuery } from "@/lib/queries/repository";
import { isLegalTransition } from "@/lib/queries/state-machine";

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

  if (!isLegalTransition(query.state, "cancelled")) {
    return NextResponse.json(
      { error: `cannot cancel from state '${query.state}'` },
      { status: 409 },
    );
  }

  await prisma.query.update({
    where: { id: query.id },
    data: { state: "cancelled" },
  });
  return NextResponse.json({ queryId: query.id, state: "cancelled" });
}
