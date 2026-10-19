"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 440;
const H = 540;
const SHIP_Y = H - 60;

type Status = "idle" | "playing" | "over";

type PowerKind = "spread" | "rapid" | "shield";

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: string;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  hp: number;
  maxHp: number;
  r: number;
  kind: "scout" | "sine" | "elite" | "boss";
  t: number;
  baseX: number;
  fireT: number;
  worth: number;
}

interface Missile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  turn: number;
}

interface Powerup {
  x: number;
  y: number;
  kind: PowerKind;
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

interface JetGame {
  shipX: number;
  shipY: number;
  vx: number;
  vy: number;
  bullets: Bullet[];
  enemies: Enemy[];
  eBullets: Bullet[];
  missiles: Missile[];
  powers: Powerup[];
  parts: Particle[];
  wave: number;
  toSpawn: number;
  spawnT: number;
  fireT: number;
  spreadT: number;
  rapidT: number;
  shield: number;
  lives: number;
  invuln: number;
  score: number;
  shake: number;
  boomT: number;
  over: boolean;
  dirty: boolean;
}

function burst(parts: Particle[], x: number, y: number, c: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 50 + Math.random() * 190;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.3 + Math.random() * 0.4,
      max: 0.7,
      r: 1.5 + Math.random() * 2.8,
      c,
    });
  }
}

function waveQuota(wave: number): number {
  return 6 + wave * 2;
}

function spawnWave(g: JetGame): void {
  const wave = g.wave;
  const isBoss = wave % 5 === 0;
  if (isBoss) {
    g.enemies.push({
      x: W / 2,
      y: -60,
      vx: 0,
      hp: 40 + wave * 8,
      maxHp: 40 + wave * 8,
      r: 38,
      kind: "boss",
      t: 0,
      baseX: W / 2,
      fireT: 1.2,
      worth: 500,
    });
    g.toSpawn = 0;
    return;
  }

  // formation: a line of scouts, some sine-weavers, an elite with missiles
  const count = Math.min(9, 3 + Math.floor(wave / 2));
  for (let i = 0; i < count; i++) {
    const kind: Enemy["kind"] =
      wave >= 3 && i === count - 1 ? "elite" : wave >= 2 && i % 2 === 1 ? "sine" : "scout";
    const x = (W / (count + 1)) * (i + 1);
    g.enemies.push({
      x,
      y: -30 - (i % 3) * 26,
      vx: 0,
      hp: kind === "elite" ? 6 : kind === "sine" ? 3 : 2,
      maxHp: kind === "elite" ? 6 : kind === "sine" ? 3 : 2,
      r: kind === "elite" ? 17 : 13,
      kind,
      t: Math.random() * 6,
      baseX: x,
      fireT: 0.8 + Math.random() * 1.6,
      worth: kind === "elite" ? 60 : kind === "sine" ? 30 : 20,
    });
  }
  g.toSpawn = 0;
}

function createGame(): JetGame {
  return {
    shipX: W / 2,
    shipY: SHIP_Y,
    vx: 0,
    vy: 0,
    bullets: [],
    enemies: [],
    eBullets: [],
    missiles: [],
    powers: [],
    parts: [],
    wave: 1,
    toSpawn: waveQuota(1),
    spawnT: 1.2,
    fireT: 0,
    spreadT: 0,
    rapidT: 0,
    shield: 0,
    lives: 3,
    invuln: 1.2,
    score: 0,
    shake: 0,
    boomT: 0,
    over: false,
    dirty: true,
  };
}

function maybeDropPower(g: JetGame, x: number, y: number): void {
  if (Math.random() > 0.22) return;
  const kinds: PowerKind[] = ["spread", "rapid", "shield"];
  g.powers.push({ x, y, kind: kinds[Math.floor(Math.random() * 3)], t: 0 });
}

function damageShip(g: JetGame, x: number, y: number): void {
  if (g.invuln > 0) return;
  if (g.shield > 0) {
    g.shield = 0;
    g.invuln = 1;
    burst(g.parts, g.shipX, g.shipY, "#67e8f9", 16);
    g.dirty = true;
    return;
  }
  g.lives -= 1;
  g.invuln = 2;
  g.shake = 10;
  burst(g.parts, x, y, "#f87171", 24);
  burst(g.parts, g.shipX, g.shipY, "#fbbf24", 14);
  g.spreadT = 0;
  g.rapidT = 0;
  g.dirty = true;
  if (g.lives <= 0) {
    g.lives = 0;
    g.over = true;
  }
}

