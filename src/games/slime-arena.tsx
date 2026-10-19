"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 520;
const H = 520;
const TAU = Math.PI * 2;
const ROUND_TIME = 90;
const KILLS_TO_WIN = 12;
const BOTS = 5;
const PELLET_SPEED = 430;
const PELLET_DMG = 25;
const FIRE_CD = 0.34;
const RAPID_CD = 0.13;

type Status = "idle" | "playing" | "over";
type Phase = "countdown" | "live" | "end";

const BOT_COLORS = ["#f472b6", "#60a5fa", "#fbbf24", "#a78bfa", "#fb7185"];

interface Slime {
  id: number;
  player: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aim: number;
  hp: number;
  maxHp: number;
  r: number;
  kills: number;
  alive: boolean;
  respawn: number;
  fireCd: number;
  rapid: number;
  boost: number;
  flash: number;
  color: string;
  // ai
  skill: number;
  maxSpeed: number;
  targetId: number;
  strafe: number;
  strafeT: number;
}
interface Pellet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: number;
  life: number;
}
interface Pickup {
  x: number;
  y: number;
  kind: "rapid" | "health";
  t: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
}

interface Game {
  slimes: Slime[];
  pellets: Pellet[];
  pickups: Pickup[];
  particles: Particle[];
  floaters: Floater[];
  round: number;
  total: number; // player kills across the run
  timer: number;
  phase: Phase;
  phaseT: number;
  banner: string;
  bannerT: number;
  pickupT: number;
  clock: number;
  shake: number;
  roundWon: boolean;
  aimPos: { x: number; y: number };
  input: { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean };
  over: boolean;
}

/* ------------------------------ helpers ------------------------------ */

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
}

function burst(g: Game, x: number, y: number, color: string, n: number, power: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = power * (0.35 + Math.random() * 0.65);
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.4,
      max: 0.75,
      color,
      size: 1.6 + Math.random() * 2.4,
    });
  }
}

function floater(g: Game, x: number, y: number, text: string, color: string): void {
  g.floaters.push({ x, y, text, t: 1, color });
}

function makeSlime(
  id: number,
  player: boolean,
  x: number,
  y: number,
  color: string,
  skill: number,
  maxSpeed: number,
): Slime {
  return {
    id,
    player,
    x,
    y,
    vx: 0,
    vy: 0,
    aim: -Math.PI / 2,
    hp: 100,
    maxHp: 100,
    r: player ? 15 : 14,
    kills: 0,
    alive: true,
    respawn: 0,
    fireCd: 0,
    rapid: 0,
    boost: 0,
    flash: 0,
    color,
    skill,
    maxSpeed,
    targetId: -1,
    strafe: Math.random() < 0.5 ? 1 : -1,
    strafeT: 1 + Math.random(),
  };
}

function resetRound(g: Game, round: number): void {
  g.round = round;
  g.timer = ROUND_TIME;
  g.pellets = [];
  g.pickups = [];
  g.pickupT = 4 + Math.random() * 4;
  g.phase = "countdown";
  g.phaseT = 1.8;
  g.banner = `ROUND ${round}`;
  g.bannerT = 1.8;

  const skill = Math.min(0.1 + round * 0.1, 0.85);
  const botSpeed = Math.min(232, 172 + round * 7);
  const tough = 100 + (round - 1) * 6;

  g.slimes = [
    makeSlime(0, true, W / 2, H * 0.74, "#a3e635", 1, 196),
  ];
  g.slimes[0].maxHp = tough;
  g.slimes[0].hp = tough;
  for (let i = 0; i < BOTS; i++) {
    const a = (i / BOTS) * TAU - Math.PI / 2;
    const s = makeSlime(
      i + 1,
      false,
      W / 2 + Math.cos(a) * 170,
      H / 2 + Math.sin(a) * 170,
      BOT_COLORS[i % BOT_COLORS.length],
      skill,
      botSpeed,
    );
    s.maxHp = tough;
    s.hp = tough;
    g.slimes.push(s);
  }
}

function createGame(): Game {
  const g: Game = {
    slimes: [],
    pellets: [],
    pickups: [],
    particles: [],
    floaters: [],
    round: 1,
    total: 0,
    timer: ROUND_TIME,
    phase: "countdown",
    phaseT: 0,
    banner: "",
    bannerT: 0,
    pickupT: 5,
    clock: 0,
    shake: 0,
    roundWon: false,
    aimPos: { x: W / 2, y: H / 2 },
    input: { up: false, down: false, left: false, right: false, fire: false },
    over: false,
  };
  resetRound(g, 1);
  return g;
}

