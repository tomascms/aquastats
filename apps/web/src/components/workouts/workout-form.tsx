"use client";

import { useState } from "react";
import { IconChevron } from "@/components/ui/icons";
import { DateField } from "@/components/ui/date-field";
import { DISTANCES, formatDistance } from "@/lib/distances";
import { BLOCK_LABEL, COURSE_LABEL, SHIFT_LABEL, treinoTitle } from "@/lib/labels";
import { formatMeters } from "@/lib/rankings";
import { DEFAULT_SEND_OFF, SEND_OFF_OPTIONS, formatSendOff } from "@/lib/send-off";
import {
  GEARS,
  GEAR_LABEL,
  INTENSITIES,
  INTENSITY_LABEL,
  WORKOUT_STROKES,
  WORKOUT_STROKE_LABEL,
  applySegmentDefaults,
  betweenRoundsCount,
  emptyBlock,
  emptyPart,
  emptySegment,
  formatParts,
  isReadySegment,
  normalizeDraft,
  orderDraftBlocks,
  persistDraft,
  resizeSegment,
  roundGearFor,
  setSegmentParts,
  toggleGear,
  toggleRepGear,
  toggleRoundGear,
  updateRepDetail,
} from "@/lib/set";
import { writtenBlockLines } from "@/lib/workout-text";
import { GROUPS, GROUP_LABEL, type TrainingGroup } from "@/lib/groups";
import type { BlockType, DraftBlock, Gear, Intensity, PoolCourse, SegmentPart, SetSegment, Shift, WorkoutInput } from "@/lib/types";
import { useT } from "@/i18n/provider";

const SHIFTS: Shift[] = ["morning", "afternoon"];
const SECTIONS: BlockType[] = ["warmup", "main", "recovery"];

function blockMeters(block: DraftBlock): number {
  const rounds = Math.max(1, block.rounds || 1);
  const perRound = block.segments.filter(isReadySegment).reduce((sum, segment) => sum + segment.reps * segment.distanceM, 0);
  const between = betweenRoundsCount(rounds, block.betweenRounds) * (block.betweenRounds?.distanceM || 0);
  return perRound * rounds + between;
}

/**
 * Writing a session the way a coach writes it on paper: three sections (warm-up, main, swim-down),
 * each set on one line (reps × metres, pace, send-off). Everything else — gear, start from the block,
 * per-rep changes, easy swim between rounds — stays folded until it's needed. The written session
 * and total volume update beside it as you type.
 */
