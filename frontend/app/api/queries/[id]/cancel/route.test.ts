import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { SESSION_COOKIE } from "@/lib/auth/middleware";
import { createSession } from "@/lib/auth/sessions";
import { prisma } from "@/lib/db";
import { createQuery } from "@/lib/queries/repository";
import { resetAuthAndQueries } from "@/lib/test-utils/db";

import { POST } from "./route";

async function authedUser(email: string): Promise<{ userId: string; cookie: string }> {
  const user = await prisma.user.create({ data: { email } });
  const { token } = await createSession(user.id);
  return { userId: user.id, cookie: `${SESSION_COOKIE}=${token}` };
}

function postRequest(id: string, cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request(`http://localhost/api/queries/${id}/cancel`, { method: "POST", headers });
}

describe("POST /api/queries/:id/cancel", () => {
  beforeEach(resetAuthAndQueries);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects unauth with 401", async () => {
    const res = await POST(postRequest("00000000-0000-0000-0000-000000000000"), {
      params: { id: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status).toBe(401);
  });

  it("transitions state to cancelled from extracted", async () => {
    const alice = await authedUser("alice@example.com");
    const q = await createQuery({ userId: alice.userId, mode: "company", payload: { goal: "g" } });
    await prisma.query.update({ where: { id: q.id }, data: { state: "extracted" } });

    const res = await POST(postRequest(q.id, alice.cookie), { params: { id: q.id } });
    expect(res.status).toBe(200);

    const stored = await prisma.query.findUnique({ where: { id: q.id } });
    expect(stored?.state).toBe("cancelled");
  });

  it("returns 404 when the query belongs to another user", async () => {
    const alice = await authedUser("alice@example.com");
    const bob = await authedUser("bob@example.com");
    const q = await createQuery({ userId: alice.userId, mode: "company", payload: { goal: "g" } });

    const res = await POST(postRequest(q.id, bob.cookie), { params: { id: q.id } });
    expect(res.status).toBe(404);
  });

  it("returns 409 when the query is already in a terminal state (confirmed)", async () => {
    const alice = await authedUser("alice@example.com");
    const q = await createQuery({ userId: alice.userId, mode: "company", payload: { goal: "g" } });
    await prisma.query.update({ where: { id: q.id }, data: { state: "confirmed" } });

    const res = await POST(postRequest(q.id, alice.cookie), { params: { id: q.id } });
    expect(res.status).toBe(409);
  });
});
