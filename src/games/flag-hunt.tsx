"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

const COLS = 14;
const ROWS = 7;
/** Rows 0–2 are CPU ground, row 3 no-man's land, rows 4–6 yours. */

type Side = "you" | "cpu";
type Kind = "flag" | "bomb" | "miner" | "soldier";
type Outcome = "playing" | "won" | "lost";
type Phase = "setup" | "battle";

interface Piece {
  id: number;
  side: Side;
  kind: Kind;
  rank: number;
  revealed: boolean;
}

interface Series {
  you: number;
  cpu: number;
}

type Board = (Piece | null)[];

const EMOJI: Record<Kind, string> = { flag: "🚩", bomb: "💣", miner: "⛏️", soldier: "🎖️" };

const HIDDEN = "❔";

function label(p: Piece): string {
  return `${EMOJI[p.kind]}${p.kind === "soldier" ? p.rank : ""}`;
}

function makeArmy(side: Side): Piece[] {
  let id = side === "you" ? 1 : 100;
  const army: Piece[] = (["flag", "bomb", "bomb", "miner"] as Kind[]).map(
    (kind) => ({ id: id++, side, kind, rank: 0, revealed: false }),
  );
  for (const rank of [2, 4, 6, 8]) {
    army.push({ id: id++, side, kind: "soldier", rank, revealed: false });
  }
  return army;
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function cellsIn(rows: number[]): number[] {
  const out: number[] = [];
  for (const r of rows) for (let c = 0; c < COLS; c++) out.push(r * COLS + c);
  return out;
}

function deployBoard(): Board {
  const board: Board = Array<Piece | null>(COLS * ROWS).fill(null);
  const place = (side: Side, rows: number[]) => {
    const cells = shuffle(cellsIn(rows));
    makeArmy(side).forEach((piece, i) => { board[cells[i]] = piece; });
  };
  place("cpu", [0, 1, 2]);
  place("you", [4, 5, 6]);
  return board;
}

function orthogonal(i: number): number[] {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const out: number[] = [];
  if (r > 0) out.push(i - COLS);
  if (r < ROWS - 1) out.push(i + COLS);
  if (c > 0) out.push(i - 1);
  if (c < COLS - 1) out.push(i + 1);
  return out;
}

function canMove(p: Piece): boolean {
  return p.kind === "soldier" || p.kind === "miner";
}

interface BattleResult {
  attackerLost: boolean;
  defenderLost: boolean;
  winnerOver?: Side;
}

/** Stratego-style combat. Flags and bombs never move. */
function resolveBattle(att: Piece, def: Piece): BattleResult {
  if (def.kind === "flag") {
    return { attackerLost: false, defenderLost: true, winnerOver: att.side };
  }
  if (def.kind === "bomb") {
    return att.kind === "miner"
      ? { attackerLost: false, defenderLost: true }
      : { attackerLost: true, defenderLost: false };
  }
  if (att.kind === "miner") {
    // Only a miner beats a bomb; against anything else it dies.
    return def.kind === "miner"
      ? { attackerLost: true, defenderLost: true }
      : { attackerLost: true, defenderLost: false };
  }
  // Attacker is a soldier: beats a miner, outranks a soldier, ties mutual.
  if (def.kind === "miner" || att.rank > def.rank) {
    return { attackerLost: false, defenderLost: true };
  }
  if (att.rank < def.rank) {
    return { attackerLost: true, defenderLost: false };
  }
  return { attackerLost: true, defenderLost: true };
}

const who = (p: Piece) => (p.side === "you" ? "You" : "CPU");

/** Applies a battle to the board and returns it plus a log line. */
function applyBattle(
  board: Board,
  from: number,
  to: number,
): { board: Board; line: string; winner: Side | null } {
  const next = board.slice();
  const att = next[from]!;
  const def = next[to]!;
  const res = resolveBattle(att, def);
  let line: string;
  let winner: Side | null = null;

  if (res.winnerOver) {
    next[from] = null;
    line = `🚩 ${who(att)} ${label(att)} captures the flag — instant win!`;
    winner = res.winnerOver;
  } else if (res.attackerLost && res.defenderLost) {
    next[from] = null;
    next[to] = null;
    line = `💥 ${who(att)} ${label(att)} vs ${who(def)} ${label(def)} — both down`;
  } else if (res.defenderLost) {
    next[from] = null;
    next[to] = { ...att, revealed: true };
    line = `⚔️ ${who(att)} ${label(att)} beats ${who(def)} ${label(def)}`;
  } else {
    next[from] = null;
    next[to] = { ...def, revealed: true };
    line =
      def.kind === "bomb"
        ? `💣 ${who(def)} ${label(def)} holds — ${who(att)} ${label(att)} is lost`
        : `🛡️ ${who(def)} ${label(def)} defends — ${who(att)} ${label(att)} falls`;
  }
  return { board: next, line, winner };
}

function movePiece(board: Board, from: number, to: number): Board {
  const next = board.slice();
  next[to] = next[from];
  next[from] = null;
  return next;
}

function sideHasMoves(board: Board, side: Side): boolean {
  return board.some(
    (p, i) =>
      p !== null && p.side === side && canMove(p) &&
      orthogonal(i).some((n) => board[n] === null || board[n]!.side !== side),
  );
}

function strength(p: Piece): number {
  return p.kind === "soldier" ? p.rank : 1;
}

/**
 * The CPU hunts toward unexplored ground and throws its strongest piece at
 * unknown enemies — it never peeks at your hidden ranks.
 */
function chooseCpuMove(board: Board): { from: number; to: number } | null {
  const pieces: number[] = [];
  board.forEach((p, i) => {
    if (p && p.side === "cpu" && canMove(p)) pieces.push(i);
  });
  if (pieces.length === 0) return null;

  let strongest = pieces[0];
  for (const i of pieces) {
    if (strength(board[i]!) > strength(board[strongest]!)) strongest = i;
  }

  let best: { from: number; to: number } | null = null;
  let bestScore = -Infinity;
  for (const i of pieces) {
    const piece = board[i]!;
    for (const to of orthogonal(i)) {
      const target = board[to];
      let score = 0;
      if (target === null) {
        // Push south into enemy ground; unexplored ground is extra tempting.
        score = Math.floor(to / COLS) * 2 + Math.random();
        if (orthogonal(to).every((n) => board[n] === null || board[n]!.side !== "cpu")) score += 3;
      } else if (target.side === "you") {
        if (!target.revealed) {
          if (i !== strongest) continue; // only the strongest hunts unknowns
          score = 100 + Math.random();
        } else {
          score = strength(piece) > strength(target) ? 70 + Math.random() : 5 + Math.random();
        }
      } else {
        continue;
      }
      if (score > bestScore) {
        bestScore = score;
        best = { from: i, to };
      }
    }
  }
  return best;
}

export default function FlagHunt({ gameId }: { gameId: string }) {
  const [board, setBoard] = useState<Board>(() => deployBoard());
  const [phase, setPhase] = useState<Phase>("setup");
  const [outcome, setOutcome] = useState<Outcome>("playing");
  const [selected, setSelected] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [log, setLog] = useState<string[]>([]);
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
  useEffect(() => () => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
  }, []);

  const endRound = useCallback(
    (winner: Side) => {
      setOutcome(winner === "you" ? "won" : "lost");
      const mine = winner === "you";
      const updated = mine
        ? { ...seriesRef.current, you: seriesRef.current.you + 1 }
        : { ...seriesRef.current, cpu: seriesRef.current.cpu + 1 };
      seriesRef.current = updated;
      setSeries(updated);
      if (mine) setNewBest(submit(updated.you));
    },
    [setSeries, submit],
  );

  const cpuTurn = (current: Board) => {
    const move = chooseCpuMove(current);
    if (!move) {
      endRound("you"); // CPU is stuck with immovable pieces
      return;
    }
    const target = current[move.to];
    let next = current;
    if (target) {
      const res = applyBattle(current, move.from, move.to);
      next = res.board;
      setLog((l) => [res.line, ...l].slice(0, 3));
      if (res.winner) {
        setBoard(next);
        endRound(res.winner);
        return;
      }
    } else {
      next = movePiece(current, move.from, move.to);
    }
    setBoard(next);
    setThinking(false);
    if (!sideHasMoves(next, "you")) endRound("cpu");
  };

  const onCell = (index: number) => {
    if (outcome !== "playing") return;

    if (phase === "setup") {
      const piece = board[index];
      const r = Math.floor(index / COLS);
      if (r < 4) return; // your half only
      if (selected === null) {
        if (piece && piece.side === "you") setSelected(index);
        return;
      }
      if (index === selected) {
        setSelected(null);
        return;
      }
      if (piece && piece.side !== "you") return;
      const next = board.slice();
      next[index] = next[selected];
      next[selected] = piece;
      setBoard(next);
      setSelected(null);
      return;
    }

    if (thinking) return;
    const piece = board[index];
    if (selected === null) {
      if (piece && piece.side === "you" && canMove(piece)) setSelected(index);
      return;
    }
    if (index === selected) {
      setSelected(null);
      return;
    }
    if (piece && piece.side === "you") {
      setSelected(piece && canMove(piece) ? index : null);
      return;
    }
    if (!orthogonal(selected).includes(index)) return;

    if (!piece) {
      const next = movePiece(board, selected, index);
      setBoard(next);
      setSelected(null);
      setThinking(true);
      cpuTimer.current = setTimeout(() => cpuTurn(next), 560);
      return;
    }

    const res = applyBattle(board, selected, index);
    setBoard(res.board);
    setLog((l) => [res.line, ...l].slice(0, 3));
    setSelected(null);
    if (res.winner) endRound(res.winner);
    else {
      setThinking(true);
      cpuTimer.current = setTimeout(() => cpuTurn(res.board), 560);
    }
  };

  const randomize = () => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setBoard(deployBoard());
    setSelected(null);
    setThinking(false);
  };

  const startBattle = () => {
    if (phase !== "setup") return;
    setPhase("battle");
    setSelected(null);
    setLog([]);
  };

  const newBattle = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setBoard(deployBoard());
    setPhase("setup");
    setOutcome("playing");
    setSelected(null);
    setThinking(false);
    setLog([]);
    setNewBest(false);
  }, []);

  const selectedTargets = new Set(selected !== null && phase === "battle" ? orthogonal(selected) : []);
  const statusText =
    outcome === "won"
      ? "You seized their flag! 🎉"
      : outcome === "lost"
        ? "Your flag fell 🤖"
        : phase === "setup"
          ? selected !== null
            ? "Tap another spot in your half to reposition"
            : "Tap a piece to reposition, then Randomize & Start"
          : thinking
            ? "CPU is thinking…"
            : "Tap a piece, then a highlighted neighbour";

  return (
    <div className="w-full max-w-[560px]">
      <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-xs uppercase tracking-wider">
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-center text-cyan-300">
          You <b className="ml-1 text-sm text-ink">{series.you}</b>
        </div>
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-center text-rose-300">
          CPU <b className="ml-1 text-sm text-ink">{series.cpu}</b>
        </div>
      </div>
      {phase === "setup" && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={randomize}
            className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
          >
            🎲 Randomize
          </button>
          <button
            type="button"
            onClick={startBattle}
            className="rounded-full bg-gradient-to-r from-rose-400 via-pink-500 to-fuchsia-600 px-5 py-1.5 text-xs font-bold text-black transition hover:brightness-110 active:scale-95"
          >
            ⚔️ Start battle
          </button>
        </div>
      )}

      <div className="relative rounded-2xl border border-line bg-surface-2 p-2 shadow-[0_0_60px_-24px_rgba(244,63,94,0.7)]">
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
          {board.map((piece, i) => {
            const r = Math.floor(i / COLS);
            const isYours = piece?.side === "you";
            const hidden = piece !== null && !isYours && !piece.revealed;
            const isTarget = selectedTargets.has(i);
            const isSel = selected === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onCell(i)}
                aria-label={`Row ${r + 1} column ${(i % COLS) + 1}: ${
                  piece ? (hidden ? "unknown enemy piece" : label(piece)) : "empty"
                }`}
                className={cn(
                  "grid aspect-square select-none place-items-center rounded border text-[11px] leading-none transition sm:text-sm",
                  r < 3
                    ? "border-rose-500/10 bg-rose-500/5"
                    : r > 3
                      ? "border-cyan-500/10 bg-cyan-500/5"
                      : "border-line bg-surface",
                  isSel && "border-cyan-400 bg-cyan-500/20 shadow-[0_0_14px_-4px_rgba(34,211,238,0.9)]",
                  isTarget &&
                    (piece && piece.side === "you"
                      ? "border-emerald-400/70 bg-emerald-500/15"
                      : "border-rose-400/70 bg-rose-500/20 shadow-[0_0_14px_-4px_rgba(251,113,133,0.9)]"),
                )}
              >
                {piece ? (
                  hidden ? (
                    <span className="opacity-70">{HIDDEN}</span>
                  ) : (
                    <span className={isYours ? "text-cyan-200" : "text-rose-200"}>{label(piece)}</span>
                  )
                ) : null}
              </button>
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
              All-time wins {best ?? 0} · Series {series.you}–{series.cpu}
            </p>
            <PrimaryButton onClick={newBattle} tone="from-rose-400 via-pink-500 to-fuchsia-600">
              New battle
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      {phase === "battle" && (
        <div className="mt-3 rounded-xl border border-line bg-surface px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Battle log</p>
          {log.length === 0 ? (
            <p className="mt-1 text-xs text-muted">No clashes yet…</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {log.map((line, i) => (
                <li key={`${i}-${line}`} className="font-mono text-[11px] text-ink">{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-3 text-center text-xs text-muted">
        {statusText} · 🚩 flag = instant win · 💣 kills unless ⛏️ defuses · ranks 2/4/6/8
      </p>
    </div>
  );
}
