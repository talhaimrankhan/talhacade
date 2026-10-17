"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay, PrimaryButton } from "@/games/parts";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";

type Mark = "X" | "O";
type Cell = Mark | null;
type Owner = Mark | "draw" | null;
type Outcome = "playing" | "won" | "lost" | "draw";

interface Series {
  you: number;
  draws: number;
  cpu: number;
}

interface Move {
  b: number;
  c: number;
}

interface UState {
  /** 81 cells: board b, cell c lives at b * 9 + c. */
  cells: Cell[];
  /** Meta ownership per mini-board. */
  owners: Owner[];
  /** Mini-board the next player must play in (null = anywhere). */
  active: number | null;
  turn: Mark;
}

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/* ------------------------------------------------------------------ */
/* Board helpers                                                       */
/* ------------------------------------------------------------------ */

function emptyState(): UState {
  return {
    cells: Array<Cell>(81).fill(null),
    owners: Array<Owner>(9).fill(null),
    active: null,
    turn: "X",
  };
}

function lineWinner(values: (Mark | "draw" | null)[]): Mark | null {
  for (const [a, b, c] of LINES) {
    const v = values[a];
    if (v && v !== "draw" && v === values[b] && v === values[c]) return v;
  }
  return null;
}

function metaWinner(owners: Owner[]): { mark: Mark; line: number[] } | null {
  for (const line of LINES) {
    const v = owners[line[0]];
    if (v && v !== "draw" && v === owners[line[1]] && v === owners[line[2]]) {
      return { mark: v, line };
    }
  }
  return null;
}

/** True when no meta line can still be completed by anyone. */
function metaDead(owners: Owner[]): boolean {
  for (const line of LINES) {
    let hasX = false;
    let hasO = false;
    let open = false;
    for (const i of line) {
      const o = owners[i];
      if (o === "X") hasX = true;
      else if (o === "O") hasO = true;
      else if (o === null) open = true;
    }
    if (open && (!hasX || !hasO)) return false;
  }
  return true;
}

function boardFull(cells: Cell[], base: number): boolean {
  for (let i = base; i < base + 9; i++) if (!cells[i]) return false;
  return true;
}

/** Legally playable mini-board/cell pairs for the side to move. */
function validMoves(s: UState): Move[] {
  const out: Move[] = [];
  const push = (b: number) => {
    if (s.owners[b]) return;
    for (let c = 0; c < 9; c++) if (!s.cells[b * 9 + c]) out.push({ b, c });
  };
  if (s.active === null) for (let b = 0; b < 9; b++) push(b);
  else push(s.active);

  // Search from the strong cells out: centre cell, then centre board.
  const priority = (m: Move) => (m.c === 4 ? 0 : 1) + (m.b === 4 ? 0 : 2);
  out.sort((m, n) => priority(m) - priority(n));
  return out;
}

function applyMove(s: UState, b: number, c: number, mark: Mark): UState {
  const cells = [...s.cells];
  cells[b * 9 + c] = mark;

  const owners = [...s.owners];
  if (!owners[b]) {
    const won = lineWinner(cells.slice(b * 9, b * 9 + 9));
    if (won) owners[b] = won;
    else if (boardFull(cells, b * 9)) owners[b] = "draw";
  }

  // The cell just played picks the next board — unless it is finished.
  const target = c;
  const active = owners[target] ? null : target;
  return { cells, owners, active, turn: mark === "X" ? "O" : "X" };
}

/* ------------------------------------------------------------------ */
/* Heuristic + alpha-beta                                              */
/* ------------------------------------------------------------------ */

/** Threats (two owned + one open) inside a live mini-board. */
function miniThreats(cells: Cell[], base: number, p: Mark): number {
  let n = 0;
  for (const [a, b, c] of LINES) {
    const v = [cells[base + a], cells[base + b], cells[base + c]];
    if (v.filter((x) => x === p).length === 2 && v.some((x) => x === null)) n++;
  }
  return n;
}

