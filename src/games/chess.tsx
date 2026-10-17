"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Color = "w" | "b";
type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
type Outcome = "playing" | "won" | "lost" | "draw";

interface Piece { t: PieceType; c: Color }
type Board = (Piece | null)[];
interface Castling { wk: boolean; wq: boolean; bk: boolean; bq: boolean }
/** ep = en-passant target square or -1 · half = plies since pawn move/capture. */
interface Position { board: Board; turn: Color; castling: Castling; ep: number; half: number }
interface Move { from: number; to: number; promo?: "q"; castle?: "k" | "q"; ep?: boolean }
interface Snapshot { pos: Position; last: { from: number; to: number } | null }
interface Series { you: number; draws: number; cpu: number }

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const ROW = (i: number) => (i / 8) | 0;
const COL = (i: number) => i % 8;
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const other = (c: Color): Color => (c === "w" ? "b" : "w");

const KNIGHT_D = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING_D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK_D = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const QUEEN_D = [...ROOK_D, ...BISHOP_D];

const VAL: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 90000;

const GLYPH: Record<Color, Record<PieceType, string>> = {
  w: { p: "\u2659", n: "\u2658", b: "\u2657", r: "\u2656", q: "\u2655", k: "\u2654" },
  b: { p: "\u265F", n: "\u265E", b: "\u265D", r: "\u265C", q: "\u265B", k: "\u265A" },
};

const NAME: Record<PieceType, string> = {
  p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king",
};

const FILES = "abcdefgh";

/* Piece-square tables (index 0 = a8 … 63 = h1, from White's view). */
const PST_P = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];
const PST_N = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];
const PST_B = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];
const PST_R = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, 10, 10, 10, 10, 5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 0, 5, 5, 0, 0, 0,
];
const PST_Q = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 0, -5,
  0, 0, 5, 5, 5, 5, 0, -5,
  -10, 5, 5, 5, 5, 5, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];
const PST_K = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
];
const PST: Record<PieceType, number[]> = {
  p: PST_P,
  n: PST_N,
  b: PST_B,
  r: PST_R,
  q: PST_Q,
  k: PST_K,
};

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

function initialPosition(): Position {
  const board: Board = Array(64).fill(null);
  const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let c = 0; c < 8; c++) {
    board[c] = { t: back[c], c: "b" };
    board[8 + c] = { t: "p", c: "b" };
    board[48 + c] = { t: "p", c: "w" };
    board[56 + c] = { t: back[c], c: "w" };
  }
  return {
    board,
    turn: "w",
    castling: { wk: true, wq: true, bk: true, bq: true },
    ep: -1,
    half: 0,
  };
}

function findKing(board: Board, c: Color): number {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.t === "k" && p.c === c) return i;
  }
  return -1;
}

