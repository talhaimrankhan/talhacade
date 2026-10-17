"use client";

import { useCallback, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

const CAP = 4;
const SHUFFLE_MOVES = 300;

const COLORS = [
  "#fb7185", // rose
  "#fb923c", // orange
  "#fbbf24", // amber
  "#34d399", // emerald
  "#22d3ee", // cyan
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#f472b6", // pink
];

type Status = "playing" | "cleared" | "stuck";

function isSolved(tubes: number[][]): boolean {
  return tubes.every(
    (t) => t.length === 0 || (t.length === CAP && t.every((c) => c === t[0])),
  );
}

function hasMove(tubes: number[][]): boolean {
  for (let from = 0; from < tubes.length; from++) {
    const src = tubes[from];
    if (src.length === 0) continue;
    const ball = src[src.length - 1];
    for (let to = 0; to < tubes.length; to++) {
      if (to === from) continue;
      const dest = tubes[to];
      if (dest.length >= CAP) continue;
      if (dest.length > 0 && dest[dest.length - 1] !== ball) continue;
      // skip pointless relocation of a lone ball into an empty tube
      if (dest.length === 0 && src.length === 1) continue;
      return true;
    }
  }
  return false;
}

/**
 * Build a solvable board: start solved, then apply random moves whose exact
 * inverse is always a legal play — so replaying them backwards solves it.
 */
function scramble(colorCount: number): number[][] {
  let last: number[][] | null = null;

  for (let attempt = 0; attempt < 24; attempt++) {
    const tubes: number[][] = [];
    for (let c = 0; c < colorCount; c++) tubes.push([c, c, c, c]);
    tubes.push([], []);

    let prevFrom = -1;
    let prevTo = -1;

    for (let i = 0; i < SHUFFLE_MOVES; i++) {
      const sources: number[] = [];
      for (let idx = 0; idx < tubes.length; idx++) {
        const t = tubes[idx];
        if (t.length === 0) continue;
        const top = t[t.length - 1];
        if (t.length === 1 || t[t.length - 2] === top) sources.push(idx);
      }
      if (sources.length === 0) break;
      const y = sources[Math.floor(Math.random() * sources.length)];

      const dests: number[] = [];
      for (let idx = 0; idx < tubes.length; idx++) {
        if (idx === y || tubes[idx].length >= CAP) continue;
        if (tubes[idx].length === 0 && tubes[y].length === 1) continue;
        if (idx === prevFrom && y === prevTo) continue;
        dests.push(idx);
      }
      if (dests.length === 0) continue;
      const x = dests[Math.floor(Math.random() * dests.length)];

      const ball = tubes[y].pop();
      if (ball === undefined) break;
      tubes[x].push(ball);
      prevFrom = y;
      prevTo = x;
    }

    last = tubes;
    if (!isSolved(tubes)) return tubes;
  }

  return last ?? [[], []];
}

export default function TubeSort({ gameId }: { gameId: string }) {
  const [level, setLevel] = useState(1);
  const [tubes, setTubes] = useState<number[][]>(() => scramble(3));
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const { best, submit } = useBestScore(gameId, "high");

  const beginLevel = useCallback((lvl: number) => {
    setTubes(scramble(Math.min(COLORS.length, lvl + 2)));
    setSelected(null);
    setMoves(0);
    setStatus("playing");
  }, []);

  const restart = useCallback(() => {
    beginLevel(level);
  }, [beginLevel, level]);

  const nextLevel = useCallback(() => {
    const lvl = level + 1;
    setLevel(lvl);
    beginLevel(lvl);
  }, [beginLevel, level]);

  const clickTube = useCallback(
    (index: number) => {
      if (status !== "playing") return;
      const tube = tubes[index];

      if (selected === null) {
        if (tube.length > 0) setSelected(index);
        return;
      }
      if (selected === index) {
        setSelected(null);
        return;
      }

      const src = tubes[selected];
      const ball = src[src.length - 1];
      const legal =
        tube.length < CAP &&
        (tube.length === 0 || tube[tube.length - 1] === ball);

      if (!legal) {
        setSelected(tube.length > 0 ? index : null);
        return;
      }

      const next = tubes.map((t, i) => {
        if (i === selected) return t.slice(0, -1);
        if (i === index) return [...t, ball];
        return t;
      });
      setTubes(next);
      setSelected(null);
      setMoves((m) => m + 1);

      if (isSolved(next)) {
        setStatus("cleared");
        submit((best ?? 0) + 1);
      } else if (!hasMove(next)) {
        setStatus("stuck");
      }
    },
    [status, tubes, selected, best, submit],
  );

  return (
    <div className="w-full max-w-[460px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Level <b className="ml-1 text-sm text-ink">{level}</b>
          <span className="ml-3">Moves</span>
          <b className="ml-1 text-sm text-ink">{moves}</b>
        </span>
        <span className="text-warn">
          Cleared <b className="ml-1 text-sm text-ink">{best ?? "—"}</b>
        </span>
      </div>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-22px_rgba(167,139,250,0.7)] sm:p-5">
        <div className="flex min-h-[190px] flex-wrap items-end justify-center gap-x-3 gap-y-4">
          {tubes.map((tube, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => clickTube(i)}
                aria-label={`Tube ${i + 1} with ${tube.length} balls${
                  isSelected ? ", selected" : ""
                }`}
                className={cn(
                  "relative flex h-36 w-12 flex-col-reverse items-center gap-0.5 rounded-b-xl rounded-t-md border-2 bg-black/40 p-1 transition",
                  isSelected
                    ? "border-warn shadow-[0_0_18px_-4px_rgba(251,191,36,0.9)]"
                    : "border-line hover:border-primary/50",
                )}
              >
                {tube.map((color, bi) => (
                  <span
                    key={bi}
                    style={{ backgroundColor: COLORS[color] }}
                    className={cn(
                      "h-7 w-7 rounded-full shadow-[inset_0_-3px_6px_rgba(0,0,0,0.35)]",
                      isSelected &&
                        bi === tube.length - 1 &&
                        "-translate-y-2.5 ring-2 ring-white/70",
                    )}
                  />
                ))}
                {tube.length === 0 && (
                  <span className="absolute inset-1 rounded-b-lg rounded-t-sm border border-dashed border-white/10" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={restart}
            className="rounded-full border border-line bg-surface px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-muted transition hover:text-ink active:scale-95"
          >
            ↺ Restart
          </button>
        </div>

        {status === "cleared" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-success">
              LEVEL {level} CLEARED
            </p>
            <p className="mt-2 text-sm text-muted">
              Every tube sorted in {moves} {moves === 1 ? "move" : "moves"}.
            </p>
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {level + 1}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Next up · Best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={nextLevel}
              tone="from-emerald-400 via-teal-500 to-cyan-600"
            >
              Next level
            </PrimaryButton>
          </Overlay>
        )}

        {status === "stuck" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-warn">
              NO MOVES LEFT
            </p>
            <p className="mt-2 max-w-[34ch] text-sm text-muted">
              The tubes locked up — happens to the best sorters. Reset this
              level and try a different order.
            </p>
            <PrimaryButton
              onClick={restart}
              tone="from-emerald-400 via-teal-500 to-cyan-600"
            >
              Reset level
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a tube to lift its top ball · tap another to drop it · sort every
        colour
      </p>
    </div>
  );
}