export function WorkoutForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<WorkoutInput>;
  submitLabel: string;
  onSubmit: (input: WorkoutInput) => void | Promise<void>;
}) {
  const t = useT();
  const startingDate = initial?.date ?? "";
  const [title, setTitle] = useState(initial?.title ?? (startingDate ? treinoTitle(startingDate) : t("Treino")));
  const [renaming, setRenaming] = useState(false);
  const [date, setDate] = useState(startingDate);
  const [shift, setShift] = useState<Shift>(initial?.shift ?? "afternoon");
  const [course, setCourse] = useState<PoolCourse | "">(initial?.course ?? "");
  const [groups, setGroups] = useState<TrainingGroup[]>((initial?.groups ?? []) as TrainingGroup[]);
  // Focus is no longer asked for; an existing value is kept untouched.
  const focus = initial?.focus ?? "";
  const [blocks, setBlocks] = useState<DraftBlock[]>(
    initial?.blocks?.length ? orderDraftBlocks(initial.blocks.map(normalizeDraft)) : [emptyBlock("warmup"), emptyBlock("main"), emptyBlock("recovery")],
  );
  const total = blocks.reduce((sum, block) => sum + blockMeters(block), 0);
  const ready = (course === "scm" || course === "lcm") && Boolean(date) && total > 0;

  function update(index: number, patch: Partial<DraftBlock> | ((current: DraftBlock) => DraftBlock)) {
    setBlocks((current) =>
      current.map((block, i) => {
        if (i !== index) return block;
        const next = typeof patch === "function" ? patch(block) : { ...block, ...patch };
        if (next.rounds === 1) next.betweenRounds = null;
        return next;
      }),
    );
  }

  return (
    <form
      className="grid gap-5 pb-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready || (course !== "scm" && course !== "lcm")) return;
        void onSubmit({
          title: title.trim() || treinoTitle(date),
          date,
          shift,
          course,
          groups,
          focus: focus.trim(),
          blocks: orderDraftBlocks(blocks.filter((block) => blockMeters(block) > 0).map(persistDraft)),
        });
      }}
    >
      <div className="min-w-0 space-y-4">
        {/* When, where, what for — one compact card. */}
        <section className="space-y-3 rounded-xl border border-line bg-panel p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-mute">
              {t("Data")}
              <DateField
                value={date}
                required
                onChange={(iso) => {
                  setDate(iso);
                  if (!renaming) setTitle(treinoTitle(iso));
                }}
                className="mt-1"
              />
            </label>
            <Segmented label={t("Turno")} options={SHIFTS.map((item) => ({ value: item, label: SHIFT_LABEL[item] }))} value={shift} onChange={setShift} />
            <Segmented
              label={t("Piscina")}
              options={(["scm", "lcm"] as const).map((item) => ({ value: item, label: COURSE_LABEL[item] }))}
              value={course}
              onChange={setCourse}
              missing={!course}
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-mute">
              {t("Grupo")} <span className="font-normal">{t("(opcional — sem grupo é para todos)")}</span>
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {GROUPS.map((item) => (
                <Chip
                  key={item}
                  active={groups.includes(item)}
                  onClick={() => setGroups((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]))}
                >
                  {GROUP_LABEL[item]}
                </Chip>
              ))}
            </div>
          </div>

          {renaming ? (
            <label className="block text-xs font-semibold text-mute">
              {t("Nome do treino")}
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="field mt-1 h-10 py-1" />
            </label>
          ) : (
            <p className="text-xs text-mute">
              {t("Nome")}: <span className="font-semibold text-mist">{title}</span>{" "}
              <button type="button" className="font-semibold text-pool hover:underline" onClick={() => setRenaming(true)}>
                {t("mudar")}
              </button>
            </p>
          )}
        </section>

        {SECTIONS.map((type) => {
          const indexes = blocks.map((block, index) => ({ block, index })).filter((item) => item.block.type === type);
          return (
            <section key={type} className="overflow-hidden rounded-xl border border-line bg-panel">
              <header className="flex items-center justify-between border-b border-line bg-panel-2 px-4 py-2">
                <h3 className="text-sm font-bold text-mist">{BLOCK_LABEL[type]}</h3>
                <span className="font-mono text-xs text-mute">
                  {formatMeters(indexes.reduce((sum, item) => sum + blockMeters(item.block), 0))}
                </span>
              </header>
              <div className="divide-y divide-line">
                {indexes.map(({ block, index }, position) => (
                  <BlockEditor
                    key={index}
                    block={block}
                    label={indexes.length > 1 ? t("Série {n}", { n: position + 1 }) : ""}
                    onChange={(patch) => update(index, patch)}
                    onRemove={() => setBlocks((current) => current.filter((_, i) => i !== index))}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setBlocks((current) => orderDraftBlocks([...current, emptyBlock(type)]))}
                className="w-full border-t border-line px-4 py-2 text-left text-sm font-semibold text-pool hover:bg-panel-2"
              >
                + {type === "main" ? t("Outra série") : t("Adicionar")}
              </button>
            </section>
          );
        })}
      </div>

      {/* The session as it will read on the sheet, always visible. */}
      <aside className="space-y-3 lg:sticky lg:top-6">
        <section className="rounded-xl border border-line bg-panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-mute">{t("Treino escrito")}</p>
          <p className="mt-1 font-display text-3xl font-bold tabular text-mist">{formatMeters(total)}</p>
          <div className="mt-3 space-y-2 font-mono text-[12px] leading-5 text-mist">
            {SECTIONS.map((type) => {
              const lines = blocks.filter((block) => block.type === type && blockMeters(block) > 0).flatMap((block) => writtenBlockLines(block));
              if (!lines.length) return null;
              return (
                <div key={type}>
                  <p className="font-sans text-[11px] font-semibold text-mute">{BLOCK_LABEL[type]}</p>
                  {lines.map((line, index) => (
                    <p key={index} style={{ paddingLeft: line.indent * 12 }}>
                      {line.text}
                    </p>
                  ))}
                </div>
              );
            })}
            {total === 0 ? <p className="font-sans text-xs text-mute">{t("Escreve a primeira série para ver o treino aqui.")}</p> : null}
          </div>
        </section>
        <button type="submit" disabled={!ready} className="btn-primary h-12 w-full disabled:opacity-40">
          {submitLabel}
        </button>
        {!course ? <p className="text-center text-xs text-coral">{t("Escolhe a piscina (25 m ou 50 m).")}</p> : null}
      </aside>
    </form>
  );
}

