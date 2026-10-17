"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

const SIZE = 16;

interface Pattern {
  name: string;
  emoji: string;
  /** Palette hexes — index 0 is the (pre-filled) background. */
  palette: string[];
  /** 16 rows of 16 palette indices. */
  rows: string[];
}

const PATTERNS: Pattern[] = [
  {
    name: "Heart",
    emoji: "💗",
    palette: ["#141426", "#fda4af", "#f43f5e", "#be123c"],
    rows: [
      "0000000000000000",
      "0003300000033000",
      "0032230000322300",
      "0312223003222230",
      "3122222332222223",
      "3222222222222223",
      "3222222222222223",
      "0322222222222230",
      "0032222222222300",
      "0003222222223000",
      "0000322222230000",
      "0000032222300000",
      "0000003223000000",
      "0000000330000000",
      "0000000000000000",
      "0000000000000000",
    ],
  },
  {
    name: "Rocket",
    emoji: "🚀",
    palette: ["#141426", "#e2e8f0", "#38bdf8", "#fb7185", "#fb923c", "#fde68a"],
    rows: [
      "0000000010000000",
      "0000000111000000",
      "0000000121000000",
      "0000000121000000",
      "0000001121100000",
      "0000001111100000",
      "0003001111103000",
      "0033001111103300",
      "0333001111103330",
      "0333001111103330",
      "0033001111103300",
      "0003001111103000",
      "0000001111100000",
      "0000000444000000",
      "0000004555400000",
      "0000000555000000",
    ],
  },
  {
    name: "Skull",
    emoji: "💀",
    palette: ["#141426", "#e2e8f0", "#1e293b", "#94a3b8"],
    rows: [
      "0000011111100000",
      "0001111111111000",
      "0011111111111100",
      "0111111111111110",
      "0111222112221110",
      "0111222112221110",
      "0111111111111110",
      "0011111211111100",
      "0011111211111100",
      "0001111111111000",
      "0000111111110000",
      "0000011111100000",
      "0000131313130000",
      "0000111111110000",
      "0000011111100000",
      "0000000000000000",
    ],
  },
  {
    name: "Cat",
    emoji: "🐱",
    palette: ["#141426", "#f59e0b", "#fcd34d", "#10b981", "#292524"],
    rows: [
      "0001100000011000",
      "0011410000114100",
      "0111111001111110",
      "1114411111144111",
      "1113311111133111",
      "1113311111133111",
      "1111111111111111",
      "1111111441111111",
      "4411122222211144",
      "1111122244221111",
      "4411122222211144",
      "1111111111111111",
      "1111111111111111",
      "0111111111111110",
      "0011111111111100",
      "0000000000000000",
    ],
  },
  {
    name: "Star",
    emoji: "⭐",
    palette: ["#141426", "#fbbf24", "#fde68a", "#f59e0b", "#ffffff"],
    rows: [
      "0000000040000000",
      "0000000121000000",
      "0000000121000000",
      "0000001121100000",
      "3111111221111113",
      "0111111221111110",
      "0011112222111100",
      "0001112222211100",
      "0000112222110000",
      "0000112222110000",
      "0001112222211100",
      "0011112222111100",
      "0111111221111110",
      "1111111221111111",
      "0110000000000110",
      "0000000000000000",
    ],
  },
  {
    name: "Mushroom",
    emoji: "🍄",
    palette: ["#141426", "#ef4444", "#fef3c7", "#fcd9a0", "#3f3f46", "#92400e"],
    rows: [
      "0000011111100000",
      "0001111111111000",
      "0011122221111100",
      "0111221122111110",
      "0111221122111110",
      "0111112222111110",
      "1111111111111111",
      "0444444444444440",
      "0033333333333300",
      "0033333333333300",
      "0033333333333300",
      "0033333333333300",
      "0003333333333000",
      "0000555555550000",
      "0000055555500000",
      "0000000000000000",
    ],
  },
];

