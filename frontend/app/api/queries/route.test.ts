import { describe, expect, it } from "vitest";

import { POST } from "./route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/queries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/queries (bootstrap stub)", () => {
  it("echoes mode + goal back to the caller", async () => {
    const res = await POST(
      postRequest({ mode: "company", goal: "find the procurement owner at Acme" }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.echo).toEqual({
      mode: "company",
      goal: "find the procurement owner at Acme",
    });
  });

  it("returns a stub Report with the six MVP sections", async () => {
    const res = await POST(postRequest({ mode: "city", goal: "meet AI partners in Singapore" }));

    const body = await res.json();
    const report = body.report;

    expect(report).toBeDefined();
    expect(report.sections).toBeDefined();

    // PRD §9: MVP report contains exactly §1, §3, §5, §6, §7, §9.
    expect(Object.keys(report.sections).sort()).toEqual(
      ["s1_goal_summary", "s3_key_entities", "s5_opportunity_items", "s6_evidence", "s7_credibility", "s9_next_actions"].sort(),
    );

    // Stub content is shaped enough to verify the contract without LLM calls.
    expect(report.sections.s1_goal_summary.mode).toBe("city");
    expect(report.sections.s1_goal_summary.goal_restated).toContain("Singapore");
    expect(Array.isArray(report.sections.s3_key_entities)).toBe(true);
    expect(Array.isArray(report.sections.s5_opportunity_items)).toBe(true);
    expect(Array.isArray(report.sections.s9_next_actions)).toBe(true);
  });

  it("rejects requests missing mode or goal with 400", async () => {
    const res = await POST(postRequest({ goal: "no mode here" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
