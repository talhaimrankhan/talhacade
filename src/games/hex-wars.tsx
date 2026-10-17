"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay, PrimaryButton } from "@/games/parts";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";

type Outcome = "playing" | "won" | "lost" | "draw";

interface Series {
  you: number;
  draws: number;
  cpu: number;
}

const N = 9;
const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

/** odd-r offset neighbours, computed once at module load. */
const NEIGHBORS: number[][] = buildNeighbors();

function buildNeighbors(): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const deltas =
        r % 2 === 1
          ? [
              [0, -1],
              [0, 1],
              [-1, 0],
              [-1, 1],
              [1, 0],
              [1, 1],
            ]
          : [
              [0, -1],
              [0, 1],
              [-1, -1],
              [-1, 0],
              [1, -1],
              [1, 0],
            ];
      const list: number[] = [];
      for (const [dr, dc] of deltas) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N) list.push(nr * N + nc);
      }
      out.push(list);
    }
  }
  return out;
}

/** Flood fill: does `player` already link its two opposing edges? */
function reaches(board: number[], player: 1 | 2): boolean {
  const seen = new Set<number>();
  const stack: number[] = [];
  for (let i = 0; i < N * N; i++) {
    if (board[i] !== player) continue;
    const r = Math.floor(i / N);
    const c = i % N;
    const onStart = player === 1 ? c === 0 : r === 0;
    if (onStart) {
      stack.push(i);
      seen.add(i);
    }
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const r = Math.floor(i / N);
    const c = i % N;
    const onGoal = player === 1 ? c === N - 1 : r === N - 1;
    if (onGoal) return true;
    for (const n of NEIGHBORS[i]) {
      if (board[n] === player && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return false;
}

/**
 * Greedy one-ply read: immediate win > immediate block > sum of friendly
 * neighbours weighted by distance to the goal edge, plus edge control.
 */
function cellScore(board: number[], i: number): number {
  const r = Math.floor(i / N);
  const c = i % N;

  const probe = [...board];
  probe[i] = 2;
  if (reaches(probe, 2)) return 1_000_000;
  probe[i] = 1;
  if (reaches(probe, 1)) return 500_000;

  let score = 0;
  for (const n of NEIGHBORS[i]) {
    const nr = Math.floor(n / N);
    const nc = n % N;
    if (board[n] === 2) score += 2 + nr; // grow my chain downward
    else if (board[n] === 1) score += 1.6 + nc; // cut their rightward push
  }

  if (r === 0) score += 10; // secure my top anchor
  if (r === N - 1) score += 14; // secure my goal edge
  if (c === 0) score += 6; // deny their anchor
  if (c === N - 1) score += 6; // deny their goal edge
  score += (4 - Math.abs(c - 4)) * 0.4; // slight centre bias
  return score;
}

function cpuPick(board: number[]): number {
  let pick = -1;
  let best = -Infinity;
  for (let i = 0; i < N * N; i++) {
    if (board[i]) continue;
    const score = cellScore(board, i);
    if (score > best) {
      best = score;
      pick = i;
    }
  }
  return pick;
}

export default function HexWars({ gameId }: { gameId: string }) {
  const [board, setBoard] = useState<number[]>(() => Array(N * N).fill(0));
  const [outcome, setOutcome] = useState<Outcome>("playing");
  const [thinking, setThinking] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [series, setSeries] = useStored<Series>(`series:${gameId}`, {
    you: 0,
    draws: 0,
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
    (result: "won" | "lost" | "draw") => {
      setOutcome(result);
      const s = seriesRef.current;
      const updated =
        result === "won"
          ? { ...s, you: s.you + 1 }
          : result === "lost"
            ? { ...s, cpu: s.cpu + 1 }
            : { ...s, draws: s.draws + 1 };
      seriesRef.current = updated;
      setSeries(updated);
      if (result === "won") setNewBest(submit(updated.you));
    },
    [setSeries, submit],
  );

  const play = (i: number) => {
    if (outcome !== "playing" || thinking || board[i] !== 0) return;

    const next = [...board];
    next[i] = 1;
    setBoard(next);

    if (reaches(next, 1)) {
      finish("won");
      return;
    }
    if (next.every((v) => v !== 0)) {
      finish("draw");
      return;
    }

    setThinking(true);
    cpuTimer.current = setTimeout(() => {
      const reply = [...next];
      const move = cpuPick(reply);
      if (move >= 0) reply[move] = 2;
      setBoard(reply);
      setThinking(false);
      if (reaches(reply, 2)) finish("lost");
      else if (reply.every((v) => v !== 0)) finish("draw");
    }, 440);
  };

  const newMatch = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setBoard(Array(N * N).fill(0));
    setOutcome("playing");
    setThinking(false);
    setNewBest(false);
  }, []);

  const statusText =
    outcome === "won"
      ? "Link complete! 🎉"
      : outcome === "lost"
        ? "CPU linked top to bottom 🤖"
        : outcome === "draw"
          ? "Board full — no link"
          : thinking
            ? "CPU is thinking…"
            : "Your stone — link left to right";

  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-3 grid grid-cols-3 gap-2 font-mono text-xs uppercase tracking-wider">
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-center text-cyan-300">
          You <b className="ml-1 text-sm text-ink">{series.you}</b>
        </div>
        <div className="rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-muted">
          Draw <b className="ml-1 text-sm text-ink">{series.draws}</b>
        </div>
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-center text-rose-300">
          CPU <b className="ml-1 text-sm text-ink">{series.cpu}</b>
        </div>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(34,211,238,0.8)]">
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-1.5 rounded-l-2xl bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-600"
        />
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-1.5 rounded-r-2xl bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-600"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl bg-gradient-to-r from-pink-400 via-rose-500 to-red-400"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1.5 rounded-b-2xl bg-gradient-to-r from-pink-400 via-rose-500 to-red-400"
        />

        <div className="flex flex-col items-center px-2 py-2">
          {Array.from({ length: N }, (_, r) => (
            <div
              key={r}
              className="flex"
              style={{
                marginTop: r === 0 ? 0 : -10,
                transform: r % 2 === 1 ? "translateX(17px)" : undefined,
              }}
            >
              {Array.from({ length: N }, (_, c) => {
                const i = r * N + c;
                const v = board[i];
                const playable =
                  v === 0 && outcome === "playing" && !thinking;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => play(i)}
                    aria-label={`Row ${r + 1}, column ${c + 1}${
                      v === 1 ? ": your stone" : v === 2 ? ": CPU stone" : ""
                    }`}
                    disabled={!playable}
                    style={{ clipPath: HEX_CLIP }}
                    className={cn(
                      "grid h-[39px] w-[34px] place-items-center transition",
                      v === 1
                        ? "bg-cyan-500/35"
                        : v === 2
                          ? "bg-rose-500/35"
                          : "bg-[#12121f] hover:bg-cyan-500/20",
                      playable && "cursor-pointer",
                    )}
                  >
                    {v !== 0 && (
                      <span
                        className={cn(
                          "animate-pop h-[17px] w-[17px] rounded-full",
                          v === 1
                            ? "bg-cyan-300 shadow-[0_0_10px_2px_rgba(34,211,238,0.75)]"
                            : "bg-rose-300 shadow-[0_0_10px_2px_rgba(251,113,133,0.75)]",
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

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
              All-time wins {best ?? 0} · Series {series.you}–{series.draws}–
              {series.cpu}
            </p>
            <PrimaryButton
              onClick={newMatch}
              tone="from-cyan-400 via-sky-500 to-blue-600"
            >
              New match
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted">
        <span className="text-cyan-300">◀ you: left → right ▶</span>
        <span className="text-rose-300">▲ cpu: top → bottom ▼</span>
      </div>

      <p className="mt-1.5 text-center text-xs text-muted">
        {outcome === "playing"
          ? statusText
          : "Tap New match to clear the grid"}
        {" · "}
        first completed link wins
      </p>
      <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-muted">
        All-time games won {best ?? 0}
      </p>
    </div>
  );
}
