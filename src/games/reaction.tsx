"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const ROUNDS = 5;

type Phase = "idle" | "waiting" | "ready" | "roundend" | "toosoon" | "final";

export default function ReflexRush({ gameId }: { gameId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [times, setTimes] = useState<number[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "low");

  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealAt = useRef(0);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (waitTimer.current) clearTimeout(waitTimer.current);
    if (nextTimer.current) clearTimeout(nextTimer.current);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const beginRound = useCallback(() => {
    setPhase("waiting");
    const delay = 1200 + Math.random() * 2400;
    waitTimer.current = setTimeout(() => {
      revealAt.current = Date.now();
      setPhase("ready");
    }, delay);
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setTimes([]);
    setLastMs(null);
    setNewBest(false);
    beginRound();
  }, [clearTimers, beginRound]);

  const tap = useCallback(() => {
    if (phase === "waiting") {
      clearTimers();
      setPhase("toosoon");
      return;
    }
    if (phase === "toosoon") {
      beginRound();
      return;
    }
    if (phase === "ready") {
      const ms = Date.now() - revealAt.current;
      clearTimers();
      setLastMs(ms);
      const updated = [...times, ms];
      setTimes(updated);

      if (updated.length >= ROUNDS) {
        const average = Math.round(
          updated.reduce((a, b) => a + b, 0) / updated.length,
        );
        setNewBest(submit(average));
        setPhase("final");
      } else {
        setPhase("roundend");
        nextTimer.current = setTimeout(() => beginRound(), 850);
      }
      return;
    }
    if (phase === "idle" || phase === "final") start();
  }, [phase, times, clearTimers, beginRound, start, submit]);

  // how long the "wait" pad has been red / the user false-started
  const average =
    times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : null;

  const padTone: Record<Phase, string> = {
    idle: "from-violet-600 to-indigo-700",
    waiting: "from-rose-700 to-red-800",
    ready: "from-emerald-400 to-green-600",
    roundend: "from-cyan-500 to-sky-700",
    toosoon: "from-amber-500 to-orange-700",
    final: "from-violet-600 to-indigo-700",
  };

  const padLabel: Record<Phase, string> = {
    idle: "START",
    waiting: "WAIT…",
    ready: "TAP!",
    roundend: lastMs !== null ? `${lastMs} ms` : "…",
    toosoon: "TOO SOON — TAP TO RETRY",
    final: "RUN IT AGAIN",
  };

  return (
    <div className="w-full max-w-[520px]">
      <GameHud
        score={`${times.length}/${ROUNDS} rounds`}
        best={best === null ? "—" : `${best} ms`}
      >
        <span className="text-accent">
          Avg{" "}
          <b className="ml-1 text-sm text-ink tabular-nums">
            {average === null ? "—" : `${average} ms`}
          </b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(52,211,153,0.8)]">
        <button
          type="button"
          onClick={tap}
          className={`grid min-h-[300px] w-full place-items-center rounded-xl bg-gradient-to-br ${padTone[phase]} select-none transition active:scale-[0.99]`}
        >
          <span
            className={`px-6 text-center font-display text-4xl font-bold tracking-[0.18em] text-white drop-shadow-lg sm:text-5xl ${
              phase === "ready" ? "animate-pop" : ""
            }`}
          >
            {padLabel[phase]}
          </span>
        </button>

        {phase === "ready" && (
          <p className="pointer-events-none absolute inset-x-0 bottom-7 text-center text-xs font-bold uppercase tracking-[0.3em] text-white/90">
            Hit it!
          </p>
        )}

        {phase === "waiting" && (
          <p className="pointer-events-none absolute inset-x-0 bottom-7 text-center text-xs uppercase tracking-[0.3em] text-white/70">
            Wait for green…
          </p>
        )}

        {phase === "toosoon" && (
          <p className="pointer-events-none absolute inset-x-0 bottom-7 text-center text-xs uppercase tracking-[0.3em] text-white/90">
            False start — the clock resets
          </p>
        )}

        {phase === "final" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              REACTION TEST
            </p>
            <p className="mt-3 font-mono text-5xl font-bold text-gradient">
              {average} ms
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best average!
              </p>
            )}
            <div className="mt-4 flex justify-center gap-1.5">
              {times.map((ms, i) => (
                <span
                  key={i}
                  className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs text-muted"
                >
                  {ms}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best} ms`}
            </p>
            <PrimaryButton onClick={start} tone="from-lime-400 to-emerald-500">
              Test again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap the instant it turns green · {ROUNDS} rounds, averaged
      </p>
    </div>
  );
}
