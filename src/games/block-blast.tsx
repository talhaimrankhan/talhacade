"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const SIZE = 8;
const EMPTY = -1;

/** [column offset, row offset] from the piece's top-left corner. */
type Cell = [number, number];

interface Piece {
  shape: Cell[];
  color: number;
}

/** No rotation — each entry is its own fixed piece. */
const SHAPES: Cell[][] = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
];

/** Literal Tailwind colours — darker border gives every block a bevel. */
const BLOCK_STYLES = [
  "bg-rose-500 border-rose-700",
  "bg-cyan-400 border-cyan-600",
  "bg-emerald-500 border-emerald-700",
  "bg-amber-400 border-amber-600",
  "bg-violet-500 border-violet-700",
  "bg-sky-500 border-sky-700",
];

const dims = (shape: Cell[]) => ({
  w: Math.max(...shape.map(([dc]) => dc)) + 1,
  h: Math.max(...shape.map(([, dr]) => dr)) + 1,
});

function makePiece(): Piece {
  return {
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    color: Math.floor(Math.random() * BLOCK_STYLES.length),
  };
}

function fillTray(): Piece[] {
  return [makePiece(), makePiece(), makePiece()];
}

function fits(board: number[], shape: Cell[], origin: number): boolean {
  const r0 = Math.floor(origin / SIZE);
  const c0 = origin % SIZE;
  for (const [dc, dr] of shape) {
    const r = r0 + dr;
    const c = c0 + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    if (board[r * SIZE + c] !== EMPTY) return false;
  }
  return true;
}

function place(
  board: number[],
  shape: Cell[],
  origin: number,
  color: number,
): number[] {
  const next = [...board];
  const r0 = Math.floor(origin / SIZE);
  const c0 = origin % SIZE;
  for (const [dc, dr] of shape) {
    next[(r0 + dr) * SIZE + (c0 + dc)] = color;
  }
  return next;
}

/** Every cell of every completely filled row and column, plus the count. */
function fullLines(board: number[]): { cells: number[]; count: number } {
  const cells: number[] = [];
  let count = 0;
  for (let r = 0; r < SIZE; r++) {
    let full = true;
    for (let c = 0; c < SIZE; c++) {
      if (board[r * SIZE + c] === EMPTY) {
        full = false;
        break;
      }
    }
    if (full) {
      count++;
      for (let c = 0; c < SIZE; c++) cells.push(r * SIZE + c);
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let full = true;
    for (let r = 0; r < SIZE; r++) {
      if (board[r * SIZE + c] === EMPTY) {
        full = false;
        break;
      }
    }
    if (full) {
      count++;
      for (let r = 0; r < SIZE; r++) cells.push(r * SIZE + c);
    }
  }
  return { cells, count };
}

function anyFits(board: number[], pieces: (Piece | null)[]): boolean {
  for (const piece of pieces) {
    if (!piece) continue;
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== EMPTY) continue;
      if (fits(board, piece.shape, i)) return true;
    }
  }
  return false;
}

