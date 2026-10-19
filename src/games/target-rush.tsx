"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 520;
const MAG_SIZE = 6;
const RELOAD_TIME = 1.1;

type Status = "idle" | "playing" | "over";

/** Rails run left→right at increasing depth; each has its own speed band. */
const RAILS = [
  { y: 120, speed: 60, size: 22 },
  { y: 210, speed: 82, size: 20 },
  { y: 300, speed: 108, size: 18 },
  { y: 390, speed: 138, size: 16 },
];

interface Slide {
  x: number;
  y: number;
  vx: number;
  r: number;
  kind: "duck" | "star" | "bot";
  hp: number;
  wob: number;
  hit: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  c: string;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  c: string;
}

interface RushGame {
  slides: Slide[];
  parts: Particle[];
  floaters: Floater[];
  spawnT: number;
  speedUp: number;
  ammo: number;
  reloading: boolean;
  reloadT: number;
  combo: number;
  lives: number;
  score: number;
  shots: number;
  hits: number;
  shake: number;
  flash: number;
  over: boolean;
  dirty: boolean;
}

function comboMult(combo: number): number {
  return Math.min(6, 1 + Math.floor(combo / 5));
}

function spawnSlide(g: RushGame): void {
  const rail = RAILS[Math.floor(Math.random() * RAILS.length)];
  const fromLeft = Math.random() < 0.5;
  const dir = fromLeft ? 1 : -1;
  const speed = (rail.speed + Math.random() * 30) * g.speedUp * dir;

  let kind: Slide["kind"] = "duck";
  const roll = Math.random();
  if (roll > 0.86) kind = "star";
  else if (roll > 0.6) kind = "bot";

  g.slides.push({
    x: fromLeft ? -30 : W + 30,
    y: rail.y,
    vx: speed,
    r: kind === "star" ? rail.size * 0.8 : rail.size,
    kind,
    hp: kind === "bot" ? 2 : 1,
    wob: Math.random() * Math.PI * 2,
    hit: 0,
  });
}

function burst(parts: Particle[], x: number, y: number, c: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 50 + Math.random() * 150;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 40,
      life: 0.3 + Math.random() * 0.35,
      max: 0.65,
      r: 1.5 + Math.random() * 2.5,
      c,
    });
  }
}

function createGame(): RushGame {
  return {
    slides: [],
    parts: [],
    floaters: [],
    spawnT: 0.5,
    speedUp: 1,
    ammo: MAG_SIZE,
    reloading: false,
    reloadT: 0,
    combo: 0,
    lives: 3,
    score: 0,
    shots: 0,
    hits: 0,
    shake: 0,
    flash: 0,
    over: false,
    dirty: true,
  };
}

function stepGame(g: RushGame, dt: number): void {
  if (g.over) return;

  g.shake = Math.max(0, g.shake - dt * 24);
  g.flash = Math.max(0, g.flash - dt);

  if (g.reloading) {
    g.reloadT -= dt;
    if (g.reloadT <= 0) {
      g.reloading = false;
      g.ammo = MAG_SIZE;
      g.dirty = true;
    }
  }

  g.spawnT -= dt;
  if (g.spawnT <= 0 && g.slides.length < 7) {
    g.spawnT = Math.max(0.28, 0.75 - g.speedUp * 0.06) + Math.random() * 0.3;
    spawnSlide(g);
  }

  for (let i = g.slides.length - 1; i >= 0; i--) {
    const s = g.slides[i];
    s.x += s.vx * dt;
    s.wob += dt * (s.kind === "duck" ? 7 : 3);
    s.hit = Math.max(0, s.hit - dt * 5);
    if (s.x < -50 || s.x > W + 50) {
      g.slides.splice(i, 1);
      // letting one escape the rail breaks the combo and costs a life
      g.combo = 0;
      g.lives -= 1;
      g.shake = Math.max(g.shake, 6);
      g.dirty = true;
      if (g.lives <= 0) {
        g.lives = 0;
        g.over = true;
        return;
      }
    }
  }

  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.parts.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
  }

  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.life -= dt;
    f.y -= 36 * dt;
    if (f.life <= 0) g.floaters.splice(i, 1);
  }
}

