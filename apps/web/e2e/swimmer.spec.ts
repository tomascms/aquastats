import { expect, test } from "@playwright/test";
import { SWIMMER, cspViolations, signIn } from "./helpers";

test("swimmer: sees their last session written for them", async ({ page }) => {
  const csp = cspViolations(page);
  await signIn(page, SWIMMER);
  await expect(page).toHaveURL(/\/swimmer/);
  await expect(page.getByText("O teu último treino")).toBeVisible();
  expect(csp).toEqual([]);
});
