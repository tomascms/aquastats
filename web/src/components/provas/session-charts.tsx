"use client";

import { analyzeRace } from "@/lib/race";
import type { RaceSession } from "@/lib/types";
import { RaceChart } from "./charts";

const AQUA = "#3dffe8";
const SAND = "#f5c542";
const CORAL = "#ff6b6b";
const MIST = "#d7ece8";
const TEAL = "#14b8a6";
const RED = "#c23b4a";

export function SessionCharts({ session }: { session: RaceSession }) {
  const view = analyzeRace(session);
  const labels = view.laps.map((lap) => `V${lap.n}`);
  const short = session.course === "scm";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <RaceChart
        title="Tempo de volta"
        unit="segundos · tendência a subir = fadiga"
        labels={labels}
        series={[{ id: "lap", label: "T. volta", color: AQUA, values: view.laps.map((lap) => lap.lapTime) }]}
      />
      <RaceChart
        title="SR vs Velocidade"
        unit="SR cyc/min  ·  V m/s"
        unitRight="m/s"
        labels={labels}
        series={[
          { id: "sr", label: "SR", color: CORAL, values: view.laps.map((lap) => lap.srAvg) },
          { id: "v", label: "Velocidade", color: "#5aa7ff", values: view.laps.map((lap) => lap.velocity), dashed: true, axis: "right" },
        ]}
      />
      <RaceChart
        title="SR por volta"
        unit="cyc/min"
        kind="bar"
        labels={labels}
        series={[{ id: "srb", label: "SR", color: SAND, values: view.laps.map((lap) => lap.srAvg) }]}
      />
      <RaceChart
        title="Braçadas por volta (SC)"
        unit="ciclos"
        kind="bar"
        labels={labels}
        series={[{ id: "sc", label: "SC", color: TEAL, values: view.laps.map((lap) => lap.sc) }]}
      />
      <RaceChart
        title="Velocidade por sector"
        unit="m/s"
        labels={labels}
        series={
          short
            ? [
                { id: "v15", label: "15 m", color: AQUA, values: view.laps.map((lap) => lap.v15) },
                { id: "v10", label: "10 m", color: SAND, values: view.laps.map((lap) => lap.v10) },
              ]
            : [
                { id: "v25", label: "0–25 m", color: AQUA, values: view.laps.map((lap) => lap.v25) },
                { id: "v50", label: "25–50 m", color: SAND, values: view.laps.map((lap) => lap.v50) },
              ]
        }
      />
      <RaceChart
        title="Tempo de nado por volta"
        unit="superfície, sem submerso"
        labels={labels}
        series={[{ id: "swim", label: "T. nado", color: MIST, values: view.laps.map((lap) => lap.swimTime) }]}
      />
      <RaceChart
        title="DPS"
        unit="m/ciclo · mais alto = mais eficiente"
        labels={labels}
        series={[{ id: "dps", label: "DPS", color: "#5aa7ff", values: view.laps.map((lap) => lap.dps) }]}
      />
      <RaceChart
        title="Decomposição: submerso + nado"
        unit="segundos"
        kind="stack"
        labels={labels}
        stacks={[
          { key: "Submerso", color: RED, values: view.laps.map((lap) => lap.uw) },
          { key: "Nado", color: "#e07a7a", values: view.laps.map((lap) => lap.swimTime) },
        ]}
      />
      <div className="lg:col-span-2">
        <RaceChart
          title="Volta com sectores"
          unit="sectores + submerso, linha = tempo total"
          kind="stack"
          labels={labels}
          stacks={
            short
              ? [
                  { key: "Submerso", color: RED, values: view.laps.map((lap) => lap.uw) },
                  { key: "15 m", color: "#3dffe8", values: view.laps.map((lap) => lap.sec15) },
                  { key: "10 m", color: "#f5c542", values: view.laps.map((lap) => lap.sec10) },
                ]
              : [
                  { key: "Submerso", color: RED, values: view.laps.map((lap) => lap.uw) },
                  { key: "1º 25 m", color: "#3dffe8", values: view.laps.map((lap) => lap.sec25) },
                  { key: "2º 25 m", color: "#f5c542", values: view.laps.map((lap) => lap.sec50) },
                ]
          }
          overlay={{ id: "total", label: "T. volta", color: MIST, values: view.laps.map((lap) => lap.lapTime), dashed: true }}
        />
      </div>
    </div>
  );
}

export function CompareCharts({ a, b, nameA, nameB }: { a: RaceSession; b: RaceSession; nameA: string; nameB: string }) {
  const left = analyzeRace(a);
  const right = analyzeRace(b);
  const n = Math.max(left.laps.length, right.laps.length);
  const labels = Array.from({ length: n }, (_, index) => `V${index + 1}`);
  const pad = (values: number[]) => labels.map((_, index) => values[index] ?? 0);
  const charts = [
    { title: "Tempo de volta", unit: "s", get: (view: typeof left) => view.laps.map((lap) => lap.lapTime) },
    { title: "SR por volta", unit: "cyc/min", get: (view: typeof left) => view.laps.map((lap) => lap.srAvg) },
    { title: "Velocidade por volta", unit: "m/s", get: (view: typeof left) => view.laps.map((lap) => lap.velocity) },
    { title: "Braçadas (SC)", unit: "ciclos", get: (view: typeof left) => view.laps.map((lap) => lap.sc) },
    { title: "Tempo de nado", unit: "s", get: (view: typeof left) => view.laps.map((lap) => lap.swimTime) },
    { title: "DPS por volta", unit: "m/ciclo", get: (view: typeof left) => view.laps.map((lap) => lap.dps) },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {charts.map((chart) => (
        <RaceChart
          key={chart.title}
          title={chart.title}
          unit={chart.unit}
          labels={labels}
          series={[
            { id: "a", label: nameA, color: CORAL, values: pad(chart.get(left)) },
            { id: "b", label: nameB, color: "#5aa7ff", values: pad(chart.get(right)), dashed: true },
          ]}
        />
      ))}
    </div>
  );
}
