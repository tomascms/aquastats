"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistance, sameMeters, splitChoices } from "@/lib/distances";
import { BLOCK_LABEL, COURSE_LABEL, SHIFT_LABEL, strokeLabel } from "@/lib/labels";
import { formatSendOff } from "@/lib/send-off";
import {
  INTENSITY_LABEL,
  flattenInner,
  flatRepNumber,
  formatGear,
  formatSet,
  innerCount,
  needsClockTime,
  splitRepNumber,
  totalReps,
} from "@/lib/set";
import { actions, emptyParts, useAppState } from "@/lib/store";
import { isTimeComplete } from "@/lib/time-save";
import {
  canAcceptSecondsDigit,
  clockStartField,
  commitClockParts,
  formatTime,
  hasClockTime,
  isEmptyParts,
  isSubMinuteDistance,
  isValidSeconds,
  padClockDigit,
  partsFromNumbers,
} from "@/lib/swim-time";
import type { CellRef, Stroke, TimeLog, TimeParts, WorkoutBlock } from "@/lib/types";
import { AthletePicker } from "@/components/matrix/athlete-picker";
import { IconBack, IconMinus, IconPlus } from "@/components/ui/icons";
import { OfflinePill } from "@/components/ui/offline-pill";
import { SwimKeyboard } from "@/components/matrix/swim-keyboard";

type Field = 0 | 1 | 2;
const FIELDS: Array<keyof TimeParts> = ["mm", "ss", "cc"];

function haptic(ms = 12) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
}

function cellKey(athleteId: string, rep: number) {
  return `${athleteId}:${rep}`;
}

function logHasTime(log: TimeLog | undefined): boolean {
  if (!log) return false;
  return hasClockTime(log.mm, log.ss, log.cc) || (log.splits ?? []).some((split) => hasClockTime(split.mm, split.ss, split.cc));
}

function partsFromLog(log: TimeLog | undefined, splitAt: number | null): TimeParts {
  if (!log) return emptyParts();
  if (splitAt == null) {
    if (!hasClockTime(log.mm, log.ss, log.cc)) return emptyParts();
    return partsFromNumbers(log.mm, log.ss, log.cc);
  }
  const split = (log.splits ?? []).find((item) => sameMeters(item.atM, splitAt));
  if (!split) return emptyParts();
  return partsFromNumbers(split.mm, split.ss, split.cc);
}