function nearestEnemy(g: Game, s: Slime): Slime | null {
  let best: Slime | null = null;
  let bestD = Infinity;
  for (const o of g.slimes) {
    if (o.id === s.id || !o.alive) continue;
    const dx = o.x - s.x;
    const dy = o.y - s.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function firePellet(g: Game, s: Slime): void {
  const spread = s.player ? 0.03 : (1 - s.skill) * 0.16;
  const a = s.aim + (Math.random() - 0.5) * spread;
  const nose = s.r + 6;
  g.pellets.push({
    x: s.x + Math.cos(s.aim) * nose,
    y: s.y + Math.sin(s.aim) * nose,
    vx: Math.cos(a) * PELLET_SPEED,
    vy: Math.sin(a) * PELLET_SPEED,
    owner: s.id,
    life: 1.15,
  });
  s.fireCd = s.rapid > 0 ? RAPID_CD : FIRE_CD;
}

function respawnSpot(): { x: number; y: number } {
  return { x: 60 + Math.random() * (W - 120), y: 60 + Math.random() * (H - 120) };
}

function moveSlime(s: Slime, dt: number, ax: number, ay: number): void {
  s.vx += ax * dt;
  s.vy += ay * dt;
  const fr = Math.exp(-6 * dt);
  s.vx *= fr;
  s.vy *= fr;
  const sp = Math.hypot(s.vx, s.vy);
  const max = s.maxSpeed * (s.boost > 0 ? 1.3 : 1) * (1 - (s.r - 14) * 0.006);
  if (sp > max) {
    s.vx = (s.vx / sp) * max;
    s.vy = (s.vy / sp) * max;
  }
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  const m = s.r + 6;
  if (s.x < m) {
    s.x = m;
    s.vx = Math.abs(s.vx) * 0.4;
  }
  if (s.x > W - m) {
    s.x = W - m;
    s.vx = -Math.abs(s.vx) * 0.4;
  }
  if (s.y < m) {
    s.y = m;
    s.vy = Math.abs(s.vy) * 0.4;
  }
  if (s.y > H - m) {
    s.y = H - m;
    s.vy = -Math.abs(s.vy) * 0.4;
  }
}

function step(g: Game, dt: number): void {
  g.clock += dt;
  g.shake = Math.max(0, g.shake - dt * 26);
  if (g.bannerT > 0) g.bannerT = Math.max(0, g.bannerT - dt);

  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2 * dt);
    p.vy *= Math.exp(-2 * dt);
    if (p.life <= 0) g.particles.splice(i, 1);
  }
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.t -= dt * 1.4;
    f.y -= 34 * dt;
    if (f.t <= 0) g.floaters.splice(i, 1);
  }

  if (g.phase === "countdown") {
    g.phaseT -= dt;
    if (g.phaseT <= 0) {
      g.phase = "live";
      g.bannerT = 0;
    }
    return;
  }

  if (g.phase === "end") {
    g.phaseT -= dt;
    if (g.phaseT <= 0) {
      if (g.roundWon) {
        resetRound(g, g.round + 1);
      } else {
        g.over = true;
      }
    }
    return;
  }

  // -------- live round --------
  g.timer = Math.max(0, g.timer - dt);

  for (const s of g.slimes) {
    s.fireCd = Math.max(0, s.fireCd - dt);
    s.rapid = Math.max(0, s.rapid - dt);
    s.boost = Math.max(0, s.boost - dt);
    s.flash = Math.max(0, s.flash - dt);

    if (!s.alive) {
      s.respawn -= dt;
      if (s.respawn <= 0) {
        const p = respawnSpot();
        s.x = p.x;
        s.y = p.y;
        s.vx = 0;
        s.vy = 0;
        s.hp = s.maxHp;
        s.alive = true;
        burst(g, s.x, s.y, s.color, 14, 140);
      }
      continue;
    }

    if (s.player) {
      let ax = 0;
      let ay = 0;
      if (g.input.left) ax -= 1;
      if (g.input.right) ax += 1;
      if (g.input.up) ay -= 1;
      if (g.input.down) ay += 1;
      const n = Math.hypot(ax, ay) || 1;
      moveSlime(s, dt, (ax / n) * 1500, (ay / n) * 1500);
      s.aim = Math.atan2(g.aimPos.y - s.y, g.aimPos.x - s.x);
      if (g.input.fire && s.fireCd <= 0) firePellet(g, s);
      continue;
    }

    // bot brain
    s.strafeT -= dt;
    if (s.strafeT <= 0) {
      s.strafe = -s.strafe;
      s.strafeT = 0.8 + Math.random() * 1.2;
    }
    const target = s.targetId >= 0 ? g.slimes.find((o) => o.id === s.targetId && o.alive) : null;
    const foe = target ?? nearestEnemy(g, s);
    if (!foe) continue;
    s.targetId = foe.id;

    const dx = foe.x - s.x;
    const dy = foe.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    let ax = 0;
    let ay = 0;
    if (d > 250) {
      ax = (dx / d) * 1200;
      ay = (dy / d) * 1200;
    } else if (d < 130) {
      ax = (-dx / d) * 1100;
      ay = (-dy / d) * 1100;
    } else {
      ax = (-dy / d) * 1000 * s.strafe;
      ay = (dx / d) * 1000 * s.strafe;
    }
    // wall repulsion
    const edge = 60;
    if (s.x < edge) ax += (edge - s.x) * 14;
    if (s.x > W - edge) ax -= (s.x - (W - edge)) * 14;
    if (s.y < edge) ay += (edge - s.y) * 14;
    if (s.y > H - edge) ay -= (s.y - (H - edge)) * 14;
    moveSlime(s, dt, ax, ay);

    const lead = d / PELLET_SPEED;
    const px = foe.x + foe.vx * lead;
    const py = foe.y + foe.vy * lead;
    const want = Math.atan2(py - s.y, px - s.x);
    let diff = want - s.aim;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    s.aim += diff * Math.min(1, dt * (5 + s.skill * 9));
    if (s.fireCd <= 0 && d < 430 && Math.abs(diff) < 0.34) firePellet(g, s);
  }

  // pellets
  for (let i = g.pellets.length - 1; i >= 0; i--) {
    const p = g.pellets[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0 || p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) {
      g.pellets.splice(i, 1);
      continue;
    }
    let consumed = false;
    for (const s of g.slimes) {
      if (!s.alive || s.id === p.owner) continue;
      const rr = s.r + 4;
      if ((s.x - p.x) * (s.x - p.x) + (s.y - p.y) * (s.y - p.y) < rr * rr) {
        consumed = true;
        s.hp -= PELLET_DMG;
        s.flash = 0.14;
        burst(g, p.x, p.y, "#86efac", 5, 110);
        if (s.hp <= 0) {
          s.alive = false;
          s.respawn = 1.6;
          burst(g, s.x, s.y, s.color, 26, 210);
          const killer = g.slimes.find((o) => o.id === p.owner);
          if (killer) {
            killer.kills += 1;
            killer.r = Math.min(30, killer.r + 1);
            killer.boost = 0.5;
            killer.hp = Math.min(killer.maxHp, killer.hp + 10);
            floater(g, s.x, s.y, "+1", killer.color);
            if (killer.player) {
              g.total += 1;
              g.shake = Math.max(g.shake, 5);
            } else if (s.player) {
              g.shake = Math.max(g.shake, 12);
              floater(g, s.x, s.y, "SPLATTED", "#fb7185");
            }
          }
        }
        break;
      }
    }
    if (consumed) g.pellets.splice(i, 1);
  }

  // pickups
  g.pickupT -= dt;
  if (g.pickupT <= 0 && g.pickups.length < 2) {
    g.pickupT = 6 + Math.random() * 5;
    g.pickups.push({
      x: W / 2 + (Math.random() - 0.5) * 150,
      y: H / 2 + (Math.random() - 0.5) * 150,
      kind: Math.random() < 0.5 ? "rapid" : "health",
      t: 0,
    });
  }
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const pk = g.pickups[i];
    pk.t += dt;
    let taken = false;
    for (const s of g.slimes) {
      if (!s.alive) continue;
      const rr = s.r + 12;
      if ((s.x - pk.x) * (s.x - pk.x) + (s.y - pk.y) * (s.y - pk.y) < rr * rr) {
        taken = true;
        if (pk.kind === "rapid") {
          s.rapid = 6;
          burst(g, pk.x, pk.y, "#fbbf24", 14, 160);
          if (s.player) floater(g, pk.x, pk.y, "RAPID FIRE!", "#fbbf24");
        } else {
          s.hp = Math.min(s.maxHp, s.hp + 45);
          burst(g, pk.x, pk.y, "#34d399", 14, 160);
          if (s.player) floater(g, pk.x, pk.y, "+45 HP", "#34d399");
        }
        break;
      }
    }
    if (taken) g.pickups.splice(i, 1);
  }

  // round end conditions
  let winner: Slime | null = null;
  for (const s of g.slimes) {
    if (s.kills >= KILLS_TO_WIN) {
      winner = s;
      break;
    }
  }
  if (!winner && g.timer <= 0) {
    let top = -1;
    for (const s of g.slimes) {
      if (s.player && s.kills >= top) {
        winner = s; // ties favour the player
        top = s.kills;
      } else if (s.kills > top) {
        winner = s;
        top = s.kills;
      }
    }
  }
  if (winner) {
    g.roundWon = winner.player;
    g.phase = "end";
    g.phaseT = 2.3;
    g.banner = winner.player ? "ROUND WON" : "ROUND LOST";
    g.bannerT = 2.3;
  }
}