export default function BlockBlast({ gameId }: { gameId: string }) {
  const [board, setBoard] = useState<number[]>(() =>
    Array<number>(SIZE * SIZE).fill(EMPTY),
  );
  const [tray, setTray] = useState<(Piece | null)[]>(() => fillTray());
  const [sel, setSel] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [popping, setPopping] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [gain, setGain] = useState<string | null>(null);
  const [shakeSlot, setShakeSlot] = useState(-1);
  const [jitter, setJitter] = useState(0);
  const [over, setOver] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shakeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scoreRef = useRef(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    shakeTimers.current.forEach(clearTimeout);
    shakeTimers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const shake = useCallback((slot: number) => {
    shakeTimers.current.forEach(clearTimeout);
    shakeTimers.current = [];
    setShakeSlot(slot);
    [-8, 8, -5, 5, 0].forEach((dx, i) => {
      shakeTimers.current.push(setTimeout(() => setJitter(dx), i * 55));
    });
  }, []);

  const restart = useCallback(() => {
    clearTimers();
    scoreRef.current = 0;
    setBoard(Array<number>(SIZE * SIZE).fill(EMPTY));
    setTray(fillTray());
    setSel(null);
    setHover(null);
    setPopping([]);
    setBusy(false);
    setScore(0);
    setStreak(0);
    setGain(null);
    setShakeSlot(-1);
    setJitter(0);
    setOver(false);
    setNewBest(false);
  }, [clearTimers]);

  const placePiece = useCallback(
    (origin: number) => {
      if (sel === null || busy || over) return;
      const piece = tray[sel];
      if (!piece) return;

      if (!fits(board, piece.shape, origin)) {
        shake(sel);
        return;
      }

      const nextBoard = place(board, piece.shape, origin, piece.color);
      const nextTray = tray.map((p, i) => (i === sel ? null : p));
      scoreRef.current += piece.shape.length;
      setScore(scoreRef.current);
      setBoard(nextBoard);
      setTray(nextTray);
      setSel(null);
      setHover(null);

      const lines = fullLines(nextBoard);
      const refilled =
        nextTray.every((p) => p === null) ? fillTray() : nextTray;

      if (lines.count === 0) {
        setStreak(0);
        if (refilled !== nextTray) setTray(refilled);
        if (!anyFits(nextBoard, refilled)) {
          setOver(true);
          setNewBest(submit(scoreRef.current));
        }
        return;
      }

      // Pop the finished lines, then pay out the line + streak bonus.
      setBusy(true);
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setPopping(lines.cells);
      const lineSet = new Set(lines.cells);
      const t = setTimeout(() => {
        const cleared = nextBoard.map((v, i) => (lineSet.has(i) ? EMPTY : v));
        const lineScore = lines.count * 100 * (lines.count > 1 ? 2 : 1);
        const bonus = nextStreak * 25;
        scoreRef.current += lineScore + bonus;
        setScore(scoreRef.current);
        setGain(`+${lineScore + bonus}`);
        const t2 = setTimeout(() => setGain(null), 1200);
        timers.current.push(t2);
        setBoard(cleared);
        setPopping([]);
        if (refilled !== nextTray) setTray(refilled);
        setBusy(false);
        if (!anyFits(cleared, refilled)) {
          setOver(true);
          setNewBest(submit(scoreRef.current));
        }
      }, 340);
      timers.current.push(t);
    },
    [sel, busy, over, tray, board, streak, shake, submit],
  );

  const activePiece = sel !== null ? tray[sel] : undefined;
  const ghostCells = new Set<number>();
  let ghostValid = false;
  if (activePiece && hover !== null && !busy && !over) {
    ghostValid = fits(board, activePiece.shape, hover);
    const r0 = Math.floor(hover / SIZE);
    const c0 = hover % SIZE;
    for (const [dc, dr] of activePiece.shape) {
      const r = r0 + dr;
      const c = c0 + dc;
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) ghostCells.add(r * SIZE + c);
    }
  }
  const popSet = new Set(popping);

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-accent">
          Streak{" "}
          <b className="ml-1 text-sm text-ink tabular-nums">{streak}</b>
        </span>
        {gain && (
          <span className="animate-pop font-bold text-success">{gain}</span>
        )}
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-2.5 shadow-[0_0_60px_-22px_rgba(251,191,36,0.55)] sm:p-3">
        <div
          className="grid grid-cols-8 gap-1 select-none sm:gap-1.5"
          onMouseLeave={() => setHover(null)}
          role="grid"
          aria-label="8 by 8 board. Pick a piece, then tap a cell to place it."
        >
          {board.map((v, i) => {
            const isGhost = ghostCells.has(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => placePiece(i)}
                onMouseEnter={() => setHover(i)}
                aria-label={`Row ${Math.floor(i / SIZE) + 1} column ${
                  (i % SIZE) + 1
                }: ${v === EMPTY ? "empty" : "filled"}`}
                className={cn(
                  "grid aspect-square place-items-center rounded-lg border-2 transition duration-200",
                  v === EMPTY
                    ? "border-line bg-[#131322]"
                    : cn(
                        BLOCK_STYLES[v],
                        "shadow-[0_2px_0_rgba(0,0,0,0.35)]",
                      ),
                  popSet.has(i) && "scale-110 opacity-0",
                  isGhost && ghostValid && activePiece
                    ? cn(BLOCK_STYLES[activePiece.color], "opacity-45")
                    : null,
                  isGhost && !ghostValid && "border-danger bg-danger/25",
                )}
              />
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {tray.map((piece, i) => {
            const pieceDims = piece ? dims(piece.shape) : null;
            return (
              <button
                key={i}
                type="button"
                disabled={!piece || busy || over}
                onClick={() => setSel(i)}
                aria-label={
                  piece ? `Select tray piece ${i + 1}` : "Empty tray slot"
                }
                aria-pressed={sel === i}
                className={cn(
                  "grid min-h-[68px] place-items-center rounded-xl border-2 p-2 transition disabled:opacity-50",
                  sel === i
                    ? "border-primary bg-primary/10"
                    : "border-line bg-[#131322] hover:border-primary/50",
                )}
                style={
                  shakeSlot === i
                    ? { transform: `translateX(${jitter}px)` }
                    : undefined
                }
              >
                {piece && pieceDims ? (
                  <span
                    className="grid gap-0.5"
                    style={{
                      gridTemplateColumns: `repeat(${pieceDims.w}, 13px)`,
                      gridTemplateRows: `repeat(${pieceDims.h}, 13px)`,
                    }}
                  >
                    {piece.shape.map(([dc, dr]) => (
                      <span
                        key={`${dc}-${dr}`}
                        className={cn(
                          "rounded-[3px] border",
                          BLOCK_STYLES[piece.color],
                        )}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="font-mono text-xs text-muted">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {over && (
          <Overlay>
            <p className="text-4xl">🧱</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              NO ROOM LEFT
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New high score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white tabular-nums">
              {score}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={restart}
              tone="from-yellow-400 via-amber-500 to-orange-600"
            >
              New game
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a piece, then tap the board to drop it · full rows and columns pop
        together · no piece left that fits = game over
      </p>
    </div>
  );
}