function BlockEditor({
  block,
  label,
  onChange,
  onRemove,
}: {
  block: DraftBlock;
  label: string;
  onChange: (patch: Partial<DraftBlock> | ((current: DraftBlock) => DraftBlock)) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const main = block.type === "main";

  function updateSegment(segmentIndex: number, patch: Partial<SetSegment> | ((current: SetSegment) => SetSegment)) {
    onChange((current) => ({
      ...current,
      segments: current.segments.map((segment, index) => (index !== segmentIndex ? segment : typeof patch === "function" ? patch(segment) : { ...segment, ...patch })),
    }));
  }

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {label ? <span className="font-semibold text-mist">{label}</span> : null}
        <span className="flex items-center gap-1.5 text-mute">
          {t("Repetir")}
          <Stepper value={block.rounds} min={1} onChange={(rounds) => onChange({ rounds })} suffix="×" />
        </span>
        {!main ? (
          <label className="flex items-center gap-1.5 text-mute">
            <input type="checkbox" checked={block.noSendOff} onChange={(event) => onChange({ noSendOff: event.target.checked })} />
            {t("Sem saídas")}
          </label>
        ) : null}
        {block.rounds > 1 ? (
          <span className="flex flex-wrap items-center gap-1.5 text-mute">
            <Chip
              small
              active={Boolean(block.betweenRounds)}
              onClick={() => onChange({ betweenRounds: block.betweenRounds ? null : { distanceM: 100 } })}
            >
              {t("Suave entre repetições")}
            </Chip>
            {block.betweenRounds ? (
              <>
                <DistanceSelect
                  compact
                  value={block.betweenRounds.distanceM}
                  onChange={(distanceM) => onChange((current) => ({ ...current, betweenRounds: { ...current.betweenRounds!, distanceM } }))}
                />
                <Chip small active={!block.betweenRounds.afterEach} onClick={() => onChange((current) => ({ ...current, betweenRounds: { ...current.betweenRounds!, afterEach: false } }))}>
                  {t("entre séries")}
                </Chip>
                <Chip small active={Boolean(block.betweenRounds.afterEach)} onClick={() => onChange((current) => ({ ...current, betweenRounds: { ...current.betweenRounds!, afterEach: true } }))}>
                  {t("no fim de cada série")}
                </Chip>
              </>
            ) : null}
          </span>
        ) : null}
        <button type="button" onClick={onRemove} className="ml-auto text-mute hover:text-coral" aria-label={t("Remover")}>
          ✕
        </button>
      </div>

      <div className={block.rounds > 1 ? "border-l-2 border-pool/40 pl-3" : ""}>
        {block.segments.map((segment, segmentIndex) => (
          <SetLine
            key={segmentIndex}
            segment={segment}
            hideSendOff={block.noSendOff}
            showStart={main}
            rounds={block.rounds}
            canRemove={block.segments.length > 1}
            onChange={(patch) => updateSegment(segmentIndex, patch)}
            onRemove={() => onChange((current) => ({ ...current, segments: current.segments.filter((_, index) => index !== segmentIndex) }))}
          />
        ))}
        <button
          type="button"
          onClick={() => onChange((current) => ({ ...current, segments: [...current.segments, emptySegment()] }))}
          className="mt-1 text-xs font-semibold text-pool hover:underline"
        >
          + {t("juntar outra distância a esta série")}
        </button>
      </div>
    </div>
  );
}