/* ------------------------------ render ------------------------------ */

function render(canvas: HTMLCanvasElement, g: Game | null, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  if (g && g.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.72);
  bg.addColorStop(0, "#0e1a12");
  bg.addColorStop(1, "#080d0a");
  ctx.fillStyle = bg;
  ctx.fillRect(-12, -12, W + 24, H + 24);

  ctx.fillStyle = "rgba(163, 230, 53, 0.08)";
  for (let x = 26; x < W; x += 26) {
    for (let y = 26; y < H; y += 26) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, TAU);
      ctx.fill();
    }
  }

  if (g) {
    // arena border
    ctx.save();
    ctx.strokeStyle = "rgba(163, 230, 53, 0.4)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#a3e635";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.roundRect(4, 4, W - 8, H - 8, 22);
    ctx.stroke();
    ctx.restore();

    // pickups
    for (const pk of g.pickups) {
      const pulse = 1 + Math.sin(pk.t * 5) * 0.12;
      const color = pk.kind === "rapid" ? "#fbbf24" : "#34d399";
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, 12 * pulse, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = hexA(color, 0.25);
      ctx.fill();
      ctx.fillStyle = color;
      if (pk.kind === "rapid") {
        ctx.beginPath();
        ctx.moveTo(pk.x + 2, pk.y - 7);
        ctx.lineTo(pk.x - 4, pk.y + 1);
        ctx.lineTo(pk.x, pk.y + 1);
        ctx.lineTo(pk.x - 2, pk.y + 7);
        ctx.lineTo(pk.x + 4, pk.y - 1);
        ctx.lineTo(pk.x, pk.y - 1);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(pk.x - 1.6, pk.y - 5.5, 3.2, 11);
        ctx.fillRect(pk.x - 5.5, pk.y - 1.6, 11, 3.2);
      }
      ctx.restore();
    }

    // pellets
    for (const p of g.pellets) {
      ctx.save();
      ctx.shadowColor = "#bbf7d0";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#d9f99d";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // slimes
    for (const s of g.slimes) {
      if (!s.alive) continue;
      const wob = 1 + Math.sin(time / 130 + s.id * 1.7) * 0.05;
      const r = s.r * wob;

      ctx.save();
      ctx.shadowColor = s.color;
      ctx.shadowBlur = s.player ? 22 : 14;
      ctx.fillStyle = s.flash > 0 ? "#ffffff" : s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, TAU);
      ctx.fill();
      ctx.restore();

      // squish highlight
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(s.x - r * 0.3, s.y - r * 0.34, r * 0.3, r * 0.2, -0.6, 0, TAU);
      ctx.fill();

      // aim eyes
      const ex = Math.cos(s.aim);
      const ey = Math.sin(s.aim);
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.arc(s.x + ex * r * 0.35 - ey * r * 0.28, s.y + ey * r * 0.35 + ex * r * 0.28, r * 0.16, 0, TAU);
      ctx.arc(s.x + ex * r * 0.35 + ey * r * 0.28, s.y + ey * r * 0.35 - ex * r * 0.28, r * 0.16, 0, TAU);
      ctx.fill();

      // player ring
      if (s.player) {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r + 4, 0, TAU);
        ctx.stroke();
      }

      // hp bar
      const w = Math.max(26, s.r * 2.2);
      const hpf = Math.max(0, s.hp / s.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(s.x - w / 2, s.y - r - 12, w, 4);
      ctx.fillStyle = hpf > 0.35 ? "#34d399" : "#fb7185";
      ctx.fillRect(s.x - w / 2, s.y - r - 12, w * hpf, 4);

      // rapid aura
      if (s.rapid > 0) {
        ctx.strokeStyle = "rgba(251, 191, 36, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r + 9, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // particles
    for (const p of g.particles) {
      ctx.fillStyle = hexA(p.color, Math.max(0, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }

    // floaters
    ctx.textAlign = "center";
    for (const f of g.floaters) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.t));
      ctx.font = "800 15px ui-monospace, monospace";
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // round clock
    const secs = Math.ceil(g.timer);
    ctx.textAlign = "center";
    ctx.fillStyle = secs <= 10 ? "#fb7185" : "rgba(226, 232, 240, 0.8)";
    ctx.font = "700 15px ui-monospace, monospace";
    ctx.fillText(`ROUND ${g.round} · ${secs}s`, W / 2, 26);

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, g.bannerT * 1.8);
      ctx.font = "800 34px ui-sans-serif, system-ui, sans-serif";
      ctx.shadowColor = "rgba(163, 230, 53, 0.8)";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g.banner, W / 2, H / 2 - 60);
      ctx.restore();
    }
  }

  ctx.restore();
}