export function MatrixScreen() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { athletes, workouts, timeLogs } = useAppState();
  const seedWorkout = workouts.find((item) => item.id === params.id);
  const dayWorkouts = useMemo(
    () =>
      workouts
        .filter((item) => item.date === seedWorkout?.date)
        .slice()
        .sort((a, b) => a.shift.localeCompare(b.shift) || a.title.localeCompare(b.title)),
    [workouts, seedWorkout?.date],
  );
  const [workoutId, setWorkoutId] = useState(params.id);
  const workout = workouts.find((item) => item.id === workoutId) ?? seedWorkout;
  const defaultBlock = workout?.blocks.find((block) => block.type === "main") ?? workout?.blocks[0];
  const [blockId, setBlockId] = useState(defaultBlock?.id ?? "");
  const block = workout?.blocks.find((item) => item.id === blockId) ?? defaultBlock;
  const [round, setRound] = useState(1);
  const [cell, setCell] = useState<CellRef | null>(null);
  const [parts, setParts] = useState<TimeParts>(emptyParts());
  const [field, setField] = useState<Field>(0);
  const [invalid, setInvalid] = useState(false);
  const [picker, setPicker] = useState(false);
  const [splitAt, setSplitAt] = useState<number | null>(null);
  const [stroke, setStroke] = useState<Stroke | "">("free");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [keyboardOpen, setKeyboardOpen] = useState(true);
  const bootstrapped = useRef(false);
  const overwritePosRef = useRef<number | null>(null);
  const partsRef = useRef(parts);
  const fieldRef = useRef<Field>(0);
  const splitAtRef = useRef(splitAt);
  const cellRef = useRef(cell);
  const workoutIdRef = useRef(workout?.id);
  const strokeRef = useRef(stroke);
  const saveChain = useRef(Promise.resolve());
  const saveErrors = useRef(0);
  workoutIdRef.current = workout?.id;

  const present = workout ? athletes.filter((athlete) => workout.athleteIds.includes(athlete.id)) : [];
  const presentIds = present.map((athlete) => athlete.id);
  const inners = block ? flattenInner(block) : [];
  const innerReps = inners.length;
  const rounds = block?.rounds ?? 1;

  useEffect(() => {
    if (!workout || !block || bootstrapped.current || presentIds.length === 0 || innerCount(block) === 0) return;
    const first = firstEmptyCell(presentIds, block, timeLogs, workout.id);
    const split = splitRepNumber(first.repNumber, innerCount(block));
    const startField = clockStartField(flattenInner(block)[split.innerRep - 1]?.distanceM);
    const loaded = partsFromLog(findLog(timeLogs, workout.id, first), null);
    const bootStroke = findLog(timeLogs, workout.id, first)?.stroke || "free";
    setRound(split.round);
    setCell(first);
    cellRef.current = first;
    setField(startField);
    fieldRef.current = startField;
    setInvalid(false);
    setSplitAt(null);
    splitAtRef.current = null;
    partsRef.current = loaded;
    setParts(loaded);
    strokeRef.current = bootStroke;
    setStroke(bootStroke);
    overwritePosRef.current = logHasTime(findLog(timeLogs, workout.id, first)) ? startField * 2 : null;
    bootstrapped.current = true;
  }, [block, presentIds, timeLogs, workout]);

  const logsByCell = new Map<string, TimeLog>();
  if (workout && block) {
    for (const log of timeLogs) {
      if (log.workoutId !== workout.id || log.blockId !== block.id) continue;
      logsByCell.set(cellKey(log.athleteId, log.repNumber), log);
    }
  }

  const requiredReps = inners.filter((item) => needsClockTime(item.intensity)).length * Math.max(1, rounds);
  const filled = [...logsByCell.values()].filter((log) => {
    if (!presentIds.includes(log.athleteId) || !logHasTime(log)) return false;
    const split = splitRepNumber(log.repNumber, innerReps || 1);
    const inner = inners[split.innerRep - 1];
    return inner ? needsClockTime(inner.intensity) : true;
  }).length;

  function queueSave(
    workoutId: string,
    currentCell: CellRef,
    currentParts: TimeParts,
    split: number | null,
    currentStroke: Stroke | "",
    immediate = false,
  ) {
    const distanceM = block
      ? flattenInner(block)[splitRepNumber(currentCell.repNumber, innerCount(block)).innerRep - 1]?.distanceM
      : undefined;
    const remote = actions
      .scheduleTimeSave(workoutId, currentCell, currentParts, split, currentStroke, { immediate, distanceM })
      .catch(() => {
        saveErrors.current += 1;
      });
    saveChain.current = saveChain.current.catch(() => {}).then(() => remote);
    return remote;
  }

  function persistCurrent() {
    const currentCell = cellRef.current;
    const currentWorkoutId = workoutIdRef.current;
    if (!currentCell || !currentWorkoutId || !workout) return saveChain.current;
    const raw = partsRef.current;
    const currentParts = commitClockParts(raw);
    partsRef.current = currentParts;
    if (raw.mm !== currentParts.mm || raw.ss !== currentParts.ss || raw.cc !== currentParts.cc) {
      setParts(currentParts);
    }
    if (!isEmptyParts(currentParts) && !isValidSeconds(currentParts.ss)) return saveChain.current;
    const existing = findLog(timeLogs, workout.id, currentCell);
    if (isEmptyParts(currentParts) && !logHasTime(existing)) return saveChain.current;
    const distanceM = block
      ? flattenInner(block)[splitRepNumber(currentCell.repNumber, innerCount(block)).innerRep - 1]?.distanceM
      : undefined;
    if (!isEmptyParts(currentParts) && !logHasTime(existing)) {
      const complete = isTimeComplete(currentParts, distanceM);
      if (!complete) return saveChain.current;
    }
    return queueSave(currentWorkoutId, currentCell, currentParts, splitAtRef.current, strokeRef.current, true);
  }

  async function flushTimes() {
    saveErrors.current = 0;
    persistCurrent();
    setSaving(true);
    setSaved("");
    try {
      await saveChain.current.catch(() => undefined);
      await actions.flushAllTimeSaves();
      if (saveErrors.current > 0) {
        setSaved("Erro ao guardar");
        window.setTimeout(() => setSaved(""), 3000);
        return;
      }
      setSaved("Guardado");
      window.setTimeout(() => setSaved(""), 1800);
    } finally {
      setSaving(false);
    }
  }

  function removeAthleteFromMatrix(athleteId: string) {
    const workoutId = workoutIdRef.current;
    if (!workoutId) return;
    persistCurrent();
    if (cell?.athleteId === athleteId) {
      setCell(null);
      cellRef.current = null;
      setParts(emptyParts());
      partsRef.current = emptyParts();
    }
    void actions.removeAthleteFromWorkout(workoutId, athleteId);
  }

  useEffect(() => {
    return () => {
      void saveChain.current.then(() => persistCurrent());
    };
  }, []);

  function applyCell(next: CellRef, hydrate: boolean) {
    const sameCell =
      cellRef.current?.athleteId === next.athleteId &&
      cellRef.current?.blockId === next.blockId &&
      cellRef.current?.repNumber === next.repNumber;
    if (!sameCell) persistCurrent();
    if (sameCell) return;
    setCell(next);
    cellRef.current = next;
    setKeyboardOpen(true);
    const nextInner = block
      ? flattenInner(block)[splitRepNumber(next.repNumber, innerCount(block)).innerRep - 1]
      : undefined;
    const startField = clockStartField(nextInner?.distanceM);
    fieldRef.current = startField;
    setField(startField);
    setInvalid(false);
    setSplitAt(null);
    splitAtRef.current = null;
    if (block) setRound(splitRepNumber(next.repNumber, innerCount(block)).round);
    const nextLog = workout ? findLog(timeLogs, workout.id, next) : undefined;
    const nextStroke = nextLog?.stroke || "free";
    strokeRef.current = nextStroke;
    setStroke(nextStroke);
    if (!hydrate || !workout) {
      const blank = emptyParts();
      partsRef.current = blank;
      setParts(blank);
      overwritePosRef.current = null;
      return;
    }
    const loaded = partsFromLog(nextLog, null);
    partsRef.current = loaded;
    setParts(loaded);
    overwritePosRef.current = logHasTime(nextLog) ? startField * 2 : null;
  }

  function move(deltaAthlete: number, deltaRep: number) {
    if (!cell || !block || present.length === 0) return;
    const athleteIndex = present.findIndex((athlete) => athlete.id === cell.athleteId);
    const nextAthlete = present[Math.min(present.length - 1, Math.max(0, athleteIndex + deltaAthlete))];
    const split = splitRepNumber(cell.repNumber, innerCount(block));
    const nextInner = Math.min(innerCount(block), Math.max(1, split.innerRep + deltaRep));
    applyCell(
      {
        athleteId: nextAthlete.id,
        blockId: block.id,
        repNumber: flatRepNumber(round, nextInner, innerCount(block)),
      },
      true,
    );
  }

  function activeRepDistance(): number | undefined {
    const activeCell = cellRef.current;
    if (!activeCell || !block) return undefined;
    return flattenInner(block)[splitRepNumber(activeCell.repNumber, innerCount(block)).innerRep - 1]?.distanceM;
  }

  function onDigit(digit: string) {
    const activeCell = cellRef.current;
    const activeWorkoutId = workoutIdRef.current;
    if (!activeCell || !activeWorkoutId) return;
    const distanceM = activeRepDistance();
    setInvalid(false);
    if (overwritePosRef.current !== null) {
      const pos = overwritePosRef.current;
      const fieldIdx = Math.floor(pos / 2) as Field;
      const charIdx = pos % 2;
      const key = FIELDS[fieldIdx];
      const next = { ...partsRef.current };
      const padded = (next[key] || "").padEnd(2, " ");
      const chars = padded.split("");
      chars[charIdx] = digit;
      next[key] = chars.join("").trimEnd();
      const nextPos = pos + 1;
      overwritePosRef.current = nextPos >= 6 ? null : nextPos;
      const nextFieldIdx = (overwritePosRef.current !== null ? Math.floor(overwritePosRef.current / 2) : fieldIdx) as Field;
      fieldRef.current = nextFieldIdx;
      setParts(next);
      setField(nextFieldIdx);
      partsRef.current = next;
      if (isTimeComplete(next, distanceM)) {
        queueSave(activeWorkoutId, activeCell, next, splitAtRef.current, strokeRef.current);
      } else {
        void actions.scheduleTimeSave(activeWorkoutId, activeCell, next, splitAtRef.current, strokeRef.current, { distanceM });
      }
      return;
    }
    const next = { ...partsRef.current };
    let nextField = fieldRef.current;
    let placed = false;
    for (let index = fieldRef.current; index < 3; index += 1) {
      const key = FIELDS[index];
      if (next[key].length >= 2) continue;
      if (key === "ss" && !canAcceptSecondsDigit(next[key], digit)) {
        setInvalid(true);
        haptic(30);
        fieldRef.current = 1;
        setField(1);
        return;
      }
      next[key] += digit;
      nextField = (next[key].length === 2 && index < 2 ? index + 1 : index) as Field;
      placed = true;
      break;
    }
    if (!placed) {
      overwritePosRef.current = fieldRef.current * 2;
      onDigit(digit);
      return;
    }
    setParts(next);
    fieldRef.current = nextField;
    setField(nextField);
    partsRef.current = next;
    if (isTimeComplete(next, distanceM)) {
      queueSave(activeWorkoutId, activeCell, next, splitAtRef.current, strokeRef.current);
    } else {
      void actions.scheduleTimeSave(activeWorkoutId, activeCell, next, splitAtRef.current, strokeRef.current, { distanceM });
    }
  }

  function onBackspace() {
    overwritePosRef.current = null;
    setInvalid(false);
    const next = { ...partsRef.current };
    let nextField = fieldRef.current;
    for (let index = fieldRef.current; index >= 0; index -= 1) {
      const key = FIELDS[index];
      if (next[key].length) {
        next[key] = next[key].slice(0, -1);
        nextField = index as Field;
        break;
      }
    }
    setParts(next);
    fieldRef.current = nextField;
    setField(nextField);
    partsRef.current = next;
  }

  function commitActive() {
    const key = FIELDS[fieldRef.current];
    const padded = padClockDigit(key, partsRef.current[key]);
    if (padded === partsRef.current[key]) return partsRef.current;
    const next = { ...partsRef.current, [key]: padded };
    setParts(next);
    partsRef.current = next;
    return next;
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        onDigit(event.key);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        onBackspace();
        return;
      }
      if (event.key === "Enter") {
        if (target?.closest("button, a")) return;
        event.preventDefault();
        const nextParts = commitActive();
        if (field < 2) setField((current) => (current + 1) as Field);
        else {
          if (workout && cell && isTimeComplete(nextParts, activeRepDistance())) {
            queueSave(workout.id, cell, nextParts, splitAt, stroke, true);
          }
          move(1, 0);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!workout) {
    return (
      <div className="px-4 py-16 text-center text-mute">
        Treino não encontrado.
        <Link href="/coach" className="mt-4 block text-aqua">
          Voltar
        </Link>
      </div>
    );
  }

  if (!block) {
    return (
      <div className="px-4 py-16 text-center text-mute">
        Este treino ainda não tem blocos.
        <Link href={`/coach/workouts/${workout.id}/edit`} className="mt-4 block text-aqua">
          Editar treino
        </Link>
      </div>
    );
  }

  const athlete = present.find((item) => item.id === cell?.athleteId);
  const selectedSplit = cell && innerReps ? splitRepNumber(cell.repNumber, innerReps) : null;
  const selectedInner = selectedSplit ? inners[selectedSplit.innerRep - 1] : undefined;
  const availableSplits = selectedInner ? splitChoices(selectedInner.distanceM) : [];
  const activeSplitMarks = availableSplits.filter((choice) =>
    (selectedInner?.splitMarks ?? []).some((mark) => sameMeters(mark, choice.atM)),
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink no-select">
      <header className="safe-top flex items-center gap-3 px-3 pb-2 pt-1">
        <button
          type="button"
          onClick={() => {
            router.push(`/coach?date=${workout.date}`);
            void flushTimes();
          }}
          className="rounded-xl border border-line bg-panel p-2 text-mist"
        >
          <IconBack />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{workout.title}</p>
          <p className="text-[11px] text-mute">
            {workout.course === "scm" || workout.course === "lcm" ? `${COURSE_LABEL[workout.course]} · ` : ""}
            {present.length} na água · {filled}/{present.length * requiredReps || 0} tempos
          </p>
        </div>
        {saved ? <span className="text-[11px] font-semibold text-aqua">{saved}</span> : null}
        <button
          type="button"
          onClick={() => void flushTimes()}
          disabled={saving}
          className="h-9 rounded-xl bg-aqua hover:bg-aqua-2 px-3 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? "A guardar…" : "Guardar"}
        </button>
        <OfflinePill />
      </header>

      {dayWorkouts.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-3 pb-2">
          {dayWorkouts.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                persistCurrent();
                setWorkoutId(item.id);
                setBlockId("");
                setRound(1);
                setCell(null);
                setSplitAt(null);
                bootstrapped.current = false;
              }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                item.id === workout.id ? "bg-aqua text-ink" : "border border-line bg-panel text-mute"
              }`}
            >
              {SHIFT_LABEL[item.shift]} · {item.title}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto px-3 pb-2">
        {workout.blocks.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              persistCurrent();
              setBlockId(item.id);
              setRound(1);
              setCell(null);
              setSplitAt(null);
              bootstrapped.current = false;
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              item.id === block.id ? "bg-aqua text-ink" : "border border-line bg-panel text-mute"
            }`}
          >
            {BLOCK_LABEL[item.type]} · {formatSet(item)}
          </button>
        ))}
      </div>

      {rounds > 1 && (
        <div className="flex gap-2 overflow-x-auto px-3 pb-2">
          {Array.from({ length: rounds }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setRound(index + 1)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                round === index + 1 ? "bg-aqua text-white" : "border border-line text-mute"
              }`}
            >
              Série {index + 1}
            </button>
          ))}
        </div>
      )}

      {block.betweenRounds && rounds > 1 && (
        <p className="px-3 pb-2 text-[11px] text-mute">
          Suave entre séries: {formatDistance(block.betweenRounds.distanceM)}m
        </p>
      )}

      <div className="matrix-scroll min-h-0 flex-1 overflow-auto px-2 pb-2">
        <div
          className="grid min-w-max"
          style={{ gridTemplateColumns: `122px repeat(${innerReps}, minmax(84px, 1fr))` }}
        >
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="sticky left-0 z-10 bg-ink px-2 py-2 text-left text-xs font-semibold tracking-[0.12em] text-aqua"
          >
            Editar atletas
          </button>
          {inners.map((item) => (
            <div key={item.index} className="px-1 py-1 text-center">
              <p className="font-mono text-[11px] text-mute">
                {item.index + 1}
                <span className="text-mute/70"> · {formatDistance(item.distanceM)}m</span>
              </p>
              <p className="text-[10px] font-semibold text-sand">{INTENSITY_LABEL[item.intensity]}</p>
              {!needsClockTime(item.intensity) ? <p className="text-[9px] text-mute">sem tempo</p> : null}
              <p className="font-mono text-[10px] text-aqua">
                {block.noSendOff ? "—" : formatSendOff(item.sendOffSeconds)}
              </p>
              {item.fromBlock && (
                <p className="mt-0.5 text-xs font-semibold text-sand">bloco</p>
              )}
              {item.gear.length > 0 && (
                <p className="mt-0.5 text-[9px] leading-tight text-mute">{formatGear(item.gear)}</p>
              )}
            </div>
          ))}

          {innerReps === 0 && (
            <div className="sticky left-0 z-10 border-t border-line bg-ink-2 px-2 py-4 text-sm text-mute">
              Esta série ainda não tem reps.
            </div>
          )}

          {present.map((row) => (
            <Row
              key={row.id}
              name={row.name}
              reps={innerReps}
              selectedInner={
                selectedSplit && cell?.athleteId === row.id && selectedSplit.round === round ? selectedSplit.innerRep : 0
              }
              getLog={(innerRep) => logsByCell.get(cellKey(row.id, flatRepNumber(round, innerRep, innerReps)))}
              onSelect={(innerRep) =>
                applyCell({ athleteId: row.id, blockId: block.id, repNumber: flatRepNumber(round, innerRep, innerReps) }, true)
              }
              onRemove={() => removeAthleteFromMatrix(row.id)}
            />
          ))}

          {innerReps > 0 && (
            <>
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="sticky left-0 z-10 flex items-center gap-2 border-t border-line bg-ink-2 px-2 py-2 text-left text-aqua"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aqua/15">
                  <IconPlus className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-semibold">Adicionar atleta</span>
              </button>
              {inners.map((item) => (
                <div key={`add-${item.index}`} className="border-t border-l border-line bg-panel/20" />
              ))}
            </>
          )}
        </div>
      </div>

      {cell && athlete && selectedSplit && selectedInner && (
        <SwimKeyboard
          parts={parts}
          field={field}
          invalid={invalid}
          athleteName={athlete.name}
          repLabel={`${rounds > 1 ? `S${selectedSplit.round} · ` : ""}R${selectedSplit.innerRep} · ${formatDistance(selectedInner.distanceM)}m`}
          finalLabel={formatDistance(selectedInner.distanceM) + "m"}
          splitMarks={activeSplitMarks}
          activeSplit={splitAt}
          availableSplits={availableSplits}
          collapsed={!keyboardOpen}
          onToggleCollapse={() => setKeyboardOpen((open) => !open)}
          onDigit={onDigit}
          onBackspace={onBackspace}
          onField={(nextField) => {
            commitActive();
            fieldRef.current = nextField;
            setField(nextField);
            const log = findLog(timeLogs, workout.id, cell);
            overwritePosRef.current = logHasTime(log) ? nextField * 2 : null;
          }}
          onPrevAthlete={() => move(-1, 0)}
          onNextAthlete={() => move(1, 0)}
          onPrevRep={() => move(0, -1)}
          onNextRep={() => move(0, 1)}
          onSplit={(atM) => {
            persistCurrent();
            setSplitAt(atM);
            splitAtRef.current = atM;
            const splitField = clockStartField(atM ?? selectedInner.distanceM);
            fieldRef.current = splitField;
            setField(splitField);
            setInvalid(false);
            const splitParts = partsFromLog(findLog(timeLogs, workout.id, cell), atM);
            partsRef.current = splitParts;
            setParts(splitParts);
          }}
          onToggleSplit={(atM) => {
            const current = selectedInner.splitMarks ?? [];
            const on = current.some((mark) => sameMeters(mark, atM));
            const next = on ? current.filter((mark) => !sameMeters(mark, atM)) : [...current, atM].sort((a, b) => a - b);
            persistCurrent();
            actions.setSplitMarks(workout.id, block.id, selectedInner.segmentIndex, next);
            if (on && splitAt != null && sameMeters(splitAt, atM)) {
              setSplitAt(null);
              setField(clockStartField(selectedInner.distanceM));
              setParts(partsFromLog(findLog(timeLogs, workout.id, cell), null));
            }
          }}
          onClear={() => {
            if (!cell) return;
            const blank = emptyParts();
            partsRef.current = blank;
            setParts(blank);
            overwritePosRef.current = null;
            setInvalid(false);
            queueSave(workout.id, cell, blank, splitAtRef.current, strokeRef.current);
          }}
          onNotDone={() => {
            if (!cell) return;
            const blank = emptyParts();
            partsRef.current = blank;
            setParts(blank);
            overwritePosRef.current = null;
            setInvalid(false);
            void actions.skipTime(workout.id, cell, strokeRef.current).catch(() => {
              saveErrors.current += 1;
            });
          }}
          stroke={stroke}
          onStroke={(next) => {
            setStroke(next);
            strokeRef.current = next;
            if (!cell) return;
            const currentParts = partsRef.current;
            if (!isEmptyParts(currentParts) && !isValidSeconds(currentParts.ss)) return;
            const log = findLog(timeLogs, workout.id, cell);
            if (logHasTime(log) || !isEmptyParts(currentParts)) {
              queueSave(workout.id, cell, currentParts, splitAtRef.current, next);
            }
          }}
        />
      )}

      {picker && <AthletePicker workoutId={workout.id} onClose={() => setPicker(false)} />}
    </div>
  );
}

function findLog(logs: TimeLog[], workoutId: string, cell: CellRef): TimeLog | undefined {
  return logs.find(
    (log) =>
      log.workoutId === workoutId &&
      log.blockId === cell.blockId &&
      log.athleteId === cell.athleteId &&
      log.repNumber === cell.repNumber,
  );
}

function Row({
  name,
  reps,
  selectedInner,
  getLog,
  onSelect,
  onRemove,
}: {
  name: string;
  reps: number;
  selectedInner: number;
  getLog: (innerRep: number) => TimeLog | undefined;
  onSelect: (innerRep: number) => void;
  onRemove?: () => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 flex items-center gap-1.5 border-t border-line bg-ink-2 px-2 py-2">
        {onRemove ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-coral/15 text-coral"
            aria-label={`Tirar ${name} deste treino`}
          >
            <IconMinus className="h-4 w-4" />
          </button>
        ) : null}
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight">{name}</p>
      </div>
      {Array.from({ length: reps }, (_, index) => {
        const innerRep = index + 1;
        const log = getLog(innerRep);
        const selected = selectedInner === innerRep;
        const splits = (log?.splits ?? []).filter((item) => hasClockTime(item.mm, item.ss, item.cc)).length;
        const hasFinal = Boolean(log && hasClockTime(log.mm, log.ss, log.cc));
        return (
          <button
            key={innerRep}
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              onSelect(innerRep);
            }}
            className={`border-t border-l border-line px-1 py-2 font-mono text-[12px] leading-none ${
              selected ? "bg-aqua/15 ring-1 ring-inset ring-aqua" : "bg-panel/50"
            }`}
          >
            {hasFinal ? (
              <span className={log?.pending ? "text-sand" : "text-mist"}>{formatTime(log!.mm, log!.ss, log!.cc)}</span>
            ) : splits ? (
              <span className="text-sand">{splits} parc.</span>
            ) : (
              <span className="text-mute/50">—</span>
            )}
            {logHasTime(log) && (
              <span className="mt-0.5 block text-[9px] text-mute">{strokeLabel(log?.stroke) || "—"}</span>
            )}
            {hasFinal && splits > 0 && <span className="mt-0.5 block text-[9px] text-mute">+{splits}</span>}
          </button>
        );
      })}
    </>
  );
}

function firstEmptyCell(
  athleteIds: string[],
  block: WorkoutBlock,
  logs: TimeLog[],
  workoutId: string,
): CellRef {
  const inners = flattenInner(block);
  const total = totalReps(block);
  for (const athleteId of athleteIds) {
    for (let rep = 1; rep <= total; rep += 1) {
      const split = splitRepNumber(rep, inners.length || 1);
      const inner = inners[split.innerRep - 1];
      if (inner && !needsClockTime(inner.intensity)) continue;
      const existing = logs.find(
        (log) =>
          log.workoutId === workoutId &&
          log.blockId === block.id &&
          log.athleteId === athleteId &&
          log.repNumber === rep,
      );
      if (!logHasTime(existing)) return { athleteId, blockId: block.id, repNumber: rep };
    }
  }
  return { athleteId: athleteIds[0], blockId: block.id, repNumber: 1 };
}
