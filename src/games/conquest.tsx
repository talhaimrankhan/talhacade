"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Overlay, PrimaryButton } from "./parts";

type Owner = "you" | "cpu";
type RegionKey = "north" | "wilds" | "ember" | "coast";
type Phase = "reinforce" | "attack" | "fortify" | "cpu";
type Outcome = "playing" | "won" | "lost";

interface Terr {
  id: string;
  name: string;
  region: RegionKey;
  x: number;
  y: number;
  adj: string[];
}

interface Series { you: number; cpu: number }

interface GameState {
  owner: Record<string, Owner>;
  troops: Record<string, number>;
  phase: Phase;
  left: number;
  sel: string | null;
  target: string | null;
  fortLeft: number;
  outcome: Outcome;
  log: string[];
}

/** A compact 14-territory world laid out on a 5×3 grid. */
const TERRITS: Terr[] = [
  { id: "frostheim", name: "Frostheim", region: "north", x: 0, y: 0, adj: ["stormcrag", "nightfen"] },
  { id: "stormcrag", name: "Stormcrag", region: "north", x: 1, y: 0, adj: ["frostheim", "wilderpeak", "duskmere"] },
  { id: "wilderpeak", name: "Wilderpeak", region: "wilds", x: 2, y: 0, adj: ["stormcrag", "thornwood", "emberfall"] },
  { id: "thornwood", name: "Thornwood", region: "wilds", x: 3, y: 0, adj: ["wilderpeak", "verdant", "ashenmoor"] },
  { id: "verdant", name: "Verdant", region: "wilds", x: 4, y: 0, adj: ["thornwood", "ashenmoor", "goldvale"] },
  { id: "nightfen", name: "Nightfen", region: "north", x: 0, y: 1, adj: ["frostheim", "duskmere", "ironmarch"] },
  { id: "duskmere", name: "Duskmere", region: "north", x: 1, y: 1, adj: ["nightfen", "stormcrag", "emberfall", "stonegate"] },
  { id: "emberfall", name: "Emberfall", region: "ember", x: 2, y: 1, adj: ["duskmere", "wilderpeak", "ashenmoor"] },
  { id: "ashenmoor", name: "Ashenmoor", region: "wilds", x: 3, y: 1, adj: ["emberfall", "thornwood", "verdant", "goldvale", "brightport"] },
  { id: "ironmarch", name: "Ironmarch", region: "ember", x: 0, y: 2, adj: ["nightfen", "stonegate"] },
  { id: "stonegate", name: "Stonegate", region: "ember", x: 1, y: 2, adj: ["ironmarch", "duskmere", "goldvale"] },
  { id: "goldvale", name: "Goldvale", region: "coast", x: 2, y: 2, adj: ["verdant", "ashenmoor", "stonegate", "brightport"] },
  { id: "brightport", name: "Brightport", region: "coast", x: 3, y: 2, adj: ["goldvale", "ashenmoor", "sunreach"] },
  { id: "sunreach", name: "Sunreach", region: "coast", x: 4, y: 2, adj: ["brightport"] },
];

const BY_ID: Record<string, Terr> = Object.fromEntries(TERRITS.map((t) => [t.id, t]));

const REGION_DOT: Record<RegionKey, string> = {
  north: "bg-sky-400", wilds: "bg-emerald-400",
  ember: "bg-rose-400", coast: "bg-amber-400",
};

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rollDice(n: number): number[] {
  return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a);
}

function countSide(side: Owner, owner: Record<string, Owner>): number {
  return TERRITS.filter((t) => owner[t.id] === side).length;
}

function hasEnemyAdj(id: string, owner: Record<string, Owner>): boolean {
  return BY_ID[id].adj.some((n) => owner[n] !== owner[id]);
}

function connectedOwned(from: string, owner: Record<string, Owner>): Set<string> {
  const side = owner[from];
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of BY_ID[cur].adj) {
      if (owner[n] !== side || seen.has(n)) continue;
      seen.add(n); queue.push(n);
    }
  }
  return seen;
}

