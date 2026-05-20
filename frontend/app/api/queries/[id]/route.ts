import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/middleware";
import { getQuery } from "@/lib/queries/repository";

type Context = { params: { id: string } };

export async function GET(request: Request, ctx: Context): Promise<Response> {
  const session = await getUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const row = await getQuery({ id: ctx.params.id, userId: session.userId });
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    query: {
      id: row.id,
      mode: row.mode,
      state: row.state,
      payload: row.payload,
      createdAt: row.createdAt.toISOString(),
    },
  });
}
