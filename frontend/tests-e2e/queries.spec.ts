import { expect, test } from "@playwright/test";

import { SESSION_COOKIE } from "@/lib/auth/middleware";
import { createSession } from "@/lib/auth/sessions";
import { prisma } from "@/lib/db";

test("home form submission returns the stub Report with goal echoed", async ({ context, page }) => {
  // Seed an authenticated user + session via the DB. The smoke test exercises
  // the form + API + stub Report path; the auth flow itself is covered by
  // vitest in app/api/auth/**.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "queries", "sessions", "magic_link_tokens", "users" RESTART IDENTITY CASCADE`,
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

  await page.goto("/");

  await page.getByTestId("mode-select").selectOption("company");
  await page.getByTestId("goal-input").fill("find the procurement owner at Acme");
  await page.getByTestId("submit-button").click();

  const json = await page.getByTestId("result-json").textContent();
  expect(json).toContain("find the procurement owner at Acme");
  expect(json).toContain("s1_goal_summary");
  expect(json).toContain("s5_opportunity_items");
  expect(json).toContain("s9_next_actions");
});
