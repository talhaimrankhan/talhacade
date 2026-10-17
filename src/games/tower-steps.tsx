"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const COUNTS = [3, 4, 5, 6, 7, 8];

/** Literal Tailwind colors — one per disc size, bottom disc first. */
const DISC_STYLES = [
  "bg-rose-500 border-rose-700",
  "bg-amber-400 border-amber-600",
  "bg-cyan-400 border-cyan-600",
  "bg-emerald-500 border-emerald-700",
  "bg-violet-500 border-violet-700",
  "bg-sky-500 border-sky-700",
  "bg-fuchsia-500 border-fuchsia-700",
  "bg-lime-400 border-lime-600",
];

interface Move {
  from: number;
  to: number;
}

/** Pegs are arrays ordered bottom → top, biggest disc first. */
function initialPegs(n: number): number[][] {
  const stack: number[] = [];
  for (let d = n; d >= 1; d--) stack.push(d);
  return [stack, [], []];
}

export default function TowerSteps({ gameId }: { gameId: string }) {
  const [count, setCount] = useState(5);
  const [pegs, setPegs] = useState<number[][]>(() => initialPegs(5));
  const [held, setHeld] = useState<number | null>(null);
  const [heldFrom, setHeldFrom] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<Move[]>([]);
  const [won, setWon] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [shakePeg, setShakePeg] = useState(-1);
  const [jitter, setJitter] = useState(0);

  const { best, submit } = useBestScore(`${gameId}:${count}`, "low");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  /** Brief left-right jitter so rejected moves read instantly. */
  const shake = useCallback(
    (peg: number) => {
      clearTimers();
      setShakePeg(peg);
      [-9, 9, -6, 6, 0].forEach((dx, i) => {
        timers.current.push(setTimeout(() => setJitter(dx), i * 55));
      });
    },
    [clearTimers],
  );

  const restart = useCallback(
    (n: number) => {
      clearTimers();
      setCount(n);
      setPegs(initialPegs(n));
      setHeld(null);
      setHeldFrom(null);
      setMoves(0);
      setHistory([]);
      setWon(false);
      setNewBest(false);
      setShakePeg(-1);
      setJitter(0);
    },
    [clearTimers],
  );

  const act = useCallback(
    (peg: number) => {
      if (won) return;

      // Empty hand → lift the top disc.
      if (held === null) {
        const stack = pegs[peg];
        if (stack.length === 0) {
          shake(peg);
          return;
        }
        setHeld(stack[stack.length - 1]);
        setHeldFrom(peg);
        return;
      }

      const from = heldFrom;
      // Clicking the source peg again puts the disc back down.
      if (from === null || from === peg) {
        setHeld(null);
        setHeldFrom(null);
        return;
      }

      const top = pegs[peg][pegs[peg].length - 1];
      if (top !== undefined && held > top) {
        shake(peg);
        return;
      }

      const next = pegs.map((stack) => [...stack]);
      if (from !== null) next[from] = next[from].slice(0, -1);
      next[peg] = [...next[peg], held];
      const nextMoves = moves + 1;

      setPegs(next);
      setHeld(null);
      setHeldFrom(null);
      setMoves(nextMoves);
      setHistory((h) => [...h, { from, to: peg }]);

      if (next[2].length === count) {
        setWon(true);
        setNewBest(submit(nextMoves));
      }
    },
    [pegs, held, heldFrom, moves, won, count, shake, submit],
  );

  const undo = useCallback(() => {
    if (won || history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPegs((prev) => {
      const source = prev[last.to];
      const disc = source[source.length - 1];
      if (disc === undefined) return prev;
      const next = prev.map((stack) => [...stack]);
      next[last.to] = source.slice(0, -1);
      next[last.from] = [...next[last.from], disc];
      return next;
    });
    setMoves((m) => Math.max(0, m - 1));
    setHeld(null);
    setHeldFrom(null);
  }, [history, won]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        e.preventDefault();
        act(Number(e.key) - 1);
      } else if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        undo();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        restart(count);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, undo, restart, count]);

  const optimal = 2 ** count - 1;
  const aboveOptimal = moves > optimal;
  const widthFor = (d: number) =>
    `${44 + ((d - 1) / Math.max(count - 1, 1)) * 54}%`;

  return (
    <div className="w-full max-w-[520px]">
      <GameHud
        score={`${moves} ${moves === 1 ? "move" : "moves"}`}
        best={best === null ? "—" : `${best}`}
      >
        <span className={aboveOptimal ? "text-rose-400" : "text-accent"}>
          Optimal{" "}
          <b className="ml-1 text-sm text-ink tabular-nums">{optimal}</b>
        </span>
        <button
          type="button"
          onClick={undo}
          disabled={history.length === 0 || won}
          className="rounded-md border border-line px-2 py-1 text-ink transition hover:border-primary/60 hover:bg-surface-2 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => restart(count)}
          className="rounded-md border border-line px-2 py-1 text-ink transition hover:border-primary/60 hover:bg-surface-2"
        >
          Restart
        </button>
      </GameHud>

      <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted">
        <span className="mr-1">Discs</span>
        {COUNTS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => restart(n)}
            aria-label={`Play with ${n} discs`}
            aria-pressed={n === count}
            className={cn(
              "h-7 w-7 rounded-lg border text-sm transition",
              n === count
                ? "border-primary bg-primary/20 text-ink"
                : "border-line bg-[#131322] text-muted hover:border-primary/50 hover:text-ink",
            )}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(56,189,248,0.7)]">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {pegs.map((stack, i) => {
            const lifting = heldFrom === i && held !== null;
            const visible = lifting ? stack.slice(0, -1) : stack;
            return (
              <button
                key={i}
                type="button"
                onClick={() => act(i)}
                aria-label={`Peg ${i + 1}, ${stack.length} discs${
                  lifting ? ", holding a disc" : ""
                }${held !== null ? ", tap to place" : ""}`}
                className={cn(
                  "relative flex h-[260px] flex-col-reverse items-center justify-start gap-1.5 rounded-2xl border px-2 pt-12 pb-6 transition",
                  heldFrom === i
                    ? "border-primary/70 bg-[#191933]"
                    : "border-line bg-[#131322] hover:border-primary/50",
                )}
                style={{
                  transform:
                    shakePeg === i ? `translateX(${jitter}px)` : undefined,
                }}
              >
                <span
                  className="absolute inset-x-3 bottom-3 h-2 rounded-full bg-surface-2"
                  aria-hidden
                />
                <span
                  className="absolute bottom-4 left-1/2 top-3 w-1.5 -translate-x-1/2 rounded-full bg-[#232342]"
                  aria-hidden
                />
                {visible.map((d) => (
                  <span
                    key={d}
                    style={{ width: widthFor(d) }}
                    className={cn(
                      "relative z-10 h-7 rounded-lg border-2 shadow-[0_3px_0_rgba(0,0,0,0.35)]",
                      DISC_STYLES[(d - 1) % DISC_STYLES.length],
                    )}
                  />
                ))}
                {lifting && (
                  <span
                    style={{ width: widthFor(held) }}
                    className={cn(
                      "animate-pop relative z-10 mb-4 h-7 rounded-lg border-2 ring-2 ring-white/70",
                      DISC_STYLES[(held - 1) % DISC_STYLES.length],
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-4">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className="text-center font-mono text-[10px] uppercase tracking-widest text-muted"
            >
              Peg {n}
            </span>
          ))}
        </div>

        {won && (
          <Overlay>
            <p className="text-4xl">🗼</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              TOWER COMPLETE
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fewest moves!
              </p>
            )}
            <p className="mt-3 font-mono text-3xl font-bold text-white tabular-nums">
              {moves} moves
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Optimal {optimal} · Best {best === null ? "—" : best} on{" "}
              {count} discs
            </p>
            <PrimaryButton
              onClick={() => restart(count)}
              tone="from-sky-400 via-blue-500 to-indigo-600"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a peg to lift its top disc, tap another to place · keys 1 2 3 · Z
        undo · R restart
      </p>
    </div>
  );
}
