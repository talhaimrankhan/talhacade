"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const COOK_MS = 1200;
const RING = 94.2; // 2πr with r=15

const MENU = [
  { key: "burger", emoji: "🍔" },
  { key: "fries", emoji: "🍟" },
  { key: "drink", emoji: "🥤" },
  { key: "taco", emoji: "🌮" },
  { key: "pizza", emoji: "🍕" },
] as const;

type Status = "intro" | "playing" | "over";

interface Station {
  item: string | null;
  startAt: number;
}

interface Order {
  id: number;
  items: string[];
  patience: number;
  max: number;
}

interface Diner {
  clock: number;
  status: Status;
  stations: Station[];
  stock: Record<string, number>;
  orders: Order[];
  lives: number;
  score: number;
  served: number;
  nextSpawnAt: number;
  nextId: number;
  toast: string | null;
  toastAt: number;
}

function newGame(status: Status = "intro"): Diner {
  return {
    clock: 0,
    status,
    stations: MENU.map(() => ({ item: null, startAt: 0 })),
    stock: {},
    orders: [],
    lives: 3,
    score: 0,
    served: 0,
    nextSpawnAt: 700,
    nextId: 1,
    toast: null,
    toastAt: 0,
  };
}

function spawnOrder(g: Diner): Order {
  const wave = Math.floor(g.served / 5);
  const count = 1 + Math.floor(Math.random() * Math.min(3, 2 + wave));
  const items: string[] = [];
  for (let i = 0; i < count; i++) {
    items.push(MENU[Math.floor(Math.random() * MENU.length)].key);
  }
  const max = 11 + count * 2.5;
  const order: Order = { id: g.nextId, items, patience: max, max };
  g.nextId += 1;
  return order;
}

/** Pure 100ms tick: cooking finishes, patience drains, new orders arrive. */
function step(prev: Diner, dt: number): Diner {
  const g: Diner = {
    ...prev,
    stations: [...prev.stations],
    stock: { ...prev.stock },
    orders: prev.orders.map((o) => ({ ...o, patience: o.patience - dt / 1000 })),
  };
  g.clock += dt;

  g.stations = g.stations.map((s) => {
    if (s.item && g.clock - s.startAt >= COOK_MS) {
      g.stock[s.item] = (g.stock[s.item] ?? 0) + 1;
      return { item: null, startAt: 0 };
    }
    return s;
  });

  const expired = g.orders.filter((o) => o.patience <= 0);
  if (expired.length > 0) {
    g.orders = g.orders.filter((o) => o.patience > 0);
    g.lives = Math.max(0, g.lives - expired.length);
    g.toast = "A customer walked out!";
    g.toastAt = g.clock;
  }

  while (g.orders.length < 3 && g.clock >= g.nextSpawnAt) {
    g.orders = [...g.orders, spawnOrder(g)];
    g.nextSpawnAt =
      g.clock + Math.max(2400, 7500 - Math.floor(g.served / 5) * 900);
  }

  if (g.lives <= 0) g.status = "over";
  return g;
}