export default function PixelPainter({ gameId }: { gameId: string }) {
  const [patternIdx, setPatternIdx] = useState(0);
  const [painted, setPainted] = useState<Set<number>>(() => new Set());
  const [selected, setSelected] = useState(1);
  const [done, setDone] = useState(false);
  const [artCount, setArtCount] = useStored(`art:${gameId}`, 0);
  const countedRef = useRef(false);

  const pattern = PATTERNS[patternIdx];

  const values = useMemo(
    () =>
      pattern.rows
        .join("")
        .split("")
        .map((ch) => Number(ch)),
    [pattern],
  );

  const target = useMemo(
    () => values.reduce((n, v) => (v === 0 ? n : n + 1), 0),
    [values],
  );

  const remaining = useMemo(() => {
    const counts = pattern.palette.map(() => 0);
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v !== 0 && !painted.has(i)) counts[v] += 1;
    }
    return counts;
  }, [pattern, values, painted]);

  const paint = useCallback(
    (cell: number) => {
      if (done) return;
      const v = values[cell];
      if (v === 0 || painted.has(cell) || v !== selected) return;

      const next = new Set(painted);
      next.add(cell);
      setPainted(next);

      if (next.size >= target) {
        setDone(true);
        if (!countedRef.current) {
          countedRef.current = true;
          setArtCount((c) => c + 1);
        }
      }
    },
    [done, values, painted, selected, target, setArtCount],
  );

  const nextArtwork = useCallback(() => {
    setPatternIdx((p) => (p + 1) % PATTERNS.length);
    setPainted(new Set());
    setSelected(1);
    setDone(false);
    countedRef.current = false;
  }, []);

  return (
    <div className="w-full max-w-[460px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Painted{" "}
          <b className="ml-1 text-sm tabular-nums text-ink">
            {painted.size}/{target}
          </b>
        </span>
        <span className="text-warn">
          🎨 Artworks <b className="ml-1 text-sm text-ink">{artCount}</b>
        </span>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-22px_rgba(244,114,182,0.7)] sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-lg font-bold text-white">
            {pattern.emoji} {pattern.name}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Colour by number
          </p>
        </div>

        <div
          className="grid gap-0.5 rounded-xl border border-line bg-black/40 p-1.5"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
          role="group"
          aria-label={`${pattern.name} pixel grid`}
        >
          {values.map((v, i) => {
            const filled = v === 0 || painted.has(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => paint(i)}
                aria-label={
                  filled
                    ? `Pixel row ${Math.floor(i / SIZE) + 1} column ${(i % SIZE) + 1}, painted`
                    : `Pixel row ${Math.floor(i / SIZE) + 1} column ${(i % SIZE) + 1}, colour ${v}`
                }
                style={filled ? { backgroundColor: pattern.palette[v] } : undefined}
                className={cn(
                  "grid aspect-square place-items-center rounded-[3px] font-mono text-[8px] leading-none transition",
                  filled
                    ? "cursor-default"
                    : cn(
                        "text-muted/70 hover:bg-white/10",
                        v === selected && "bg-white/[0.07] ring-1 ring-white/40",
                      ),
                )}
              >
                {filled ? "" : v}
              </button>
            );
          })}
        </div>

        {/* palette */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {pattern.palette.map((hex, idx) => {
            if (idx === 0) return null;
            const left = remaining[idx];
            const active = selected === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelected(idx)}
                aria-label={`Select colour ${idx}, ${left} pixels left`}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2 py-1 transition active:scale-95",
                  active
                    ? "border-white/60 bg-white/10"
                    : "border-line hover:border-primary/50",
                  left === 0 && "opacity-40",
                )}
              >
                <span
                  style={{ backgroundColor: hex }}
                  className="h-5 w-5 rounded-md shadow-[inset_0_-2px_4px_rgba(0,0,0,0.35)]"
                />
                <span className="font-mono text-[10px] tabular-nums text-muted">
                  {left === 0 ? "✓" : left}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={nextArtwork}
            className="rounded-full border border-line bg-surface px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-muted transition hover:text-ink active:scale-95"
          >
            Next artwork →
          </button>
        </div>

        {done && (
          <Overlay>
            <p className="text-4xl">{pattern.emoji}</p>
            <p className="mt-2 font-display text-2xl font-bold text-white">
              {pattern.name.toUpperCase()} COMPLETE
            </p>
            <p className="mt-2 text-sm text-muted">
              That&apos;s artwork number <b className="text-ink">{artCount}</b>{" "}
              — the palette is all used up.
            </p>
            <PrimaryButton
              onClick={nextArtwork}
              tone="from-rose-400 via-pink-500 to-fuchsia-600"
            >
              Next artwork
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Pick a colour chip, then fill every cell showing that number
      </p>
    </div>
  );
}
