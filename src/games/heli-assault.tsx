"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 520;
const GROUND_BASE = 430;

type Status = "idle" | "playing" | "over";

interface Bomb {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Turret {
  x: number;
  y: number; // ground contact
  hp: number;
  kind: "turret" | "tank";
  telegraph: number; // >0 = charging a shot
  cool: number;
  flash: number;
  worth: number;
}

interface Shell {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Spike {
  x: number;
  y: number;
}

interface Pickup {
  x: number;
  y: number;
  kind: "health";
  t: number;
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

interface HeliGame {
  heliX: number;
  heliY: number;
  vx: number;
  vy: number;
  hp: number;
  bombs: Bomb[];
  turrets: Turret[];
  shells: Shell[];
  spikes: Spike[];
  pickups: Pickup[];
  parts: Particle[];
  scroll: number; // distance travelled
  spawnX: number; // next ground-feature world x
  bombCd: number;
  score: number;
  kills: number;
  shake: number;
  tailPhase: number;
  over: boolean;
  dirty: boolean;
}

function terrainAt(g: HeliGame, worldX: number): number {
  // rolling ridge — deterministic from world position
  const a = Math.sin(worldX * 0.008) * 34;
  const b = Math.sin(worldX * 0.021 + 1.7) * 20;
  const c = Math.sin(worldX * 0.047 + 4.1) * 9;
  return GROUND_BASE + a + b + c;
}

function burst(parts: Particle[], x: number, y: number, c: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const s = 45 + Math.random() * 175;
    parts.push({
      x,
      y,
      vx: Math.cos(ang) * s,
      vy: Math.sin(ang) * s,
      life: 0.32 + Math.random() * 0.4,
      max: 0.72,
      r: 1.5 + Math.random() * 2.8,
      c,
    });
  }
}

function createGame(): HeliGame {
  const g: HeliGame = {
    heliX: 110,
    heliY: 200,
    vx: 0,
    vy: 0,
    hp: 100,
    bombs: [],
    turrets: [],
    shells: [],
    spikes: [],
    pickups: [],
    parts: [],
    scroll: 0,
    spawnX: 620,
    bombCd: 0,
    score: 0,
    kills: 0,
    shake: 0,
    tailPhase: 0,
    over: false,
    dirty: true,
  };
  return g;
}

/** Populate terrain features ahead of the chopper. */
function feedTerrain(g: HeliGame): void {
  while (g.spawnX < g.scroll + W + 400) {
    const wx = g.spawnX;
    const gy = terrainAt(g, wx);
    const roll = Math.random();
    if (roll < 0.34) {
      g.turrets.push({
        x: wx,
        y: gy,
        hp: 2,
        kind: "turret",
        telegraph: 0,
        cool: 0.8 + Math.random() * 1.4,
        flash: 0,
        worth: 25,
      });
    } else if (roll < 0.5) {
      g.turrets.push({
        x: wx,
        y: gy,
        hp: 4,
        kind: "tank",
        telegraph: 0,
        cool: 1.4 + Math.random() * 1.6,
        flash: 0,
        worth: 50,
      });
    } else if (roll < 0.72) {
      // spike ridge segment
      for (let i = 0; i < 3; i++) {
        const sx = wx + i * 26;
        g.spikes.push({ x: sx, y: terrainAt(g, sx) });
      }
    } else if (roll < 0.84) {
      g.pickups.push({ x: wx, y: gy - 90, kind: "health", t: 0 });
    }
    g.spawnX += 190 + Math.random() * 160;
  }

  // prune behind the camera
  const cutoff = g.scroll - 120;
  g.turrets = g.turrets.filter((t) => t.x > cutoff);
  g.spikes = g.spikes.filter((s) => s.x > cutoff);
  g.pickups = g.pickups.filter((p) => p.x > cutoff);
}

function stepGame(g: HeliGame, dt: number, difficulty: number): void {
  if (g.over) return;

  const speed = 92 + difficulty * 26;
  g.scroll += speed * dt;
  g.tailPhase += dt * 30;
  g.shake = Math.max(0, g.shake - dt * 20);
  g.bombCd = Math.max(0, g.bombCd - dt);

  feedTerrain(g);

  // heli inertia
  g.heliX += g.vx * dt;
  g.heliY += g.vy * dt;
  g.heliX = Math.max(40, Math.min(W * 0.55, g.heliX));
  g.heliY = Math.max(30, Math.min(H - 70, g.heliY));
  g.vx *= 1 - Math.min(1, dt * 4);
  g.vy *= 1 - Math.min(1, dt * 4);

  // bombs fall and drift back with the scroll
  for (let i = g.bombs.length - 1; i >= 0; i--) {
    const b = g.bombs[i];
    b.vy += 520 * dt;
    b.x += (b.vx - speed) * dt;
    b.y += b.vy * dt;
    const worldX = g.scroll + b.x;
    if (b.y >= terrainAt(g, worldX)) {
      // boom — splash anything near the impact
      burst(g.parts, b.x, terrainAt(g, worldX), "#fbbf24", 16);
      burst(g.parts, b.x, terrainAt(g, worldX), "#f97316", 10);
      g.shake = Math.max(g.shake, 5);
      for (const t of g.turrets) {
        const tx = t.x - g.scroll;
        if (Math.abs(tx - b.x) < 42 && Math.abs(t.y - b.y) < 70) {
          t.hp -= 2;
          t.flash = 0.2;
          if (t.hp <= 0) {
            g.score += t.worth;
            g.kills += 1;
            burst(g.parts, tx, t.y, "#fbbf24", 20);
            burst(g.parts, tx, t.y, "#ef4444", 12);
            g.shake = Math.max(g.shake, 9);
          }
        }
      }
      g.turrets = g.turrets.filter((t) => t.hp > 0);
      g.bombs.splice(i, 1);
      g.dirty = true;
      continue;
    }
    if (b.y > H + 20 || b.x < -40) g.bombs.splice(i, 1);
  }

  // ground fire
  for (const t of g.turrets) {
    const tx = t.x - g.scroll;
    t.flash = Math.max(0, t.flash - dt);
    if (tx < -30 || tx > W + 60) continue;

    t.cool -= dt;
    if (t.telegraph > 0) {
      t.telegraph -= dt;
      if (t.telegraph <= 0) {
        // fire! shell leads the heli slightly
        const lead = 0.35;
        const aimX = g.heliX + g.vx * lead;
        const aimY = g.heliY + g.vy * lead;
        const ang = Math.atan2(aimY - t.y, aimX - tx);
        const shellSpeed = 220 + difficulty * 40;
        g.shells.push({
          x: tx,
          y: t.y - 14,
          vx: Math.cos(ang) * shellSpeed,
          vy: Math.sin(ang) * shellSpeed,
        });
        t.cool = Math.max(0.7, (t.kind === "tank" ? 1.6 : 1.9) - difficulty * 0.18);
        t.flash = 0.12;
      }
    } else if (t.cool <= 0) {
      t.telegraph = 0.75; // telegraph before firing
    }
  }

  for (let i = g.shells.length - 1; i >= 0; i--) {
    const s = g.shells[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const dx = s.x - g.heliX;
    const dy = s.y - g.heliY;
    if (dx * dx + dy * dy < 17 * 17) {
      g.shells.splice(i, 1);
      g.hp -= 14;
      g.shake = Math.max(g.shake, 8);
      burst(g.parts, g.heliX, g.heliY, "#ef4444", 18);
      g.dirty = true;
      if (g.hp <= 0) {
        g.hp = 0;
        g.over = true;
        burst(g.parts, g.heliX, g.heliY, "#fbbf24", 30);
        return;
      }
      continue;
    }
    if (s.x < -20 || s.x > W + 20 || s.y > H + 20 || s.y < -20) g.shells.splice(i, 1);
  }

  // ridge spikes + terrain collision
  const heliWorldX = g.scroll + g.heliX;
  for (const s of g.spikes) {
    if (Math.abs(s.x - heliWorldX) > 16) continue;
    if (g.heliY + 16 > s.y - 16) {
      g.hp -= 25;
      g.shake = Math.max(g.shake, 10);
      burst(g.parts, g.heliX, g.heliY, "#ef4444", 20);
      g.heliY = s.y - 60; // knock upward
      g.dirty = true;
      if (g.hp <= 0) {
        g.hp = 0;
        g.over = true;
        return;
      }
    }
  }
  const groundHere = terrainAt(g, heliWorldX);
  if (g.heliY + 18 > groundHere) {
    g.hp -= 30;
    g.shake = Math.max(g.shake, 12);
    burst(g.parts, g.heliX, g.heliY, "#ef4444", 24);
    g.heliY = groundHere - 70;
    g.dirty = true;
    if (g.hp <= 0) {
      g.hp = 0;
      g.over = true;
      return;
    }
  }

  // health pickups
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const p = g.pickups[i];
    p.t += dt;
    const px = p.x - g.scroll;
    if (px < -30) {
      g.pickups.splice(i, 1);
      continue;
    }
    const dx = px - g.heliX;
    const dy = p.y - g.heliY;
    if (dx * dx + dy * dy < 26 * 26) {
      g.hp = Math.min(100, g.hp + 30);
      burst(g.parts, px, p.y, "#34d399", 12);
      g.pickups.splice(i, 1);
      g.dirty = true;
    }
  }

  // particles
  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.parts.splice(i, 1);
      continue;
    }
    p.vy += 300 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  // distance score
  g.score = g.kills * 10 + Math.floor(g.scroll / 40);
  g.dirty = true;
}

export default function HeliAssault() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<HeliGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [dist, setDist] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [kills, setKills] = useState(0);
  const { best, submit } = useBestScore("heli-assault", "high");
  const keys = useRef<Record<string, boolean>>({});
  const dragging = useRef(false);
  const bombTap = useRef(false);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#04202e");
    sky.addColorStop(0.6, "#0b3446");
    sky.addColorStop(1, "#155e6b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // parallax clouds
    ctx.fillStyle = "rgba(165, 243, 252, 0.09)";
    for (let i = 0; i < 6; i++) {
      const x = ((i * 167 - g.scroll * 0.25) % (W + 240)) + (W + 240);
      const cx = (x % (W + 240)) - 120;
      const cy = 60 + i * 46;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 58, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 36, cy - 8, 32, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // distant hills (slower parallax)
    ctx.fillStyle = "rgba(20, 80, 90, 0.7)";
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const wx = g.scroll * 0.4 + x;
      ctx.lineTo(x, GROUND_BASE - 60 + Math.sin(wx * 0.006) * 26 + Math.sin(wx * 0.015) * 12);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    if (g.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    }

    // terrain
    ctx.fillStyle = "#123b2b";
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) {
      ctx.lineTo(x, terrainAt(g, g.scroll + x));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(74, 222, 128, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = terrainAt(g, g.scroll + x);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // spikes
    for (const s of g.spikes) {
      const x = s.x - g.scroll;
      if (x < -30 || x > W + 30) continue;
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.moveTo(x - 9, s.y);
      ctx.lineTo(x, s.y - 18);
      ctx.lineTo(x + 9, s.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.moveTo(x - 3, s.y - 4);
      ctx.lineTo(x, s.y - 15);
      ctx.lineTo(x + 3, s.y - 4);
      ctx.closePath();
      ctx.fill();
    }

    // turrets / tanks
    for (const t of g.turrets) {
      const x = t.x - g.scroll;
      if (x < -40 || x > W + 40) continue;
      const y = t.y;
      ctx.save();
      ctx.translate(x, y);
      if (t.kind === "tank") {
        ctx.fillStyle = t.flash > 0 ? "#fca5a5" : "#4b5563";
        ctx.beginPath();
        ctx.roundRect(-20, -14, 40, 12, 3);
        ctx.fill();
        ctx.fillStyle = t.flash > 0 ? "#fecaca" : "#6b7280";
        ctx.beginPath();
        ctx.roundRect(-10, -24, 20, 11, 4);
        ctx.fill();
        ctx.strokeStyle = "#9ca3af";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(6, -20);
        ctx.lineTo(22, -26);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#374151";
        ctx.beginPath();
        ctx.roundRect(-9, -16, 18, 16, 3);
        ctx.fill();
        ctx.strokeStyle = "#9ca3af";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(4, -26);
        ctx.stroke();
        ctx.fillStyle = "#f87171";
        ctx.beginPath();
        ctx.arc(4, -27, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // telegraph flash
      if (t.telegraph > 0) {
        const pulse = Math.sin(time / 50) > 0 ? 1 : 0.4;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "#fde047";
        ctx.beginPath();
        ctx.arc(t.kind === "tank" ? 20 : 6, t.kind === "tank" ? -26 : -26, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // shells
    for (const s of g.shells) {
      ctx.save();
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // pickups
    for (const p of g.pickups) {
      const x = p.x - g.scroll;
      if (x < -30 || x > W + 30) continue;
      const pulse = 1 + Math.sin(p.t * 5) * 0.12;
      ctx.save();
      ctx.shadowColor = "#34d399";
      ctx.shadowBlur = 14;
      ctx.strokeStyle = "#34d399";
      ctx.fillStyle = "rgba(52, 211, 153, 0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, p.y, 11 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#6ee7b7";
      ctx.fillRect(x - 5, p.y - 1.5, 10, 3);
      ctx.fillRect(x - 1.5, p.y - 5, 3, 10);
      ctx.restore();
    }

    // bombs
    for (const b of g.bombs) {
      ctx.save();
      ctx.fillStyle = "#e5e7eb";
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 4.5, 6.5, Math.atan2(b.vy, b.vx) + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f97316";
      ctx.fillRect(b.x - 1.5, b.y - 9, 3, 3);
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

    // helicopter
    ctx.save();
    ctx.translate(g.heliX, g.heliY);
    const tilt = Math.max(-0.25, Math.min(0.25, g.vy / 400));
    ctx.rotate(tilt);
    // tail boom
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.roundRect(-34, -3, 30, 6, 3);
    ctx.fill();
    ctx.fillStyle = "#0e7490";
    ctx.beginPath();
    ctx.moveTo(-34, -8);
    ctx.lineTo(-26, 0);
    ctx.lineTo(-34, 8);
    ctx.closePath();
    ctx.fill();
    // tail rotor
    ctx.strokeStyle = "#a5f3fc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-30, -9 - Math.sin(g.tailPhase) * 5);
    ctx.lineTo(-30, 9 + Math.sin(g.tailPhase) * 5);
    ctx.stroke();
    // cabin
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#06b6d4";
    ctx.beginPath();
    ctx.ellipse(2, 0, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#083344";
    ctx.beginPath();
    ctx.ellipse(9, -2, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // skids
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 12);
    ctx.lineTo(-8, 17);
    ctx.moveTo(10, 12);
    ctx.lineTo(10, 17);
    ctx.moveTo(-12, 17);
    ctx.lineTo(14, 17);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // main rotor
    ctx.strokeStyle = "rgba(226, 240, 250, 0.65)";
    ctx.lineWidth = 2.5;
    const rotor = Math.sin(g.tailPhase * 2.4) * 26;
    ctx.beginPath();
    ctx.moveTo(-4 - Math.abs(rotor), -18);
    ctx.lineTo(-4 + Math.abs(rotor), -18);
    ctx.stroke();
    ctx.fillStyle = "#0e7490";
    ctx.fillRect(-5, -20, 3, 6);
    ctx.restore();

    ctx.restore();

    // hp bar
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(12, H - 26, 120, 12);
    ctx.fillStyle = g.hp > 50 ? "#34d399" : g.hp > 25 ? "#fbbf24" : "#f87171";
    ctx.fillRect(14, H - 24, 116 * (g.hp / 100), 8);
    ctx.fillStyle = "rgba(226,232,240,0.85)";
    ctx.font = "bold 9px ui-monospace, monospace";
    ctx.fillText("HULL", 12, H - 30);
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
    keys.current = {};
    dragging.current = false;
    bombTap.current = false;
    setScore(0);
    setHp(100);
    setDist(0);
    setKills(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const dropBomb = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.over || g.bombCd > 0) return;
    g.bombCd = 0.45;
    g.bombs.push({
      x: g.heliX + 6,
      y: g.heliY + 18,
      vx: 40,
      vy: 40,
    });
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

      const difficulty = 1 + g.scroll / 2600;

      // keyboard flight
      const lift = 320;
      let kx = 0;
      let ky = 0;
      if (keys.current.ArrowLeft || keys.current.a) kx -= 1;
      if (keys.current.ArrowRight || keys.current.d) kx += 1;
      if (keys.current.ArrowUp || keys.current.w) ky -= 1;
      if (keys.current.ArrowDown || keys.current.s) ky += 1;
      g.vx += kx * lift * 2.2 * dt;
      g.vy += ky * lift * 2.2 * dt;
      if (keys.current[" "]) dropBomb();
      if (bombTap.current) {
        bombTap.current = false;
        dropBomb();
      }

      stepGame(g, dt, difficulty);

      if (g.dirty) {
        g.dirty = false;
        setScore(g.score);
        setHp(Math.ceil(g.hp));
        setDist(Math.floor(g.scroll / 40));
        setKills(g.kills);
      }
      if (g.over) {
        setScore(g.score);
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
  }, [status, submit, draw, dropBomb]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "ArrowLeft" ||
        key === "ArrowRight" ||
        key === " "
      ) {
        e.preventDefault();
      }
      if (key === " ") {
        if (status !== "playing") start();
        return;
      }
      keys.current[key] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys.current[key] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start]);

  const steer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas || !g) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    g.vx = Math.max(-260, Math.min(260, (x - g.heliX) * 7));
    g.vy = Math.max(-260, Math.min(260, (y - g.heliY) * 7));
  };

  return (
    <div className="w-full max-w-[480px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Hull <b className={`ml-1 text-sm ${hp > 50 ? "text-ink" : hp > 25 ? "text-warn" : "text-rose-400"}`}>{hp}</b>
        </span>
        <span>
          Range <b className="ml-1 text-sm text-ink">{dist}m</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-24px_rgba(45,212,191,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          aria-label="Heli Assault flight strip"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") {
              start();
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
            steer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (dragging.current) steer(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        />

        {/* touch bomb button */}
        {status === "playing" && (
          <button
            type="button"
            aria-label="Drop bomb"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              bombTap.current = true;
            }}
            className="absolute bottom-4 right-4 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 font-display text-2xl text-black shadow-lg transition active:scale-90"
          >
            💣
          </button>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">HELI ASSAULT</p>
            <p className="mt-2 text-sm text-muted">
              Hold a low line over hostile ridge. Turrets flash before they shoot — bomb them,
              dodge the spikes, grab the green crates.
            </p>
            <PrimaryButton onClick={start} tone="from-teal-400 to-sky-500">
              Start engine
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Arrows / WASD to fly · Space or 💣 to bomb · drag + bomb button on touch
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">CRASHED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · {dist}m flown · {kills} destroyed
            </p>
            <PrimaryButton onClick={start} tone="from-teal-400 to-sky-500">
              Relaunch
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Yellow muzzle flash = shot incoming · bombs fall behind you, lead the target · spikes
        cost more than bullets
      </p>
    </div>
  );
}
