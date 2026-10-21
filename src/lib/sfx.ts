"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny WebAudio sound engine — every effect is synthesized on the fly,
 * so the whole arcade stays asset-free and offline-friendly.
 *
 * Rules of the road:
 *  - Browsers only allow audio after a real user gesture, so nothing is
 *    emitted until the first pointerdown/keydown of the session.
 *  - The preference is persisted ("na:v1:sfx") and toggled from the header.
 *  - Every function is a no-op on the server.
 */

const KEY = "na:v1:sfx";

let ctx: AudioContext | null = null;
let interacted = false;
let listenersInstalled = false;
const listeners = new Set<() => void>();

if (typeof window !== "undefined" && !listenersInstalled) {
  listenersInstalled = true;
  const arm = () => {
    interacted = true;
  };
  window.addEventListener("pointerdown", arm, { once: true });
  window.addEventListener("keydown", arm, { once: true });
}

function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(KEY) !== "false";
  } catch {
    return true;
  }
}

export function setSfxEnabled(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, String(value));
  } catch {
    // Storage blocked — sound just stays where it is.
  }
  listeners.forEach((notify) => notify());
}

function subscribeSfx(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Persisted on/off, hydrated safely for the header toggle. */
export function useSfxEnabled(): boolean {
  return useSyncExternalStore(
    subscribeSfx,
    readEnabled,
    () => true,
  );
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !interacted || !readEnabled()) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

/** One enveloped oscillator. `to` slides the pitch (portamento). */
function tone(
  freq: number,
  opts: {
    dur?: number;
    type?: OscillatorType;
    gain?: number;
    to?: number;
    delay?: number;
  } = {},
): void {
  const ac = audio();
  if (!ac) return;
  const { dur = 0.09, type = "square", gain = 0.05, to, delay = 0 } = opts;

  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);

  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Short filtered-noise burst — used for swishes and overlays. */
function noise(opts: { dur?: number; gain?: number; freq?: number } = {}): void {
  const ac = audio();
  if (!ac) return;
  const { dur = 0.16, gain = 0.035, freq = 900 } = opts;

  const frames = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq, ac.currentTime);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, ac.currentTime);

  src.connect(filter).connect(amp).connect(ac.destination);
  src.start();
}

export const sfx = {
  /** Neutral UI click (buttons, keys, chips). */
  click(): void {
    tone(660, { dur: 0.05, gain: 0.035 });
  },
  /** Soft positive pop — favorites, selections. */
  pop(): void {
    tone(520, { dur: 0.07, type: "triangle", gain: 0.045, to: 780 });
  },
  /** Two-note success chime. */
  success(): void {
    tone(660, { dur: 0.09, type: "triangle", gain: 0.05 });
    tone(990, { dur: 0.12, type: "triangle", gain: 0.05, delay: 0.08 });
  },
  /** Downward buzz for mistakes. */
  error(): void {
    tone(200, { dur: 0.14, type: "sawtooth", gain: 0.04, to: 90 });
  },
  /** Achievement sparkle. */
  unlock(): void {
    tone(880, { dur: 0.08, type: "triangle", gain: 0.05 });
    tone(1320, { dur: 0.09, type: "triangle", gain: 0.045, delay: 0.07 });
    tone(1760, { dur: 0.16, type: "triangle", gain: 0.04, delay: 0.15 });
  },
  /** Airy swish when an overlay appears. */
  whoosh(): void {
    noise({ dur: 0.18, gain: 0.03, freq: 1100 });
  },
};
