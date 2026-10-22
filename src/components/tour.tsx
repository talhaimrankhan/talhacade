"use client";

import { ArrowRight, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * First-visit tour — three dismissible cards that point out the daily
 * challenge, the "Surprise me" button and the local-only progress model.
 * Runs on the homepage once; the "seen" flag is a tiny external store so
 * the static shell never renders it and hydration stays deterministic.
 */

const FLAG_KEY = "na:v1:tour";

const STEPS = [
  {
    icon: "📅",
    title: "A new game, every day",
    body: "The Daily Challenge picks one title per calendar day. Play it to keep your streak alive, then share the card and dare a friend.",
  },
  {
    icon: "🎲",
    title: "Can't decide? Surprise me",
    body: "The 🎲 button in the header throws you into a random game out of all 160. No menus, no decision fatigue.",
  },
  {
    icon: "💾",
    title: "Everything stays on your device",
    body: "No accounts, ever. Scores, favorites and achievements live in your browser — and the arcade keeps working offline.",
  },
] as const;

const listeners = new Set<() => void>();

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(FLAG_KEY) !== null;
  } catch {
    return true; // Storage blocked — never nag.
  }
}

function subscribeSeen(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function clientSnapshot(): boolean {
  return readSeen();
}

function serverSnapshot(): boolean {
  return true;
}

function markSeen(): void {
  try {
    window.localStorage.setItem(FLAG_KEY, Date.now().toString());
  } catch {
    // Nothing to do — worst case the tour shows again next visit.
  }
  listeners.forEach((notify) => notify());
}

export function Tour() {
  const seen = useSyncExternalStore(
    subscribeSeen,
    clientSnapshot,
    serverSnapshot,
  );
  const [step, setStep] = useState(0);

  // Escape always bails out, wherever you are in the tour.
  useEffect(() => {
    if (seen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") markSeen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [seen]);

  if (seen) return null;

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Talhacade"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={markSeen}
    >
      <div
        className="panel w-full max-w-md p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600/25 to-cyan-600/25 text-2xl">
            {current.icon}
          </span>
          <button
            type="button"
            onClick={markSeen}
            aria-label="Skip the tour"
            className="rounded-full p-1.5 text-muted transition hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <h2 className="mt-4 font-display text-xl font-bold">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{current.body}</p>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-accent" : "w-1.5 bg-line"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => (last ? markSeen() : setStep(step + 1))}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_30px_-10px_rgba(139,92,246,0.95)] transition hover:brightness-110 active:scale-95"
          >
            {last ? "Got it" : "Next"}
            {!last && <ArrowRight className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}
