"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Registers the offline service worker (production builds only). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`${basePath}/sw.js`)
      .catch(() => undefined); // offline support is a progressive enhancement
  }, []);

  return null;
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Install" button that only appears when the browser actually offers an
 * install prompt (Chrome/Android + desktop). Hidden otherwise — no fake UI.
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || prompt === null) return null;

  const install = () => {
    const pending = prompt;
    if (!pending) return;
    setPrompt(null);
    void pending.prompt();
    void pending.userChoice.then((choice) => {
      if (choice.outcome === "dismissed") return; // browser decides the rest
    });
  };

  return (
    <button
      type="button"
      onClick={install}
      aria-label="Install Talhacade on this device"
      title="Install app"
      className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:border-primary/50 hover:text-ink active:scale-95"
    >
      <Download className="h-4 w-4" aria-hidden />
    </button>
  );
}
