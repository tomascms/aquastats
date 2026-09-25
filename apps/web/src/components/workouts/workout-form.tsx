"use client";

import { useState } from "react";
import { IconChevron } from "@/components/ui/icons";
import { DISTANCES, formatDistance } from "@/lib/distances";
import { BLOCK_LABEL, COURSE_LABEL, SHIFT_LABEL, treinoTitle } from "@/lib/labels";
import { DEFAULT_SEND_OFF, SEND_OFF_OPTIONS, formatSendOff } from "@/lib/send-off";
import {
  GEARS,
  GEAR_LABEL,
  INTENSITIES,
  INTENSITY_LABEL,
  applySegmentDefaults,
  emptyBlock,
  emptySegment,
  formatSet,
  isReadySegment,
  normalizeDraft,
  orderDraftBlocks,
  persistDraft,
  resizeSegment,
  toggleGear,
  toggleRepGear,
  updateRepDetail,
} from "@/lib/set";
import type { BlockType, DraftBlock, Gear, Intensity, PoolCourse, SetSegment, Shift, WorkoutInput } from "@/lib/types";

const SHIFTS: Shift[] = ["morning", "afternoon"];
const TYPES: BlockType[] = ["warmup", "main", "recovery"];

export function WorkoutForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<WorkoutInput>;
  submitLabel: string;
  onSubmit: (input: WorkoutInput) => void | Promise<void>;
}) {
  const startingDate = initial?.date ?? "";
  const [title, setTitle] = useState(initial?.title ?? (startingDate ? treinoTitle(startingDate) : "Treino"));
  const [date, setDate] = useState(startingDate);
  const [shift, setShift] = useState<Shift>(initial?.shift ?? "afternoon");
  const [course, setCourse] = useState<PoolCourse | "">(initial?.course ?? "");
  const [blocks, setBlocks] = useState<DraftBlock[]>(
    initial?.blocks?.length ? orderDraftBlocks(initial.blocks.map(normalizeDraft)) : [emptyBlock("main")],
  );

  function updateBlock(index: number, patch: Partial<DraftBlock> | ((current: DraftBlock) => DraftBlock)) {
    setBlocks((current) =>
      orderDraftBlocks(current.map((block, i) => {
        if (i !== index) return block;
        const next = typeof patch === "function" ? patch(block) : { ...block, ...patch };
        if (next.rounds === 1) next.betweenRounds = null;
        return next;
      })),
    );
  }

  return (
    <form
      className="space-y-4 pb-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (course !== "scm" && course !== "lcm") return;
        void onSubmit({
          title: title.trim() || treinoTitle(date),
          date,
          shift,
          course,
          blocks: orderDraftBlocks(blocks.map(persistDraft)),
        });
      }}
    >
      <label className="block text-xs font-semibold text-mute">
        Data
        <input
          type="date"
          value={date}
          onChange={(event) => {
            const next = event.target.value;
            setDate(next);
            setTitle(treinoTitle(next));
          }}
          className="mt-1 w-full rounded-2xl border border-line bg-panel px-3 py-3 text-sm text-mist outline-none"
          required
        />
      </label>

      <div>
        <p className="text-xs font-semibold text-mute">Piscina</p>
        <div className="mt-1 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-panel p-1">
          {(["scm", "lcm"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCourse(item)}
              className={`rounded-xl py-2 text-sm font-semibold ${course === item ? "bg-aqua text-ink" : "text-mute"}`}
            >
              {COURSE_LABEL[item]}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-xs font-semibold text-mute">
        Título
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 w-full rounded-2xl border border-line bg-panel px-3 py-3 text-sm text-mist outline-none focus:border-aqua"
        />
      </label>

      <div>
        <p className="text-xs font-semibold text-mute">Turno</p>
        <div className="mt-1 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-panel p-1">
          {SHIFTS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setShift(item)}
              className={`rounded-xl py-2 text-sm font-semibold ${shift === item ? "bg-aqua text-ink" : "text-mute"}`}
            >
              {SHIFT_LABEL[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {blocks.map((block, index) => (
          <BlockEditor
            key={index}
            block={block}
            onChange={(patch) => updateBlock(index, patch)}
            onRemove={blocks.length > 1 ? () => setBlocks((current) => current.filter((_, i) => i !== index)) : undefined}
          />
        ))}
        <button
          type="button"
          onClick={() => setBlocks((current) => orderDraftBlocks([...current, emptyBlock("main")]))}
          className="w-full rounded-2xl border border-dashed border-line py-3 text-sm text-mute"
        >
          Adicionar bloco
        </button>
      </div>

      <button type="submit" disabled={course !== "scm" && course !== "lcm"} className="h-12 w-full rounded-2xl bg-aqua text-sm font-medium text-ink disabled:opacity-40">
        {submitLabel}
      </button>
    </form>
  );
}

function BlockEditor({
  block,
  onChange,
  onRemove,
}: {
  block: DraftBlock;
  onChange: (patch: Partial<DraftBlock> | ((current: DraftBlock) => DraftBlock)) => void;
  onRemove?: () => void;
}) {
  const showNoSendOff = block.type === "warmup" || block.type === "recovery";
  const preview = formatSet(block);

  function updateSegment(segmentIndex: number, patch: Partial<SetSegment> | ((current: SetSegment) => SetSegment)) {
    onChange((current) => ({
      ...current,
      segments: current.segments.map((segment, index) => {
        if (index !== segmentIndex) return segment;
        return typeof patch === "function" ? patch(segment) : { ...segment, ...patch };
      }),
    }));
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ type, noSendOff: type !== "main" })}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                block.type === type ? "bg-aqua text-ink" : "text-mute"
              }`}
            >
              {BLOCK_LABEL[type]}
            </button>
          ))}
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-[11px] text-coral">
            Remover
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <NumberField label="Séries" value={block.rounds} min={1} onChange={(rounds) => onChange({ rounds })} />
        {showNoSendOff && (
          <label className="mb-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.noSendOff}
              onChange={(event) => onChange({ noSendOff: event.target.checked })}
            />
            Sem saídas
          </label>
        )}
      </div>

      {preview !== "—" && <p className="mt-3 font-mono text-sm text-aqua">{preview}</p>}

      <div className="mt-3 space-y-2">
        {block.segments.map((segment, segmentIndex) => (
          <GroupCard
            key={segmentIndex}
            segment={segment}
            hideSendOff={block.noSendOff}
            showStart={block.type === "main"}
            canRemove={block.segments.length > 1}
            onChange={(patch) => updateSegment(segmentIndex, patch)}
            onRemove={() =>
              onChange((current) => ({
                ...current,
                segments: current.segments.length > 1 ? current.segments.filter((_, index) => index !== segmentIndex) : [emptySegment()],
              }))
            }
          />
        ))}
        <button
          type="button"
          onClick={() => onChange((current) => ({ ...current, segments: [...current.segments, emptySegment()] }))}
          className="w-full rounded-2xl border border-dashed border-line py-2.5 text-sm text-mute"
        >
          + Grupo
        </button>
      </div>

      {block.rounds > 1 && (
        <div className="mt-3 rounded-2xl border border-line bg-ink px-3 py-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.betweenRounds)}
              onChange={(event) =>
                onChange({
                  betweenRounds: event.target.checked ? { distanceM: 200 } : null,
                })
              }
            />
            Suave entre séries
          </label>
          {block.betweenRounds && (
            <div className="mt-2 max-w-[160px]">
              <DistanceField
                value={block.betweenRounds.distanceM}
                onChange={(distanceM) => onChange({ betweenRounds: { distanceM } })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  segment,
  hideSendOff,
  showStart,
  canRemove,
  onChange,
  onRemove,
}: {
  segment: SetSegment;
  hideSendOff: boolean;
  showStart: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<SetSegment> | ((current: SetSegment) => SetSegment)) => void;
  onRemove: () => void;
}) {
  const ready = isReadySegment(segment);
  const [customizing, setCustomizing] = useState(false);

  return (
    <div className="rounded-2xl border border-line bg-ink px-3 py-3">
      <div className="flex items-end gap-2">
            <NumberField
              label="Reps"
              value={segment.reps}
              min={1}
              onChange={(reps) => onChange((current) => resizeSegment(current, reps))}
            />
        <span className="mb-2 text-mute">×</span>
        <DistanceField value={segment.distanceM} onChange={(distanceM) => onChange({ distanceM })} />
        {canRemove && (
          <button type="button" onClick={onRemove} className="mb-1 ml-auto text-[11px] text-coral">
            Tirar
          </button>
        )}
      </div>

      {ready && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <p className="mb-1 text-xs font-semibold text-mute">Velocidade</p>
              <IntensityPills
                value={segment.intensity}
                onChange={(intensity) => onChange((current) => applySegmentDefaults(current, { intensity }))}
              />
            </div>
            {!hideSendOff && (
              <label className="w-[7.5rem] text-xs font-semibold text-mute">
                Saída
                <SendOffSelect
                  value={segment.sendOffSeconds || DEFAULT_SEND_OFF}
                  onChange={(sendOffSeconds) => onChange((current) => applySegmentDefaults(current, { sendOffSeconds }))}
                />
              </label>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-mute">Material</p>
            <div className="flex flex-wrap gap-1">
              {GEARS.map((item) => (
                <GearChip
                  key={item}
                  gear={item}
                  active={segment.gear.includes(item)}
                  onClick={() => onChange((current) => toggleGear(current, item))}
                />
              ))}
            </div>
          </div>

          <div>
            {showStart ? (
              <p className="mb-1 text-xs font-semibold text-mute">Partida</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {showStart ? (
                <StartToggle
                  fromBlock={segment.fromBlock}
                  onChange={(fromBlock) => onChange((current) => applySegmentDefaults(current, { fromBlock }))}
                />
              ) : null}
              <button
                type="button"
                onClick={() => setCustomizing((open) => !open)}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold ${
                  customizing ? "bg-aqua text-ink" : "border border-line text-mute"
                }`}
              >
                {customizing ? "Fechar" : "Personalizar"}
              </button>
            </div>
          </div>

          {customizing &&
            segment.details.map((detail, index) => (
              <div key={index} className="rounded-xl border border-line/80 px-2 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-5 font-mono text-[11px] text-mute">{index + 1}</span>
                  <div className="relative">
                    <select
                      value={detail.intensity}
                      onChange={(event) =>
                        onChange((current) => updateRepDetail(current, index, { intensity: event.target.value as Intensity }))
                      }
                      className="h-9 appearance-none rounded-lg border border-line bg-panel px-2 pr-7 font-mono text-[12px] text-mist outline-none"
                    >
                      {INTENSITIES.map((item) => (
                        <option key={item} value={item}>
                          {INTENSITY_LABEL[item]}
                        </option>
                      ))}
                    </select>
                    <IconChevron dir="down" className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-mute" />
                  </div>
                  {!hideSendOff && (
                    <SendOffSelect
                      compact
                      value={detail.sendOffSeconds || DEFAULT_SEND_OFF}
                      onChange={(sendOffSeconds) => onChange((current) => updateRepDetail(current, index, { sendOffSeconds }))}
                    />
                  )}
                  {showStart ? (
                    <StartToggle
                      compact
                      fromBlock={detail.fromBlock}
                      onChange={(fromBlock) => onChange((current) => updateRepDetail(current, index, { fromBlock }))}
                    />
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1 pl-7">
                  {GEARS.map((item) => (
                    <GearChip
                      key={item}
                      gear={item}
                      active={detail.gear.includes(item)}
                      onClick={() => onChange((current) => toggleRepGear(current, index, item))}
                      compact
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function SendOffSelect({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`relative ${compact ? "" : "mt-1"}`}>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`appearance-none rounded-xl border border-line bg-panel py-2 pl-2.5 pr-8 font-mono text-mist outline-none ${
          compact ? "h-9 w-[5.75rem] text-[12px]" : "mt-0 h-10 w-full text-sm"
        }`}
      >
        {SEND_OFF_OPTIONS.map((seconds) => (
          <option key={seconds} value={seconds}>
            {formatSendOff(seconds)}
          </option>
        ))}
      </select>
      <IconChevron dir="down" className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mute" />
    </div>
  );
}

function IntensityPills({ value, onChange }: { value: Intensity; onChange: (value: Intensity) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Intensity)}
        className="h-10 w-full appearance-none rounded-xl border border-line bg-panel px-3 pr-9 text-sm font-semibold text-mist outline-none focus:border-aqua"
      >
        <optgroup label="Carga">
          {INTENSITIES.filter((item) => !item.startsWith("P")).map((item) => (
            <option key={item} value={item}>{INTENSITY_LABEL[item]}</option>
          ))}
        </optgroup>
        <optgroup label="Ritmo de prova">
          {INTENSITIES.filter((item) => item.startsWith("P")).map((item) => (
            <option key={item} value={item}>{INTENSITY_LABEL[item]}</option>
          ))}
        </optgroup>
      </select>
      <IconChevron dir="down" className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mute" />
    </div>
  );
}

function StartToggle({
  fromBlock,
  onChange,
  compact = false,
}: {
  fromBlock: boolean;
  onChange: (fromBlock: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid grid-cols-2 gap-1 rounded-xl border border-line p-0.5 ${compact ? "w-[9.5rem]" : "max-w-[220px]"}`}>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded-lg py-1.5 text-[11px] font-semibold ${!fromBlock ? "bg-aqua text-ink" : "text-mute"}`}
      >
        De baixo
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`rounded-lg py-1.5 text-[11px] font-semibold ${fromBlock ? "bg-sand text-ink" : "text-mute"}`}
      >
        Bloco
      </button>
    </div>
  );
}

function GearChip({
  gear,
  active,
  onClick,
  compact = false,
}: {
  gear: Gear;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full font-semibold ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"} ${
        active ? "bg-sand text-ink" : "border border-line text-mute"
      }`}
    >
      {GEAR_LABEL[gear]}
    </button>
  );
}

function DistanceField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-xs text-mute">
      Metros
      <div className="relative mt-1">
        <select
          value={value ? String(value) : ""}
          onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
          className="h-10 w-[6.5rem] appearance-none rounded-xl border border-line bg-panel py-2 pl-2.5 pr-8 font-mono text-sm text-mist outline-none"
        >
          <option value="">—</option>
          {DISTANCES.map((meters) => (
            <option key={meters} value={String(meters)}>
              {formatDistance(meters)}
            </option>
          ))}
        </select>
        <IconChevron dir="down" className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mute" />
      </div>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs text-mute">
      {label}
      <input
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Math.max(min, Number(event.target.value) || min))}
        className="mt-1 w-20 rounded-xl border border-line bg-panel px-2 py-2 font-mono text-sm text-mist outline-none"
      />
    </label>
  );
}
