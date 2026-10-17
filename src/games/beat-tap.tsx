"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

interface Note {
  id: number;
  timeMs: number;
  lane: number;
}

interface Track {
  key: string;
  name: string;
  bpm: number;
  seconds: number;
  pattern: number[]; // deterministic lane order
}

const TRACKS: Track[] = [
  { key: "groove", name: "Groove", bpm: 120, seconds: 60, pattern: [0, 1, 2, 3, 2, 1] },
  { key: "sprint", name: "Sprint", bpm: 140, seconds: 60, pattern: [0, 2, 1, 3, 0, 3, 1, 2] },
];

const LANE_KEYS = ["d", "f", "j", "k"];
const LANE_TONES = ["text-cyan-400", "text-violet-400", "text-rose-400", "text-amber-400"];
const LANE_BARS = ["bg-cyan-400", "bg-violet-400", "bg-rose-400", "bg-amber-400"];
const LANE_LINES = ["border-cyan-400/50", "border-violet-400/50", "border-rose-400/50", "border-amber-400/50"];

const PLAY_H = 340;
const NOTE_H = 26;
const TRAVEL_MS = 2000; // how long a note is visible before it hits the line
const LEAD_IN_MS = 2500;
const PERFECT_MS = 60;
const GOOD_MS = 120;

type Phase = "idle" | "playing" | "over";

interface Frame {
  notes: { id: number; lane: number; y: number }[];
  pct: number;
}

/** Deterministic chart: one note per beat (every other beat on Easy). */
function buildTrack(track: Track, hard: boolean): Note[] {
  const beat = 60000 / track.bpm;
  const notes: Note[] = [];
  for (let i = 0; i * beat < (track.seconds - 2) * 1000; i++) {
    if (!hard && i % 2 !== 0) continue;
    notes.push({
      id: i,
      timeMs: Math.round(i * beat + LEAD_IN_MS),
      lane: track.pattern[i % track.pattern.length],
    });
  }
  return notes;
}

