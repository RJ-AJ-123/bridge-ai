import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { resetAuthAndQueries } from "@/lib/test-utils/db";

import { POST } from "./route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/magic-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/magic-link", () => {
  beforeEach(resetAuthAndQueries);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates the user and persists a magic-link token for a valid email", async () => {
    const res = await POST(postRequest({ email: "alice@example.com" }));
    expect(res.status).toBe(200);

    const users = await prisma.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("alice@example.com");

    const tokens = await prisma.magicLinkToken.findMany({ where: { userId: users[0].id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].consumedAt).toBeNull();
  });

  it("rejects requests missing email with 400", async () => {
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects malformed emails with 400", async () => {
    const res = await POST(postRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });
});