/** One set on one line: reps × metres · pace · send-off. Gear, start and per-rep changes fold under "mais". */
function SetLine({
  segment,
  hideSendOff,
  showStart,
  rounds,
  canRemove,
  onChange,
  onRemove,
}: {
  segment: SetSegment;
  hideSendOff: boolean;
  showStart: boolean;
  rounds: number;
  canRemove: boolean;
  onChange: (patch: Partial<SetSegment> | ((current: SetSegment) => SetSegment)) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [more, setMore] = useState(false);
  const [perRep, setPerRep] = useState(false);
  const [byRound, setByRound] = useState(Boolean(segment.roundGear?.length));
  const ready = isReadySegment(segment);
  const split = Boolean(segment.parts?.length);
  const extras = [
    split ? t("dividido") : "",
    !split && segment.stroke && segment.stroke !== "free" ? WORKOUT_STROKE_LABEL[segment.stroke] : "",
    segment.gear.length ? segment.gear.map((item) => GEAR_LABEL[item]).join(", ") : "",
    showStart && segment.fromBlock ? t("bloco") : "",
    segment.roundGear?.length ? t("material por repetição") : "",
  ].filter(Boolean);

  return (
    <div className="py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Stepper value={segment.reps} min={1} onChange={(reps) => onChange((current) => resizeSegment(current, reps))} />
        <span className="text-mute">×</span>
        <DistanceSelect value={segment.distanceM} onChange={(distanceM) => onChange({ distanceM })} />
        {ready ? (
          <>
            {split ? (
              <span className="rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 font-mono text-xs font-semibold text-sand">{formatParts(segment.parts!)}</span>
            ) : (
              <IntensitySelect value={segment.intensity} onChange={(intensity) => onChange((current) => applySegmentDefaults(current, { intensity }))} />
            )}
            {!hideSendOff ? (
              <span className="flex items-center gap-1 text-xs text-mute">
                {t("a")}
                <SendOffSelect
                  value={segment.sendOffSeconds || DEFAULT_SEND_OFF}
                  onChange={(sendOffSeconds) => onChange((current) => applySegmentDefaults(current, { sendOffSeconds }))}
                />
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setMore((open) => !open)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${more ? "bg-aqua text-white" : "border border-line text-mute hover:text-mist"}`}
            >
              {extras.length ? extras.join(" · ") : t("mais")}
            </button>
          </>
        ) : (
          <span className="text-xs text-mute">{t("escolhe os metros")}</span>
        )}
        {canRemove ? (
          <button type="button" onClick={onRemove} className="ml-auto text-xs text-mute hover:text-coral" aria-label={t("Remover")}>
            ✕
          </button>
        ) : null}
      </div>

      {ready && more ? (
        <div className="mt-2 space-y-2 rounded-lg bg-panel-2 px-3 py-2.5">
          {!split ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-16 text-[11px] font-semibold text-mute">{t("Estilo")}</span>
              {WORKOUT_STROKES.map((item) => (
                <Chip
                  key={item}
                  small
                  active={item === "free" ? !segment.stroke || segment.stroke === "free" : segment.stroke === item}
                  onClick={() => onChange((current) => applySegmentDefaults(current, { stroke: item === "free" ? "" : item }))}
                >
                  {WORKOUT_STROKE_LABEL[item]}
                </Chip>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-16 text-[11px] font-semibold text-mute">{t("Material")}</span>
            {GEARS.map((item) => (
              <Chip key={item} small active={segment.gear.includes(item)} onClick={() => onChange((current) => toggleGear(current, item))}>
                {GEAR_LABEL[item]}
              </Chip>
            ))}
            {rounds > 1 && !split ? (
              <Chip
                small
                active={byRound}
                onClick={() => {
                  const next = !byRound;
                  setByRound(next);
                  if (!next) onChange((current) => ({ ...current, roundGear: undefined }));
                }}
              >
                {t("Por repetição")}
              </Chip>
            ) : null}
          </div>
          {rounds > 1 && !split && byRound
            ? Array.from({ length: rounds }, (_, index) => index + 1).map((round) => (
                <div key={round} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-16 text-[11px] font-semibold text-mute">{t("Repetição {n}", { n: round })}</span>
                  {GEARS.map((item) => (
                    <Chip
                      key={item}
                      small
                      active={roundGearFor(segment, round, segment.gear).includes(item)}
                      onClick={() => onChange((current) => toggleRoundGear(current, round, item))}
                    >
                      {GEAR_LABEL[item]}
                    </Chip>
                  ))}
                </div>
              ))
            : null}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-mute">
              <input
                type="checkbox"
                checked={split}
                onChange={(event) =>
                  onChange((current) =>
                    setSegmentParts(
                      current,
                      event.target.checked
                        ? [emptyPart(Math.floor(current.distanceM / 2) || current.distanceM), emptyPart(current.distanceM - Math.floor(current.distanceM / 2))]
                        : undefined,
                    ),
                  )
                }
              />
              {t("Dividir esta rep em partes (ex.: 25 prog + 25 A1)")}
            </label>
            {split ? <PartsEditor segment={segment} onChange={onChange} /> : null}
          </div>
          {showStart ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-16 text-[11px] font-semibold text-mute">{t("Partida")}</span>
              <Chip small active={!segment.fromBlock} onClick={() => onChange((current) => applySegmentDefaults(current, { fromBlock: false }))}>
                {t("De baixo")}
              </Chip>
              <Chip small active={segment.fromBlock} onClick={() => onChange((current) => applySegmentDefaults(current, { fromBlock: true }))}>
                {t("Bloco")}
              </Chip>
              <Chip small active={segment.gear.includes("suit")} onClick={() => onChange((current) => toggleGear(current, "suit"))}>
                {t("Fato")}
              </Chip>
            </div>
          ) : null}
          {segment.reps > 1 && !split ? (
            <button type="button" className="text-[11px] font-semibold text-pool hover:underline" onClick={() => setPerRep((open) => !open)}>
              {perRep ? t("Fechar repetições") : t("Mudar repetições individuais (ritmo, saída, material, estilo)")}
            </button>
          ) : null}
          {perRep && !split
            ? segment.details.map((detail, index) => (
                <div key={index} className="flex flex-wrap items-center gap-1.5 border-t border-line pt-1.5">
                  <span className="w-6 font-mono text-[11px] text-mute">{index + 1}.</span>
                  <IntensitySelect compact value={detail.intensity} onChange={(intensity) => onChange((current) => updateRepDetail(current, index, { intensity }))} />
                  {!hideSendOff ? (
                    <SendOffSelect
                      compact
                      value={detail.sendOffSeconds || DEFAULT_SEND_OFF}
                      onChange={(sendOffSeconds) => onChange((current) => updateRepDetail(current, index, { sendOffSeconds }))}
                    />
                  ) : null}
                  {showStart ? (
                    <Chip small active={detail.fromBlock} onClick={() => onChange((current) => updateRepDetail(current, index, { fromBlock: !detail.fromBlock }))}>
                      {t("Bloco")}
                    </Chip>
                  ) : null}
                  <Chip
                    small
                    active={detail.gear.includes("suit")}
                    onClick={() => onChange((current) => toggleRepGear(current, index, "suit"))}
                  >
                    {t("Fato")}
                  </Chip>
                  {WORKOUT_STROKES.map((item) => (
                    <Chip
                      key={item}
                      small
                      active={detail.stroke === item}
                      onClick={() => onChange((current) => updateRepDetail(current, index, { stroke: detail.stroke === item ? "" : item }))}
                    >
                      {WORKOUT_STROKE_LABEL[item]}
                    </Chip>
                  ))}
                  {GEARS.map((item) => (
                    <Chip key={item} small active={detail.gear.includes(item)} onClick={() => onChange((current) => toggleRepGear(current, index, item))}>
                      {GEAR_LABEL[item]}
                    </Chip>
                  ))}
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

/** Editor for a segment split into ordered chunks ("4×50: 25 prog + 25 A1"). */
function PartsEditor({
  segment,
  onChange,
}: {
  segment: SetSegment;
  onChange: (patch: Partial<SetSegment> | ((current: SetSegment) => SetSegment)) => void;
}) {
  const t = useT();
  const parts = segment.parts ?? [];
  const total = parts.reduce((sum, part) => sum + part.distanceM, 0);

  function set(index: number, patch: Partial<SegmentPart>) {
    onChange((current) => setSegmentParts(current, (current.parts ?? []).map((part, i) => (i === index ? { ...part, ...patch } : part))));
  }

  return (
    <div className="space-y-1.5 border-t border-line pt-1.5">
      {parts.map((part, index) => (
        <div key={index} className="flex flex-wrap items-center gap-1.5">
          <span className="w-6 font-mono text-[11px] text-mute">{index + 1}.</span>
          <DistanceSelect compact value={part.distanceM} onChange={(distanceM) => set(index, { distanceM })} />
          <IntensitySelect compact value={part.intensity} onChange={(intensity) => set(index, { intensity })} />
          {WORKOUT_STROKES.map((item) => (
            <Chip
              key={item}
              small
              active={item === "free" ? !part.stroke || part.stroke === "free" : part.stroke === item}
              onClick={() => set(index, { stroke: item === "free" ? "" : item })}
            >
              {WORKOUT_STROKE_LABEL[item]}
            </Chip>
          ))}
          {parts.length > 2 ? (
            <button
              type="button"
              onClick={() => onChange((current) => setSegmentParts(current, (current.parts ?? []).filter((_, i) => i !== index)))}
              className="text-mute hover:text-coral"
              aria-label={t("Remover")}
            >
              ✕
            </button>
          ) : null}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange((current) => setSegmentParts(current, [...(current.parts ?? []), emptyPart()]))}
          className="text-[11px] font-semibold text-pool hover:underline"
        >
          + {t("parte")}
        </button>
        <span className={`font-mono text-[11px] ${total === segment.distanceM ? "text-mute" : "text-coral"}`}>
          {t("{total}m de {distance}m", { total, distance: segment.distanceM })}
        </span>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  missing = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (value: T) => void;
  missing?: boolean;
}) {
  return (
    <div className="text-xs font-semibold text-mute">
      {label}
      <div className={`mt-1 grid h-10 grid-cols-${options.length} gap-1 rounded-lg border p-0.5 ${missing ? "border-coral/50" : "border-line"}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-md text-sm font-semibold ${value === option.value ? "bg-aqua text-white" : "text-mute hover:text-mist"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children, small = false }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full font-semibold ${small ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"} ${
        active ? "bg-aqua text-white" : "border border-line text-mute hover:text-mist"
      }`}
    >
      {children}
    </button>
  );
}

function Stepper({ value, min, onChange, suffix = "" }: { value: number; min: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <span className="inline-flex h-9 items-center rounded-lg border border-line bg-panel">
      <button type="button" className="h-full w-7 text-mute hover:text-mist" onClick={() => onChange(Math.max(min, value - 1))} aria-label="−">
        −
      </button>
      <input
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(Math.max(min, Number(event.target.value.replace(/\D/g, "")) || min))}
        className="w-8 bg-transparent text-center font-mono text-sm font-bold text-mist outline-none"
      />
      {suffix ? <span className="pr-1 font-mono text-sm text-mute">{suffix}</span> : null}
      <button type="button" className="h-full w-7 text-mute hover:text-mist" onClick={() => onChange(value + 1)} aria-label="+">
        +
      </button>
    </span>
  );
}

function SelectShell({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <span className="relative inline-block">
      {children}
      <IconChevron dir="down" className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-mute ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
    </span>
  );
}

function DistanceSelect({ value, onChange, compact = false }: { value: number; onChange: (value: number) => void; compact?: boolean }) {
  return (
    <SelectShell compact={compact}>
      <select
        value={value ? String(value) : ""}
        onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
        className={`appearance-none rounded-lg border bg-panel pl-2.5 pr-7 font-mono font-bold text-mist outline-none focus:border-aqua ${
          compact ? "h-7 text-xs" : "h-9 text-sm"
        } ${value ? "border-line" : "border-pool"}`}
      >
        <option value="">m</option>
        {DISTANCES.map((meters) => (
          <option key={meters} value={String(meters)}>
            {formatDistance(meters)} m
          </option>
        ))}
      </select>
    </SelectShell>
  );
}

function IntensitySelect({ value, onChange, compact = false }: { value: Intensity; onChange: (value: Intensity) => void; compact?: boolean }) {
  const t = useT();
  return (
    <SelectShell compact={compact}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Intensity)}
        className={`appearance-none rounded-lg border border-line bg-panel pl-2.5 pr-7 font-semibold text-mist outline-none focus:border-aqua ${compact ? "h-7 text-xs" : "h-9 text-sm"}`}
      >
        <optgroup label={t("Carga")}>
          {INTENSITIES.filter((item) => !/^P\d/.test(item)).map((item) => (
            <option key={item} value={item}>
              {INTENSITY_LABEL[item]}
            </option>
          ))}
        </optgroup>
        <optgroup label={t("Ritmo de prova")}>
          {INTENSITIES.filter((item) => /^P\d/.test(item)).map((item) => (
            <option key={item} value={item}>
              {INTENSITY_LABEL[item]}
            </option>
          ))}
        </optgroup>
      </select>
    </SelectShell>
  );
}

function SendOffSelect({ value, onChange, compact = false }: { value: number; onChange: (value: number) => void; compact?: boolean }) {
  return (
    <SelectShell compact={compact}>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`appearance-none rounded-lg border border-line bg-panel pl-2.5 pr-7 font-mono text-mist outline-none focus:border-aqua ${compact ? "h-7 text-xs" : "h-9 text-sm"}`}
      >
        {SEND_OFF_OPTIONS.map((seconds) => (
          <option key={seconds} value={seconds}>
            {formatSendOff(seconds)}
          </option>
        ))}
      </select>
    </SelectShell>
  );
}

export type { Gear };