function isAttacked(board: Board, sq: number, by: Color): boolean {
  const r = ROW(sq);
  const c = COL(sq);

  // Pawns: a pawn on (r+1, c±1) attacks upwards for White.
  const pr = r + (by === "w" ? 1 : -1);
  for (const dc of [-1, 1]) {
    if (!inside(pr, c + dc)) continue;
    const p = board[pr * 8 + c + dc];
    if (p && p.c === by && p.t === "p") return true;
  }

  const stepHit = (dirs: number[][], type: PieceType) => {
    for (const [dr, dc] of dirs) {
      if (!inside(r + dr, c + dc)) continue;
      const p = board[(r + dr) * 8 + c + dc];
      if (p && p.c === by && p.t === type) return true;
    }
    return false;
  };
  if (stepHit(KNIGHT_D, "n") || stepHit(KING_D, "k")) return true;

  const rays: [number[][], PieceType[]][] = [
    [ROOK_D, ["r", "q"]],
    [BISHOP_D, ["b", "q"]],
  ];
  for (const [dirs, types] of rays) {
    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inside(nr, nc)) {
        const p = board[nr * 8 + nc];
        if (p) {
          if (p.c === by && types.includes(p.t)) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }
  return false;
}

function inCheck(pos: Position): boolean {
  const k = findKing(pos.board, pos.turn);
  return k >= 0 && isAttacked(pos.board, k, other(pos.turn));
}

function addCastling(pos: Position, moves: Move[]): void {
  const { board, turn, castling } = pos;
  if (inCheck(pos)) return;
  const foe = other(turn);
  const safe = (sq: number) => !board[sq] && !isAttacked(board, sq, foe);
  const home = turn === "w" ? 60 : 4;
  const rookK = turn === "w" ? 63 : 7;
  const rookQ = turn === "w" ? 56 : 0;
  const canK = turn === "w" ? castling.wk : castling.bk;
  const canQ = turn === "w" ? castling.wq : castling.bq;
  if (
    canK &&
    board[home]?.t === "k" &&
    board[rookK]?.t === "r" &&
    board[rookK]?.c === turn &&
    safe(home + 1) &&
    safe(home + 2)
  ) {
    moves.push({ from: home, to: home + 2, castle: "k" });
  }
  if (
    canQ &&
    board[home]?.t === "k" &&
    board[rookQ]?.t === "r" &&
    board[rookQ]?.c === turn &&
    !board[home - 1] &&
    safe(home - 2) &&
    safe(home - 3)
  ) {
    moves.push({ from: home, to: home - 2, castle: "q" });
  }
}

/** Pseudo-legal moves for the side to move (capturesOnly feeds quiescence). */
function pseudoMoves(pos: Position, capturesOnly: boolean): Move[] {
  const { board, turn } = pos;
  const foe = other(turn);
  const moves: Move[] = [];

  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p.c !== turn) continue;
    const r = ROW(i);
    const c = COL(i);

    if (p.t === "p") {
      const dir = turn === "w" ? -1 : 1;
      const start = turn === "w" ? 6 : 1;
      const promoRow = turn === "w" ? 0 : 7;
      for (const dc of [-1, 1]) {
        const nr = r + dir;
        const nc = c + dc;
        if (!inside(nr, nc)) continue;
        const t = nr * 8 + nc;
        const target = board[t];
        if (target && target.c === foe) {
          if (nr === promoRow) moves.push({ from: i, to: t, promo: "q" });
          else moves.push({ from: i, to: t });
        } else if (!target && t === pos.ep) {
          moves.push({ from: i, to: t, ep: true });
        }
      }
      if (capturesOnly) continue;
      const one = (r + dir) * 8 + c;
      if (inside(r + dir, c) && !board[one]) {
        if (r + dir === promoRow) {
          moves.push({ from: i, to: one, promo: "q" });
        } else {
          moves.push({ from: i, to: one });
          const two = (r + 2 * dir) * 8 + c;
          if (r === start && !board[two]) moves.push({ from: i, to: two });
        }
      }
    } else if (p.t === "n" || p.t === "k") {
      const dirs = p.t === "n" ? KNIGHT_D : KING_D;
      for (const [dr, dc] of dirs) {
        if (!inside(r + dr, c + dc)) continue;
        const t = (r + dr) * 8 + c + dc;
        const target = board[t];
        if (target && target.c === turn) continue;
        if (target) moves.push({ from: i, to: t });
        else if (!capturesOnly) moves.push({ from: i, to: t });
      }
    } else {
      const dirs = p.t === "r" ? ROOK_D : p.t === "b" ? BISHOP_D : QUEEN_D;
      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (inside(nr, nc)) {
          const t = nr * 8 + nc;
          const target = board[t];
          if (target) {
            if (target.c === foe) moves.push({ from: i, to: t });
            break;
          }
          if (!capturesOnly) moves.push({ from: i, to: t });
          nr += dr;
          nc += dc;
        }
      }
    }
  }

  if (!capturesOnly) addCastling(pos, moves);
  return moves;
}