/** First hop from `from` toward the nearest own border territory. */
function firstStepToBorder(from: string, owner: Record<string, Owner>): string | null {
  const seen = new Set<string>([from]);
  const queue: { id: string; first: string | null }[] = [{ id: from, first: null }];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.first !== null && hasEnemyAdj(cur.id, owner)) return cur.first;
    for (const n of BY_ID[cur.id].adj) {
      if (owner[n] !== "cpu" || seen.has(n)) continue;
      seen.add(n); queue.push({ id: n, first: cur.first ?? n });
    }
  }
  return null;
}

function createGame(): GameState {
  const owner: Record<string, Owner> = {};
  const troops: Record<string, number> = {};
  for (const t of TERRITS) { owner[t.id] = "cpu"; troops[t.id] = 0; }
  shuffle(TERRITS.map((t) => t.id)).forEach((id, i) => {
    owner[id] = i < 7 ? "you" : "cpu";
    troops[id] = 2 + Math.floor(Math.random() * 5); // 2–6 troops
  });
  return {
    owner, troops, phase: "reinforce",
    left: Math.max(3, Math.floor(countSide("you", owner) / 3)),
    sel: null, target: null, fortLeft: 1, outcome: "playing",
    log: ["The map is drawn. Place your reinforcements."],
  };
}

/** The whole CPU turn: reinforce, attack on odds, fortify, pass back. */
function cpuTurn(g: GameState): GameState {
  const owner = { ...g.owner };
  const troops = { ...g.troops };
  const log: string[] = [];

  const mine = TERRITS.filter((t) => owner[t.id] === "cpu");
  let bestId = mine[0].id;
  let bestScore = -1;
  for (const t of mine) {
    const score = troops[t.id] + (hasEnemyAdj(t.id, owner) ? 10 : 0) + Math.random();
    if (score > bestScore) { bestScore = score; bestId = t.id; }
  }
  troops[bestId] += Math.max(3, Math.floor(mine.length / 3));

  let attacks = 0;
  for (let guard = 0; guard < 40; guard++) {
    let acted = false;
    outer: for (const t of TERRITS) {
      if (owner[t.id] !== "cpu" || troops[t.id] < 2) continue;
      for (const n of t.adj) {
        if (owner[n] !== "you" || troops[t.id] < 2 * troops[n]) continue;
        const aDice = rollDice(Math.min(3, troops[t.id] - 1));
        const dDice = rollDice(Math.min(2, troops[n]));
        const pairs = Math.min(aDice.length, dDice.length);
        let attLoss = 0;
        let defLoss = 0;
        for (let i = 0; i < pairs; i++) {
          if (aDice[i] > dDice[i]) defLoss++; else attLoss++;
        }
        if (troops[n] - defLoss <= 0) {
          troops[t.id] -= aDice.length;
          owner[n] = "cpu";
          troops[n] = aDice.length;
          attacks++;
        } else {
          troops[n] -= defLoss;
          troops[t.id] -= attLoss;
        }
        acted = true;
        break outer;
      }
    }
    if (!acted) break;
  }
  if (attacks > 0) log.push(`CPU launches ${attacks} attack${attacks === 1 ? "" : "s"}.`);

  if (countSide("cpu", owner) === TERRITS.length) {
    return {
      ...g, owner, troops, outcome: "lost",
      log: [...log, "The CPU took the whole map.", ...g.log].slice(0, 4),
    };
  }

  for (const t of TERRITS) {
    if (owner[t.id] !== "cpu" || troops[t.id] < 2) continue;
    if (!t.adj.every((n) => owner[n] === "cpu")) continue;
    const dest = firstStepToBorder(t.id, owner);
    if (!dest) continue;
    const move = troops[t.id] - 1;
    troops[dest] += move;
    troops[t.id] = 1;
    log.push(`CPU fortifies ${move} → ${BY_ID[dest].name}.`);
    break;
  }

  return {
    ...g, owner, troops, phase: "reinforce",
    left: Math.max(3, Math.floor(countSide("you", owner) / 3)),
    sel: null, target: null, fortLeft: 1,
    log: [...log, "Your turn — reinforce.", ...g.log].slice(0, 4),
  };
}

