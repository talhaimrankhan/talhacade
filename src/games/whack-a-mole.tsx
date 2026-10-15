"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const ROUND_SECONDS = 30;
const CELLS = 9;

type Phase = "idle" | "playing" | "over";

interface Pop {
  cell: number;
  text: string;
  tone: string;
  id: number;
}

export default function WhackAMole({ gameId }: { gameId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [active, setActive] = useState<number | null>(null);
  const [isBomb, setIsBomb] = useState(false);
  const [pops, setPops] = useState<Pop[]>([]);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const scoreRef = useRef(0);
  const timeRef = useRef(ROUND_SECONDS);
  const popId = useRef(0);
  const lastCell = useRef(-1);

  const pushPop = useCallback((cell: number, text: string, tone: string) => {
    const id = ++popId.current;
    setPops((prev) => [...prev, { cell, text, tone, id }]);
    setTimeout(() => {
      setPops((prev) => prev.filter((p) => p.id !== id));
    }, 700);
  }, []);

  const start = useCallback(() => {
    scoreRef.current = 0;
    timeRef.current = ROUND_SECONDS;
    lastCell.current = -1;
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setActive(null);
    setPops([]);
    setNewBest(false);
    setPhase("playing");
  }, []);

  // countdown — state updates live in the interval callback, not the effect body
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const next = Math.max(0, timeRef.current - 1);
      timeRef.current = next;
      setTimeLeft(next);
      if (next === 0) {
        setPhase("over");
        setNewBest(submit(scoreRef.current));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, submit]);

  // mole pop-ups — speed up as the round burns on
  useEffect(() => {
    if (phase !== "playing") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        if (cancelled) return;
        let next = Math.floor(Math.random() * CELLS);
        while (next === lastCell.current) {
          next = Math.floor(Math.random() * CELLS);
        }
        lastCell.current = next;
        setActive(next);
        setIsBomb(Math.random() < 0.24);

        const elapsed = ROUND_SECONDS - timeLeft;
        const nextDelay = Math.max(430, 720 - elapsed * 9);
        schedule(nextDelay);
      }, delay);
    };

    schedule(450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, timeLeft]);

  // hide the target briefly after every whack so double-taps can't stack
  const whack = (cell: number) => {
    if (phase !== "playing" || cell !== active) return;

    if (isBomb) {
      const next = Math.max(0, scoreRef.current - 2);
      scoreRef.current = next;
      setScore(next);
      pushPop(cell, "−2", "text-rose-400");
    } else {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      pushPop(cell, "+1", "text-emerald-400");
    }
    setActive(null);
  };

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-accent">
          Time{" "}
          <b
            className={cn(
              "ml-1 text-sm tabular-nums",
              timeLeft <= 5 && phase === "playing" ? "text-rose-400" : "text-ink",
            )}
          >
            {timeLeft}s
          </b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(244,114,182,0.8)]">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {Array.from({ length: CELLS }, (_, cell) => {
            const isActive = cell === active;
            return (
              <button
                key={cell}
                type="button"
                onClick={() => whack(cell)}
                aria-label={`Hole ${cell + 1}`}
                className="relative grid aspect-square place-items-center rounded-2xl border border-line bg-gradient-to-b from-[#191931] to-[#10101f] transition hover:border-primary/40"
              >
                {/* the hole */}
                <span className="absolute h-[42%] w-[58%] translate-y-[26%] rounded-[50%] bg-black/70 shadow-[inset_0_4px_10px_rgba(0,0,0,0.9)]" />
                {isActive && (
                  <span
                    className={cn(
                      "relative z-10 animate-pop text-4xl sm:text-5xl",
                      isBomb && "rotate-12",
                    )}
                  >
                    {isBomb ? "💣" : "🐹"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* floating score pops */}
        {pops.map((pop) => (
          <span
            key={pop.id}
            style={{
              left: `${((pop.cell % 3) + 0.5) * 33.333}%`,
              top: `${(Math.floor(pop.cell / 3) + 0.4) * 33.333}%`,
            }}
            className={cn(
              "animate-pop pointer-events-none absolute z-20 -translate-x-1/2 font-display text-xl font-bold drop-shadow",
              pop.tone,
            )}
          >
            {pop.text}
          </span>
        ))}

        {phase === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              WHACK-A-MOLE
            </p>
            <p className="mt-2 text-sm text-muted">
              🐹 = +1 · 💣 = −2 · 30 seconds on the clock
            </p>
            <PrimaryButton onClick={start} tone="from-rose-400 to-fuchsia-500">
              Start game
            </PrimaryButton>
          </Overlay>
        )}

        {phase === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              TIME&apos;S UP
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {score}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-rose-400 to-fuchsia-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Bonk the mole the instant it pops — never the bomb
      </p>
    </div>
  );
}