function applyMove(pos: Position, m: Move): Position {
  const board = pos.board.slice();
  const piece = board[m.from]!;
  let captured: Piece | null = board[m.to];
  board[m.from] = null;
  if (m.ep) {
    const capSq = ROW(m.from) * 8 + COL(m.to);
    captured = board[capSq];
    board[capSq] = null;
  }
  board[m.to] = m.promo ? { t: "q", c: piece.c } : piece;

  if (m.castle === "k") {
    if (piece.c === "w") {
      board[61] = board[63];
      board[63] = null;
    } else {
      board[5] = board[7];
      board[7] = null;
    }
  } else if (m.castle === "q") {
    if (piece.c === "w") {
      board[59] = board[56];
      board[56] = null;
    } else {
      board[3] = board[0];
      board[0] = null;
    }
  }

  const castling = { ...pos.castling };
  if (piece.t === "k") {
    if (piece.c === "w") {
      castling.wk = false;
      castling.wq = false;
    } else {
      castling.bk = false;
      castling.bq = false;
    }
  }
  if (m.from === 63 || m.to === 63) castling.wk = false;
  if (m.from === 56 || m.to === 56) castling.wq = false;
  if (m.from === 7 || m.to === 7) castling.bk = false;
  if (m.from === 0 || m.to === 0) castling.bq = false;

  const double = piece.t === "p" && Math.abs(m.to - m.from) === 16;
  return {
    board,
    turn: other(pos.turn),
    castling,
    ep: double ? (m.from + m.to) / 2 : -1,
    half: piece.t === "p" || captured ? 0 : pos.half + 1,
  };
}

/** Fully legal moves for the side to move. */
function legalMoves(pos: Position, capturesOnly = false): Move[] {
  const foe = other(pos.turn);
  return pseudoMoves(pos, capturesOnly).filter((m) => {
    const next = applyMove(pos, m);
    const k = findKing(next.board, pos.turn);
    return k < 0 || !isAttacked(next.board, k, foe);
  });
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

function mirror(i: number): number {
  return (7 - ROW(i)) * 8 + COL(i);
}

/** Static eval, positive = good for White. */
function evaluate(pos: Position): number {
  const { board } = pos;
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const value = VAL[p.t] + (p.c === "w" ? PST[p.t][i] : PST[p.t][mirror(i)]);
    score += p.c === "w" ? value : -value;
  }
  return score;
}

function moveScore(pos: Position, m: Move): number {
  const victim = m.ep ? { t: "p" as PieceType } : pos.board[m.to];
  const attacker = pos.board[m.from];
  if (victim && attacker) return VAL[victim.t] * 16 - VAL[attacker.t];
  if (m.castle) return 6;
  return 0;
}

/** Captures-first ordering (MVV-LVA) keeps alpha-beta pruning sharp. */
function orderMoves(pos: Position, moves: Move[]): Move[] {
  return [...moves].sort((a, b) => moveScore(pos, b) - moveScore(pos, a));
}

/** Extend the search at the horizon so captures aren't missed. */
function quiesce(pos: Position, alpha: number, beta: number, depth: number): number {
  const stand = evaluate(pos);
  if (depth === 0) return stand;
  const caps = orderMoves(pos, legalMoves(pos, true));
  if (pos.turn === "w") {
    if (stand >= beta) return beta;
    alpha = Math.max(alpha, stand);
    for (const m of caps) {
      alpha = Math.max(alpha, quiesce(applyMove(pos, m), alpha, beta, depth - 1));
      if (alpha >= beta) break;
    }
    return alpha;
  }
  if (stand <= alpha) return alpha;
  beta = Math.min(beta, stand);
  for (const m of caps) {
    beta = Math.min(beta, quiesce(applyMove(pos, m), alpha, beta, depth - 1));
    if (alpha >= beta) break;
  }
  return beta;
}

