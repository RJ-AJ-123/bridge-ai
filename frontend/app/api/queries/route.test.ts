import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { SESSION_COOKIE } from "@/lib/auth/middleware";
import { createSession } from "@/lib/auth/sessions";
import { prisma } from "@/lib/db";
import { EXTRACT_SCHEMA_NAME } from "@/lib/extract/extract";
import { StubLlmClient } from "@/lib/llm/stub-client";
import { resetAuthAndQueries } from "@/lib/test-utils/db";

import { createQueryAndExtract, POST } from "./route";

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

function companyExtractStub(): StubLlmClient {
  return new StubLlmClient({
    responses: [
      {
        schema: EXTRACT_SCHEMA_NAME,
        value: {
          target: { kind: "company", name: "Acme Corp", url: null },
          goal_restated: "Enter Acme to sell AI tooling.",
          parsed_known_relationships: [{ display_name: "Person C" }],
          signals: {},
          unknowns: ["budget-range"],
        },
      },
    ],
  });
}

describe("POST /api/queries (Company-mode intake + Stage 1 Extract)", () => {
  beforeEach(resetAuthAndQueries);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await POST(
      postRequest({ mode: "company", goal: "g", target: { name: "Acme" } }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects company-mode payloads without target.name with 400", async () => {
    const { cookie } = await authedUser("alice@example.com");
    const res = await createQueryAndExtract(
      postRequest({ mode: "company", goal: "g", target: {} }, cookie),
      companyExtractStub(),
    );
    expect(res.status).toBe(400);
  });

  it("rejects empty goal with 400", async () => {
    const { cookie } = await authedUser("alice@example.com");
    const res = await createQueryAndExtract(
      postRequest({ mode: "company", goal: "   ", target: { name: "Acme" } }, cookie),
      companyExtractStub(),
    );
    expect(res.status).toBe(400);
  });

  it("rejects city-mode payloads with 400 (deferred to slice #06)", async () => {
    const { cookie } = await authedUser("alice@example.com");
    const res = await createQueryAndExtract(
      postRequest({ mode: "city", goal: "g" }, cookie),
      companyExtractStub(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/city/i);
  });

  it("rejects unknown modes with 400", async () => {
    const { cookie } = await authedUser("alice@example.com");
    const res = await createQueryAndExtract(
      postRequest({ mode: "bogus", goal: "g" }, cookie),
      companyExtractStub(),
    );
    expect(res.status).toBe(400);
  });

  it("persists the Query, runs Stage 1, and returns the ExtractedQuery in state=extracted", async () => {
    const { userId, cookie } = await authedUser("alice@example.com");

    const res = await createQueryAndExtract(
      postRequest(
        {
          mode: "company",
          goal: "Enter Acme to sell AI tooling.",
          target: { name: "Acme Corp" },
          knownRelationships: ["Person C — former Acme engineer"],
        },
        cookie,
      ),
      companyExtractStub(),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.queryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.state).toBe("extracted");
    expect(body.extracted.target.name).toBe("Acme Corp");
    expect(body.extracted.goalRestated).toBe("Enter Acme to sell AI tooling.");

    const stored = await prisma.query.findUnique({ where: { id: body.queryId } });
    expect(stored?.userId).toBe(userId);
    expect(stored?.mode).toBe("company");
    expect(stored?.state).toBe("extracted");

    const extracted = await prisma.extractedQuery.findUnique({
      where: { queryId: body.queryId },
    });
    expect(extracted).not.toBeNull();
    expect(extracted?.userEdited).toBe(false);
    expect(extracted?.confirmedAt).toBeNull();
  });

  it("on Stage 1 LLM failure: persists the Query, sets state=failed, returns 502 with retryable=true", async () => {
    const { cookie } = await authedUser("alice@example.com");
    const failingLlm = new StubLlmClient({
      responses: [
        { schema: EXTRACT_SCHEMA_NAME, error: new Error("upstream 503") },
      ],
    });

    const res = await createQueryAndExtract(
      postRequest(
        { mode: "company", goal: "g", target: { name: "Acme" } },
        cookie,
      ),
      failingLlm,
    );

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.queryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.retryable).toBe(true);

    const stored = await prisma.query.findUnique({ where: { id: body.queryId } });
    expect(stored?.state).toBe("failed");
  });

  it("uses the default LlmClient (LocalFakeLlmClient) when POST is called directly without DI", async () => {
    const { cookie } = await authedUser("alice@example.com");
    const res = await POST(
      postRequest(
        {
          mode: "company",
          goal: "Find AI partners",
          target: { name: "Acme", url: "https://acme.example" },
        },
        cookie,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe("extracted");
    expect(body.extracted.target.name).toBe("Acme");
    expect(body.extracted.target.url).toBe("https://acme.example");
  });
});
