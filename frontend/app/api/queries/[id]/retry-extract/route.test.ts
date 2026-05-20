import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { SESSION_COOKIE } from "@/lib/auth/middleware";
import { createSession } from "@/lib/auth/sessions";
import { prisma } from "@/lib/db";
import { EXTRACT_SCHEMA_NAME } from "@/lib/extract/extract";
import { upsertExtracted } from "@/lib/extract/repository";
import type { ExtractedQueryCompany } from "@/lib/extract/types";
import { StubLlmClient } from "@/lib/llm/stub-client";
import { createQuery } from "@/lib/queries/repository";
import { resetAuthAndQueries } from "@/lib/test-utils/db";

import { retryExtract } from "./route";

async function authedUser(email: string): Promise<{ userId: string; cookie: string }> {
  const user = await prisma.user.create({ data: { email } });
  const { token } = await createSession(user.id);
  return { userId: user.id, cookie: `${SESSION_COOKIE}=${token}` };
}

function postRequest(id: string, cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request(`http://localhost/api/queries/${id}/retry-extract`, { method: "POST", headers });
}

function seed(): ExtractedQueryCompany {
  return {
    mode: "company",
    target: { kind: "company", name: "Acme", url: null },
    goalRestated: "old",
    parsedKnownRelationships: [],
    signals: {},
    unknowns: [],
  };
}

function successStub(goal: string): StubLlmClient {
  return new StubLlmClient({
    responses: [
      {
        schema: EXTRACT_SCHEMA_NAME,
        value: {
          target: { kind: "company", name: "Acme Corp", url: null },
          goal_restated: goal,
          parsed_known_relationships: [],
          signals: {},
          unknowns: [],
        },
      },
    ],
  });
}

describe("POST /api/queries/:id/retry-extract", () => {
  beforeEach(resetAuthAndQueries);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects unauth with 401", async () => {
    const res = await retryExtract(
      postRequest("00000000-0000-0000-0000-000000000000"),
      { params: { id: "00000000-0000-0000-0000-000000000000" } },
      successStub("g"),
    );
    expect(res.status).toBe(401);
  });

  it("re-runs Stage 1 from failed state and writes a fresh ExtractedQuery", async () => {
    const alice = await authedUser("alice@example.com");
    const q = await createQuery({
      userId: alice.userId,
      mode: "company",
      payload: { goal: "Find AI partners", target: { name: "Acme Corp" } },
    });
    await prisma.query.update({ where: { id: q.id }, data: { state: "failed" } });

    const res = await retryExtract(
      postRequest(q.id, alice.cookie),
      { params: { id: q.id } },
      successStub("Find AI partners — refreshed"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe("extracted");
    expect(body.extracted.goalRestated).toBe("Find AI partners — refreshed");

    const stored = await prisma.query.findUnique({ where: { id: q.id } });
    expect(stored?.state).toBe("extracted");
  });

  it("re-runs Stage 1 from extracted state too (user can re-extract before confirming)", async () => {
    const alice = await authedUser("alice@example.com");
    const q = await createQuery({
      userId: alice.userId,
      mode: "company",
      payload: { goal: "g", target: { name: "Acme" } },
    });
    await upsertExtracted({ queryId: q.id, extracted: seed(), userEdited: false });
    await prisma.query.update({ where: { id: q.id }, data: { state: "extracted" } });

    const res = await retryExtract(
      postRequest(q.id, alice.cookie),
      { params: { id: q.id } },
      successStub("rerun"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.extracted.goalRestated).toBe("rerun");
  });

  it("returns 409 when the query is not in failed or extracted state", async () => {
    const alice = await authedUser("alice@example.com");
    const q = await createQuery({
      userId: alice.userId,
      mode: "company",
      payload: { goal: "g", target: { name: "Acme" } },
    });
    await prisma.query.update({ where: { id: q.id }, data: { state: "confirmed" } });

    const res = await retryExtract(
      postRequest(q.id, alice.cookie),
      { params: { id: q.id } },
      successStub("g"),
    );
    expect(res.status).toBe(409);
  });

  it("returns 404 when the query belongs to another user", async () => {
    const alice = await authedUser("alice@example.com");
    const bob = await authedUser("bob@example.com");
    const q = await createQuery({
      userId: alice.userId,
      mode: "company",
      payload: { goal: "g", target: { name: "Acme" } },
    });
    await prisma.query.update({ where: { id: q.id }, data: { state: "failed" } });

    const res = await retryExtract(
      postRequest(q.id, bob.cookie),
      { params: { id: q.id } },
      successStub("g"),
    );
    expect(res.status).toBe(404);
  });

  it("on retry failure: keeps query in failed state, returns 502 retryable=true", async () => {
    const alice = await authedUser("alice@example.com");
    const q = await createQuery({
      userId: alice.userId,
      mode: "company",
      payload: { goal: "g", target: { name: "Acme" } },
    });
    await prisma.query.update({ where: { id: q.id }, data: { state: "failed" } });

    const failingStub = new StubLlmClient({
      responses: [{ schema: EXTRACT_SCHEMA_NAME, error: new Error("still down") }],
    });

    const res = await retryExtract(
      postRequest(q.id, alice.cookie),
      { params: { id: q.id } },
      failingStub,
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.retryable).toBe(true);

    const stored = await prisma.query.findUnique({ where: { id: q.id } });
    expect(stored?.state).toBe("failed");
  });
});