function minimax(pos: Position, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(pos);
  if (moves.length === 0) {
    if (inCheck(pos)) return pos.turn === "w" ? -MATE - depth : MATE + depth;
    return 0;
  }
  if (pos.half >= 100) return 0;
  if (depth === 0) return quiesce(pos, alpha, beta, 3);

  const ordered = orderMoves(pos, moves);
  if (pos.turn === "w") {
    let value = -Infinity;
    for (const m of ordered) {
      value = Math.max(value, minimax(applyMove(pos, m), depth - 1, alpha, beta));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }
  let value = Infinity;
  for (const m of ordered) {
    value = Math.min(value, minimax(applyMove(pos, m), depth - 1, alpha, beta));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

/** The CPU plays Black: pick the lowest-scoring reply (ties broken at random). */
function cpuMove(pos: Position, moves: Move[]): Move {
  let best = Infinity;
  let choice = moves[0];
  for (const m of moves) {
    const score = minimax(applyMove(pos, m), 2, -Infinity, Infinity);
    if (score < best) {
      best = score;
      choice = m;
    } else if (score === best && Math.random() < 0.3) {
      choice = m;
    }
  }
  return choice;
}

/** Terminal detection after a move has been played. */
function resultOf(pos: Position): { outcome: Outcome; msg: string } | null {
  const moves = legalMoves(pos);
  if (moves.length === 0) {
    if (inCheck(pos)) {
      return pos.turn === "w"
        ? { outcome: "lost", msg: "Checkmate \u2014 CPU wins \uD83E\uDD16" }
        : { outcome: "won", msg: "Checkmate! You win \uD83C\uDF89" };
    }
    return { outcome: "draw", msg: "Stalemate \u2014 draw" };
  }
  if (pos.half >= 100) return { outcome: "draw", msg: "Draw \u2014 50-move rule" };
  return null;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Chess({ gameId }: { gameId: string }) {
  const [pos, setPos] = useState<Position>(() => initialPosition());
  const [past, setPast] = useState<Snapshot[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [last, setLast] = useState<{ from: number; to: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("playing");
  const [overMsg, setOverMsg] = useState("");
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

  const selMoves = useMemo(
    () => (sel === null ? [] : legalMoves(pos).filter((m) => m.from === sel)),
    [sel, pos],
  );

  const checkedKing = useMemo(() => {
    const k = findKing(pos.board, pos.turn);
    return k >= 0 && isAttacked(pos.board, k, other(pos.turn)) ? k : -1;
  }, [pos]);

  const captured = useMemo(() => {
    const start: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
    const alive: Record<Color, Record<PieceType, number>> = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    };
    for (const p of pos.board) if (p) alive[p.c][p.t]++;
    const order: PieceType[] = ["q", "r", "b", "n", "p"];
    const mine: string[] = [];
    const theirs: string[] = [];
    for (const t of order) {
      for (let i = 0; i < start[t] - alive.b[t]; i++) mine.push(GLYPH.b[t]);
      for (let i = 0; i < start[t] - alive.w[t]; i++) theirs.push(GLYPH.w[t]);
    }
    return { mine, theirs };
  }, [pos]);

  const finish = useCallback(
    (result: { outcome: Outcome; msg: string }) => {
      setOutcome(result.outcome);
      setOverMsg(result.msg);
      const s = seriesRef.current;
      const key = result.outcome === "won" ? "you" : result.outcome === "lost" ? "cpu" : "draws";
      const updated: Series = { ...s, [key]: s[key] + 1 };
      seriesRef.current = updated;
      setSeries(updated);
      if (result.outcome === "won") setNewBest(submit(updated.you));
    },
    [setSeries, submit],
  );

  const playerMove = (m: Move) => {
    setPast((p) => [...p, { pos, last }]);
    const next = applyMove(pos, m);
    setPos(next);
    setLast({ from: m.from, to: m.to });
    setSel(null);
    const res = resultOf(next);
    if (res) {
      finish(res);
      return;
    }
    setThinking(true);
    cpuTimer.current = setTimeout(() => {
      const cpuM = cpuMove(next, legalMoves(next));
      const reply = applyMove(next, cpuM);
      setPast((p) => [...p, { pos: next, last: { from: m.from, to: m.to } }]);
      setPos(reply);
      setLast({ from: cpuM.from, to: cpuM.to });
      setThinking(false);
      const result = resultOf(reply);
      if (result) finish(result);
    }, 340);
  };

  const onCell = (i: number) => {
    if (outcome !== "playing" || thinking || pos.turn !== "w") return;
    const hit = sel === null ? undefined : selMoves.find((m) => m.to === i);
    if (hit) {
      playerMove(hit);
      return;
    }
    const p = pos.board[i];
    setSel(p && p.c === "w" ? i : null);
  };

  const newGame = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setPos(initialPosition());
    setPast([]);
    setSel(null);
    setLast(null);
    setOutcome("playing");
    setOverMsg("");
    setThinking(false);
    setNewBest(false);
  }, []);

  const undo = () => {
    if (outcome !== "playing" || past.length === 0) return;
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    const idx = pos.turn === "w" && past.length >= 2 ? past.length - 2 : past.length - 1;
    const snap = past[idx];
    setPast(past.slice(0, idx));
    setPos(snap.pos);
    setLast(snap.last);
    setSel(null);
    setThinking(false);
  };

  const statusText =
    outcome === "won"
      ? "Checkmate! \uD83C\uDF89"
      : outcome === "lost"
        ? "CPU delivers mate \uD83E\uDD16"
        : outcome === "draw"
          ? "Draw \u2014 nobody takes it"
          : thinking
            ? "CPU is thinking\u2026"
            : checkedKing >= 0
              ? "Check!"
              : "Your move \u2654";
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

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs uppercase tracking-wider">
        <span className={thinking ? "text-rose-300" : "text-muted"}>
          {thinking ? "Thinking\u2026 " : ""}
          <b className="text-ink">{statusText}</b>
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={outcome !== "playing" || past.length === 0}
            className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-muted transition hover:text-ink disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={newGame}
            className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            New game
          </button>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
        <span className="text-rose-400" aria-label="Pieces you captured">
          {captured.mine.join("") || <span className="text-xs text-muted">no captures</span>}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">captured</span>
        <span className="text-white" aria-label="Pieces the CPU captured">
          {captured.theirs.join("") || <span className="text-xs text-muted">none</span>}
        </span>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-2 shadow-[0_0_60px_-24px_rgba(34,211,238,0.7)] sm:p-3">
        <div className="grid grid-cols-8 gap-px overflow-hidden rounded-lg border border-line bg-line">
          {Array.from({ length: 64 }, (_, i) => {
            const r = ROW(i);
            const c = COL(i);
            const piece = pos.board[i];
            const isSel = sel === i;
            const target = selMoves.find((m) => m.to === i);
            const isLast = last && (last.from === i || last.to === i);
            const isCheck = checkedKing === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onCell(i)}
                aria-label={`${FILES[c]}${8 - r}${piece ? ` ${piece.c === "w" ? "white" : "black"} ${NAME[piece.t]}` : ""}`}
                className={cn(
                  "relative grid aspect-square select-none place-items-center rounded-none border border-transparent text-xl leading-none transition hover:border-primary/50 hover:brightness-110 sm:text-2xl",
                  (r + c) % 2 === 0 ? "bg-[#2b2b50]" : "bg-[#15152a]",
                  isSel && "z-10 shadow-[inset_0_0_0_2px_#22d3ee]",
                  !isSel && isCheck && "shadow-[inset_0_0_0_2px_#fb7185]",
                )}
              >
                {isLast && (
                  <span className="pointer-events-none absolute inset-0 bg-cyan-400/15" />
                )}
                {target && (
                  <span
                    className={cn(
                      "pointer-events-none absolute",
                      target.ep || pos.board[i]
                        ? "h-3.5 w-3.5 rounded-full border-2 border-rose-400/80"
                        : "h-3 w-3 rounded-full bg-cyan-400/70",
                    )}
                  />
                )}
                {piece && (
                  <span
                    className={cn(
                      "relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
                      piece.c === "w" ? "text-white" : "text-rose-400",
                    )}
                  >
                    {GLYPH[piece.c][piece.t]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {outcome !== "playing" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">{overMsg}</p>
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
                outcome === "won"
                  ? "from-cyan-400 via-sky-500 to-blue-600"
                  : outcome === "lost"
                    ? "from-amber-400 via-orange-500 to-red-500"
                    : "from-slate-400 via-zinc-500 to-neutral-700"
              }
            >
              New game
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Click a piece, then a highlighted square &middot; you play White
      </p>
    </div>
  );
}