export default function Conquest({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<GameState>(() => createGame());
  const [diceSel, setDiceSel] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const [series, setSeries] = useStored<Series>(`series:${gameId}`, { you: 0, cpu: 0 });
  const { best, submit } = useBestScore(gameId, "high");
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seriesRef = useRef<Series>(series);
  useEffect(() => { seriesRef.current = series; }, [series]);
  useEffect(() => () => { if (cpuTimer.current) clearTimeout(cpuTimer.current); }, []);

  const recordResult = useCallback(
    (winner: "you" | "cpu") => {
      const mine = winner === "you";
      const updated = mine ? { ...seriesRef.current, you: seriesRef.current.you + 1 }
        : { ...seriesRef.current, cpu: seriesRef.current.cpu + 1 };
      seriesRef.current = updated;
      setSeries(updated);
      if (mine) setNewBest(submit(updated.you));
    },
    [setSeries, submit],
  );

  const restart = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setGame(createGame());
    setDiceSel(1);
    setNewBest(false);
  }, []);

  const onTerritory = (id: string) => {
    const g = game;
    if (g.outcome !== "playing" || g.phase === "cpu") return;

    if (g.phase === "reinforce") {
      if (g.owner[id] !== "you" || g.left <= 0) return;
      setGame({ ...g, troops: { ...g.troops, [id]: g.troops[id] + 1 }, left: g.left - 1, sel: id });
      return;
    }

    if (g.phase === "attack") {
      if (g.sel && g.owner[id] === "you") {
        setGame({ ...g, sel: g.troops[id] >= 2 && hasEnemyAdj(id, g.owner) ? id : null, target: null });
        return;
      }
      if (g.sel && g.owner[id] === "cpu" && BY_ID[g.sel].adj.includes(id)) {
        setGame({ ...g, target: id });
        return;
      }
      if (!g.sel && g.owner[id] === "you" && g.troops[id] >= 2 && hasEnemyAdj(id, g.owner)) setGame({ ...g, sel: id });
      return;
    }

    // fortify: pick a source, then any connected own territory
    if (g.fortLeft === 0) return;
    if (g.sel === null) {
      if (g.owner[id] === "you" && g.troops[id] >= 2) setGame({ ...g, sel: id });
      return;
    }
    if (id === g.sel) return setGame({ ...g, sel: null });
    if (g.owner[id] !== "you" || !connectedOwned(g.sel, g.owner).has(id)) return;
    const move = g.troops[g.sel] - 1;
    setGame({
      ...g, troops: { ...g.troops, [g.sel]: 1, [id]: g.troops[id] + move },
      sel: null, fortLeft: 0,
      log: [`Moved ${move} troops to ${BY_ID[id].name}.`, ...g.log].slice(0, 4),
    });
  };

  const autoPlace = () => {
    const g = game;
    if (g.phase !== "reinforce" || g.left <= 0) return;
    const troops = { ...g.troops };
    const mine = TERRITS.filter((t) => g.owner[t.id] === "you");
    const borders = mine.filter((t) => hasEnemyAdj(t.id, g.owner));
    const queue = borders.length ? borders : mine;
    let left = g.left;
    let i = 0;
    while (left > 0 && queue.length) {
      troops[queue[i % queue.length].id] += 1;
      left -= 1; i += 1;
    }
    setGame({ ...g, troops, left });
  };

  const attack = () => {
    const g = game;
    if (g.phase !== "attack" || !g.sel || !g.target) return;
    const from = g.sel;
    const to = g.target;
    const aMax = Math.min(3, g.troops[from] - 1);
    if (aMax < 1) return;
    const aDice = rollDice(Math.min(diceSel, aMax));
    const dDice = rollDice(Math.min(2, g.troops[to]));
    const pairs = Math.min(aDice.length, dDice.length);
    let attLoss = 0;
    let defLoss = 0;
    for (let i = 0; i < pairs; i++) {
      if (aDice[i] > dDice[i]) defLoss++; else attLoss++;
    }
    const troops = { ...g.troops };
    const owner = { ...g.owner };
    let line: string;
    if (troops[to] - defLoss <= 0) {
      troops[from] -= aDice.length;
      owner[to] = "you";
      troops[to] = aDice.length;
      line = `⚔️ Took ${BY_ID[to].name}! [${aDice.join("")}] vs [${dDice.join("")}]`;
    } else {
      troops[to] -= defLoss;
      troops[from] -= attLoss;
      line = `⚔️ ${BY_ID[from].name} [${aDice.join("")}] vs [${dDice.join("")}] ${BY_ID[to].name} — lost ${attLoss}/${defLoss}`;
    }
    const outcome: Outcome = countSide("you", owner) === TERRITS.length
      ? "won"
      : countSide("cpu", owner) === TERRITS.length ? "lost" : "playing";
    setGame({
      ...g, owner, troops, target: null, outcome,
      sel: troops[from] >= 2 && hasEnemyAdj(from, owner) ? from : null,
      log: [line, ...g.log].slice(0, 4),
    });    if (outcome !== "playing") recordResult(outcome === "won" ? "you" : "cpu");
  };

  const endTurn = () => {
    const g = game;
    if (g.phase !== "fortify" || g.outcome !== "playing") return;
    setGame({ ...g, phase: "cpu", sel: null });
    cpuTimer.current = setTimeout(() => {
      const next = cpuTurn(g);
      setGame(next);
      if (next.outcome === "lost") recordResult("cpu");
    }, 640);
  };

  const statusText =
    game.outcome === "won"
      ? "The map is yours! 🎉"
      : game.outcome === "lost"
        ? "The CPU conquered everything 🤖"
        : game.phase === "reinforce"
          ? `${game.left} reinforcements to place`
          : game.phase === "attack"
            ? game.target
              ? `Attack ${BY_ID[game.target].name}?`
              : "Pick a border territory, then its enemy neighbour"
            : game.phase === "fortify"
              ? game.fortLeft === 0 ? "Fortify spent — end your turn" : "Fortify: tap one territory, then a connected one"
              : "CPU is thinking…";

  const nodeRing = (id: string) => {
    const g = game;
    if (g.sel === id) return "ring-2 ring-warn shadow-[0_0_18px_-4px_rgba(251,191,36,0.9)]";
    if (g.target === id) return "ring-2 ring-rose-400 shadow-[0_0_18px_-4px_rgba(251,113,133,0.9)]";
    if (g.sel && BY_ID[g.sel].adj.includes(id) && g.owner[id] === "cpu") return "ring-1 ring-rose-400/60";
    return "";
  };

  const pairLines: [Terr, Terr][] = [];
  TERRITS.forEach((t, i) => {
    for (const n of t.adj) if (TERRITS.indexOf(BY_ID[n]) > i) pairLines.push([t, BY_ID[n]]);
  });

  const busy = game.outcome !== "playing" || game.phase === "cpu";
  const btn = "rounded-full px-4 py-1.5 text-xs font-bold transition active:scale-95";
  const rollBtn = cn(btn, "bg-gradient-to-r from-rose-400 via-pink-500 to-fuchsia-600 text-black hover:brightness-110");

  return (
    <div className="w-full max-w-[540px]">
      <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-xs uppercase tracking-wider">
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-center text-cyan-300">
          You <b className="ml-1 text-sm text-ink">{series.you}</b>
          <span className="ml-2 text-[10px] text-muted">{countSide("you", game.owner)} lands</span>
        </div>
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-center text-rose-300">
          CPU <b className="ml-1 text-sm text-ink">{series.cpu}</b>
          <span className="ml-2 text-[10px] text-muted">{countSide("cpu", game.owner)} lands</span>
        </div>
      </div>
      <div className="relative aspect-[5/3] w-full rounded-2xl border border-line bg-surface-2 shadow-[0_0_60px_-24px_rgba(148,163,184,0.7)]">
        <svg viewBox="0 0 500 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {pairLines.map(([a, b]) => (
            <line
              key={`${a.id}-${b.id}`}
              x1={(a.x + 0.5) * 100} y1={(a.y + 0.5) * 100}
              x2={(b.x + 0.5) * 100} y2={(b.y + 0.5) * 100}
              stroke="#2b2b45" strokeWidth="3"
            />
          ))}
        </svg>

        {TERRITS.map((t) => {
          const mine = game.owner[t.id] === "you";
          const nodeCls = cn(
            "grid h-11 w-11 place-items-center rounded-full border-2 font-mono text-sm font-bold",
            mine ? "border-cyan-400 bg-cyan-500/20 text-cyan-100" : "border-rose-400 bg-rose-500/20 text-rose-100",
            nodeRing(t.id),
          );
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTerritory(t.id)}
              aria-label={`${t.name}, ${mine ? "yours" : "CPU"}, ${game.troops[t.id]} troops`}
              disabled={busy}
              className={cn("absolute z-10 -translate-x-1/2 -translate-y-1/2 transition active:scale-95", busy && "cursor-not-allowed")}
              style={{ left: `${(t.x + 0.5) * 20}%`, top: `${((t.y + 0.5) / 3) * 100}%` }}
            >
              <span className={nodeCls}>{game.troops[t.id]}</span>
              <span className="mt-0.5 flex items-center justify-center gap-1 whitespace-nowrap">
                <span className={cn("h-1.5 w-1.5 rounded-full", REGION_DOT[t.region])} />
                <span className="text-[8px] uppercase tracking-wider text-muted">{t.name}</span>
              </span>
            </button>
          );
        })}

        {game.outcome !== "playing" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">{statusText}</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ Most games won — new best!
              </p>
            )}
            <p className="mt-2 text-xs uppercase tracking-widest text-muted">
              All-time wins {best ?? 0} · Series {series.you}–{series.cpu}
            </p>
            <PrimaryButton onClick={restart} tone="from-slate-400 via-zinc-500 to-neutral-700">
              New game
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      {/* phase controls */}
      <div className="mt-3 rounded-xl border border-line bg-surface px-3 py-2">        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted">{statusText}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {game.phase === "reinforce" && (
              <>
                <button
                  type="button" onClick={autoPlace} disabled={game.left <= 0}
                  className={cn("rounded-full border border-line px-3 py-1.5 text-xs font-semibold transition", game.left > 0 ? "text-muted hover:text-ink" : "text-muted/50")}
                >Auto-place</button>
                <button
                  type="button" onClick={() => setGame({ ...game, phase: "attack", sel: null, target: null })} disabled={game.left > 0}
                  className={cn(btn, game.left === 0 ? rollBtn : "cursor-not-allowed border border-line text-muted")}
                >⚔️ Attack</button>
              </>
            )}

            {game.phase === "attack" && (
              <>
                {game.sel && game.target && (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((d) => {
                      const max = Math.min(3, game.troops[game.sel!] - 1);
                      return (
                        <button
                          key={d} type="button" onClick={() => setDiceSel(d)} disabled={d > max}
                          aria-label={`Roll ${d} attack dice`} aria-pressed={diceSel === d}
                          className={cn(
                            "grid h-7 w-7 place-items-center rounded-lg border font-mono text-xs font-bold transition",
                            diceSel === d && d <= max ? "border-warn bg-warn/20 text-warn" : "border-line text-muted hover:text-ink",
                            d > max && "opacity-40",
                          )}
                        >{d}</button>
                      );
                    })}
                    <button type="button" onClick={attack} className={cn(btn, "ml-1", rollBtn)}>🎲 Roll</button>
                  </div>
                )}
                <button
                  type="button" onClick={() => setGame({ ...game, phase: "fortify", sel: null, target: null })}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
                >End turn</button>
              </>
            )}

            {game.phase === "fortify" && (
              <button
                type="button" onClick={endTurn}
                className={cn(btn, "bg-gradient-to-r from-teal-400 via-emerald-500 to-green-600 text-black hover:brightness-110")}
              >End turn → CPU</button>
            )}
          </div>
        </div>

        <ul className="mt-2 space-y-0.5">
          {game.log.map((line, i) => (
            <li key={`${i}-${line}`} className="font-mono text-[11px] text-ink">{line}</li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-center text-xs text-muted">Click to place · attack beats dice · defender ties win · control all 14</p>
    </div>
  );
}
