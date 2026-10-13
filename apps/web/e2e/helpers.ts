import { expect, type Page } from "@playwright/test";

// Local demo accounts from apps/api/scripts/seed_synthetic.py (synthetic data, local databases only).
export const COACH = "treinador@demo.aquastats.test";
export const SWIMMER = "atleta@demo.aquastats.test";
const PASSWORD = process.env.E2E_PASSWORD || "sintetico-demo-2026";

export async function signIn(page: Page, email: string) {
  await page.goto("/entrar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/(coach|swimmer)/);
}

/** Collects Content-Security-Policy violations: a flow that trips the CSP is a broken flow. */
export function cspViolations(page: Page): string[] {
  const seen: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) seen.push(message.text());
  });
  return seen;
}