function stepGame(g: JetGame, dt: number): void {
  if (g.over) return;

  g.shake = Math.max(0, g.shake - dt * 24);
  g.boomT = Math.max(0, g.boomT - dt);
  g.invuln = Math.max(0, g.invuln - dt);
  g.spreadT = Math.max(0, g.spreadT - dt);
  g.rapidT = Math.max(0, g.rapidT - dt);

  // steer
  g.shipX += g.vx * dt;
  g.shipY += g.vy * dt;
  g.shipX = Math.max(16, Math.min(W - 16, g.shipX));
  g.shipY = Math.max(H * 0.35, Math.min(H - 22, g.shipY));

  // spawn next wave when the field is clear
  if (g.toSpawn > 0 && g.enemies.length === 0) {
    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      spawnWave(g);
      g.score += 25 * g.wave;
      g.dirty = true;
    }
  }
  if (g.enemies.length === 0 && g.toSpawn === 0) {
    g.wave += 1;
    g.toSpawn = waveQuota(g.wave);
    g.spawnT = 1.4;
    g.dirty = true;
    return;
  }

  // player fire
  g.fireT -= dt;
  if (g.fireT <= 0) {
    const rate = g.rapidT > 0 ? 0.08 : 0.16;
    g.fireT = rate;
    const speed = 520;
    if (g.spreadT > 0) {
      for (const off of [-0.18, 0, 0.18]) {
        g.bullets.push({
          x: g.shipX + Math.sin(off) * 10,
          y: g.shipY - 14,
          vx: Math.sin(off) * speed,
          vy: -Math.cos(off) * speed,
          r: 3,
          c: "#67e8f9",
        });
      }
    } else {
      g.bullets.push({
        x: g.shipX - 6,
        y: g.shipY - 12,
        vx: 0,
        vy: -speed,
        r: 3,
        c: "#67e8f9",
      });
      g.bullets.push({
        x: g.shipX + 6,
        y: g.shipY - 12,
        vx: 0,
        vy: -speed,
        r: 3,
        c: "#67e8f9",
      });
    }
  }

  // player bullets
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -12 || b.x < -12 || b.x > W + 12) {
      g.bullets.splice(i, 1);
      continue;
    }
    for (let j = g.enemies.length - 1; j >= 0; j--) {
      const e = g.enemies[j];
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      if (dx * dx + dy * dy > (e.r + b.r) * (e.r + b.r)) continue;
      e.hp -= 1;
      burst(g.parts, b.x, b.y, "#a5f3fc", 3);
      g.bullets.splice(i, 1);
      if (e.hp <= 0) {
        g.score += e.worth * g.wave;
        g.enemies.splice(j, 1);
        burst(g.parts, e.x, e.y, "#fbbf24", e.kind === "boss" ? 40 : 14);
        burst(g.parts, e.x, e.y, "#f87171", e.kind === "boss" ? 26 : 8);
        g.shake = Math.max(g.shake, e.kind === "boss" ? 12 : 4);
        g.boomT = e.kind === "boss" ? 0.3 : 0;
        maybeDropPower(g, e.x, e.y);
        g.dirty = true;
      }
      break;
    }
  }

  // enemies
  const speedScale = 1 + (g.wave - 1) * 0.08;
  for (const e of g.enemies) {
    e.t += dt;
    if (e.kind === "boss") {
      e.y = Math.min(90, e.y + 60 * dt);
      e.x = e.baseX + Math.sin(e.t * 0.9) * 130;
    } else {
      e.y += (e.kind === "sine" ? 90 : 70) * speedScale * dt;
      if (e.kind === "sine") e.x = e.baseX + Math.sin(e.t * 2.6) * 46;
      if (e.kind === "elite") e.x = e.baseX + Math.sin(e.t * 1.4) * 70;
    }

    // fire at the player
    e.fireT -= dt;
    if (e.fireT <= 0 && e.y > 0 && e.y < g.shipY - 40) {
      if (e.kind === "boss") {
        e.fireT = Math.max(0.4, 1.1 - g.wave * 0.03);
        // radial pattern
        const n = 8 + Math.min(6, Math.floor(g.wave / 2));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + e.t;
          g.eBullets.push({
            x: e.x,
            y: e.y + 12,
            vx: Math.cos(a) * 150,
            vy: Math.sin(a) * 150,
            r: 4.5,
            c: "#f472b6",
          });
        }
      } else if (e.kind === "elite") {
        e.fireT = 1.4;
        // homing missile
        const ang = Math.atan2(g.shipY - e.y, g.shipX - e.x);
        g.missiles.push({
          x: e.x,
          y: e.y + 10,
          vx: Math.cos(ang) * 130,
          vy: Math.sin(ang) * 130,
          life: 5,
          turn: 0,
        });
      } else if (e.kind === "scout" && g.wave >= 2) {
        e.fireT = 2 + Math.random();
        const ang = Math.atan2(g.shipY - e.y, g.shipX - e.x);
        g.eBullets.push({
          x: e.x,
          y: e.y + 8,
          vx: Math.cos(ang) * 190,
          vy: Math.sin(ang) * 190,
          r: 3.5,
          c: "#f9a8d4",
        });
      } else {
        e.fireT = 2.4;
      }
    }

    // ram the ship
    const dx = e.x - g.shipX;
    const dy = e.y - g.shipY;
    if (dx * dx + dy * dy < (e.r + 11) * (e.r + 11)) {
      damageShip(g, g.shipX, g.shipY);
      if (e.kind !== "boss") {
        burst(g.parts, e.x, e.y, "#f87171", 10);
        e.hp = 0;
      }
    }

    if (e.y > H + 50) {
      e.hp = 0;
    }
  }
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    if (g.enemies[i].hp <= 0) g.enemies.splice(i, 1);
  }

  // enemy bullets
  for (let i = g.eBullets.length - 1; i >= 0; i--) {
    const b = g.eBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > H + 12 || b.y < -12 || b.x < -12 || b.x > W + 12) {
      g.eBullets.splice(i, 1);
      continue;
    }
    const dx = b.x - g.shipX;
    const dy = b.y - g.shipY;
    if (dx * dx + dy * dy < (b.r + 9) * (b.r + 9)) {
      g.eBullets.splice(i, 1);
      damageShip(g, b.x, b.y);
    }
  }

  // homing missiles
  for (let i = g.missiles.length - 1; i >= 0; i--) {
    const m = g.missiles[i];
    m.life -= dt;
    m.turn += dt;
    const want = Math.atan2(g.shipY - m.y, g.shipX - m.x);
    const cur = Math.atan2(m.vy, m.vx);
    let diff = want - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnRate = m.turn < 0.6 ? 0.4 : 2.4; // brief launch delay, then bites
    const next = cur + Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    const speed = 200;
    m.vx = Math.cos(next) * speed;
    m.vy = Math.sin(next) * speed;
    m.x += m.vx * dt;
    m.y += m.vy * dt;

    if (Math.random() < 0.6) {
      g.parts.push({
        x: m.x,
        y: m.y,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        life: 0.3,
        max: 0.3,
        r: 2,
        c: "#9ca3af",
      });
    }

    const dx = m.x - g.shipX;
    const dy = m.y - g.shipY;
    if (dx * dx + dy * dy < 14 * 14) {
      g.missiles.splice(i, 1);
      damageShip(g, m.x, m.y);
      continue;
    }
    if (m.life <= 0 || m.x < -20 || m.x > W + 20 || m.y < -20 || m.y > H + 20) {
      g.missiles.splice(i, 1);
    }
  }

  // powerups
  for (let i = g.powers.length - 1; i >= 0; i--) {
    const p = g.powers[i];
    p.t += dt;
    p.y += 80 * dt;
    if (p.y > H + 20) {
      g.powers.splice(i, 1);
      continue;
    }
    const dx = p.x - g.shipX;
    const dy = p.y - g.shipY;
    if (dx * dx + dy * dy < 22 * 22) {
      if (p.kind === "spread") g.spreadT = 9;
      else if (p.kind === "rapid") g.rapidT = 9;
      else g.shield = 1;
      burst(g.parts, p.x, p.y, "#a7f3d0", 12);
      g.powers.splice(i, 1);
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
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - dt * 1.6;
    p.vy *= 1 - dt * 1.6;
  }
}

