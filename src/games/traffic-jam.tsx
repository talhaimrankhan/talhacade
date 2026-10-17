"use client";

import { useCallback, useEffect, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

const N = 6;

/* 15 handcrafted jams: `ID LEN hv@row,col` — red car (R) first. Verified
   solvable offline with a BFS solver (optimal 3 → 14 moves). */
const PUZZLES: string[] = [
  "R2h@2,1 A3v@1,5 B3h@0,0 C3h@5,3 D2h@1,0",
  "R2h@4,2 A2v@4,4 B2v@4,5 C3v@1,3 D2v@2,2",
  "R2h@4,1 A3v@2,3 B2v@3,5 C2h@1,0 D2h@5,2",
  "R2h@4,0 A3v@3,2 B2v@4,4 C2v@0,5 D3v@0,0",
  "R2h@2,1 A2v@2,3 B2v@2,5 C2h@5,0 D2h@4,0 E2v@0,2",
  "R2h@4,0 A2v@3,2 B3v@2,5 C2v@4,4 D3h@2,0 E3v@2,3",
  "R2h@4,0 A2v@4,3 B2v@4,5 C2v@3,2 D3h@2,1 E3v@3,4",
  "R2h@4,0 A3v@2,2 B2v@3,3 C3v@3,4 D2v@0,0 E2v@0,1 F2h@1,3",
  "R2h@4,0 A3v@2,2 B2v@3,3 C2v@3,4 D2h@1,4 E2h@5,2 F2h@2,4",
  "R2h@1,0 A3v@1,5 B3v@1,2 C3h@0,1 D2h@5,4 E3h@4,2",
  "R2h@1,0 A3v@0,2 B2v@1,5 C2v@0,3 D2v@1,4 E3h@4,1 F2v@3,5",
  "R2h@2,1 A3v@2,4 B3v@0,3 C2v@2,5 D2h@4,2 E2h@0,0 F2v@4,1",
  "R2h@3,0 A3v@1,4 B3v@2,5 C3v@3,3 D2v@3,2 E2v@1,1 F3h@0,0 G2h@2,2",
  "R2h@3,0 A2v@3,4 B3v@1,2 C2v@2,3 D3v@3,5 E2h@1,4 F3h@0,0 G2h@5,2",
  "R2h@2,0 A3v@2,5 B3v@1,2 C2v@2,3 D3v@0,4 E2v@4,3 F2h@4,1 G2v@4,0",
];

interface Vehicle {
  id: string;
  r: number;
  c: number;
  len: number;
  horiz: boolean;
}

function parse(puzzle: string): Vehicle[] {
  return puzzle.split(" ").map((tok) => {
    const m = /^([A-Z])([23])([hv])@(\d),(\d)$/.exec(tok);
    return {
      id: m?.[1] ?? "?",
      len: Number(m?.[2] ?? 2),
      horiz: m?.[3] === "h",
      r: Number(m?.[4] ?? 0),
      c: Number(m?.[5] ?? 0),
    };
  });
}

function cellsOf(v: Vehicle): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < v.len; i++) out.push(v.horiz ? [v.r, v.c + i] : [v.r + i, v.c]);
  return out;
}

/** Every position vehicle `i` can slide to with the others standing still. */
function slideTargets(vs: Vehicle[], i: number): { r: number; c: number }[] {
  const v = vs[i];
  const blocked = new Set<number>();
  vs.forEach((o, j) => {
    if (j === i) return;
    for (const [r, c] of cellsOf(o)) blocked.add(r * N + c);
  });
  const out: { r: number; c: number }[] = [];
  if (v.horiz) {
    for (let c = v.c - 1; c >= 0; c--) {
      if (blocked.has(v.r * N + c)) break;
      out.push({ r: v.r, c });
    }
    for (let c = v.c + 1; c + v.len <= N; c++) {
      if (blocked.has(v.r * N + c + v.len - 1)) break;
      out.push({ r: v.r, c });
    }
  } else {
    for (let r = v.r - 1; r >= 0; r--) {
      if (blocked.has(r * N + v.c)) break;
      out.push({ r, c: v.c });
    }
    for (let r = v.r + 1; r + v.len <= N; r++) {
      if (blocked.has((r + v.len - 1) * N + v.c)) break;
      out.push({ r, c: v.c });
    }
  }
  return out;
}

