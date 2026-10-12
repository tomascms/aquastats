"use client";

import { useSay } from "@/components/analise/coach-text";
import { useT } from "@/i18n/provider";
import type { Point } from "@/lib/session-report";

/** "Correu bem" / "A melhorar": each point with what coincided and the next step (docs/natacao/benchmark-visualizacao.md D1). */
export function ReportPoints({ points }: { points: Point[] }) {
  const t = useT();
  const say = useSay();
  if (!points.length) return null;
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {(["good", "improve"] as const).map((tone) => {
        const list = points.filter((p) => p.tone === tone);
        if (!list.length) return null;
        return (
          <div key={tone}>
            <h4 className={`text-sm font-semibold ${tone === "good" ? "text-good" : "text-slower"}`}>
              <span aria-hidden>{tone === "good" ? "✓ " : "→ "}</span>
              {tone === "good" ? t("Correu bem") : t("A melhorar")}
            </h4>
            <ul className="mt-1 space-y-2 text-sm">
              {list.map((p, i) => (
                <li key={i}>
                  <span className="text-mist">{say(p.what)}</span>
                  {p.why?.length ? (
                    <span className="block text-mute">
                      {t("Coincide com:")} {p.why.map(say).join("; ")}.
                    </span>
                  ) : null}
                  {p.next ? <span className="block text-mute">{say(p.next)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