export default function JetStrike() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<JetGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [powerLabel, setPowerLabel] = useState("—");
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("jet-strike", "high");
  const keys = useRef<Record<string, boolean>>({});
  const dragging = useRef(false);

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    // deep space
    ctx.fillStyle = "#06060f";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 46; i++) {
      const x = (i * 89) % W;
      const y = ((i * 53 + time / (i % 3 === 0 ? 26 : 52)) % H);
      ctx.fillStyle = i % 7 === 0 ? "rgba(103,232,249,0.7)" : "rgba(226,232,240,0.45)";
      ctx.fillRect(x, y, 1.6, 1.6);
    }

    ctx.save();
    if (g.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    }

    // powerups
    for (const p of g.powers) {
      const pulse = 1 + Math.sin(p.t * 6) * 0.12;
      const c = p.kind === "spread" ? "#a78bfa" : p.kind === "rapid" ? "#fbbf24" : "#34d399";
      ctx.save();
      ctx.shadowColor = c;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = c;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 11 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.font = "bold 11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(p.kind === "spread" ? "S" : p.kind === "rapid" ? "R" : "◈", p.x, p.y + 4);
      ctx.textAlign = "start";
      ctx.restore();
    }

    // enemies
    for (const e of g.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === "boss") {
        ctx.shadowColor = "#f472b6";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "#be185d";
        ctx.beginPath();
        ctx.moveTo(0, 26);
        ctx.lineTo(-e.r, -14);
        ctx.lineTo(-e.r * 0.5, -24);
        ctx.lineTo(e.r * 0.5, -24);
        ctx.lineTo(e.r, -14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fbcfe8";
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#be185d";
        ctx.beginPath();
        ctx.arc(0, 0, 4 + Math.sin(time / 120) * 1.5, 0, Math.PI * 2);
        ctx.fill();
        // boss hp bar
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(-e.r, -e.r - 12, e.r * 2, 5);
        ctx.fillStyle = "#f472b6";
        ctx.fillRect(-e.r, -e.r - 12, (e.r * 2 * e.hp) / e.maxHp, 5);
      } else if (e.kind === "elite") {
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#0e7490";
        ctx.beginPath();
        ctx.moveTo(0, e.r);
        ctx.lineTo(-e.r, -e.r * 0.5);
        ctx.lineTo(0, -e.r * 0.2);
        ctx.lineTo(e.r, -e.r * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#67e8f9";
        ctx.fillRect(-2, -e.r * 0.6, 4, e.r * 0.7);
      } else {
        ctx.shadowColor = e.kind === "sine" ? "#c084fc" : "#f87171";
        ctx.shadowBlur = 10;
        ctx.fillStyle = e.kind === "sine" ? "#9333ea" : "#dc2626";
        ctx.beginPath();
        ctx.moveTo(0, e.r);
        ctx.lineTo(-e.r, -e.r * 0.6);
        ctx.lineTo(e.r, -e.r * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // enemy bullets
    ctx.fillStyle = "#f9a8d4";
    for (const b of g.eBullets) {
      ctx.save();
      ctx.shadowColor = "#f472b6";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // missiles
    for (const m of g.missiles) {
      const a = Math.atan2(m.vy, m.vx);
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(a);
      ctx.fillStyle = "#e5e7eb";
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-6, -3.5);
      ctx.lineTo(-6, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // player bullets
    ctx.save();
    ctx.shadowColor = "#67e8f9";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#a5f3fc";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (const b of g.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + 7);
      ctx.lineTo(b.x, b.y - 7);
      ctx.stroke();
    }
    ctx.restore();

    // particles
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ship
    const blink = g.invuln > 0 && Math.floor(time / 110) % 2 === 0;
    if (!blink) {
      ctx.save();
      ctx.translate(g.shipX, g.shipY);
      if (g.shield > 0) {
        ctx.strokeStyle = `rgba(52, 211, 153, ${0.5 + Math.sin(time / 90) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, Math.PI * 2);
        ctx.stroke();
      }
      // engine flame
      ctx.fillStyle = `rgba(251, 191, 36, ${0.6 + Math.random() * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(-5, 12);
      ctx.lineTo(0, 22 + Math.random() * 6);
      ctx.lineTo(5, 12);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = "#67e8f9";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#67e8f9";
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(-12, 10);
      ctx.lineTo(-4, 7);
      ctx.lineTo(0, 12);
      ctx.lineTo(4, 7);
      ctx.lineTo(12, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0e7490";
      ctx.beginPath();
      ctx.ellipse(0, -2, 3.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // wave banner
    if (g.spawnT > 0.4 && g.enemies.length === 0 && status === "playing") {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 26px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        g.wave % 5 === 0 ? `WAVE ${g.wave} — INCOMING HEAVY` : `WAVE ${g.wave}`,
        W / 2,
        H / 2 - 40,
      );
      ctx.textAlign = "start";
    }

    // power timers
    ctx.font = "bold 11px ui-monospace, monospace";
    if (g.spreadT > 0) {
      ctx.fillStyle = "#a78bfa";
      ctx.fillText(`SPREAD ${g.spreadT.toFixed(0)}s`, 12, H - 28);
    }
    if (g.rapidT > 0) {
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`RAPID ${g.rapidT.toFixed(0)}s`, 12, H - 14);
    }
  }, [status]);

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
    setScore(0);
    setLives(3);
    setWave(1);
    setPowerLabel("—");
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastWave = 1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      // keyboard steer
      const speed = 300;
      let kx = 0;
      let ky = 0;
      if (keys.current.ArrowLeft || keys.current.a) kx -= 1;
      if (keys.current.ArrowRight || keys.current.d) kx += 1;
      if (keys.current.ArrowUp || keys.current.w) ky -= 1;
      if (keys.current.ArrowDown || keys.current.s) ky += 1;
      if (kx || ky) {
        const d = Math.hypot(kx, ky);
        g.vx = (kx / d) * speed;
        g.vy = (ky / d) * speed;
      } else {
        g.vx *= 1 - Math.min(1, dt * 12);
        g.vy *= 1 - Math.min(1, dt * 12);
      }

      stepGame(g, dt);

      if (g.dirty) {
        g.dirty = false;
        setScore(g.score);
        setLives(g.lives);
        setPowerLabel(
          [
            g.spreadT > 0 ? `SPREAD ${g.spreadT.toFixed(0)}s` : "",
            g.rapidT > 0 ? `RAPID ${g.rapidT.toFixed(0)}s` : "",
            g.shield > 0 ? "SHIELD" : "",
          ]
            .filter(Boolean)
            .join(" · ") || "—",
        );
      }
      if (g.wave !== lastWave) {
        lastWave = g.wave;
        setWave(g.wave);
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
  }, [status, submit, draw]);

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
    // eased chase so touch feels smooth
    g.vx = Math.max(-360, Math.min(360, (x - g.shipX) * 9));
    g.vy = Math.max(-360, Math.min(360, (y - g.shipY) * 9));
  };

  return (
    <div className="w-full max-w-[460px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Wave <b className="ml-1 text-sm text-ink">{wave}</b>
        </span>
        <span>
          Lives{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${lives} lives`}>
            {"🚀".repeat(Math.max(0, lives)) || "—"}
          </b>
        </span>
        <span>
          Pow <b className="ml-1 text-sm text-ink">{powerLabel}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-24px_rgba(99,102,241,0.85)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          aria-label="Jet Strike playfield"
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

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">JET STRIKE</p>
            <p className="mt-2 text-sm text-muted">
              Wave after wave of drones, weavers, and missile elites. Grab S / R / shield drops —
              a heavy boss lands every fifth wave.
            </p>
            <PrimaryButton onClick={start} tone="from-blue-400 to-violet-500">
              Launch
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Arrows / WASD to fly · guns are always hot · drag on touch
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">EJECTED</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · shot down over wave {wave}
            </p>
            <PrimaryButton onClick={start} tone="from-blue-400 to-violet-500">
              Fly again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Guns fire automatically · purple S = spread, gold R = rapid, green ◈ = shield · watch for
        missile trails
      </p>
    </div>
  );
}
