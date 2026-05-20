import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { SESSION_COOKIE } from "@/lib/auth/middleware";
import { createSession } from "@/lib/auth/sessions";
import { prisma } from "@/lib/db";
import { resetAuthAndQueries } from "@/lib/test-utils/db";

import { POST } from "./route";

async function authedUser(email: string): Promise<{ userId: string; cookie: string }> {
  const user = await prisma.user.create({ data: { email } });
  const { token } = await createSession(user.id);
  return { userId: user.id, cookie: `${SESSION_COOKIE}=${token}` };
}

function postRequest(body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request("http://localhost/api/queries", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/queries (auth + persistence)", () => {
  beforeEach(resetAuthAndQueries);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await POST(
      postRequest({ mode: "company", goal: "enter Acme" }),
    );
    expect(res.status).toBe(401);
  });

  it("persists the query under the authenticated user and returns its id", async () => {
    const { userId, cookie } = await authedUser("alice@example.com");

    const res = await POST(
      postRequest({ mode: "company", goal: "enter Acme" }, cookie),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.queryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.echo).toEqual({ mode: "company", goal: "enter Acme" });

    const stored = await prisma.query.findUnique({ where: { id: body.queryId } });
    expect(stored).not.toBeNull();
    expect(stored?.userId).toBe(userId);
    expect(stored?.mode).toBe("company");
  });

  it("returns a stub Report with the six MVP sections", async () => {
    const { cookie } = await authedUser("alice@example.com");
    const res = await POST(
      postRequest({ mode: "city", goal: "meet AI partners in Singapore" }, cookie),
    );
    const body = await res.json();
    expect(Object.keys(body.report.sections).sort()).toEqual(
      [
        "s1_goal_summary",
        "s3_key_entities",
        "s5_opportunity_items",
        "s6_evidence",
        "s7_credibility",
        "s9_next_actions",
      ].sort(),
    );
    expect(body.report.sections.s1_goal_summary.mode).toBe("city");
  });

  it("rejects authenticated requests missing mode or goal with 400", async () => {
    const { cookie } = await authedUser("alice@example.com");
    const res = await POST(postRequest({ goal: "no mode here" }, cookie));
    expect(res.status).toBe(400);
  });
});
