"use client";

import { useEffect, useRef } from "react";

/**
 * Global confetti burst — listens for achievement unlocks and new personal
 * bests (both dispatched as window CustomEvents) and paints a short-lived
 * particle celebration on a fixed canvas. No deps, no per-game wiring,
 * nothing to run on the server, and silent under prefers-reduced-motion.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  life: number;
}

const COLORS = ["#a78bfa", "#22d3ee", "#fbbf24", "#f472b6", "#34d399", "#818cf8"];
const BURST_COUNT = 150;
const LIFETIME = 1700; // ms

export function Celebrations() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles: Particle[] = [];
    let raf: number | null = null;
    let last = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const tick = (now: number) => {
      const dt = Math.min(32, now - last) / 16.67; // normalize to ~60fps steps
      last = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt * 16.67;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += 0.22 * dt;
        p.vx *= 0.99;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        const alpha = p.life < 500 ? p.life / 500 : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }

      if (particles.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        raf = null;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const burst = () => {
      if (reduced) return;
      resize();
      const cx = canvas.width / 2;
      const cy = canvas.height * 0.42;
      const now = performance.now();
      last = now;

      for (let i = 0; i < BURST_COUNT; i++) {
        const angle = (Math.PI * 2 * i) / BURST_COUNT + Math.random() * 0.4;
        const speed = 4 + Math.random() * 9;
        particles.push({
          x: cx + (Math.random() - 0.5) * 40,
          y: cy + (Math.random() - 0.5) * 40,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.4,
          size: 6 + Math.random() * 7,
          color: COLORS[i % COLORS.length],
          life: LIFETIME * (0.7 + Math.random() * 0.5),
        });
      }

      if (raf === null) raf = requestAnimationFrame(tick);
    };

    const onAchievement = () => burst();
    const onBest = () => burst();
    const onDaily = () => burst();

    window.addEventListener("talhacade:achievement", onAchievement);
    window.addEventListener("talhacade:best", onBest);
    window.addEventListener("talhacade:daily", onDaily);
    window.addEventListener("resize", resize);
    resize();

    return () => {
      window.removeEventListener("talhacade:achievement", onAchievement);
      window.removeEventListener("talhacade:best", onBest);
      window.removeEventListener("talhacade:daily", onDaily);
      window.removeEventListener("resize", resize);
      if (raf !== null) cancelAnimationFrame(raf);
      particles.length = 0;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[70]"
    />
  );
}
