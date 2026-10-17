"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

/* ------------------------------------------------------------------ */
/* Rules (pure)                                                        */
/* ------------------------------------------------------------------ */

const DOTS = 6; // 6x6 dots
const BOX = DOTS - 1; // 5x5 boxes
const H_EDGES = DOTS * BOX; // 30 horizontal edges
const V_EDGES = BOX * DOTS; // 30 vertical edges
const TOTAL_BOXES = BOX * BOX; // 25

/** h = horizontal edges (6 rows x 5) · v = vertical (5 rows x 6).
 *  Edge arrays: 0 undrawn · 1 drawn by you · 2 drawn by the CPU.
 *  boxes: 0 open · 1 yours · 2 CPU's */
interface DbState {
  h: number[];
  v: number[];
  boxes: number[];
}
interface Edge { kind: "h" | "v"; idx: number }
interface Series { you: number; draws: number; cpu: number }

const emptyState = (): DbState => ({
  h: Array(H_EDGES).fill(0),
  v: Array(V_EDGES).fill(0),
  boxes: Array(TOTAL_BOXES).fill(0),
});

const isFull = (s: DbState) => s.h.every((x) => x !== 0) && s.v.every((x) => x !== 0);

function sides(h: number[], v: number[], box: number): number {
  const r = Math.floor(box / BOX);
  const c = box % BOX;
  return (
    (h[r * BOX + c] ? 1 : 0) +
    (h[(r + 1) * BOX + c] ? 1 : 0) +
    (v[r * DOTS + c] ? 1 : 0) +
    (v[r * DOTS + c + 1] ? 1 : 0)
  );
}

/** Draws one edge and claims whatever it completes. */
function playEdge(
  s: DbState,
  kind: "h" | "v",
  idx: number,
  side: 1 | 2,
): { next: DbState; gained: number } {
  if ((kind === "h" ? s.h[idx] : s.v[idx]) !== 0) return { next: s, gained: 0 };
  const h = s.h.slice();
  const v = s.v.slice();
  if (kind === "h") h[idx] = side;
  else v[idx] = side;
  const boxes = s.boxes.slice();
  let gained = 0;
  for (let b = 0; b < TOTAL_BOXES; b++) {
    if (boxes[b] === 0 && sides(h, v, b) === 4) {
      boxes[b] = side;
      gained++;
    }
  }
  return { next: { h, v, boxes }, gained };
}

/** The missing edge of a three-sided box — a free point for whoever takes it. */
function freeBox(s: DbState): Edge | null {
  for (let b = 0; b < TOTAL_BOXES; b++) {
    if (s.boxes[b] !== 0 || sides(s.h, s.v, b) !== 3) continue;
    const r = Math.floor(b / BOX);
    const c = b % BOX;
    if (s.h[r * BOX + c] === 0) return { kind: "h", idx: r * BOX + c };
    if (s.h[(r + 1) * BOX + c] === 0) return { kind: "h", idx: (r + 1) * BOX + c };
    if (s.v[r * DOTS + c] === 0) return { kind: "v", idx: r * DOTS + c };
    return { kind: "v", idx: r * DOTS + c + 1 };
  }
  return null;
}

function openEdges(s: DbState): Edge[] {
  const out: Edge[] = [];
  for (let i = 0; i < H_EDGES; i++) if (s.h[i] === 0) out.push({ kind: "h", idx: i });
  for (let i = 0; i < V_EDGES; i++) if (s.v[i] === 0) out.push({ kind: "v", idx: i });
  return out;
}

/** Safe = leaves the opponent without a three-sided box to claim. */
function isSafe(s: DbState, e: Edge): boolean {
  const { next } = playEdge(s, e.kind, e.idx, 2);
  for (let b = 0; b < TOTAL_BOXES; b++) {
    if (next.boxes[b] === 0 && sides(next.h, next.v, b) === 3) return false;
  }
  return true;
}

/** Boxes the opponent would scoop by running the chain after this edge. */
function giftAfter(s: DbState, e: Edge): number {
  let cur = playEdge(s, e.kind, e.idx, 2).next;
  let gift = 0;
  for (;;) {
    const free = freeBox(cur);
    if (!free) break;
    const step = playEdge(cur, free.kind, free.idx, 1);
    cur = step.next;
    gift += step.gained;
  }
  return gift;
}

