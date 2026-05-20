import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { requestMagicLink, type MagicLinkSender } from "@/lib/auth/magic-link";
import { SESSION_COOKIE } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { resetAuthAndQueries } from "@/lib/test-utils/db";

import { GET } from "./route";

function tokenFromUrl(url: string): string {
  return new URL(url).searchParams.get("token") ?? "";
}

async function issueLinkFor(email: string): Promise<string> {
  let captured = "";
  const sender: MagicLinkSender = async ({ linkUrl }) => {
    captured = tokenFromUrl(linkUrl);
  };
  await requestMagicLink({ email, origin: "http://localhost:3000", sender });
  return captured;
}

function callbackRequest(token: string | null): Request {
  const url = token === null
    ? "http://localhost:3000/api/auth/callback"
    : `http://localhost:3000/api/auth/callback?token=${encodeURIComponent(token)}`;
  return new Request(url);
}

describe("GET /api/auth/callback", () => {
  beforeEach(resetAuthAndQueries);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("consumes a valid magic link, sets the session cookie, and redirects to /queries", async () => {
    const token = await issueLinkFor("alice@example.com");
    const res = await GET(callbackRequest(token));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/queries");

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("path=/");

    const sessions = await prisma.session.findMany();
    expect(sessions).toHaveLength(1);
  });

  it("redirects to /sign-in with an error when the token is missing", async () => {
    const res = await GET(callbackRequest(null));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/sign-in?error=invalid_link");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("redirects to /sign-in with an error when the token is unknown", async () => {
    const res = await GET(callbackRequest("not-a-real-token"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/sign-in?error=invalid_link");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("treats a previously-consumed token as invalid", async () => {
    const token = await issueLinkFor("alice@example.com");
    await GET(callbackRequest(token));

    const second = await GET(callbackRequest(token));
    expect(second.status).toBe(303);
    expect(second.headers.get("location")).toBe("/sign-in?error=invalid_link");
  });
});
