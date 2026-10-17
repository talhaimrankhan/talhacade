"use client";

import { useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

interface Owned {
  cursor: number;
  drill: number;
  reactor: number;
  fusion: number;
  overclock: number;
}

interface Save {
  cookies: number;
  total: number;
  owned: Owned;
}

interface Up {
  key: keyof Owned;
  name: string;
  emoji: string;
  base: number;
  growth: number;
  rate: number; // cookies per second, per level
  effect: string;
}

const EMPTY: Save = {
  cookies: 0,
  total: 0,
  owned: { cursor: 0, drill: 0, reactor: 0, fusion: 0, overclock: 0 },
};

const UPS: Up[] = [
  { key: "cursor", name: "Cursor", emoji: "🖱️", base: 15, growth: 1.15, rate: 1, effect: "+1/s" },
  { key: "drill", name: "Drill", emoji: "⛏️", base: 100, growth: 1.15, rate: 8, effect: "+8/s" },
  { key: "reactor", name: "Reactor", emoji: "⚛️", base: 1100, growth: 1.15, rate: 40, effect: "+40/s" },
  { key: "fusion", name: "Fusion", emoji: "🌀", base: 12000, growth: 1.15, rate: 200, effect: "+200/s" },
  { key: "overclock", name: "Overclock", emoji: "⚡", base: 50, growth: 1.25, rate: 0, effect: "×2 tap" },
];

const costOf = (u: Up, level: number) => Math.ceil(u.base * Math.pow(u.growth, level));
const cpsOf = (o: Owned) => UPS.reduce((sum, u) => sum + o[u.key] * u.rate, 0);
const tapPower = (o: Owned) => Math.pow(2, o.overclock);

/** Big-number shorthand: 1.2k, 3.4M, 5.6B, 1.2T. */
function fmt(n: number): string {
  if (n < 1000) return Math.floor(n).toLocaleString("en-US");
  const units = ["k", "M", "B", "T", "Qa", "Qi"];
  let v = n;
  let i = -1;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i += 1;
  }
  return `${v.toFixed(v < 100 ? 1 : 0)}${units[i]}`;
}

export default function NeonClicker({ gameId }: { gameId: string }) {
  const [save, setSave] = useStored<Save>(`save:${gameId}`, EMPTY);
  const [started, setStarted] = useState(false);
  const { best, submit } = useBestScore(gameId, "high");

  // latest snapshot for the tick callback — keeps the interval subscription stable
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  });

  const cps = cpsOf(save.owned);
  const power = tapPower(save.owned);
  const gain = cps / 4;

  // cookies-per-second accrue four times a second; progress is reported from here too
  useEffect(() => {
    const id = setInterval(() => {
      if (gain > 0) setSave((prev) => ({ ...prev, cookies: prev.cookies + gain, total: prev.total + gain }));
      submit(Math.floor(latest.current.total + gain));
    }, 250);
    return () => clearInterval(id);
  }, [gain, setSave, submit]);

  const tap = () => {
    setSave((prev) => ({
      ...prev,
      cookies: prev.cookies + power,
      total: prev.total + power,
    }));
  };

  const buy = (u: Up) => {
    setSave((prev) => {
      const level = prev.owned[u.key];
      const cost = costOf(u, level);
      if (prev.cookies < cost) return prev;
      return {
        ...prev,
        cookies: prev.cookies - cost,
        owned: { ...prev.owned, [u.key]: level + 1 },
      };
    });
  };

  const reset = () => {
    if (window.confirm("Wipe your save and start from zero?")) setSave(EMPTY);
  };

  const rowBtn =
    "flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left transition";

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={fmt(save.cookies)} best={best ?? "—"}>
        <span className="text-accent">
          Rate <b className="ml-1 text-sm text-ink">{fmt(cps)}/s</b>
        </span>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-line bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted transition hover:border-rose-500/50 hover:text-rose-400"
        >
          Reset
        </button>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-4 shadow-[0_0_60px_-24px_rgba(251,191,36,0.9)]">
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={tap}
            aria-label="Tap to earn cookies"
            className="animate-pulse-glow grid h-40 w-40 place-items-center rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600 shadow-[0_10px_40px_-10px_rgba(251,191,36,0.9)] transition active:scale-95"
          >
            <span className="select-none text-6xl">🍪</span>
          </button>
          <p className="mt-3 font-mono text-xs uppercase tracking-widest text-muted">
            +{power} per tap · {fmt(save.total)} baked all-time
          </p>
        </div>

        <div className="mt-4 space-y-2">
          {UPS.map((u) => {
            const level = save.owned[u.key];
            const cost = costOf(u, level);
            const afford = save.cookies >= cost;
            return (
              <button
                key={u.key}
                type="button"
                onClick={() => buy(u)}
                disabled={!afford}
                aria-label={`Buy ${u.name} for ${Math.ceil(cost)} cookies`}
                className={`${rowBtn} ${
                  afford
                    ? "border-primary/40 hover:border-primary/70 hover:bg-surface-2"
                    : "opacity-50"
                }`}
              >
                <span className="text-2xl">{u.emoji}</span>
                <span className="flex-1">
                  <b className="block font-display text-sm text-ink">{u.name}</b>
                  <span className="font-mono text-[11px] text-muted">{u.effect}</span>
                </span>
                <span className="text-right">
                  <b className="block font-mono text-sm text-warn">{fmt(cost)}</b>
                  <span className="font-mono text-[11px] text-muted">lv {level}</span>
                </span>
              </button>
            );
          })}
        </div>

        {!started && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">NEON CLICKER</p>
            <p className="mt-2 text-sm text-muted">
              Tap the orb, buy machines, keep the numbers climbing.
            </p>
            <PrimaryButton onClick={() => setStarted(true)} tone="from-yellow-400 via-amber-500 to-orange-600">
              Start baking
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Your bakery keeps running even while you&apos;re away
            </p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Idle bakery · costs rise 15% per level, so buy early and often
      </p>
    </div>
  );
}
