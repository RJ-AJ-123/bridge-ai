import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { SESSION_COOKIE } from "@/lib/auth/middleware";
import { createSession } from "@/lib/auth/sessions";
import { prisma } from "@/lib/db";
import { upsertExtracted } from "@/lib/extract/repository";
import type { ExtractedQueryCompany } from "@/lib/extract/types";
import { createQuery } from "@/lib/queries/repository";
import { resetAuthAndQueries } from "@/lib/test-utils/db";

import { PATCH } from "./route";

async function authedUser(email: string): Promise<{ userId: string; cookie: string }> {
  const user = await prisma.user.create({ data: { email } });
  const { token } = await createSession(user.id);
  return { userId: user.id, cookie: `${SESSION_COOKIE}=${token}` };
}

function patchRequest(id: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request(`http://localhost/api/queries/${id}/extracted`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

function seedExtracted(): ExtractedQueryCompany {
  return {
    mode: "company",
    target: { kind: "company", name: "Acme Corp", url: null },
    goalRestated: "v1",
    parsedKnownRelationships: [],
    signals: {},
    unknowns: [],
  };
}

describe("PATCH /api/queries/:id/extracted", () => {
  beforeEach(resetAuthAndQueries);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await PATCH(patchRequest("00000000-0000-0000-0000-000000000000", { extracted: seedExtracted() }), {
      params: { id: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status).toBe(401);
  });

  it("saves the user-edited extracted JSON and marks userEdited=true", async () => {
    const alice = await authedUser("alice@example.com");
    const q = await createQuery({ userId: alice.userId, mode: "company", payload: { goal: "g" } });
    await upsertExtracted({ queryId: q.id, extracted: seedExtracted(), userEdited: false });
    await prisma.query.update({ where: { id: q.id }, data: { state: "extracted" } });

    const edited: ExtractedQueryCompany = {
      ...seedExtracted(),
      goalRestated: "edited-by-user",
      unknowns: ["budget-range"],
    };

    const res = await PATCH(
      patchRequest(q.id, { extracted: edited }, alice.cookie),
      { params: { id: q.id } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.extracted.goalRestated).toBe("edited-by-user");
    expect(body.userEdited).toBe(true);

    const stored = await prisma.extractedQuery.findUnique({ where: { queryId: q.id } });
    expect(stored?.userEdited).toBe(true);
    expect((stored?.extracted as { goalRestated: string }).goalRestated).toBe("edited-by-user");
  });

  it("returns 404 when the query belongs to a different user (no leak)", async () => {
    const alice = await authedUser("alice@example.com");
    const bob = await authedUser("bob@example.com");
    const q = await createQuery({ userId: alice.userId, mode: "company", payload: { goal: "alice-secret" } });
    await upsertExtracted({ queryId: q.id, extracted: seedExtracted(), userEdited: false });

    const res = await PATCH(
      patchRequest(q.id, { extracted: { ...seedExtracted(), goalRestated: "bob-edit" } }, bob.cookie),
      { params: { id: q.id } },
    );
    expect(res.status).toBe(404);

    const stored = await prisma.extractedQuery.findUnique({ where: { queryId: q.id } });
    expect((stored?.extracted as { goalRestated: string }).goalRestated).toBe("v1");
  });

  it("rejects malformed extracted bodies with 400", async () => {
    const alice = await authedUser("alice@example.com");
    const q = await createQuery({ userId: alice.userId, mode: "company", payload: { goal: "g" } });
    await upsertExtracted({ queryId: q.id, extracted: seedExtracted(), userEdited: false });

    const res = await PATCH(
      patchRequest(q.id, { extracted: { mode: "company" } }, alice.cookie),
      { params: { id: q.id } },
    );
    expect(res.status).toBe(400);
  });
});
