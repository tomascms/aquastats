import { expect, test, type Page } from "@playwright/test";
import { COACH, cspViolations, signIn } from "./helpers";

// Times explained (docs/natacao): the training chips, the week card on the profile and the race story.
type Snapshot = {
  workouts: { id: string; date: string }[];
  timeLogs: { workoutId: string }[];
  competitions: { id: string; date: string }[];
  meetEntries: { id: string; competitionId: string }[];
  meetResults: { entryId: string }[];
};

async function snapshot(page: Page) {
  return (await (await page.request.get("/api/v1/snapshot")).json()) as Snapshot;
}

test("coach: training chips open the box by keyboard and by touch", async ({ page }) => {
  const csp = cspViolations(page);
  await signIn(page, COACH);
  const data = await snapshot(page);
  const timed = new Set(data.timeLogs.map((log) => log.workoutId));
  const latest = data.workouts.filter((w) => timed.has(w.id)).sort((a, b) => b.date.localeCompare(a.date))[0];
  await page.goto(`/coach/workouts/${latest.id}`);

  // The page opens on the first swimmer present, who may have no times here: pick swimmers until one has chips.
  await expect(page.getByRole("heading", { name: "Como correu o treino?" })).toBeVisible();
  // The first set with two times or more (a warm-up can be a single rep).
  const group = page.getByRole("group", { name: "Tempos da série" }).filter({ has: page.locator("button:nth-of-type(2)") }).first();
  const none = page.getByText("Ainda sem tempos registados para este atleta neste treino.");
  const swimmers = page.getByRole("navigation", { name: "Escolher atleta" }).getByRole("button");
  for (let i = 0; ; i++) {
    await expect(group.or(none)).toBeVisible();
    if (await group.count()) break;
    await swimmers.nth(i).click();
  }
  const chips = group.getByRole("button");
  await expect(chips.nth(1)).toBeVisible();
  const box = page.locator(`[id="${await chips.first().getAttribute("aria-controls")}"]`);

  // Keyboard: focus moves to the next chip and the box follows it.
  await chips.first().focus();
  await page.keyboard.press("Tab");
  await expect(chips.nth(1)).toBeFocused();
  await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(box).toContainText((await chips.nth(1).textContent())!);

  // Touch: a tap opens the box for that chip (and a tap must not close it again).
  await chips.first().tap();
  await expect(chips.first()).toHaveAttribute("aria-pressed", "true");
  await expect(box).toContainText((await chips.first().textContent())!);
  expect(csp).toEqual([]);
});

test("coach: the profile shows the week card", async ({ page }) => {
  const csp = cspViolations(page);
  await signIn(page, COACH);
  await page.goto("/coach/team");
  const swimmers = page.getByRole("link", { name: /Sintético/ });
  await expect(swimmers.first()).toBeVisible();
  let shown = false;
  // A few young swimmers have too few times; the first with a week card is enough.
  for (let i = 0; i < 6 && !shown; i++) {
    await page.goto("/coach/team");
    await swimmers.nth(i).click();
    const section = page.getByRole("region", { name: "Tempos explicados" });
    const week = section.locator("#semana");
    await expect(week.or(section.getByText("Ainda sem tempos suficientes para comparar com o costume."))).toBeVisible();
    if (await week.count()) {
      await expect(week).toContainText("Semana de");
      await expect(week.getByRole("heading", { level: 3 })).toBeVisible();
      shown = true;
    }
  }
  expect(shown).toBe(true);
  expect(csp).toEqual([]);
});

test("coach: the meet page says what the race says about training", async ({ page }) => {
  const csp = cspViolations(page);
  await signIn(page, COACH);
  const data = await snapshot(page);
  const swum = new Set(data.meetResults.map((result) => result.entryId));
  const meets = new Set(data.meetEntries.filter((entry) => swum.has(entry.id)).map((entry) => entry.competitionId));
  const meet = data.competitions.filter((item) => meets.has(item.id)).sort((a, b) => b.date.localeCompare(a.date))[0];
  await page.goto(`/coach/competicoes/${meet.id}`);

  const stories = page.getByText("O que a prova diz do treino").first();
  await expect(stories).toBeVisible();
  // Nothing may widen the page past the phone (it zooms out and taps land elsewhere).
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  // Each race is a closed <details>; opening the first shows its story.
  await stories.locator("..").locator("summary").first().click();
  await expect(page.getByRole("heading", { name: "Como chegou à prova" }).first()).toBeVisible();
  expect(csp).toEqual([]);
});
