"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

type Phase = "idle" | "showing" | "input" | "over";

interface Pad {
  name: string;
  emoji: string;
  gradient: string;
}

const PADS: Pad[] = [
  { name: "Red", emoji: "🔴", gradient: "from-pink-400 via-rose-500 to-red-400" },
  { name: "Yellow", emoji: "🟡", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
  { name: "Blue", emoji: "🔵", gradient: "from-sky-400 via-blue-500 to-indigo-600" },
  { name: "Green", emoji: "🟢", gradient: "from-teal-400 via-emerald-500 to-green-600" },
];

/** Every 5 steps the flashes get quicker. */
function timings(length: number) {
  const level = Math.floor(length / 5);
  return {
    flash: Math.max(150, 350 - level * 35),
    gap: Math.max(70, 150 - level * 15),
  };
}

export default function ColorEcho({ gameId }: { gameId: string }) {
  const [seq, setSeq] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lit, setLit] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  // playback — every pad gets its own timeout, all of them cancelled on cleanup
  useEffect(() => {
    if (phase !== "showing") return;
    if (flashTimer.current) {
      clearTimeout(flashTimer.current);
      flashTimer.current = null;
    }
    const { flash, gap } = timings(seq.length);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    seq.forEach((pad, i) => {
      const at = i * (flash + gap);
      timers.push(setTimeout(() => !cancelled && setLit(pad), at));
      timers.push(setTimeout(() => !cancelled && setLit(null), at + flash));
    });
    timers.push(
      setTimeout(
        () => {
          if (cancelled) return;
          setLit(null);
          setStep(0);
          setPhase("input");
        },
        seq.length * (flash + gap),
      ),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [phase, seq]);

  const start = useCallback(() => {
    setSeq([Math.floor(Math.random() * 4)]);
    setScore(0);
    setStep(0);
    setLit(null);
    setNewBest(false);
    setPhase("showing");
  }, []);

  const tap = useCallback(
    (pad: number) => {
      if (phase !== "input") return;
      if (pad !== seq[step]) {
        setPhase("over");
        setNewBest(submit(score));
        return;
      }
      // little flash under the finger
      setLit(pad);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setLit(null), 170);

      if (step + 1 < seq.length) {
        setStep(step + 1);
        return;
      }
      // chain complete — one more random pad joins it
      const nextPad = Math.floor(Math.random() * 4);
      setScore(score + 1);
      setStep(0);
      setSeq((prev) => [...prev, nextPad]);
      setPhase("showing");
    },
    [phase, seq, step, score, submit],
  );

  const level = Math.floor(seq.length / 5) + 1;

  return (
    <div className="w-full max-w-[420px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-accent">
          Length <b className="ml-1 text-sm text-ink">{seq.length}</b>
        </span>
        <span className="text-warn">
          Speed <b className="ml-1 text-sm text-ink">{level}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(244,114,182,0.9)]">
        <div className="grid grid-cols-2 gap-3">
          {PADS.map((p, i) => (
            <button
              key={p.name}
              type="button"
              onClick={() => tap(i)}
              disabled={phase !== "input"}
              aria-label={`${p.name} pad`}
              className={cn(
                "grid aspect-square place-items-center rounded-2xl bg-gradient-to-br transition active:scale-95",
                p.gradient,
                lit === i
                  ? "scale-105 brightness-125 ring-4 ring-white/80"
                  : "brightness-[0.55]",
              )}
            >
              <span className="text-4xl sm:text-5xl">{p.emoji}</span>
            </button>
          ))}
        </div>

        {/* progress + status */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap gap-1.5">
            {seq.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 w-2 rounded-full transition",
                  phase === "input" && i < step ? "bg-cyan-400" : "bg-line",
                )}
              />
            ))}
          </div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
            {phase === "showing" ? "Watch…" : phase === "input" ? "Your turn" : "Ready"}
          </span>
        </div>

        {phase === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">COLOR ECHO</p>
            <p className="mt-2 text-sm text-muted">
              Watch the pads light up, then repeat the chain.
            </p>
            <PrimaryButton onClick={start} tone="from-pink-400 via-rose-500 to-red-400">
              Play
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              One new pad every round · the flashes speed up every 5
            </p>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">WRONG PAD</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New longest chain!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              sequences · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-pink-400 via-rose-500 to-red-400">
              Try again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Repeat the sequence · best = longest chain you can hold
      </p>
    </div>
  );
}
