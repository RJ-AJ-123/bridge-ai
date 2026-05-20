import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { SESSION_COOKIE } from "@/lib/auth/middleware";
import { createSession, verifySession } from "@/lib/auth/sessions";
import { prisma } from "@/lib/db";
import { resetAuthAndQueries } from "@/lib/test-utils/db";

import { POST } from "./route";

function signOutRequest(cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request("http://localhost:3000/api/auth/sign-out", {
    method: "POST",
    headers,
  });
}

describe("POST /api/auth/sign-out", () => {
  beforeEach(resetAuthAndQueries);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("deletes the session row and clears the cookie when a valid cookie is provided", async () => {
    const user = await prisma.user.create({ data: { email: "alice@example.com" } });
    const { token } = await createSession(user.id);

    const res = await POST(signOutRequest(`${SESSION_COOKIE}=${token}`));

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain("max-age=0");

    expect(await verifySession(token)).toBeNull();
    expect(await prisma.session.findMany()).toHaveLength(0);
  });

  it("is a no-op (200) when there is no session cookie", async () => {
    const res = await POST(signOutRequest());
    expect(res.status).toBe(200);
  });
});