/** Heuristic for the CPU (O). Positive favours O. */
function evaluate(s: UState): number {
  let score = 0;

  for (let b = 0; b < 9; b++) {
    const owner = s.owners[b];
    const claim = b === 4 ? 55 : 35;
    if (owner === "O") score += claim;
    else if (owner === "X") score -= claim;
    else {
      // Centre cell of a live board.
      const centre = s.cells[b * 9 + 4];
      if (centre === "O") score += b === 4 ? 9 : 5;
      else if (centre === "X") score -= b === 4 ? 9 : 5;
      score += (miniThreats(s.cells, b, "O") - miniThreats(s.cells, b, "X")) * 4;
    }
  }

  let oThreats = 0;
  let xThreats = 0;
  for (const line of LINES) {
    let mine = 0;
    let theirs = 0;
    let open = 0;
    for (const i of line) {
      const owner = s.owners[i];
      if (owner === "O") mine++;
      else if (owner === "X") theirs++;
      else if (owner === null) open++;
    }
    if (theirs === 0) {
      if (mine === 2 && open === 1) {
        score += 45;
        oThreats++;
      } else if (mine === 1 && open === 2) score += 12;
    }
    if (mine === 0) {
      if (theirs === 2 && open === 1) {
        score -= 52;
        xThreats++;
      } else if (theirs === 1 && open === 2) score -= 12;
    }
  }

  // Two threatening lines at once = an unblockable meta fork.
  if (oThreats >= 2) score += 90;
  if (xThreats >= 2) score -= 90;

  return score;
}

