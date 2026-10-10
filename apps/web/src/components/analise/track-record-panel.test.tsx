import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToString } from "react-dom/server";
import { LocaleProvider } from "@/i18n/provider";
import { DEFAULT_VARIANT, generateDataset } from "@/lib/ml/synthetic";
import type { Athlete } from "@/lib/types";
import { TrackRecordPanel } from "./track-record-panel";

const dataset = generateDataset("tipico", 9, DEFAULT_VARIANT);
const athletes: Athlete[] = dataset.athletes.map((athlete) => ({
  id: athlete.id,
  name: athlete.name,
  isPlaceholder: true,
  teamId: "syn-team",
  primaryStroke: athlete.primaryStroke,
  dateOfBirth: athlete.dateOfBirth,
  gender: athlete.gender,
  groupName: athlete.group,
  wellness: athlete.wellness,
}));

// The locale provider refreshes the router on a language change; a stub is enough to render.
const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} } as never;

const render = (locale: "pt" | "en", athleteId: string) =>
  renderToString(
    <AppRouterContext.Provider value={router}>
      <LocaleProvider initialLocale={locale}>
        <TrackRecordPanel athleteId={athleteId} athletes={athletes} workouts={dataset.workouts} timeLogs={dataset.timeLogs} canReadLedger={false} />
      </LocaleProvider>
    </AppRouterContext.Provider>,
  );

describe("track record panel", () => {
  it("shows a reconstructed track record, the learning status and recent misses", () => {
    const html = render("pt", athletes[0].id);
    assert.match(html, /Histórico de acerto/);
    assert.match(html, /Reconstruído/);
    assert.match(html, /Reps comparadas/);
    assert.match(html, /Dentro do intervalo/);
    assert.match(html, /tempos deste atleta/);
  });

  it("speaks English too", () => {
    const html = render("en", athletes[1].id);
    assert.match(html, /Prediction track record/);
    assert.match(html, /Reconstructed/);
  });

  it("says so honestly when there is nothing to compare yet", () => {
    const html = render("pt", "nobody");
    assert.match(html, /Ainda não há tempos suficientes/);
  });
});