export default function TargetRush() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<RushGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [ammo, setAmmo] = useState(MAG_SIZE);
  const [reloading, setReloading] = useState(false);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [newBest, setNewBest] = useState(false);
  const [endStats, setEndStats] = useState({ hits: 0, shots: 0 });
  const { best, submit } = useBestScore("target-rush", "high");
  const cross = useRef({ x: W / 2, y: H / 2 });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    // carnival night sky + tent stripes
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1b0a2a");
    sky.addColorStop(0.55, "#2a0f3d");
    sky.addColorStop(1, "#12071c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // string lights
    for (let i = 0; i < 22; i++) {
      const x = 12 + i * ((W - 24) / 21);
      const y = 26 + Math.sin(i * 0.9) * 8;
      const hue = (i * 47) % 360;
      ctx.fillStyle = `hsla(${hue}, 90%, 65%, ${0.55 + Math.sin(time / 300 + i) * 0.35})`;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // rails
    for (const rail of RAILS) {
      ctx.strokeStyle = "rgba(244, 114, 182, 0.28)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, rail.y + rail.size + 8);
      ctx.lineTo(W, rail.y + rail.size + 8);
      ctx.stroke();
    }

    ctx.save();
    if (g.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    }

    for (const s of g.slides) {
      ctx.save();
      ctx.translate(s.x, s.y + Math.sin(s.wob) * (s.kind === "duck" ? 4 : 0));

      if (s.kind === "star") {
        ctx.shadowColor = "#fde047";
        ctx.shadowBlur = 18;
        ctx.fillStyle = s.hit > 0 ? "#ffffff" : "#fde047";
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          const ax = Math.cos(a) * s.r;
          const ay = Math.sin(a) * s.r;
          const b = a + Math.PI / 5;
          if (i === 0) ctx.moveTo(ax, ay);
          else ctx.lineTo(ax, ay);
          ctx.lineTo(Math.cos(b) * s.r * 0.45, Math.sin(b) * s.r * 0.45);
        }
        ctx.closePath();
        ctx.fill();
      } else if (s.kind === "bot") {
        // robot duck — two hits, armored
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 12;
        ctx.fillStyle = s.hit > 0 ? "#ffffff" : "#06b6d4";
        ctx.beginPath();
        ctx.roundRect(-s.r, -s.r * 0.8, s.r * 2, s.r * 1.6, 8);
        ctx.fill();
        ctx.fillStyle = "#083344";
        ctx.fillRect(-s.r * 0.5, -s.r * 0.35, s.r * 0.35, s.r * 0.3);
        ctx.fillRect(s.r * 0.15, -s.r * 0.35, s.r * 0.35, s.r * 0.3);
        ctx.strokeStyle = "#67e8f9";
        ctx.lineWidth = 2;
        for (let i = 0; i < s.hp; i++) {
          ctx.beginPath();
          ctx.moveTo(-s.r + 4 + i * 8, s.r * 0.55);
          ctx.lineTo(-s.r + 9 + i * 8, s.r * 0.55);
          ctx.stroke();
        }
      } else {
        const dir = Math.sign(s.vx);
        // rubber duck
        ctx.shadowColor = "#fb7185";
        ctx.shadowBlur = 12;
        ctx.fillStyle = s.hit > 0 ? "#ffffff" : "#fb7185";
        ctx.beginPath();
        ctx.ellipse(0, 2, s.r, s.r * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dir * s.r * 0.55, -s.r * 0.5, s.r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        // beak
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.moveTo(dir * s.r * 0.9, -s.r * 0.55);
        ctx.lineTo(dir * (s.r * 1.35), -s.r * 0.35);
        ctx.lineTo(dir * s.r * 0.9, -s.r * 0.2);
        ctx.closePath();
        ctx.fill();
        // eye
        ctx.fillStyle = "#0b0b16";
        ctx.beginPath();
        ctx.arc(dir * s.r * 0.62, -s.r * 0.58, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // particles
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // floaters
    ctx.font = "bold 15px ui-monospace, monospace";
    ctx.textAlign = "center";
    for (const f of g.floaters) {
      ctx.globalAlpha = Math.min(1, f.life / 0.35);
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
    ctx.restore();

    // muzzle flash bleed
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(253, 224, 71, ${g.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    // crosshair
    const cx = cross.current.x;
    const cy = cross.current.y;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.moveTo(cx - 20, cy);
    ctx.lineTo(cx - 6, cy);
    ctx.moveTo(cx + 6, cy);
    ctx.lineTo(cx + 20, cy);
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(cx, cy - 6);
    ctx.moveTo(cx, cy + 6);
    ctx.lineTo(cx, cy + 20);
    ctx.stroke();

    // magazine readout
    ctx.font = "bold 16px ui-monospace, monospace";
    if (g.reloading) {
      const frac = 1 - g.reloadT / RELOAD_TIME;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(W - 96, H - 26, 84, 14);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(W - 94, H - 24, 80 * frac, 10);
      ctx.fillStyle = "#fde047";
      ctx.fillText("RELOADING", W - 96, H - 32);
    } else {
      for (let i = 0; i < MAG_SIZE; i++) {
        ctx.fillStyle = i < g.ammo ? "#fde047" : "rgba(255,255,255,0.15)";
        ctx.beginPath();
        ctx.roundRect(W - 96 + i * 14, H - 22, 9, 16, 2);
        ctx.fill();
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }, [draw]);

  /* ---------------- loop ---------------- */

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setAmmo(MAG_SIZE);
    setReloading(false);
    setCombo(0);
    setLives(3);
    setEndStats({ hits: 0, shots: 0 });
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      stepGame(g, dt);

      if (g.dirty) {
        g.dirty = false;
        setScore(g.score);
        setAmmo(g.ammo);
        setReloading(g.reloading);
        setCombo(g.combo);
        setLives(g.lives);
      }
      // endless: difficulty creeps up with the score
      g.speedUp = Math.min(2.4, 1 + g.score / 2600);

      if (g.over) {
        setScore(g.score);
        setEndStats({ hits: g.hits, shots: g.shots });
        setNewBest(submit(g.score));
        setStatus("over");
        draw(t);
        return;
      }

      draw(t);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start]);

  const aim = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    cross.current = {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const shoot = (clientX: number, clientY: number) => {
    const g = gameRef.current;
    if (!g || g.over) return;
    aim(clientX, clientY);
    const x = cross.current.x;
    const y = cross.current.y;

    if (g.reloading) return;
    if (g.ammo <= 0) {
      // click on empty mag → kick off the reload
      g.reloading = true;
      g.reloadT = RELOAD_TIME;
      g.dirty = true;
      return;
    }

    g.ammo -= 1;
    g.shots += 1;
    g.flash = 0.06;
    g.shake = Math.max(g.shake, 2);
    g.dirty = true;

    for (let i = g.slides.length - 1; i >= 0; i--) {
      const s = g.slides[i];
      const dx = x - s.x;
      const dy = y - s.y;
      if (dx * dx + dy * dy > (s.r + 4) * (s.r + 4)) continue;

      s.hp -= 1;
      s.hit = 1;
      burst(g.parts, x, y, "#fde047", 6);
      if (s.hp > 0) {
        // armor chip — no combo change
        g.floaters.push({ x: s.x, y: s.y - s.r, text: "CLANK", life: 0.5, c: "#67e8f9" });
        return;
      }

      g.slides.splice(i, 1);
      g.hits += 1;
      g.combo += 1;
      const m = comboMult(g.combo);
      const base = s.kind === "star" ? 50 : s.kind === "bot" ? 25 : 15;
      const points = base * m * (s.kind === "star" ? 3 : 1);
      g.score += points;
      g.floaters.push({
        x: s.x,
        y: s.y - s.r,
        text: `${s.kind === "star" ? "★ " : ""}+${points}`,
        life: 0.7,
        c: s.kind === "star" ? "#fde047" : "#fda4af",
      });
      const color = s.kind === "star" ? "#fde047" : s.kind === "bot" ? "#22d3ee" : "#fb7185";
      burst(g.parts, s.x, s.y, color, 14);
      g.shake = Math.max(g.shake, s.kind === "star" ? 6 : 3.5);
      g.dirty = true;
      return;
    }

    // clean miss
    g.combo = 0;
    g.dirty = true;
    burst(g.parts, x, y, "#6b7280", 5);

    if (g.ammo === 0) {
      g.reloading = true;
      g.reloadT = RELOAD_TIME;
    }
  };

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Combo{" "}
          <b className={`ml-1 text-sm ${combo >= 5 ? "text-warn" : "text-ink"}`}>
            {combo} (×{comboMult(combo)})
          </b>
        </span>
        <span>
          Lives{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${lives} lives`}>
            {"●".repeat(Math.max(0, lives)) || "—"}
          </b>
        </span>
        <span>
          Mag{" "}
          <b className="ml-1 text-sm text-ink">
            {reloading ? "…" : ammo}/{MAG_SIZE}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-24px_rgba(244,114,182,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-none"
          aria-label="Target Rush shooting gallery"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") {
              start();
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            shoot(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            aim(e.clientX, e.clientY);
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">TARGET RUSH</p>
            <p className="mt-2 text-sm text-muted">
              Ducks on rails, armored bots, and triple-pay stars. Six rounds in the magazine —
              click empty to reload. Let three escape and the fair shuts down.
            </p>
            <PrimaryButton onClick={start} tone="from-rose-400 to-fuchsia-500">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Aim + click or tap · combo builds on hits, breaks on misses
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">FAIR&apos;S OVER</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · {endStats.hits} hits / {endStats.shots} shots
            </p>
            <PrimaryButton onClick={start} tone="from-rose-400 to-fuchsia-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Stars pay 3× · bots take two hits · empty click reloads · speed climbs with your score
      </p>
    </div>
  );
}
