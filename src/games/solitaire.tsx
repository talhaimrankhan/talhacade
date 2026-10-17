"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

interface Card {
  id: number;
  r: number; // 1..13
  s: number; // 0..3 spades, hearts, diamonds, clubs
  up: boolean;
}

interface GameState {
  stock: Card[];
  waste: Card[];
  fnd: Card[][];
  tab: Card[][];
}

type Src = { kind: "waste" } | { kind: "tab"; col: number; index: number };
type Zone = { kind: "tab"; col: number } | { kind: "fnd"; i: number };
type Phase = "idle" | "playing" | "won";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const isRed = (s: number) => s === 1 || s === 2;

function deal(): GameState {
  const deck: Card[] = [];
  let id = 0;
  for (let s = 0; s < 4; s++)
    for (let r = 1; r <= 13; r++) deck.push({ id: id++, r, s, up: false });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tab: Card[][] = [];
  let k = 0;
  for (let c = 0; c < 7; c++) {
    const col: Card[] = [];
    for (let n = 0; n <= c; n++) col.push({ ...deck[k++], up: n === c });
    tab.push(col);
  }
  return { stock: deck.slice(k), waste: [], fnd: [[], [], [], []], tab };
}

const canTab = (c: Card, dest: Card[]) => {
  const top = dest[dest.length - 1];
  return top ? top.up && top.r === c.r + 1 && isRed(top.s) !== isRed(c.s) : c.r === 13;
};

const canFnd = (c: Card, dest: Card[]) => {
  const top = dest[dest.length - 1];
  return top ? top.s === c.s && c.r === top.r + 1 : c.r === 1;
};

/** Pure move — returns the next state, or null when the move is illegal. */
function applyMove(s: GameState, from: Src, to: Zone): GameState | null {
  const col = from.kind === "tab" ? s.tab[from.col] : null;
  const card =
    from.kind === "waste" ? s.waste[s.waste.length - 1] : (col?.[from.index] ?? null);
  if (!card || !card.up) return null;
  if (to.kind === "tab") {
    if (from.kind === "tab" && from.col === to.col) return null;
    if (!canTab(card, s.tab[to.col])) return null;
  } else if (!canFnd(card, s.fnd[to.i]) || (from.kind === "tab" && from.index !== col!.length - 1)) {
    return null;
  }

  const tab = s.tab.map((c) => [...c]);
  const waste = [...s.waste];
  const fnd = s.fnd.map((f) => [...f]);
  const moving =
    from.kind === "waste" ? [waste.pop()!] : tab[from.col].splice(from.index);

  if (from.kind === "tab") {
    const last = tab[from.col].length - 1;
    if (last >= 0 && !tab[from.col][last].up)
      tab[from.col][last] = { ...tab[from.col][last], up: true };
  }
  if (to.kind === "tab") tab[to.col].push(...moving);
  else fnd[to.i].push(...moving);
  return { ...s, tab, waste, fnd };
}

/** Deal one from the stock, or recycle the waste once the stock runs dry. */
function drawOne(s: GameState): GameState {
  if (s.stock.length)
    return {
      ...s,
      stock: s.stock.slice(0, -1),
      waste: [...s.waste, { ...s.stock[s.stock.length - 1], up: true }],
    };
  return {
    ...s,
    stock: s.waste.slice().reverse().map((c) => ({ ...c, up: false })),
    waste: [],
  };
}

const isWin = (s: GameState) => s.fnd.every((f) => f.length === 13);

function parseSrc(v: string): Src | null {
  if (v === "w") return { kind: "waste" };
  const m = /^t:(\d+):(\d+)$/.exec(v);
  return m ? { kind: "tab", col: +m[1], index: +m[2] } : null;
}

function parseZone(v: string): Zone | null {
  const m = /^t:(\d+)$/.exec(v) ?? /^f:(\d+)$/.exec(v);
  if (!m) return null;
  return v.startsWith("t:") ? { kind: "tab", col: +m[1] } : { kind: "fnd", i: +m[1] };
}

const sameSrc = (a: Src, b: Src) =>
  a.kind === b.kind &&
  (a.kind === "waste" || (a.kind === "tab" && b.kind === "tab" && a.col === b.col && a.index === b.index));

const clock = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

