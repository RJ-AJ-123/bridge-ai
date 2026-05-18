import { expect, test } from "@playwright/test";

test("home form submission returns the stub Report with goal echoed", async ({ page }) => {
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
