import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { SESSION_COOKIE } from "@/lib/auth/middleware";
import { createSession } from "@/lib/auth/sessions";
import { prisma } from "@/lib/db";
import { createQuery } from "@/lib/queries/repository";
import { resetAuthAndQueries } from "@/lib/test-utils/db";

import { GET } from "./route";

async function authedUser(email: string): Promise<{ userId: string; cookie: string }> {
  const user = await prisma.user.create({ data: { email } });
  const { token } = await createSession(user.id);
  return { userId: user.id, cookie: `${SESSION_COOKIE}=${token}` };
}

function getRequest(id: string, cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request(`http://localhost/api/queries/${id}`, { method: "GET", headers });
}

describe("GET /api/queries/:id (cross-user isolation)", () => {
  beforeEach(resetAuthAndQueries);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await GET(getRequest("00000000-0000-0000-0000-000000000000"), {
      params: { id: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status).toBe(401);
  });

  it("returns the requested query when it belongs to the caller", async () => {
    const alice = await authedUser("alice@example.com");
    const q = await createQuery({ userId: alice.userId, mode: "company", payload: { goal: "g" } });

    const res = await GET(getRequest(q.id, alice.cookie), { params: { id: q.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.query.id).toBe(q.id);
    expect(body.query.mode).toBe("company");
  });

  it("returns 404 when the query belongs to a different user (never leaks the row)", async () => {
    const alice = await authedUser("alice@example.com");
    const bob = await authedUser("bob@example.com");
    const aliceQuery = await createQuery({
      userId: alice.userId,
      mode: "company",
      payload: { goal: "alice-goal" },
    });

    const res = await GET(getRequest(aliceQuery.id, bob.cookie), {
      params: { id: aliceQuery.id },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    // No part of the response should reveal the row's contents.
    expect(JSON.stringify(body)).not.toContain("alice-goal");
  });

  it("returns 404 for a syntactically valid but unknown UUID", async () => {
    const { cookie } = await authedUser("alice@example.com");
    const res = await GET(getRequest("11111111-1111-1111-1111-111111111111", cookie), {
      params: { id: "11111111-1111-1111-1111-111111111111" },
    });
    expect(res.status).toBe(404);
  });
});
