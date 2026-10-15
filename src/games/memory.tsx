"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const EMOJIS = ["🍕", "👾", "🚀", "🌈", "🔥", "🐙", "💎", "🎮"];

interface Card {
  key: number;
  emoji: string;
  faceUp: boolean;
  matched: boolean;
}

function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function deal(): Card[] {
  const pairs = [...EMOJIS, ...EMOJIS];
  return shuffle(pairs).map((emoji, key) => ({
    key,
    emoji,
    faceUp: false,
    matched: false,
  }));
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Memory({ gameId }: { gameId: string }) {
  const [cards, setCards] = useState<Card[]>(() => deal());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "low");
  const lockRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restart = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    lockRef.current = false;
    setCards(deal());
    setFlipped([]);
    setMoves(0);
    setSeconds(0);
    setStarted(false);
    setWon(false);
    setNewBest(false);
  }, []);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  // clock
  useEffect(() => {
    if (!started || won) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [started, won]);

  const flip = (index: number) => {
    if (lockRef.current || won) return;
    const card = cards[index];
    if (card.faceUp || card.matched) return;

    if (!started) setStarted(true);

    const nextCards = cards.map((c, i) =>
      i === index ? { ...c, faceUp: true } : c,
    );
    const nextFlipped = [...flipped, index];
    setCards(nextCards);

    if (nextFlipped.length < 2) {
      setFlipped(nextFlipped);
      return;
    }

    // two cards up — resolve the pair
    const [a, b] = nextFlipped;
    const isMatch = nextCards[a].emoji === nextCards[b].emoji;
    const nextMoves = moves + 1;
    setMoves(nextMoves);
    setFlipped([]);
    lockRef.current = true;

    if (isMatch) {
      const matchedCards = nextCards.map((c, i) =>
        i === a || i === b ? { ...c, matched: true } : c,
      );
      setCards(matchedCards);
      lockRef.current = false;

      if (matchedCards.every((c) => c.matched)) {
        setWon(true);
        setNewBest(submit(nextMoves));
      }
    } else {
      timeoutRef.current = setTimeout(() => {
        setCards((prev) =>
          prev.map((c, i) =>
            i === a || i === b ? { ...c, faceUp: false } : c,
          ),
        );
        lockRef.current = false;
      }, 720);
    }
  };

  return (
    <div className="w-full max-w-[440px]">
      <GameHud
        score={`${moves} moves`}
        best={best === null ? "—" : `${best} moves`}
      >
        <span className="text-accent">
          Time{" "}
          <b className="ml-1 text-sm text-ink tabular-nums">
            {formatTime(seconds)}
          </b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-22px_rgba(52,211,153,0.8)]">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {cards.map((card, i) => (
            <button
              key={card.key}
              type="button"
              onClick={() => flip(i)}
              aria-label={card.faceUp || card.matched ? card.emoji : "Hidden card"}
              className="aspect-square [perspective:800px]"
            >
              <div
                className={cn(
                  "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]",
                  card.faceUp && "[transform:rotateY(180deg)]",
                )}
              >
                {/* card back */}
                <span className="absolute inset-0 grid place-items-center rounded-xl border border-line bg-gradient-to-br from-violet-600/70 to-cyan-700/60 font-display text-xl font-bold text-white/80 [backface-visibility:hidden] transition group-hover:brightness-110">
                  ?
                </span>
                {/* card face */}
                <span
                  className={cn(
                    "absolute inset-0 grid place-items-center rounded-xl border bg-[#101022] text-3xl [backface-visibility:hidden] [transform:rotateY(180deg)]",
                    card.matched
                      ? "animate-pop border-success/70 bg-success/10 shadow-[0_0_20px_-6px_rgba(52,211,153,0.9)]"
                      : "border-line",
                  )}
                >
                  {card.emoji}
                </span>
              </div>
            </button>
          ))}
        </div>

        {won && (
          <Overlay>
            <p className="text-4xl">🧠</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">
              ALL PAIRS FOUND
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New fewest moves!
              </p>
            )}
            <p className="mt-3 font-mono text-3xl font-bold text-white">
              {moves} moves · {formatTime(seconds)}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best === null ? "—" : `${best} moves`}
            </p>
            <PrimaryButton onClick={restart} tone="from-emerald-400 to-teal-500">
              Shuffle again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Flip two cards · match all eight pairs in as few moves as you can
      </p>
    </div>
  );
}
