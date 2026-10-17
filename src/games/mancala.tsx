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

/*
 * Board layout (counterclockwise sowing):
 *   0–5   your pits   · 6  your store
 *   7–12  CPU pits    · 13 CPU store
 */
const YOUR_PITS = [0, 1, 2, 3, 4, 5];
const CPU_PITS = [7, 8, 9, 10, 11, 12];
const YOUR_STORE = 6;
const CPU_STORE = 13;

function initialBoard(): number[] {
  const b = Array<number>(14).fill(0);
  for (const i of YOUR_PITS) b[i] = 4;
  for (const i of CPU_PITS) b[i] = 4;
  return b;
}

/** Indices visited hop by hop, skipping the rival's store. */
function planSow(board: number[], from: number, player: 1 | 2): number[] {
  const steps: number[] = [];
  const skip = player === 1 ? CPU_STORE : YOUR_STORE;
  let count = board[from];
  let i = from;
  while (count > 0) {
    i = (i + 1) % 14;
    if (i === skip) continue;
    steps.push(i);
    count--;
  }
  return steps;
}

interface SowResult {
  board: number[];
  extra: boolean;
  over: boolean;
  captured: number;
}

function finalizeSow(
  board: number[],
  player: 1 | 2,
  last: number,
): SowResult {
  const b = [...board];
  const ownStore = player === 1 ? YOUR_STORE : CPU_STORE;
  const extra = last === ownStore;
  let captured = 0;

  const ownPits = player === 1 ? YOUR_PITS : CPU_PITS;
  if (ownPits.includes(last) && b[last] === 1) {
    const opposite = 12 - last;
    captured = b[opposite];
    b[ownStore] += 1 + b[opposite];
    b[last] = 0;
    b[opposite] = 0;
  }

  const yourSum = YOUR_PITS.reduce((a, i) => a + b[i], 0);
  const cpuSum = CPU_PITS.reduce((a, i) => a + b[i], 0);
  let over = false;
  if (yourSum === 0 || cpuSum === 0) {
    b[YOUR_STORE] += yourSum;
    b[CPU_STORE] += cpuSum;
    for (const i of YOUR_PITS) b[i] = 0;
    for (const i of CPU_PITS) b[i] = 0;
    over = true;
  }
  return { board: b, extra, over, captured };
}

/** Instant apply — used by the search, never on screen. */
function applySow(
  board: number[],
  from: number,
  player: 1 | 2,
): { board: number[]; extra: boolean; over: boolean } {
  const steps = planSow(board, from, player);
  const b = [...board];
  b[from] = 0;
  for (const i of steps) b[i] += 1;
  const res = finalizeSow(b, player, steps[steps.length - 1]);
  return { board: res.board, extra: res.extra, over: res.over };
}

/** Store difference plus how dangerously each pit is distributed. */
function evalBoard(b: number[]): number {
  let score = (b[CPU_STORE] - b[YOUR_STORE]) * 10;
  let mine = 0;
  let theirs = 0;
  for (const i of CPU_PITS) mine += b[i] * (i - 6);
  for (const i of YOUR_PITS) theirs += b[i] * (6 - i);
  score += (mine - theirs) * 0.5;
  return score;
}