function Face({ card }: { card: Card }) {
  const tone = isRed(card.s) ? "text-rose-400" : "text-ink";
  if (!card.up)
    return (
      <div className="relative aspect-[5/7] w-full rounded-md border border-line bg-[#191930]">
        <span className="absolute inset-0 grid place-items-center text-white/10">◆</span>
      </div>
    );
  return (
    <div className="relative aspect-[5/7] w-full rounded-md border border-line bg-[#0d0d1a] shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
      <span className={cn("absolute left-1 top-1 font-mono text-[10px] font-bold leading-none sm:text-xs", tone)}>
        {RANKS[card.r]}
        <span className="block text-center">{SUITS[card.s]}</span>
      </span>
      <span className={cn("grid h-full place-items-center text-lg sm:text-2xl", tone)}>{SUITS[card.s]}</span>
    </div>
  );
}

const Slot = ({ label }: { label: string }) => (
  <div className="grid aspect-[5/7] w-full place-items-center rounded-md border border-dashed border-line text-muted/40">
    <span className="text-lg opacity-60">{label}</span>
  </div>
);

export default function Solitaire({ gameId }: { gameId: string }) {
  const [state, setState] = useState<GameState>(() => deal());
  const [history, setHistory] = useState<GameState[]>([]);
  const [selection, setSelection] = useState<Src | null>(null);
  const [drag, setDrag] = useState<{ from: Src; cards: Card[]; x: number; y: number } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "low");

  const secondsRef = useRef(0);
  const pending = useRef<{ from: Src; cards: Card[]; x: number; y: number; moved: boolean } | null>(null);
  const suppress = useRef(false);

  const start = useCallback(() => {
    secondsRef.current = 0;
    setSeconds(0);
    setState(deal());
    setHistory([]);
    setSelection(null);
    setDrag(null);
    setNewBest(false);
    setPhase("playing");
  }, []);

  // ticking clock — seconds are advanced inside the interval callback only
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const doMove = useCallback(
    (from: Src, to: Zone): boolean => {
      const next = applyMove(state, from, to);
      if (!next) return false;
      setHistory((h) => [...h, state]);
      setState(next);
      setSelection(null);
      if (isWin(next)) {
        setPhase("won");
        setNewBest(submit(secondsRef.current));
      }
      return true;
    },
    [state, submit],
  );

  const clickStock = () => {
    if (phase !== "playing") return;
    setHistory((h) => [...h, state]);
    setState(drawOne(state));
    setSelection(null);
  };

  const clickCard = (from: Src, card: Card) => {
    if (suppress.current) {
      suppress.current = false;
      return;
    }
    if (phase !== "playing") return;
    if (selection && sameSrc(selection, from)) {
      setSelection(null);
      return;
    }
    const zone: Zone | null = from.kind === "tab" ? { kind: "tab", col: from.col } : null;
    if (selection && zone && doMove(selection, zone)) return;
    if (card.up) setSelection(from);
  };

  const clickZone = (zoneId: string) => {
    if (suppress.current) {
      suppress.current = false;
      return;
    }
    if (phase !== "playing" || !selection) return;
    const zone = parseZone(zoneId);
    if (zone) doMove(selection, zone);
  };

  const autoFoundation = (from: Src) => {
    if (phase !== "playing") return;
    for (let i = 0; i < 4; i++) if (doMove(from, { kind: "fnd", i })) return;
  };

  const undo = () => {
    if (!history.length) return;
    setState(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setSelection(null);
    setDrag(null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    suppress.current = false;
    if (e.button !== 0) return;
    const el = (e.target as HTMLElement).closest("[data-src]");
    const from = el ? parseSrc(el.getAttribute("data-src") ?? "") : null;
    if (!from || phase !== "playing") return;
    const card =
      from.kind === "waste" ? state.waste[state.waste.length - 1] : state.tab[from.col][from.index];
    if (!card?.up) return;
    const cards = from.kind === "waste" ? [card] : state.tab[from.col].slice(from.index);
    pending.current = { from, cards, x: e.clientX, y: e.clientY, moved: false };
  };

  // drag: follow the pointer, then resolve the zone underneath on release
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      if (!p.moved) {
        if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) < 12) return;
        p.moved = true;
        suppress.current = true;
        setDrag({ from: p.from, cards: p.cards, x: e.clientX, y: e.clientY });
        return;
      }
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    };
    const onUp = (e: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      pending.current = null;
      if (!p.moved) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const zoneId = el?.closest("[data-drop]")?.getAttribute("data-drop") ?? null;
      setDrag(null);
      const zone = zoneId ? parseZone(zoneId) : null;
      if (zone && phase === "playing") doMove(p.from, zone);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [doMove, phase]);

  const draggingIds = drag ? new Set(drag.cards.map((c) => c.id)) : null;
  const isSel = (from: Src) => !draggingIds && selection !== null && sameSrc(selection, from);
  const top = state.waste[state.waste.length - 1];
  const undoBtn =
    "rounded-md border border-line bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink transition";

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={clock(seconds)} best={best === null ? "—" : `${best}s`}>
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={!history.length}
            className={cn(undoBtn, "enabled:hover:border-primary/50 disabled:opacity-40")}
          >
            ↶ Undo
          </button>
          <button type="button" onClick={start} className={cn(undoBtn, "hover:border-primary/50")}>
            ⟳ New deal
          </button>
        </span>
      </GameHud>

      <div
        onPointerDown={onPointerDown}
        className="relative touch-none select-none rounded-2xl border border-line bg-surface-2 p-2 shadow-[0_0_60px_-24px_rgba(139,92,246,0.9)] sm:p-3"
      >
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={clickStock}
            aria-label={state.stock.length ? "Stock — deal a card" : "Recycle the waste"}
            className="rounded-md transition hover:brightness-110 active:scale-95"
          >
            {state.stock.length ? <Face card={{ id: -1, r: 0, s: 0, up: false }} /> : <Slot label="↻" />}
          </button>

          <div data-src={top ? "w" : undefined}>
            {top ? (
              <div
                onClick={() => clickCard({ kind: "waste" }, top)}
                onDoubleClick={() => autoFoundation({ kind: "waste" })}
                className={cn(
                  "rounded-md transition",
                  isSel({ kind: "waste" }) && "-translate-y-1 ring-2 ring-primary/90",
                )}
              >
                <Face card={top} />
              </div>
            ) : (
              <Slot label="" />
            )}
          </div>

          <div />

          {state.fnd.map((pile, i) => (
            <div
              key={i}
              data-drop={`f:${i}`}
              onClick={() => clickZone(`f:${i}`)}
              aria-label={`Foundation ${i + 1}`}
              className="cursor-pointer rounded-md transition"
            >
              {pile.length ? <Face card={pile[pile.length - 1]} /> : <Slot label={SUITS[i]} />}
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2">
          {state.tab.map((column, col) => (
            <div
              key={col}
              data-drop={`t:${col}`}
              onClick={() => clickZone(`t:${col}`)}
              aria-label={`Column ${col + 1}`}
              className="flex flex-col rounded-md"
            >
              {column.length === 0 && <Slot label="K" />}
              {column.map((card, idx) => {
                const from: Src = { kind: "tab", col, index: idx };
                return (
                  <div
                    key={card.id}
                    data-src={card.up ? `t:${col}:${idx}` : undefined}
                    data-drop={`t:${col}`}
                    onClick={() => (card.up ? clickCard(from, card) : clickZone(`t:${col}`))}
                    onDoubleClick={card.up ? () => autoFoundation(from) : undefined}
                    style={{ marginTop: idx === 0 ? undefined : card.up ? "-98%" : "-117.6%" }}
                    className={cn(
                      "relative rounded-md transition",
                      draggingIds?.has(card.id) && "opacity-40",
                      isSel(from) && card.up && "ring-2 ring-primary/90",
                    )}
                  >
                    <Face card={card} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* the dragged stack follows the pointer */}
        {drag && (
          <div
            aria-hidden
            className="pointer-events-none fixed z-50 w-16"
            style={{ left: drag.x, top: drag.y, transform: "translate(-50%, -50%)" }}
          >
            {drag.cards.map((card, i) => (
              <div key={card.id} style={{ marginTop: i === 0 ? undefined : "-98%" }}>
                <Face card={card} />
              </div>
            ))}
          </div>
        )}

        {phase === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">SOLITAIRE</p>
            <p className="mt-2 text-sm text-muted">Klondike draw-1 · down alternating, up by suit</p>
            <PrimaryButton onClick={start} tone="from-sky-400 via-blue-500 to-indigo-600">
              Deal cards
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Drag or tap to move · double-click auto-files</p>
          </Overlay>
        )}

        {phase === "won" && (
          <Overlay>
            <p className="text-4xl">♠️</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">YOU WON</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fastest win!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{clock(seconds)}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best}s`}
            </p>
            <PrimaryButton onClick={start} tone="from-sky-400 via-blue-500 to-indigo-600">
              New deal
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a card then its destination · drag stacks · double-click to auto-file
      </p>
    </div>
  );
}