function search(s: UState, depth: number, alpha: number, beta: number): number {
  const win = metaWinner(s.owners);
  if (win) return win.mark === "O" ? 100000 + depth : -100000 - depth;
  if (metaDead(s.owners)) return 0;
  if (depth === 0) return evaluate(s);

  const moves = validMoves(s);
  if (moves.length === 0) return evaluate(s);

  if (s.turn === "O") {
    let best = -Infinity;
    for (const m of moves) {
      const value = search(applyMove(s, m.b, m.c, "O"), depth - 1, alpha, beta);
      if (value > best) best = value;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  let best = Infinity;
  for (const m of moves) {
    const value = search(applyMove(s, m.b, m.c, "X"), depth - 1, alpha, beta);
    if (value < best) best = value;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Alpha-beta, two plies deep, over the meta structure. */
function cpuMove(s: UState): Move | null {
  const moves = validMoves(s);
  if (moves.length === 0) return null;
  let best = -Infinity;
  let pick = moves[0];
  for (const m of moves) {
    const value = search(applyMove(s, m.b, m.c, "O"), 2, -Infinity, Infinity);
    if (value > best) {
      best = value;
      pick = m;
    }
  }
  return pick;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function UltimateTicTacToe({ gameId }: { gameId: string }) {
  const [state, setState] = useState<UState>(() => emptyState());
  const [outcome, setOutcome] = useState<Outcome>("playing");
  const [metaLine, setMetaLine] = useState<number[]>([]);
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
    (s: UState): boolean => {
      const win = metaWinner(s.owners);
      if (win) {
        setMetaLine(win.line);
        if (win.mark === "X") {
          setOutcome("won");
          const updated = {
            ...seriesRef.current,
            you: seriesRef.current.you + 1,
          };
          seriesRef.current = updated;
          setSeries(updated);
          setNewBest(submit(updated.you));
        } else {
          setOutcome("lost");
          const updated = {
            ...seriesRef.current,
            cpu: seriesRef.current.cpu + 1,
          };
          seriesRef.current = updated;
          setSeries(updated);
        }
        return true;
      }
      if (metaDead(s.owners)) {
        setOutcome("draw");
        const updated = {
          ...seriesRef.current,
          draws: seriesRef.current.draws + 1,
        };
        seriesRef.current = updated;
        setSeries(updated);
        return true;
      }
      return false;
    },
    [setSeries, submit],
  );

  const play = (b: number, c: number) => {
    if (outcome !== "playing" || thinking) return;
    if (state.owners[b]) return;
    if (state.active !== null && state.active !== b) return;
    if (state.cells[b * 9 + c]) return;

    const next = applyMove(state, b, c, "X");
    setState(next);
    if (finish(next)) return;

    setThinking(true);
    cpuTimer.current = setTimeout(() => {
      const move = cpuMove(next);
      setThinking(false);
      if (!move) return;
      const reply = applyMove(next, move.b, move.c, "O");
      setState(reply);
      finish(reply);
    }, 420);
  };

  const newMatch = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setState(emptyState());
    setOutcome("playing");
    setMetaLine([]);
    setThinking(false);
    setNewBest(false);
  }, []);

  const statusText =
    outcome === "won"
      ? "Meta mastered! 🎉"
      : outcome === "lost"
        ? "CPU takes the meta 🤖"
        : outcome === "draw"
          ? "Meta grid locked — draw"
          : thinking
            ? "CPU is thinking…"
            : state.active === null
              ? "Your move — pick any open board"
              : `Your move — board ${state.active + 1} only`;

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

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-24px_rgba(139,92,246,0.9)]">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }, (_, b) => {
            const owner = state.owners[b];
            const allowed =
              !owner &&
              outcome === "playing" &&
              (state.active === null || state.active === b);
            const wonMeta = metaLine.includes(b);
            return (
              <div
                key={b}
                aria-label={`Board ${b + 1}${
                  owner ? ` — claimed by ${owner === "draw" ? "nobody" : owner}` : ""
                }`}
                className={cn(
                  "relative rounded-xl border p-1.5 transition",
                  owner === "X"
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : owner === "O"
                      ? "border-rose-400/60 bg-rose-500/10"
                      : owner === "draw"
                        ? "border-line bg-surface"
                        : allowed
                          ? "border-cyan-400/70 bg-[#171733] shadow-[0_0_18px_-6px_rgba(34,211,238,0.8)]"
                          : "border-line bg-[#101020]",
                  wonMeta && "ring-2 ring-success/70",
                )}
              >
                <div className="grid grid-cols-3 gap-1">
                  {Array.from({ length: 9 }, (_, c) => {
                    const mark = state.cells[b * 9 + c];
                    const playable = allowed && !mark && !thinking;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => play(b, c)}
                        aria-label={`Board ${b + 1}, cell ${c + 1}${
                          mark ? `: ${mark}` : ""
                        }`}
                        disabled={!playable}
                        className={cn(
                          "grid aspect-square place-items-center rounded-md border font-display text-base font-bold transition sm:text-lg",
                          mark
                            ? "border-transparent bg-[#0c0c18]"
                            : "border-[#22223f] bg-[#13132a] hover:border-cyan-400/60",
                          playable && "cursor-pointer",
                          owner && "opacity-45",
                        )}
                      >
                        {mark && (
                          <span
                            className={cn(
                              "animate-pop",
                              mark === "X" ? "text-cyan-400" : "text-rose-400",
                            )}
                          >
                            {mark}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {owner && owner !== "draw" && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <span
                      className={cn(
                        "animate-pop font-display text-5xl font-bold drop-shadow-lg",
                        owner === "X" ? "text-cyan-300" : "text-rose-300",
                      )}
                    >
                      {owner}
                    </span>
                  </div>
                )}
                {owner === "draw" && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <span className="font-display text-3xl font-bold text-muted">
                      –
                    </span>
                  </div>
                )}
              </div>
            );
          })}
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
              tone="from-violet-500 via-purple-500 to-fuchsia-500"
            >
              New match
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        {outcome === "playing"
          ? statusText
          : "Tap New match to reset the meta grid"}
        {" · "}
        win 3 mini-boards in a row
      </p>
      <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-muted">
        All-time games won {best ?? 0}
      </p>
    </div>
  );
}