export default function NeonDiner({ gameId }: { gameId: string }) {
  const [g, setG] = useState<Diner>(() => newGame());
  const latestRef = useRef<Diner>(g);
  const { best, submit } = useBestScore(gameId, "high");

  const apply = useCallback((next: Diner) => {
    latestRef.current = next;
    setG(next);
  }, []);

  useEffect(() => {
    if (g.status !== "playing") return;
    const id = setInterval(() => {
      const next = step(latestRef.current, 100);
      if (next.status === "over" && latestRef.current.status !== "over") {
        submit(next.score);
      }
      apply(next);
    }, 100);
    return () => clearInterval(id);
  }, [g.status, apply, submit]);

  const start = useCallback(() => {
    apply(newGame("playing"));
  }, [apply]);

  const cook = useCallback(
    (key: string) => {
      const prev = latestRef.current;
      if (prev.status !== "playing") return;
      const idx = prev.stations.findIndex((s) => s.item === null);
      if (idx === -1) {
        apply({ ...prev, toast: "All stations busy!", toastAt: prev.clock });
        return;
      }
      const stations = prev.stations.map((s, i) =>
        i === idx ? { item: key, startAt: prev.clock } : s,
      );
      apply({ ...prev, stations });
    },
    [apply],
  );

  const serve = useCallback(
    (orderId: number) => {
      const prev = latestRef.current;
      if (prev.status !== "playing") return;
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order) return;

      const stock = { ...prev.stock };
      const ready = order.items.every((it) => (stock[it] ?? 0) > 0);
      if (!ready) {
        apply({ ...prev, toast: "Still cooking!", toastAt: prev.clock });
        return;
      }
      for (const it of order.items) stock[it] -= 1;

      const pay = order.items.length * 100;
      const tip = Math.round(50 * (order.patience / order.max));
      apply({
        ...prev,
        stock,
        orders: prev.orders.filter((o) => o.id !== orderId),
        score: prev.score + pay + tip,
        served: prev.served + 1,
        toast: `+${pay + tip}`,
        toastAt: prev.clock,
      });
    },
    [apply],
  );

  const toastLive = g.clock - g.toastAt < 1400;
  const wave = Math.floor(g.served / 5) + 1;

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={g.score} best={best ?? "—"}>
        <span className="text-rose-400">
          Lives{" "}
          <b className="ml-1 text-sm text-ink">
            {"❤".repeat(Math.max(0, g.lives)) || "—"}
          </b>
        </span>
        <span className="text-accent">
          Wave <b className="ml-1 text-sm text-ink">{wave}</b>
        </span>
      </GameHud>

      <div className="relative rounded-2xl border border-line bg-surface-2 p-3 shadow-[0_0_60px_-22px_rgba(244,114,182,0.8)] sm:p-4">
        {/* prep stations */}
        <div className="grid grid-cols-5 gap-2">
          {MENU.map((m, i) => {
            const station = g.stations[i];
            const cooking = station.item !== null;
            const pct = cooking
              ? Math.min(1, (g.clock - station.startAt) / COOK_MS)
              : 0;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => cook(m.key)}
                aria-label={`Prep ${m.key}`}
                className={cn(
                  "relative grid aspect-square place-items-center rounded-xl border transition active:scale-95",
                  cooking
                    ? "border-warn/60 bg-warn/10"
                    : "border-line bg-surface hover:border-primary/50",
                )}
              >
                <span className="text-2xl sm:text-3xl">{m.emoji}</span>
                {cooking && (
                  <svg
                    viewBox="0 0 36 36"
                    className="absolute inset-0 h-full w-full -rotate-90"
                    aria-hidden="true"
                  >
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="rgba(251,191,36,0.2)"
                      strokeWidth="3"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${pct * RING} ${RING}`}
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* ready counter */}
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-black/25 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Ready
          </span>
          <div className="flex gap-2">
            {MENU.map((m) => {
              const count = g.stock[m.key] ?? 0;
              return (
                <span
                  key={m.key}
                  className={cn(
                    "relative text-xl transition",
                    count > 0 ? "opacity-100" : "opacity-25",
                  )}
                >
                  {m.emoji}
                  {count > 0 && (
                    <b className="absolute -right-2 -top-1 rounded-full bg-success px-1 font-mono text-[9px] text-black">
                      {count}
                    </b>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* order queue */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {g.orders.map((o) => {
            const need = [...new Set(o.items)];
            const ready = need.every((it) => (g.stock[it] ?? 0) > 0);
            const life = Math.max(0, o.patience / o.max);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => serve(o.id)}
                aria-label={`Serve order ${o.id}`}
                className={cn(
                  "rounded-xl border bg-surface p-2.5 text-left transition active:scale-[0.98]",
                  ready
                    ? "border-success/70 shadow-[0_0_18px_-8px_rgba(52,211,153,0.9)]"
                    : "border-line",
                )}
              >
                <div className="flex items-center gap-1 text-xl">
                  {need.map((it) => {
                    const total = o.items.filter((x) => x === it).length;
                    const have = Math.min(total, g.stock[it] ?? 0);
                    return (
                      <span
                        key={it}
                        className={cn(
                          "relative",
                          have === total && "drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]",
                        )}
                      >
                        {MENU.find((m) => m.key === it)?.emoji}
                        {total > 1 && (
                          <b className="ml-0.5 align-super font-mono text-[9px] text-muted">
                            ×{total}
                          </b>
                        )}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/50">
                  <div
                    style={{ width: `${life * 100}%` }}
                    className={cn(
                      "h-full rounded-full transition-[width] duration-100 ease-linear",
                      life > 0.5
                        ? "bg-success"
                        : life > 0.25
                          ? "bg-warn"
                          : "bg-rose-400",
                    )}
                  />
                </div>
                <p className="mt-1.5 font-mono text-[9px] uppercase tracking-widest text-muted">
                  {ready ? "tap to serve" : "cooking…"}
                </p>
              </button>
            );
          })}
          {g.orders.length === 0 && (
            <p className="py-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted sm:col-span-3">
              Waiting for customers…
            </p>
          )}
        </div>

        {toastLive && g.toast && (
          <p className="animate-pop pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-line bg-black/80 px-4 py-1 font-mono text-xs font-bold text-warn">
            {g.toast}
          </p>
        )}

        {g.status === "intro" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">
              NEON DINER
            </p>
            <p className="mt-2 max-w-[36ch] text-sm text-muted">
              Prep items at the stations, then tap the matching order to serve
              it before patience runs out. Every 5 served speeds the rush up.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-pink-400 via-rose-500 to-red-400"
            >
              Open up
            </PrimaryButton>
          </Overlay>
        )}

        {g.status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              KITCHEN CLOSED
            </p>
            {best !== null && g.score >= best && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ Best shift!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {g.score}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {g.served} orders served · Best {best ?? "—"}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-pink-400 via-rose-500 to-red-400"
            >
              New shift
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Tap a station to cook · tap an order when it&apos;s ready · never lose
        three customers
      </p>
    </div>
  );
}