/**
 * Greedy and chain-aware: take free boxes, otherwise play a safe edge, and
 * only when every edge is unsafe hand over the shortest chain possible.
 */
function cpuChoose(s: DbState): Edge | null {
  const open = openEdges(s);
  if (open.length === 0) return null;
  const free = freeBox(s);
  if (free) return free;
  const safe = open.filter((e) => isSafe(s, e));
  if (safe.length > 0) return safe[Math.floor(Math.random() * safe.length)];

  let best: Edge = open[0];
  let bestGift = Infinity;
  let ties = 0;
  for (const e of open) {
    const gift = giftAfter(s, e);
    if (gift < bestGift) {
      bestGift = gift;
      best = e;
      ties = 1;
    } else if (gift === bestGift) {
      ties += 1;
      if (Math.random() * ties < 1) best = e; // random tie-break
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function DotsBoxes({ gameId }: { gameId: string }) {
  const [state, setState] = useState<DbState>(() => emptyState());
  const [turn, setTurn] = useState<1 | 2>(1);
  const [over, setOver] = useState<"won" | "lost" | null>(null);
  const [overMsg, setOverMsg] = useState("");
  const [thinking, setThinking] = useState(false);
  const [note, setNote] = useState("Draw your first line");
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
    (result: "won" | "lost", msg: string) => {
      setOver(result);
      setOverMsg(msg);
      const s = seriesRef.current;
      const key = result === "won" ? "you" : "cpu";
      const updated: Series = { ...s, [key]: s[key] + 1 };
      seriesRef.current = updated;
      setSeries(updated);
      if (result === "won") setNewBest(submit(updated.you));
    },
    [setSeries, submit],
  );

  const endGame = (final: DbState) => {
    const mine = final.boxes.filter((b) => b === 1).length;
    const theirs = final.boxes.filter((b) => b === 2).length;
    finish(
      mine > theirs ? "won" : "lost",
      `${mine}\u2013${theirs} boxes \u2014 ${mine > theirs ? "you take it" : "CPU takes it"}`,
    );
  };

  /** The CPU plays one edge per beat until it has to pass the turn back. */
  const startCpu = (current: DbState, taken = 0) => {
    if (isFull(current)) {
      endGame(current);
      return;
    }
    setThinking(true);
    cpuTimer.current = setTimeout(() => {
      const move = cpuChoose(current);
      if (!move) {
        setThinking(false);
        endGame(current);
        return;
      }
      const { next, gained } = playEdge(current, move.kind, move.idx, 2);
      setState(next);
      if (isFull(next)) {
        setThinking(false);
        endGame(next);
        return;
      }
      if (gained > 0) {
        startCpu(next, taken + gained);
        return;
      }
      setThinking(false);
      setTurn(1);
      setNote(
        taken > 0
          ? `CPU claims ${taken} box${taken > 1 ? "es" : ""} \u2014 your move`
          : "CPU plays on \u2014 your move",
      );
    }, 420);
  };

  const onEdge = (kind: "h" | "v", idx: number) => {
    if (over || thinking || turn !== 1) return;
    const { next, gained } = playEdge(state, kind, idx, 1);
    if (next === state) return;
    setState(next);
    if (gained > 0) {
      setNote(`You claim ${gained} box${gained > 1 ? "es" : ""} \u2014 extra turn`);
      if (isFull(next)) endGame(next);
      return;
    }
    setNote("Line drawn \u2014 CPU answers");
    setTurn(2);
    startCpu(next);
  };

  const newGame = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setState(emptyState());
    setTurn(1);
    setOver(null);
    setOverMsg("");
    setThinking(false);
    setNote("Draw your first line");
    setNewBest(false);
  }, []);

  let mine = 0;
  let theirs = 0;
  for (const b of state.boxes) {
    if (b === 1) mine++;
    else if (b === 2) theirs++;
  }

  const statusText = over
    ? overMsg
    : thinking
      ? "CPU is thinking\u2026"
      : turn === 2
        ? "CPU's turn"
        : note;

  const edgeClass = (owner: number) =>
    owner === 1
      ? "bg-cyan-400"
      : owner === 2
        ? "bg-rose-400"
        : "bg-[#2b2b50] hover:bg-cyan-400/80";

  return (
    <div className="w-full max-w-[560px]">
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

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs uppercase tracking-wider">
        <span className={thinking ? "text-rose-300" : "text-muted"}>
          <b className="text-ink">{thinking ? "Thinking\u2026 " : ""}{statusText}</b>
        </span>
        <span className="flex items-center gap-3 text-muted">
          Boxes <b className="text-cyan-400">{mine}</b> &middot;{" "}
          <b className="text-rose-400">{theirs}</b>
          <button
            type="button"
            onClick={newGame}
            className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            New game
          </button>
        </span>
      </div>

      <div className="relative mx-auto max-w-[440px] rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(34,211,238,0.7)]">
        <div
          className="grid gap-px"
          style={{ gridTemplateColumns: `repeat(${DOTS * 2 - 1}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: (DOTS * 2 - 1) * (DOTS * 2 - 1) }, (_, k) => {
            const row = Math.floor(k / (DOTS * 2 - 1));
            const col = k % (DOTS * 2 - 1);
            const isDot = row % 2 === 0 && col % 2 === 0;
            const isH = row % 2 === 0 && col % 2 === 1;
            const isV = row % 2 === 1 && col % 2 === 0;

            if (isDot) {
              return (
                <div key={k} className="relative aspect-square">
                  <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#54547d]" />
                </div>
              );
            }

            if (isH) {
              const idx = (row / 2) * BOX + (col - 1) / 2;
              const owner = state.h[idx];
              return (
                <div key={k} className="relative aspect-square">
                  <button
                    type="button"
                    onClick={() => onEdge("h", idx)}
                    disabled={owner !== 0 || over !== null || thinking || turn !== 1}
                    aria-label={`Horizontal line ${Math.floor(idx / BOX) + 1}-${(idx % BOX) + 1}${owner !== 0 ? ", drawn" : ""}`}
                    className={cn(
                      "absolute left-[-50%] right-[-50%] top-1/2 h-2.5 -translate-y-1/2 rounded-full transition disabled:cursor-default",
                      edgeClass(owner),
                    )}
                  />
                </div>
              );
            }

            if (isV) {
              const idx = ((row - 1) / 2) * DOTS + col / 2;
              const owner = state.v[idx];
              return (
                <div key={k} className="relative aspect-square">
                  <button
                    type="button"
                    onClick={() => onEdge("v", idx)}
                    disabled={owner !== 0 || over !== null || thinking || turn !== 1}
                    aria-label={`Vertical line ${Math.floor(idx / DOTS) + 1}-${(idx % DOTS) + 1}${owner !== 0 ? ", drawn" : ""}`}
                    className={cn(
                      "absolute top-[-50%] bottom-[-50%] left-1/2 w-2.5 -translate-x-1/2 rounded-full transition disabled:cursor-default",
                      edgeClass(owner),
                    )}
                  />
                </div>
              );
            }

            const boxIdx = ((row - 1) / 2) * BOX + (col - 1) / 2;
            const owner = state.boxes[boxIdx];
            return (
              <div key={k} className="relative aspect-square">
                {owner !== 0 && (
                  <span
                    role="img"
                    aria-label={`Box ${Math.floor(boxIdx / BOX) + 1}-${(boxIdx % BOX) + 1} owned by ${owner === 1 ? "you" : "CPU"}`}
                    className={cn(
                      "absolute inset-[18%] rounded-lg border",
                      owner === 1
                        ? "border-cyan-400/60 bg-cyan-400/25"
                        : "border-rose-400/60 bg-rose-400/25",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {over && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {over === "won" ? "You boxed out the CPU \uD83C\uDF89" : "CPU draws the last line \uD83E\uDD16"}
            </p>
            <p className="mt-2 font-mono text-4xl font-bold text-white">
              {mine} <span className="text-muted">&ndash;</span> {theirs}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                &#10022; Most games won &mdash; new best!
              </p>
            )}
            <p className="mt-2 text-xs uppercase tracking-widest text-muted">
              All-time wins {best ?? 0} &middot; Series {series.you}&ndash;
              {series.draws}&ndash;{series.cpu}
            </p>
            <PrimaryButton
              onClick={newGame}
              tone={
                over === "won"
                  ? "from-cyan-400 via-sky-500 to-blue-600"
                  : "from-amber-400 via-orange-500 to-red-500"
              }
            >
              New game
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Complete a box to score it and play again &middot; watch your chains
      </p>
    </div>
  );
}
