"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useT, useTDynamic } from "@/i18n/provider";
import { DateField } from "@/components/ui/date-field";
import { formatApiError, type ApiError } from "@/lib/api";
import { COURSE_LABEL, formatDateRange } from "@/lib/labels";
import { actions, type MeetFileOptions, type MeetFileSummary } from "@/lib/store";
import { toast } from "@/lib/toast";

type Pending = { name: string; data: string; summary: MeetFileSummary; mapping: Record<string, string>; clubKey?: string };
type Queued = { name: string; data: string };

const SUPPORTED = /\.(lxf|lef|xml|pdf)$/i;

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * One place to drop what the organiser published (from SwimRankings or the federation).
 * Aquastats reads it and fills the existing competition screens; the coach confirms once.
 */
export function MeetFilesDrop({ compact = false, competitionId }: { compact?: boolean; competitionId?: string }) {
  const t = useT();
  const td = useTDynamic();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [queue, setQueue] = useState<Queued[]>([]);

  async function preview(name: string, data: string, clubKey?: string, mapping: Record<string, string> = {}) {
    const summary = await actions.processMeetFile({ name, data }, { dryRun: true, clubKey, mapping, competitionId });
    setPending({ name, data, summary, mapping, clubKey: clubKey ?? summary.club?.key });
  }

  async function handle(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    setBusy(true);
    setNotes([]);
    const later: string[] = [];
    try {
      const readable: Queued[] = [];
      for (const file of list) {
        if (SUPPORTED.test(file.name)) readable.push({ name: file.name, data: await readBase64(file) });
        else later.push(t("{file}: formato não suportado. Usa o Lenex (.lxf) ou os PDFs da competição.", { file: file.name }));
      }
      // The first file is shown for confirmation; the rest follow with the same club once confirmed.
      if (readable.length) {
        await preview(readable[0].name, readable[0].data);
        setQueue(readable.slice(1));
      }
    } catch (error) {
      toast.error(formatApiError(error as ApiError) || t("Não foi possível ler o ficheiro."));
    } finally {
      setNotes(later);
      setBusy(false);
    }
  }

  async function confirm(options: Partial<MeetFileOptions> = {}) {
    if (!pending) return;
    setBusy(true);
    try {
      const done = await actions.processMeetFile(
        { name: pending.name, data: pending.data },
        { clubKey: pending.clubKey, mapping: pending.mapping, competitionId, ...options },
      );
      setPending(null);
      let extra = 0;
      for (const file of queue) {
        try {
          await actions.processMeetFile(file, { clubKey: pending.clubKey, mapping: pending.mapping, competitionId: done.competitionId ?? competitionId });
          extra += 1;
        } catch (error) {
          toast.error(`${file.name}: ${formatApiError(error as ApiError)}`);
        }
      }
      setQueue([]);
      toast.success(
        done.kind === "rules" ? t("Regulamento guardado.") : done.kind === "results" ? t("Resultados importados.") : t("Inscrições importadas."),
        extra
          ? t("{count} ficheiros importados.", { count: extra + 1 })
          : done.kind === "rules"
            ? undefined
            : t("{title}: {count} atletas atualizados.", { title: done.competitionTitle ?? done.meet?.name ?? "", count: done.athletes?.length ?? 0 }),
      );
      if (done.competitionId && !competitionId) router.push(`/coach/competicoes/${done.competitionId}`);
    } catch (error) {
      toast.error(formatApiError(error as ApiError) || t("Não foi possível importar."));
    } finally {
      setBusy(false);
    }
  }

  const summary = pending?.summary;

  return (
    <section className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handle(event.dataTransfer.files);
        }}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed px-4 ${compact ? "py-3" : "py-5"} transition-colors ${
          dragging ? "border-pool bg-pool-soft" : "border-line-strong bg-panel"
        }`}
      >
        <div className="min-w-0">
          <p className="font-semibold text-mist">{competitionId ? t("Start list e resultados") : t("Nova competição")}</p>
          <p className="text-sm text-mute">
            {competitionId
              ? t("Quando sair, larga aqui a start list (PDF) do SwimRankings: entram as provas, séries, pistas e tempos de inscrição. Resultados em PDF ou Lenex também entram aqui.")
              : t("Larga o regulamento (PDF) tirado do SwimRankings. A competição fica criada com o nome, as datas e o local; a start list juntas depois, dentro da competição.")}
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn-primary shrink-0">
          {busy ? t("A ler…") : competitionId ? t("Escolher ficheiros") : t("Escolher regulamento")}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".lxf,.lef,.xml,.pdf"
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void handle(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {notes.map((note) => (
        <p key={note} className="rounded-lg bg-panel-2 px-3 py-2 text-sm text-mute">
          {note}
        </p>
      ))}

      {summary?.kind === "rules" ? (
        <RulesPreview
          summary={summary}
          name={pending?.name ?? ""}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={(extra) => void confirm(extra)}
        />
      ) : summary ? (
        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          <header className="border-b border-line bg-panel-2 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-mute">
              {summary.kind === "results" ? t("Resultados oficiais") : t("Inscrições")} · {pending?.name}
            </p>
            <p className="mt-0.5 font-display text-2xl font-bold">{summary.meet.name}</p>
            <p className="text-sm text-mute">
              {[summary.meet.city, formatDateRange(summary.meet.date, summary.meet.endDate), summary.meet.course ? COURSE_LABEL[summary.meet.course] : ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>

          {summary.status === "needsClub" ? (
            <div className="space-y-2 px-4 py-4">
              <p className="text-sm text-mist">{t("Não consegui perceber qual é o teu clube neste ficheiro. Qual é?")}</p>
              <select
                className="field"
                defaultValue=""
                onChange={(event) => event.target.value && pending && void preview(pending.name, pending.data, event.target.value)}
              >
                <option value="">{t("Escolher clube…")}</option>
                {summary.clubs?.map((club) => (
                  <option key={club.key} value={club.key}>
                    {club.name}
                    {club.code ? ` (${club.code})` : ""} · {t("{count} atletas", { count: club.athletes })}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-4 px-4 py-4">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={t("Clube")} value={summary.club?.name ?? "—"} />
                <Stat
                  label={t("Competição")}
                  value={summary.createsCompetition ? t("Nova") : td(summary.competitionTitle ?? "")}
                />
                <Stat label={t("Atletas")} value={String(summary.athletes?.length ?? 0)} />
                <Stat
                  label={summary.kind === "results" ? t("Resultados") : t("Inscrições")}
                  value={String(summary.kind === "results" ? summary.results : summary.entries)}
                />
              </dl>

              {summary.athletes?.length ? (
                <p className="text-sm text-mute">
                  {summary.athletes.map((item) => `${item.name} (${item.events})`).join(" · ")}
                </p>
              ) : null}

              {summary.unmatched?.length ? (
                <div className="rounded-lg border border-line">
                  <p className="border-b border-line bg-panel-2 px-3 py-2 text-xs font-semibold text-mute">
                    {t("Nadadores do clube que não reconheci — liga-os a um atleta da equipa ou ignora.")}
                  </p>
                  <ul className="divide-y divide-line">
                    {summary.unmatched.map((person) => (
                      <li key={person.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span>
                          {person.name}
                          {person.birthDate ? <span className="text-mute"> · {person.birthDate.slice(0, 4)}</span> : null}
                        </span>
                        <select
                          className="field h-9 w-auto py-1 text-sm"
                          value={pending?.mapping[person.key] ?? ""}
                          onChange={(event) =>
                            setPending((current) =>
                              current ? { ...current, mapping: { ...current.mapping, [person.key]: event.target.value } } : current,
                            )
                          }
                        >
                          <option value="">{t("Ignorar")}</option>
                          {summary.teamAthletes?.map((athlete) => (
                            <option key={athlete.id} value={athlete.id}>
                              {athlete.name}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setPending(null)} disabled={busy}>
                  {t("Cancelar")}
                </button>
                <button type="button" className="btn-primary" onClick={() => void confirm()} disabled={busy}>
                  {busy ? t("A importar…") : t("Importar")}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function RulesPreview({
  summary,
  name,
  busy,
  onCancel,
  onConfirm,
}: {
  summary: MeetFileSummary;
  name: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (extra: Partial<MeetFileOptions>) => void;
}) {
  const t = useT();
  const td = useTDynamic();
  const creates = Boolean(summary.createsCompetition);
  const [title, setTitle] = useState(summary.meet?.name ?? "");
  // Pre-filled when the regulations say the pool length; otherwise the coach picks it.
  const detected = summary.meet?.course;
  const [course, setCourse] = useState<"scm" | "lcm" | "">(detected === "scm" || detected === "lcm" ? detected : "");
  const [start, setStart] = useState(summary.meet?.date ?? "");
  const [end, setEnd] = useState(summary.meet?.endDate ?? "");
  const ready = !creates || (title.trim() && course && start);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="border-b border-line bg-panel-2 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-mute">
          {t("Regulamento")} · {name}
        </p>
        {creates ? <p className="mt-0.5 text-sm text-mist">{t("Confirma os dados e a competição fica criada. A start list juntas quando sair.")}</p> : null}
      </header>
      {creates ? (
        <div className="grid gap-3 border-b border-line px-4 py-3 sm:grid-cols-4">
          <label className="text-xs font-semibold text-mute sm:col-span-4">
            {t("Nome da competição")}
            <input className="field mt-1" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
          </label>
          <div className="text-xs font-semibold text-mute">
            {t("Piscina")}
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-line p-0.5">
              {(["scm", "lcm"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCourse(item)}
                  className={`rounded-md py-1.5 text-sm font-semibold ${course === item ? "bg-mist text-white" : "text-mute"}`}
                >
                  {COURSE_LABEL[item]}
                </button>
              ))}
            </div>
          </div>
          <label className="text-xs font-semibold text-mute">
            {t("De")}
            <DateField value={start} onChange={setStart} className="mt-1" />
          </label>
          <label className="text-xs font-semibold text-mute">
            {t("Até")}
            <DateField value={end} min={start} onChange={setEnd} className="mt-1" />
          </label>
        </div>
      ) : null}
      <table className="w-full text-sm">
        <tbody>
          {summary.facts?.map((fact) => (
            <tr key={fact.label} className="border-b border-line last:border-0">
              <th className="w-44 bg-panel-2/60 px-4 py-2 text-left align-top text-xs font-semibold text-mute">{td(fact.label)}</th>
              <td className="px-4 py-2 text-mist">{fact.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          {t("Cancelar")}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !ready}
          onClick={() => onConfirm(creates ? { title: title.trim(), course: course || undefined, date: start, endDate: end || start } : {})}
        >
          {creates ? t("Criar competição") : t("Guardar na competição")}
        </button>
      </div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-mute">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-mist" title={value}>
        {value}
      </dd>
    </div>
  );
}
