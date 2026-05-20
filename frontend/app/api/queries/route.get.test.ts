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

function getRequest(cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request("http://localhost/api/queries", { method: "GET", headers });
}

describe("GET /api/queries (auth + cross-user isolation)", () => {
  beforeEach(resetAuthAndQueries);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("returns only the authenticated user's queries; never leaks another user's data", async () => {
    const alice = await authedUser("alice@example.com");
    const bob = await authedUser("bob@example.com");

    await createQuery({ userId: alice.userId, mode: "company", payload: { goal: "alice-goal-1" } });
    await createQuery({ userId: alice.userId, mode: "city", payload: { goal: "alice-goal-2" } });
    await createQuery({ userId: bob.userId, mode: "company", payload: { goal: "bob-goal-1" } });

    const aliceRes = await GET(getRequest(alice.cookie));
    const aliceBody = await aliceRes.json();
    expect(aliceBody.queries).toHaveLength(2);
    for (const q of aliceBody.queries) {
      expect(q.payload.goal.startsWith("alice")).toBe(true);
    }

    const bobRes = await GET(getRequest(bob.cookie));
    const bobBody = await bobRes.json();
    expect(bobBody.queries).toHaveLength(1);
    expect(bobBody.queries[0].payload.goal).toBe("bob-goal-1");
  });

  it("returns an empty list when the user has no queries", async () => {
    const { cookie } = await authedUser("alice@example.com");
    const res = await GET(getRequest(cookie));
    const body = await res.json();
    expect(body.queries).toEqual([]);
  });
});