/* ------------------------------ component ------------------------------ */

export default function SlimeArena() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [leader, setLeader] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("slime-arena", "high");

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (canvas) render(canvas, gameRef.current, time);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!gameRef.current) gameRef.current = createGame();
    draw(performance.now());
  }, [draw]);

  const start = useCallback(() => {
    gameRef.current = createGame();
    keysRef.current = { up: false, down: false, left: false, right: false };
    setScore(0);
    setRound(1);
    setLeader(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let lastScore = -1;
    let lastRound = -1;
    let lastLeader = -1;

    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const g = gameRef.current;
      if (!g) return;

      // mirror held keys into the game input
      g.input.up = keysRef.current.up;
      g.input.down = keysRef.current.down;
      g.input.left = keysRef.current.left;
      g.input.right = keysRef.current.right;

      step(g, dt);

      let top = 0;
      for (const s of g.slimes) if (!s.player && s.kills > top) top = s.kills;

      if (g.total !== lastScore) {
        lastScore = g.total;
        setScore(g.total);
      }
      if (g.round !== lastRound) {
        lastRound = g.round;
        setRound(g.round);
      }
      if (top !== lastLeader) {
        lastLeader = top;
        setLeader(top);
      }

      draw(t);
      if (g.over) {
        setNewBest(submit(g.total));
        setStatus("over");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, submit]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ------------------------------ input ------------------------------ */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === "ArrowUp" || k === "w") {
        e.preventDefault();
        keysRef.current.up = true;
      } else if (k === "ArrowDown" || k === "s") {
        e.preventDefault();
        keysRef.current.down = true;
      } else if (k === "ArrowLeft" || k === "a") {
        e.preventDefault();
        keysRef.current.left = true;
      } else if (k === "ArrowRight" || k === "d") {
        e.preventDefault();
        keysRef.current.right = true;
      } else if (k === "Enter" && status !== "playing") {
        e.preventDefault();
        start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === "ArrowUp" || k === "w") keysRef.current.up = false;
      if (k === "ArrowDown" || k === "s") keysRef.current.down = false;
      if (k === "ArrowLeft" || k === "a") keysRef.current.left = false;
      if (k === "ArrowRight" || k === "d") keysRef.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start]);

  const toPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  /* ------------------------------ view ------------------------------ */

  return (
    <div className="w-full max-w-[560px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Round <b className="ml-1 text-sm text-ink">{round}</b>
        </span>
        <span className="text-rose-400">
          Leader{" "}
          <b className="ml-1 text-sm text-ink">
            {leader}/{KILLS_TO_WIN}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(163,230,53,0.85)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full cursor-crosshair touch-none"
          aria-label="Slime arena battlefield"
          onPointerDown={(e) => {
            if (status !== "playing") {
              start();
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            const g = gameRef.current;
            if (!g) return;
            g.aimPos = toPos(e);
            g.input.fire = true;
          }}
          onPointerMove={(e) => {
            const g = gameRef.current;
            if (g && status === "playing") g.aimPos = toPos(e);
          }}
          onPointerUp={() => {
            const g = gameRef.current;
            if (g) g.input.fire = false;
          }}
          onPointerCancel={() => {
            const g = gameRef.current;
            if (g) g.input.fire = false;
          }}
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">SLIME ARENA</p>
            <p className="mt-2 text-sm text-muted">
              Five slimes want the throne. Goo them before they goo you — first
              to 12 kills takes the round.
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-lime-400 via-emerald-500 to-teal-600"
            >
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              WASD / arrows to move · aim with the mouse · click to fire · grab
              the center pickups
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">
              OUT-SLIMED
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Kills · Best {best ?? "—"} · reached round {round}
            </p>
            <PrimaryButton
              onClick={start}
              tone="from-lime-400 via-emerald-500 to-teal-600"
            >
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Each round the bots aim sharper · rapid-fire and health drop in the
        center · win a round, fight meaner bots next
      </p>
    </div>
  );
}
