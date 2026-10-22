"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

/**
 * "You're offline — everything still works" pill. Subscribes to the
 * browser's online/offline events through the same external-store
 * discipline as the rest of the site, so the static shell always
 * prerenders the (hidden) online state.
 */
function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function onlineSnapshot(): boolean {
  return navigator.onLine;
}

function serverSnapshot(): boolean {
  return true;
}

export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribeOnline,
    onlineSnapshot,
    serverSnapshot,
  );

  if (online) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto w-fit max-w-md rounded-full border border-line bg-surface/95 px-5 py-3 text-sm shadow-[0_18px_50px_-20px_rgba(139,92,246,0.9)] backdrop-blur"
    >
      <span className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0 text-warn" aria-hidden />
        <span>
          You&apos;re offline —{" "}
          <span className="text-muted">the arcade still works.</span>
        </span>
      </span>
    </div>
  );
}
