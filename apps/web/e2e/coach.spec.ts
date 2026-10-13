import { expect, test } from "@playwright/test";
import { COACH, cspViolations, signIn } from "./helpers";

test("pages carry a nonce-based CSP", async ({ request }) => {
  const response = await request.get("/entrar");
  expect(response.headers()["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
});

test("coach: swimmer summary, race analysis and training report", async ({ page }) => {
  const csp = cspViolations(page);
  await signIn(page, COACH);
  await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();

  // First swimmers in the list whose last race can be opened (a few young ones have none).
  await page.goto("/coach/team");
  const swimmers = page.getByRole("link", { name: /Sintético/ });
  await expect(swimmers.first()).toBeVisible();
  let opened = false;
  for (let i = 0; i < 6 && !opened; i++) {
    await page.goto("/coach/team");
    await swimmers.nth(i).click();
    await expect(page.getByRole("heading", { name: /Como está/ })).toBeVisible();
    const race = page.getByRole("link", { name: /Ver análise da prova/ });
    // Races come with the older history: wait for the link or the "no races" note.
    await expect(race.or(page.getByText("Ainda sem provas registadas."))).toBeVisible();
    if (await race.count()) {
      await race.click();
      await expect(page.getByRole("heading", { name: "Porque correu assim?" })).toBeVisible();
      opened = true;
    }
  }
  expect(opened).toBe(true);

  await page.goto("/coach/provas/treino");
  await expect(page.getByRole("heading", { name: "Como correu o treino?" })).toBeVisible();
  expect(csp).toEqual([]);
});

test("coach: times a rep in the timing grid", async ({ page }) => {
  const csp = cspViolations(page);
  await signIn(page, COACH);
  // The latest session with swimmers, whatever the generated data looks like.
  const snapshot = (await (await page.request.get("/api/v1/snapshot")).json()) as { workouts: { id: string; date: string; athleteIds: string[] }[] };
  const latest = snapshot.workouts.filter((w) => w.athleteIds.length).sort((a, b) => b.date.localeCompare(a.date))[0];
  await page.goto(`/coach/workouts/${latest.id}`);
  await page.getByRole("link", { name: "Registar tempos" }).click();

  const keys = page.getByRole("group", { name: "Teclas numéricas" });
  await expect(keys).toBeVisible();
  // Clear the selected cell, then type 1'23"45.
  const erase = page.getByRole("button", { name: "Apagar dígito" });
  for (let i = 0; i < 6; i++) await erase.click();
  for (const digit of "012345") await keys.getByRole("button", { name: `Dígito ${digit}`, exact: true }).click();
  await expect(page.getByLabel("Tempo 01 minutos 23 segundos 45 centésimos")).toBeVisible();
  await expect(page.getByText("01'23\"45").first()).toBeVisible();
  expect(csp).toEqual([]);
});
