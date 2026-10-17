"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

const START_ROWS = [1, 3, 5];

type Outcome = "playing" | "won" | "lost";
type Difficulty = "perfect" | "beatable";

interface Series {
  you: number;
  cpu: number;
}

interface Take {
  row: number;
  count: number;
}

function randomMove(rows: number[]): Take {
  const moves: Take[] = [];
  rows.forEach((n, row) => {
    for (let c = 1; c <= n; c++) moves.push({ row, count: c });
  });
  return moves[Math.floor(Math.random() * moves.length)];
}

/** Perfect Nim: leave a zero nim-sum, or null when it is already zero. */
function optimalMove(rows: number[]): Take | null {
  const xor = rows.reduce((a, b) => a ^ b, 0);
  if (xor === 0) return null;
  for (let row = 0; row < rows.length; row++) {
    const target = rows[row] ^ xor;
    if (target < rows[row]) return { row, count: rows[row] - target };
  }
  return null;
}

function cpuChoose(rows: number[], difficulty: Difficulty): Take {
  const best = optimalMove(rows);
  if (difficulty === "perfect") return best ?? randomMove(rows);
  // Beatable mode: mostly random, but 30% of the time it finds the killer move.
  if (best && Math.random() < 0.3) return best;
  return randomMove(rows);
}

export default function Nim({ gameId }: { gameId: string }) {
  const [rows, setRows] = useState<number[]>(() => [...START_ROWS]);
  const [outcome, setOutcome] = useState<Outcome>("playing");
  const [pick, setPick] = useState<Take | null>(null);
  const [thinking, setThinking] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("beatable");
  const [newBest, setNewBest] = useState(false);
  const [series, setSeries] = useStored<Series>(`series:${gameId}`, {
    you: 0,
    cpu: 0,
  });
  const { best, submit } = useBestScore(gameId, "high");
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seriesRef = useRef<Series>(series);
  useEffect(() => {
    seriesRef.current = series;
  }, [series]);

  useEffect(
    () => () => {
      if (cpuTimer.current) clearTimeout(cpuTimer.current);
    },
    [],
  );

  const finish = useCallback(
    (winner: "you" | "cpu") => {
      setOutcome(winner === "you" ? "won" : "lost");
      if (winner === "you") {
        const updated = {
          ...seriesRef.current,
          you: seriesRef.current.you + 1,
        };
        seriesRef.current = updated;
        setSeries(updated);
        setNewBest(submit(updated.you));
      } else {
        const updated = {
          ...seriesRef.current,
          cpu: seriesRef.current.cpu + 1,
        };
        seriesRef.current = updated;
        setSeries(updated);
      }
    },
    [setSeries, submit],
  );

  const confirmTake = () => {
    if (!pick || outcome !== "playing" || thinking) return;

    const next = rows.map((n, i) => (i === pick.row ? n - pick.count : n));
    setRows(next);
    setPick(null);
    if (next.every((n) => n === 0)) {
      finish("you");
      return;
    }

    setThinking(true);
    cpuTimer.current = setTimeout(() => {
      const take = cpuChoose(next, difficulty);
      const reply = next.map((n, i) => (i === take.row ? n - take.count : n));
      setRows(reply);
      setThinking(false);
      if (reply.every((n) => n === 0)) finish("cpu");
    }, 480);
  };

  const clickStick = (row: number, index: number) => {
    if (outcome !== "playing" || thinking) return;
    const count = rows[row] - index;
    if (pick && pick.row === row && pick.count === count) {
      setPick(null);
      return;
    }
    setPick({ row, count });
  };

  const newGame = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setRows([...START_ROWS]);
    setOutcome("playing");
    setPick(null);
    setThinking(false);
    setNewBest(false);
  }, []);

  const statusText =
    outcome === "won"
      ? "You took the last stick! 🎉"
      : outcome === "lost"
        ? "The CPU took the last stick 🤖"
        : thinking
          ? "CPU is thinking…"
          : pick
            ? `Take ${pick.count} from row ${pick.row + 1}?`
            : "Click a stick to select your take";

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-xs uppercase tracking-wider">
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-center text-cyan-300">
          You <b className="ml-1 text-sm text-ink">{series.you}</b>
        </div>
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-center text-rose-300">
          CPU <b className="ml-1 text-sm text-ink">{series.cpu}</b>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Difficulty
        </span>
        <div className="flex gap-1.5">
          {(["beatable", "perfect"] as Difficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              aria-pressed={difficulty === d}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition",
                difficulty === d
                  ? "bg-amber-500 text-black shadow-[0_0_18px_-6px_rgba(245,158,11,0.9)]"
                  : "border border-line text-muted hover:text-ink",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(245,158,11,0.8)]">
        <div className="flex flex-col gap-4">
          {rows.map((count, row) => (
            <div key={row} className="flex items-center gap-3">
              <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted">
                Row {row + 1}
              </span>
              <div className="flex flex-1 flex-wrap items-center gap-1.5">
                {Array.from({ length: count }, (_, i) => {
                  const selected =
                    pick !== null && pick.row === row && i >= count - pick.count;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => clickStick(row, i)}
                      disabled={outcome !== "playing" || thinking}
                      aria-label={`Row ${row + 1}, stick ${i + 1} of ${count}${
                        selected ? ", selected" : ""
                      }`}
                      aria-pressed={selected}
                      className={cn(
                        "h-11 w-4 rounded-full border transition active:scale-90",
                        selected
                          ? "border-cyan-300 bg-gradient-to-b from-cyan-300 to-sky-600 shadow-[0_0_16px_-4px_rgba(34,211,238,0.9)]"
                          : "border-amber-500/40 bg-gradient-to-b from-amber-400 to-orange-600 hover:brightness-110",
                        (outcome !== "playing" || thinking) &&
                          "cursor-not-allowed opacity-60",
                      )}
                    />
                  );
                })}
              </div>
              <span className="w-6 shrink-0 text-right font-mono text-xs text-muted">
                {count}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={confirmTake}
          disabled={!pick || outcome !== "playing" || thinking}
          className={cn(
            "mt-5 w-full rounded-full px-5 py-2.5 text-sm font-bold transition active:scale-95",
            pick && outcome === "playing" && !thinking
              ? "bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 text-black shadow-lg hover:brightness-110"
              : "cursor-not-allowed border border-line bg-surface text-muted",
          )}
        >
          {pick ? `Confirm — take ${pick.count}` : "Confirm take"}
        </button>

        {outcome !== "playing" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {statusText}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ Most games won — new best!
              </p>
            )}
            <p className="mt-2 text-xs uppercase tracking-widest text-muted">
              All-time wins {best ?? 0} · Series {series.you}–{series.cpu}
            </p>
            <PrimaryButton onClick={newGame} tone="from-yellow-400 via-amber-500 to-orange-600">
              New game
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        {statusText}
        {" · "}
        grab every stick to win — the CPU reads the nim-sum
      </p>
    </div>
  );
}