function search(
  b: number[],
  depth: number,
  alpha: number,
  beta: number,
  player: 1 | 2,
): number {
  const moves = (player === 1 ? YOUR_PITS : CPU_PITS).filter((i) => b[i] > 0);
  if (depth === 0 || moves.length === 0) return evalBoard(b);

  const maximizing = player === 2;
  let best = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    const r = applySow(b, m, player);
    let value = r.over
      ? (r.board[CPU_STORE] - r.board[YOUR_STORE]) * 100
      : search(r.board, depth - 1, alpha, beta, r.extra ? player : player === 1 ? 2 : 1);
    if (r.extra && !r.over) value += player === 2 ? 10 : -10;
    if (maximizing) {
      if (value > best) best = value;
      if (best > alpha) alpha = best;
    } else {
      if (value < best) best = value;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

/** Alpha-beta, six deep, for the CPU side. */
function cpuMove(b: number[]): number {
  let best = -Infinity;
  let pick = -1;
  for (const m of CPU_PITS) {
    if (b[m] === 0) continue;
    const r = applySow(b, m, 2);
    let value = r.over
      ? (r.board[CPU_STORE] - r.board[YOUR_STORE]) * 100
      : search(r.board, 5, -Infinity, Infinity, r.extra ? 2 : 1);
    if (r.extra && !r.over) value += 10;
    if (value > best) {
      best = value;
      pick = m;
    }
  }
  return pick;
}

const HOP_MS = 55;

export default function Mancala({ gameId }: { gameId: string }) {
  const [board, setBoard] = useState<number[]>(() => initialBoard());
  const [turn, setTurn] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("playing");
  const [newBest, setNewBest] = useState(false);
  const [series, setSeries] = useStored<Series>(`series:${gameId}`, {
    you: 0,
    draws: 0,
    cpu: 0,
  });
  const { best, submit } = useBestScore(gameId, "high");
  const seriesRef = useRef<Series>(series);
  const sowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    seriesRef.current = series;
  }, [series]);

  useEffect(
    () => () => {
      if (sowTimer.current) clearTimeout(sowTimer.current);
      if (cpuTimer.current) clearTimeout(cpuTimer.current);
    },
    [],
  );

  const scheduleCpu = (b: number[], delay = 480) => {
    setThinking(true);
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    cpuTimer.current = setTimeout(() => {
      const pick = cpuMove(b);
      setThinking(false);
      if (pick >= 0) sow(b, pick, 2);
    }, delay);
  };

  const finishSow = (work: number[], player: 1 | 2, last: number) => {
    const res = finalizeSow(work, player, last);
    setBoard(res.board);
    setBusy(false);

    if (res.over) {
      const you = res.board[YOUR_STORE];
      const cpu = res.board[CPU_STORE];
      const result: Outcome = you > cpu ? "won" : you < cpu ? "lost" : "draw";
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
      return;
    }

    if (player === 1) {
      if (res.extra) {
        setTurn(1);
        setNote("Landed in your store — extra turn!");
      } else {
        setTurn(2);
        setNote(res.captured > 0 ? `Captured ${res.captured} stones!` : null);
        scheduleCpu(res.board);
      }
    } else {
      setNote(
        res.extra
          ? "CPU earned an extra turn."
          : res.captured > 0
            ? `CPU captured ${res.captured} stones.`
            : null,
      );
      if (res.extra) scheduleCpu(res.board, 380);
      else setTurn(1);
    }
  };

  const sow = (startBoard: number[], from: number, player: 1 | 2) => {
    const steps = planSow(startBoard, from, player);
    const base = startBoard.map((v, i) => (i === from ? 0 : v));
    setBoard(base);
    setBusy(true);
    setThinking(false);
    setNote(null);

    let k = 0;
    let current = base;
    const hop = () => {
      if (k < steps.length) {
        const target = steps[k];
        current = current.map((v, i) => (i === target ? v + 1 : v));
        k += 1;
        setBoard(current);
        sowTimer.current = setTimeout(hop, HOP_MS);
      } else {
        finishSow(current, player, steps[steps.length - 1]);
      }
    };
    sowTimer.current = setTimeout(hop, HOP_MS);
  };

  const onPit = (i: number) => {
    if (outcome !== "playing" || turn !== 1 || busy || thinking) return;
    if (!YOUR_PITS.includes(i) || board[i] === 0) return;
    sow(board, i, 1);
  };

  const newGame = useCallback(() => {
    if (sowTimer.current) clearTimeout(sowTimer.current);
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setBoard(initialBoard());
    setTurn(1);
    setBusy(false);
    setThinking(false);
    setNote(null);
    setOutcome("playing");
    setNewBest(false);
  }, []);

  const statusText =
    outcome !== "playing"
      ? "Game over"
      : thinking
        ? "CPU is thinking…"
        : busy
          ? "Sowing…"
          : turn === 2
            ? "CPU's turn…"
            : note
              ? note
              : "Your move — pick a pit";

  const yourStore = board[YOUR_STORE];
  const cpuStore = board[CPU_STORE];

  const renderPit = (i: number) => {
    const count = board[i];
    const mine = YOUR_PITS.includes(i);
    const enabled =
      mine && turn === 1 && !busy && !thinking && outcome === "playing" && count > 0;
    return (
      <button
        key={i}
        type="button"
        onClick={() => onPit(i)}
        disabled={!enabled}
        aria-label={
          mine
            ? `Your pit ${YOUR_PITS.indexOf(i) + 1}, ${count} stones`
            : `CPU pit ${CPU_PITS.indexOf(i) + 1}, ${count} stones`
        }
        className={cn(
          "relative grid aspect-square place-items-center rounded-full border font-mono text-base font-bold transition sm:text-lg",
          mine
            ? enabled
              ? "border-cyan-400/70 bg-cyan-500/15 text-ink hover:bg-cyan-500/30 hover:shadow-[0_0_18px_-8px_rgba(34,211,238,0.9)]"
              : "border-line bg-surface text-muted"
            : "border-rose-400/35 bg-rose-500/10 text-muted",
        )}
      >
        {count}
      </button>
    );
  };

  return (
    <div className="w-full max-w-[520px]">
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

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(52,211,153,0.8)]">
        <div className="grid grid-cols-[3.25rem_repeat(6,1fr)_3.25rem] grid-rows-2 items-center gap-2 sm:gap-3">
          <div
            aria-label={`CPU store, ${cpuStore} stones`}
            className="row-span-2 grid place-items-center rounded-2xl border border-rose-400/40 bg-rose-500/10 py-4 font-mono text-lg font-bold text-rose-200"
          >
            {cpuStore}
          </div>

          {CPU_PITS.slice()
            .reverse()
            .map((i) => renderPit(i))}

          <div
            aria-label={`Your store, ${yourStore} stones`}
            className="row-span-2 grid place-items-center rounded-2xl border border-cyan-400/50 bg-cyan-500/15 py-4 font-mono text-lg font-bold text-cyan-200 shadow-[0_0_18px_-8px_rgba(34,211,238,0.9)]"
          >
            {yourStore}
          </div>

          {YOUR_PITS.map((i) => renderPit(i))}
        </div>

        {outcome !== "playing" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              {outcome === "won"
                ? "You hoard the most! 🎉"
                : outcome === "lost"
                  ? "The CPU sweeps the board 🤖"
                  : "Dead even — a draw"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ Most games won — new best!
              </p>
            )}
            <p className="mt-2 font-mono text-sm uppercase tracking-widest text-muted">
              Final {yourStore} – {cpuStore} · Series {series.you}–
              {series.draws}–{series.cpu}
            </p>
            <PrimaryButton
              onClick={newGame}
              tone="from-teal-400 via-emerald-500 to-green-600"
            >
              New game
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted">
        <span className="text-cyan-300">You · pits 1–6 · store right</span>
        <span className="text-rose-300">CPU · store left</span>
      </div>

      <p className="mt-1.5 text-center text-xs text-muted">
        {outcome === "playing" ? statusText : "Tap New game to refill the pits"}
        {" · "}
        store landing = extra turn, empty pit = capture
      </p>
      <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-muted">
        All-time games won {best ?? 0}
      </p>
    </div>
  );
}
