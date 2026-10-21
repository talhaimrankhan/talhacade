"use client";

import { useEffect, type ReactNode } from "react";
import { sfx } from "@/lib/sfx";

/** Glass overlay rendered on top of a game canvas/board. */
export function Overlay({ children }: { children: ReactNode }) {
  useEffect(() => {
    sfx.whoosh();
  }, []);

  return (
    <div className="absolute inset-0 grid place-items-center bg-black/75 p-6 text-center backdrop-blur-[3px]">
      <div>{children}</div>
    </div>
  );
}

/** Big gradient call-to-action used inside overlays. */
export function PrimaryButton({
  onClick,
  tone,
  children,
}: {
  onClick: () => void;
  /** Tailwind gradient classes (literal at call site). */
  tone: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        sfx.click();
        onClick();
      }}
      className={`mt-5 rounded-full bg-gradient-to-r ${tone} px-7 py-2.5 text-sm font-bold text-black shadow-lg transition hover:brightness-110 active:scale-95`}
    >
      {children}
    </button>
  );
}

/** Score / best strip shown above a game. */
export function GameHud({
  score,
  best,
  accent = "text-warn",
  children,
}: {
  score: ReactNode;
  best: ReactNode;
  accent?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
      <span>
        Score <b className="ml-1 text-sm text-ink">{score}</b>
      </span>
      <div className="flex items-center gap-3">
        {children}
        <span className={accent}>
          Best <b className="ml-1 text-sm text-ink">{best}</b>
        </span>
      </div>
    </div>
  );
}