export default function BeatTap({ gameId }: { gameId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [frame, setFrame] = useState<Frame | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [counts, setCounts] = useState({ perfect: 0, good: 0, miss: 0 });
  const [fx, setFx] = useState<{ id: number; lane: number; tone: string } | null>(null);
  const [trackIdx, setTrackIdx] = useState(0);
  const [hard, setHard] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const notesRef = useRef<Note[]>([]);
  const startRef = useRef(0);
  const durationRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const countsRef = useRef({ perfect: 0, good: 0, miss: 0 });
  const fxId = useRef(0);
  const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (fxTimer.current) clearTimeout(fxTimer.current);
    },
    [],
  );

  const start = useCallback(() => {
    const track = TRACKS[trackIdx];
    notesRef.current = buildTrack(track, hard);
    startRef.current = performance.now();
    durationRef.current = track.seconds * 1000;
    scoreRef.current = 0;
    comboRef.current = 0;
    countsRef.current = { perfect: 0, good: 0, miss: 0 };
    setScore(0);
    setCombo(0);
    setCounts({ perfect: 0, good: 0, miss: 0 });
    setFrame(null);
    setFx(null);
    setNewBest(false);
    setPhase("playing");
  }, [trackIdx, hard]);

  const hit = useCallback(
    (lane: number) => {
      if (phase !== "playing") return;
      const elapsed = performance.now() - startRef.current;
      const list = notesRef.current;
      let pick = -1;
      let delta = Infinity;
      for (let i = 0; i < list.length; i++) {
        if (list[i].lane !== lane) continue;
        const d = Math.abs(elapsed - list[i].timeMs);
        if (d <= GOOD_MS && d < delta) {
          delta = d;
          pick = i;
        }
      }
      if (pick === -1) return;
      const perfect = delta <= PERFECT_MS;
      list.splice(pick, 1);
      comboRef.current += 1;
      const mult = Math.min(3, 1 + Math.floor(comboRef.current / 10));
      scoreRef.current += (perfect ? 300 : 100) * mult;
      countsRef.current[perfect ? "perfect" : "good"] += 1;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      setCounts({ ...countsRef.current });
      setFx({ id: ++fxId.current, lane, tone: perfect ? "PERFECT" : "GOOD" });
      if (fxTimer.current) clearTimeout(fxTimer.current);
      fxTimer.current = setTimeout(() => setFx(null), 260);
    },
    [phase],
  );

  // falling notes + misses, all driven by performance.now() offsets
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const loop = () => {
      const elapsed = performance.now() - startRef.current;
      const list = notesRef.current;

      while (list.length && elapsed - list[0].timeMs > GOOD_MS) {
        list.shift();
        countsRef.current.miss += 1;
        comboRef.current = 0;
        setCombo(0);
        setCounts({ ...countsRef.current });
      }

      const notes: Frame["notes"] = [];
      for (const n of list) {
        const d = n.timeMs - elapsed;
        if (d > TRAVEL_MS || d < -GOOD_MS) continue;
        notes.push({ id: n.id, lane: n.lane, y: (1 - d / TRAVEL_MS) * PLAY_H });
      }
      setFrame({ notes, pct: Math.min(1, elapsed / durationRef.current) });

      if (!list.length && elapsed > durationRef.current) {
        setPhase("over");
        setNewBest(submit(scoreRef.current));
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, submit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const lane = LANE_KEYS.indexOf(e.key.toLowerCase());
      if (lane >= 0) {
        e.preventDefault();
        hit(lane);
        return;
      }
      if ((e.key === " " || e.key === "Enter") && phase !== "playing") {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hit, phase, start]);

  const mult = Math.min(3, 1 + Math.floor(combo / 10));
  const pickBtn =
    "rounded-lg border px-2 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition";

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-accent">
          Combo <b className="ml-1 text-sm text-ink">{combo}</b>
          <b className="ml-1 text-warn">×{mult}</b>
        </span>
      </GameHud>

      <div className="rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(34,211,238,0.9)]">
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface">
          <div
            style={{ width: `${(frame?.pct ?? 0) * 100}%` }}
            className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600"
          />
        </div>

        <div
          className="relative overflow-hidden rounded-xl border border-line bg-[#0b0b16]"
          style={{ height: PLAY_H }}
          aria-label="Beat Tap play field"
        >
          {LANE_TONES.map((tone, i) => (
            <span
              key={i}
              style={{ left: `${i * 25}%` }}
              className={cn("pointer-events-none absolute inset-y-0 w-px border-l", LANE_LINES[i])}
            />
          ))}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-cyan-400" />

          {frame?.notes.map((n) => (
            <span
              key={n.id}
              style={{ left: `calc(${n.lane * 25}% + 6px)`, top: n.y - NOTE_H, width: "calc(25% - 12px)", height: NOTE_H }}
              className={cn("absolute rounded-md shadow-lg", LANE_BARS[n.lane])}
            />
          ))}

          {fx && (
            <span
              key={fx.id}
              style={{ left: `${fx.lane * 25}%`, width: "25%" }}
              className={cn(
                "animate-pop pointer-events-none absolute bottom-2 text-center font-display text-sm font-bold",
                fx.tone === "PERFECT" ? "text-warn" : "text-cyan-300",
              )}
            >
              {fx.tone}
            </span>
          )}

          {phase === "idle" && (
            <Overlay>
              <p className="font-display text-2xl font-bold text-white">BEAT TAP</p>
              <div className="mt-3 flex justify-center gap-1.5">
                {TRACKS.map((t, i) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTrackIdx(i)}
                    aria-pressed={trackIdx === i}
                    className={cn(
                      pickBtn,
                      trackIdx === i
                        ? "border-cyan-400/70 bg-cyan-400/10 text-cyan-300"
                        : "border-line bg-surface text-muted",
                    )}
                  >
                    {t.name} {t.bpm}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHard(false)}
                  aria-pressed={!hard}
                  className={cn(
                    pickBtn,
                    !hard
                      ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-300"
                      : "border-line bg-surface text-muted",
                  )}
                >
                  Easy
                </button>
                <button
                  type="button"
                  onClick={() => setHard(true)}
                  aria-pressed={hard}
                  className={cn(
                    pickBtn,
                    hard
                      ? "border-rose-400/70 bg-rose-400/10 text-rose-300"
                      : "border-line bg-surface text-muted",
                  )}
                >
                  Normal
                </button>
              </div>
              <PrimaryButton onClick={start} tone="from-emerald-400 via-teal-500 to-cyan-600">
                Drop the beat
              </PrimaryButton>
              <p className="mt-3 text-xs text-muted">D F J K — or tap the pads</p>
            </Overlay>
          )}

          {phase === "over" && (
            <Overlay>
              <p className="font-display text-2xl font-bold text-white">TRACK CLEARED</p>
              {newBest && (
                <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                  ✦ New high score!
                </p>
              )}
              <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
              <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
                <span className="text-warn">Perfect {counts.perfect}</span>
                {" · "}
                <span className="text-cyan-300">Good {counts.good}</span>
                {" · "}
                <span className="text-rose-400">Miss {counts.miss}</span>
              </p>
              <PrimaryButton onClick={start} tone="from-emerald-400 via-teal-500 to-cyan-600">
                Replay
              </PrimaryButton>
            </Overlay>
          )}
        </div>

        <div className="touch-none mt-2 grid select-none grid-cols-4 gap-2">
          {LANE_KEYS.map((k, i) => (
            <button
              key={k}
              type="button"
              onPointerDown={() => hit(i)}
              aria-label={`Lane ${i + 1} — key ${k.toUpperCase()}`}
              className={cn(
                "rounded-xl border bg-surface py-3 font-mono text-lg font-bold transition active:scale-95",
                LANE_LINES[i],
                LANE_TONES[i],
                fx?.lane === i && "bg-surface-2 ring-2 ring-current",
              )}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Hit the line on the beat · perfect ±60ms · combo multiplies up to ×3
      </p>
    </div>
  );
}