const CAR_BG: Record<string, string> = {
  R: "bg-rose-500 text-rose-950",
  A: "bg-cyan-400 text-cyan-950",
  B: "bg-violet-400 text-violet-950",
  C: "bg-emerald-400 text-emerald-950",
  D: "bg-amber-400 text-amber-950",
  E: "bg-sky-400 text-sky-950",
  F: "bg-pink-400 text-pink-950",
  G: "bg-lime-400 text-lime-950",
};

const CELLS = Array.from({ length: N * N }, (_, i) => i);

export default function TrafficJam({ gameId }: { gameId: string }) {
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => parse(PUZZLES[0]));
  const [selected, setSelected] = useState<string | null>(null);
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);
  const [totalSolved, setTotalSolved] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  const exitRow = parse(PUZZLES[puzzleIdx])[0].r;

  const loadPuzzle = useCallback((idx: number) => {
    setPuzzleIdx(idx);
    setVehicles(parse(PUZZLES[idx]));
    setSelected(null);
    setMoves(0);
    setSolved(false);
    setNewBest(false);
  }, []);

  const moveVehicle = useCallback(
    (vIdx: number, nr: number, nc: number) => {
      const v = vehicles[vIdx];
      setVehicles((prev) =>
        prev.map((o, i) => (i === vIdx ? { ...o, r: nr, c: nc } : o)),
      );
      setMoves((m) => m + 1);

      if (v.id === "R" && nc + v.len === N) {
        setSelected(null);
        setSolved(true);
        const total = totalSolved + 1;
        setTotalSolved(total);
        setNewBest(submit(total));
        return;
      }
    },
    [vehicles, totalSolved, submit],
  );

  const handleCell = useCallback(
    (r: number, c: number) => {
      if (solved) return;

      const hitIdx = vehicles.findIndex((v) =>
        cellsOf(v).some(([vr, vc]) => vr === r && vc === c),
      );
      if (hitIdx >= 0) {
        setSelected((s) => (s === vehicles[hitIdx].id ? null : vehicles[hitIdx].id));
        return;
      }
      if (!selected) return;
      const si = vehicles.findIndex((v) => v.id === selected);
      if (si < 0) return;
      const v = vehicles[si];
      if (v.horiz ? r !== v.r : c !== v.c) return; // must click along its axis

      const covering = slideTargets(vehicles, si).filter((p) =>
        v.horiz ? p.c <= c && c < p.c + v.len : p.r <= r && r < p.r + v.len,
      );
      if (covering.length === 0) return;
      covering.sort(
        (a, b) =>
          Math.abs(a.c - v.c) + Math.abs(a.r - v.r) -
          (Math.abs(b.c - v.c) + Math.abs(b.r - v.r)),
      );
      const target = covering[0];
      moveVehicle(si, target.r, target.c);
    },
    [vehicles, selected, solved, moveVehicle],
  );

  const moveBy = useCallback(
    (id: string, dr: number, dc: number) => {
      const i = vehicles.findIndex((v) => v.id === id);
      if (i < 0) return;
      const v = vehicles[i];
      if (dr !== 0 && v.horiz) return;
      if (dc !== 0 && !v.horiz) return;
      const nr = v.r + dr;
      const nc = v.c + dc;
      if (nr < 0 || nc < 0 || nr + (v.horiz ? 1 : v.len) > N || nc + (v.horiz ? v.len : 1) > N) {
        return;
      }
      const free = cellsOf({ ...v, r: nr, c: nc }).every(([cr, cc]) =>
        vehicles.every((o, j) => j === i || !cellsOf(o).some(([or, oc]) => or === cr && oc === cc)),
      );
      if (!free) return;
      moveVehicle(i, nr, nc);
    },
    [vehicles, moveVehicle],
  );

  // arrow-key sliding for the selected vehicle
  useEffect(() => {
    if (!selected || solved) return;
    const DIRS: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const d = DIRS[e.key];
      if (!d) return;
      e.preventDefault();
      moveBy(selected, d[0], d[1]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, solved, moveBy]);

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Jam <b className="ml-1 text-sm text-ink">{puzzleIdx + 1}/{PUZZLES.length}</b>
        </span>
        <div className="flex items-center gap-3">
          <span className="text-accent">
            Moves <b className="ml-1 text-sm text-ink tabular-nums">{moves}</b>
          </span>
          <span className="text-warn">
            Solved <b className="ml-1 text-sm text-ink tabular-nums">{best ?? "—"}</b>
          </span>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {selected
            ? `Vehicle ${selected} selected — tap a free cell in line with it`
            : "Tap a vehicle, then tap where it should slide"}
        </p>
        <button
          type="button"
          onClick={() => loadPuzzle((puzzleIdx + 1) % PUZZLES.length)}
          aria-label="Next puzzle"
          className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
        >
          ⟳ Next puzzle
        </button>
      </div>

      <div className="relative flex gap-1 overflow-hidden rounded-2xl border border-line bg-surface-2 p-2 shadow-[0_0_60px_-24px_rgba(244,63,94,0.8)]">
        <div className="relative aspect-square flex-1 overflow-hidden rounded-xl border border-line bg-[#0f0f1e]">
          {/* clickable cells */}
          <div className="absolute inset-0 grid grid-cols-6 grid-rows-6">
            {CELLS.map((i) => {
              const r = Math.floor(i / N);
              const c = i % N;
              const occupant = vehicles.find((v) =>
                cellsOf(v).some(([vr, vc]) => vr === r && vc === c),
              );
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleCell(r, c)}
                  aria-label={
                    occupant
                      ? `Vehicle ${occupant.id} at row ${r + 1}, column ${c + 1}`
                      : `Empty cell row ${r + 1}, column ${c + 1}`
                  }
                  className="m-[2px] rounded-[6px] bg-[#141428] transition hover:bg-[#1c1c36]"
                />
              );
            })}
          </div>

          {/* vehicle pieces */}
          {vehicles.map((v) => {
            const isSelected = selected === v.id;
            return (
              <div
                key={v.id}
                className="pointer-events-none absolute"
                style={{
                  left: `${(v.c / N) * 100}%`,
                  top: `${(v.r / N) * 100}%`,
                  width: `${(v.len / N) * 100}%`,
                  height: `${100 / N}%`,
                }}
              >
                <div
                  className={cn(
                    "absolute inset-[3px] grid place-items-center rounded-lg border-2 font-mono text-[11px] font-bold shadow-lg transition",
                    CAR_BG[v.id] ?? "bg-slate-400 text-slate-950",
                    isSelected
                      ? "border-white ring-2 ring-white/70"
                      : "border-black/25",
                  )}
                >
                  {v.id === "R" ? "🚗" : v.len === 3 ? "🚚" : "🚙"}
                </div>
              </div>
            );
          })}
        </div>

        {/* exit gutter */}
        <div className="relative w-4 shrink-0">
          <div
            className="absolute left-0 flex w-full items-center justify-center rounded-r-md border-y-2 border-r-2 border-emerald-400/70 bg-emerald-400/15 text-[10px]"
            style={{ top: `${(exitRow / N) * 100}%`, height: `${100 / N}%` }}
            aria-hidden="true"
          >
            ➜
          </div>
        </div>
      {solved && (
          <Overlay>
            <p className="text-4xl">🚧</p>
            <p className="mt-2 font-display text-2xl font-bold text-gradient">ROAD CLEARED</p>
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {moves} {moves === 1 ? "move" : "moves"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best run!
              </p>
            )}
            <p className="text-xs uppercase tracking-widest text-muted">
              Puzzles solved {totalSolved} · best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={() => loadPuzzle((puzzleIdx + 1) % PUZZLES.length)}
              tone="from-rose-400 via-pink-500 to-fuchsia-600"
            >
              Next puzzle
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Slide the red car to the gap on the right · arrow keys work once selected
      </p>
    </div>
  );
}
