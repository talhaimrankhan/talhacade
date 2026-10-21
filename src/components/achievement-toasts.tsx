"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Achievement } from "@/lib/achievements";
import { sfx } from "@/lib/sfx";

/**
 * Global host for achievement pop-ups. Listens for `talhacade:achievement`
 * window events (dispatched by src/lib/achievements.ts) and slides the
 * unlocked achievement into the bottom-right corner with a sparkle.
 *
 * Mount once — the layout does it. Keep at most MAX_TOASTS visible; the
 * oldest falls off, and each toast self-dismisses after TOAST_MS.
 */

interface Toast extends Achievement {
  key: number;
}

const MAX_TOASTS = 3;
const TOAST_MS = 5500;

export function AchievementToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let nextKey = 0;
    const timers = new Set<number>();

    const onAchievement = (event: Event) => {
      const detail = (event as CustomEvent<Achievement | undefined>).detail;
      if (!detail || typeof detail.id !== "string") return;

      const key = ++nextKey;
      setToasts((prev) => [...prev, { ...detail, key }].slice(-MAX_TOASTS));
      sfx.unlock();

      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setToasts((prev) => prev.filter((toast) => toast.key !== key));
      }, TOAST_MS);
      timers.add(timer);
    };

    window.addEventListener("talhacade:achievement", onAchievement);
    return () => {
      window.removeEventListener("talhacade:achievement", onAchievement);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.key}
            role="status"
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: 48, scale: 0.9 }
            }
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: 24, scale: 0.92 }
            }
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="panel glow-soft pointer-events-auto flex w-80 max-w-[calc(100vw-3rem)] items-start gap-3 p-4"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 text-xl shadow-[0_10px_24px_-10px_rgba(139,92,246,0.9)]">
              <span aria-hidden>{toast.icon}</span>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
                Achievement unlocked
              </p>
              <p className="mt-0.5 font-display text-sm font-bold text-ink">
                {toast.title}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-muted">
                {toast.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
