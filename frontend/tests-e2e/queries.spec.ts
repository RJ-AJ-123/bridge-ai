import { expect, test } from "@playwright/test";

import { SESSION_COOKIE } from "@/lib/auth/middleware";
import { createSession } from "@/lib/auth/sessions";
import { prisma } from "@/lib/db";

test("Company-mode intake → Extract preview → confirm → Enrichment placeholder", async ({
  context,
  page,
}) => {
  // The smoke test exercises form → POST /api/queries → Stage 1 (LocalFakeLlmClient,
  // default when ANTHROPIC_API_KEY is unset) → preview page → confirm.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "extracted_queries", "queries", "sessions", "magic_link_tokens", "users" RESTART IDENTITY CASCADE`,
  );
  const user = await prisma.user.create({
    data: { email: `e2e-${Date.now()}@example.com` },
  });
  const { token } = await createSession(user.id);

  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/queries/new");

  await page.getByTestId("target-name-input").fill("Acme Corp");
  await page.getByTestId("target-url-input").fill("https://acme.example");
  await page.getByTestId("goal-input").fill("find the procurement owner at Acme");
  await page.getByTestId("submit-button").click();

  await page.waitForURL(/\/queries\/[0-9a-f-]{36}\/extracted/);

  await expect(page.getByTestId("edit-target-name")).toHaveValue("Acme Corp");
  await expect(page.getByTestId("edit-goal")).toContainText("find the procurement owner at Acme");

  await page.getByTestId("confirm-button").click();
  await expect(page.getByTestId("enrichment-placeholder")).toBeVisible();
});
