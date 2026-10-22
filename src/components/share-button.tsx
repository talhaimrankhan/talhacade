"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Share sheet when the browser offers one (mostly mobile), clipboard copy
 * otherwise. This site has no server — sharing is just text plus a link.
 */
export function ShareButton({
  text,
  label = "Share",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const share = () => {
    if (typeof navigator.share === "function") {
      navigator.share({ text }).catch(() => undefined); // sheet dismissed
      return;
    }
    const write = navigator.clipboard?.writeText(text);
    if (!write) return;
    void write
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined); // permission blocked — nothing to show
  };

  return (
    <button
      type="button"
      onClick={share}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted transition hover:border-primary/50 hover:text-ink active:scale-95",
        copied && "border-emerald-500/50 text-emerald-300",
        className,
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Share2 className="h-3.5 w-3.5" aria-hidden />
      )}
      {copied ? "Copied!" : label}
    </button>
  );
}
