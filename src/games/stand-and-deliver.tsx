"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 560;
const PAD = 26;
const PLAYER_R = 13;
const BASE_CHARGE = 0.72;
const ARROW_V = 430;
const BULLET_V = 215;

type Status = "idle" | "playing" | "upgrade" | "over";
type Kind = "chaser" | "shooter" | "spinner";

interface Enemy {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  fire: number;
  aim: number;
  aimX: number;
  aimY: number;
  wind: number;
  dashT: number;
  dax: number;
  day: number;
  spin: number;
  born: number;
  hitT: number;
}

interface Arrow {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  pierce: number;
  hits: number[];
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Part {
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

interface Mods {
  pierce: number;
  multishot: number;
  dmg: number;
  speed: number;
  charge: number;
}

interface DeliverGame {
  px: number;
  py: number;
  hearts: number;
  iframes: number;
  charge: number;
  enemies: Enemy[];
  arrows: Arrow[];
  bullets: Bullet[];
  parts: Part[];
  floaters: Floater[];
  room: number;
  kills: number;
  score: number;
  mods: Mods;
  toSpawn: number;
  spawnT: number;
  queue: Kind[];
  shake: number;
  flash: number;
  banner: string;
  bannerT: number;
  over: boolean;
  dirty: boolean;
  nextId: number;
}

const UPGRADES = [
  { id: "pierce", name: "PIERCING BOLTS", desc: "Arrows punch through one more foe", tone: "from-orange-400 to-red-500" },
  { id: "multishot", name: "SPLIT SHOT", desc: "+1 arrow in every volley", tone: "from-red-400 to-rose-500" },
  { id: "speed", name: "SWIFT BOOTS", desc: "+15% movement speed", tone: "from-amber-400 to-orange-500" },
  { id: "dmg", name: "HEAVY TIPS", desc: "+1 damage on every hit", tone: "from-rose-500 to-red-600" },
  { id: "charge", name: "QUICK LOOSE", desc: "Charge 25% faster", tone: "from-orange-500 to-rose-600" },
  { id: "heart", name: "SECOND WIND", desc: "+1 heart (max 5)", tone: "from-pink-400 to-rose-500" },
] as const;

type UpgradeId = (typeof UPGRADES)[number]["id"];

const KEY_DIRS: Record<string, { x: number; y: number }> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

function createGame(): DeliverGame {
  return {
    px: W / 2,
    py: H / 2,
    hearts: 3,
    iframes: 0,
    charge: 0,
    enemies: [],
    arrows: [],
    bullets: [],
    parts: [],
    floaters: [],
    room: 1,
    kills: 0,
    score: 0,
    mods: { pierce: 0, multishot: 0, dmg: 1, speed: 185, charge: 1 },
    toSpawn: 0,
    spawnT: 0,
    queue: [],
    shake: 0,
    flash: 0,
    banner: "",
    bannerT: 0,
    over: false,
    dirty: true,
    nextId: 1,
  };
}

function enemyStats(kind: Kind, room: number) {
  if (kind === "chaser") {
    return { r: 14, hp: 2 + Math.floor(room / 3), speed: Math.min(135, 64 + room * 3) };
  }
  if (kind === "shooter") {
    return { r: 13, hp: 3 + Math.floor(room / 3), speed: Math.min(110, 56 + room * 2) };
  }
  return { r: 11, hp: 2 + Math.floor(room / 4), speed: Math.min(190, 100 + room * 3) };
}

function buildQueue(room: number): Kind[] {
  const count = Math.min(14, 3 + Math.floor(room * 1.15));
  const q: Kind[] = [];
  for (let i = 0; i < count; i++) {
    if (room >= 4 && i % 4 === 3) q.push("spinner");
    else if (room >= 2 && i % 3 === 2) q.push("shooter");
    else q.push("chaser");
  }
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [q[i], q[j]] = [q[j], q[i]];
  }
  return q;
}

function startRoom(g: DeliverGame): void {
  g.queue = buildQueue(g.room);
  g.toSpawn = g.queue.length;
  g.spawnT = 0.4;
  g.bullets = [];
  g.charge = 0;
  g.banner = `ROOM ${g.room}`;
  g.bannerT = 1.5;
  g.dirty = true;
}

function spawnEnemy(g: DeliverGame): void {
  const kind = g.queue.shift();
  if (!kind) return;
  const st = enemyStats(kind, g.room);
  let x = W / 2;
  let y = H / 2;
  for (let tries = 0; tries < 14; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = 150 + Math.random() * 90;
    x = Math.max(PAD, Math.min(W - PAD, g.px + Math.cos(a) * d));
    y = Math.max(PAD, Math.min(H - PAD, g.py + Math.sin(a) * d));
    if (Math.hypot(x - g.px, y - g.py) > 130) break;
  }
  g.enemies.push({
    id: g.nextId++,
    kind,
    x,
    y,
    r: st.r,
    hp: st.hp,
    maxHp: st.hp,
    speed: st.speed,
    fire: kind === "spinner" ? 0 : 1 + Math.random(),
    aim: 0,
    aimX: 0,
    aimY: 0,
    wind: 0,
    dashT: kind === "spinner" ? 1.4 + Math.random() : 0,
    dax: 0,
    day: 0,
    spin: Math.random() * Math.PI * 2,
    born: 0,
    hitT: 0,
  });
}

function burst(parts: Part[], x: number, y: number, c: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 190;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.3 + Math.random() * 0.3,
      max: 0.6,
      r: 1.4 + Math.random() * 2.6,
      c,
    });
  }
}

function hurtPlayer(g: DeliverGame): void {
  if (g.iframes > 0 || g.over) return;
  g.hearts -= 1;
  g.iframes = 1.2;
  g.charge = 0;
  g.shake = 9;
  g.flash = 0.4;
  g.dirty = true;
  burst(g.parts, g.px, g.py, "#fb7185", 16);
  g.floaters.push({ x: g.px, y: g.py - 22, text: "OUCH", life: 0.8, c: "#fda4af" });
  if (g.hearts <= 0) {
    g.hearts = 0;
    g.over = true;
  }
}

function nearestEnemy(g: DeliverGame): Enemy | null {
  let best: Enemy | null = null;
  let bd = Infinity;
  for (const e of g.enemies) {
    const d = (e.x - g.px) ** 2 + (e.y - g.py) ** 2;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function fireVolley(g: DeliverGame): void {
  const target = nearestEnemy(g);
  if (!target) return;
  const base = Math.atan2(target.y - g.py, target.x - g.px);
  const count = 1 + g.mods.multishot;
  for (let i = 0; i < count; i++) {
    const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 0.15;
    const a = base + spread;
    g.arrows.push({
      x: g.px,
      y: g.py,
      vx: Math.cos(a) * ARROW_V,
      vy: Math.sin(a) * ARROW_V,
      dmg: g.mods.dmg,
      pierce: g.mods.pierce,
      hits: [],
    });
  }
  burst(g.parts, g.px + Math.cos(base) * 14, g.py + Math.sin(base) * 14, "#fde68a", 4);
}

/** Returns "over", "clear" when a room is wiped, else null. */
function stepGame(g: DeliverGame, dt: number): "over" | "clear" | null {
  if (g.over) return "over";
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt);
  g.iframes = Math.max(0, g.iframes - dt);
  g.bannerT = Math.max(0, g.bannerT - dt);

  if (g.toSpawn > 0) {
    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      spawnEnemy(g);
      g.toSpawn -= 1;
      g.spawnT = Math.max(0.3, 0.8 - g.room * 0.03);
    }
  }

  for (const e of g.enemies) {
    e.born += dt;
    e.hitT = Math.max(0, e.hitT - dt);
    e.spin += dt * 2.4;
    const dx = g.px - e.x;
    const dy = g.py - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;

    if (e.kind === "chaser") {
      const wob = Math.sin(e.spin * 1.7) * 0.35;
      e.x += (ux - uy * wob) * e.speed * dt;
      e.y += (uy + ux * wob) * e.speed * dt;
    } else if (e.kind === "shooter") {
      const fwd = d > 215 ? 1 : d < 150 ? -1 : 0;
      const strafe = Math.sin(e.spin * 0.8) * 0.85;
      e.x += (ux * fwd - uy * strafe) * e.speed * dt;
      e.y += (uy * fwd + ux * strafe) * e.speed * dt;
      if (e.aim > 0) {
        e.aim -= dt;
        if (e.aim <= 0) {
          const ax = e.aimX - e.x;
          const ay = e.aimY - e.y;
          const ad = Math.hypot(ax, ay) || 1;
          const bv = BULLET_V + g.room * 4;
          g.bullets.push({
            x: e.x,
            y: e.y,
            vx: (ax / ad) * bv,
            vy: (ay / ad) * bv,
            r: 5.5,
          });
          e.fire = Math.max(0.85, 1.9 - g.room * 0.06) + Math.random() * 0.5;
        }
      } else {
        e.fire -= dt;
        if (e.fire <= 0 && d < 430) {
          e.aim = 0.75;
          e.aimX = g.px;
          e.aimY = g.py;
        }
      }
    } else {
      // spinner: orbit → wind up (telegraphed) → dash → repeat
      if (e.wind > 0) {
        e.wind -= dt;
        if (e.wind <= 0) e.fire = 0.42; // let it fly
      } else if (e.fire > 0) {
        e.fire -= dt;
        e.x += e.dax * e.speed * 2.4 * dt;
        e.y += e.day * e.speed * 2.4 * dt;
      } else {
        e.dashT -= dt;
        if (e.dashT <= 0) {
          e.wind = 0.42;
          e.dax = ux;
          e.day = uy;
        } else {
          const tang = 0.9;
          e.x += (ux - uy * tang) * e.speed * 0.75 * dt;
          e.y += (uy + ux * tang) * e.speed * 0.75 * dt;
        }
      }
    }

    e.x = Math.max(PAD, Math.min(W - PAD, e.x));
    e.y = Math.max(PAD, Math.min(H - PAD, e.y));

    // contact damage
    if (Math.hypot(e.x - g.px, e.y - g.py) < e.r + PLAYER_R - 2) hurtPlayer(g);
  }

  // bullets
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -10 || b.y < -10 || b.x > W + 10 || b.y > H + 10) {
      g.bullets.splice(i, 1);
      continue;
    }
    if (Math.hypot(b.x - g.px, b.y - g.py) < b.r + PLAYER_R - 3) {
      g.bullets.splice(i, 1);
      hurtPlayer(g);
    }
  }

  // arrows
  for (let i = g.arrows.length - 1; i >= 0; i--) {
    const a = g.arrows[i];
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (a.x < -12 || a.y < -12 || a.x > W + 12 || a.y > H + 12) {
      g.arrows.splice(i, 1);
      continue;
    }
    for (const e of g.enemies) {
      if (a.hits.includes(e.id)) continue;
      if (Math.hypot(a.x - e.x, a.y - e.y) > e.r + 5) continue;
      a.hits.push(e.id);
      e.hp -= a.dmg;
      e.hitT = 0.1;
      burst(g.parts, a.x, a.y, "#fde68a", 5);
      if (a.pierce > 0) {
        a.pierce -= 1;
      } else {
        g.arrows.splice(i, 1);
      }
      break;
    }
  }

  // enemy deaths
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    if (e.hp > 0) continue;
    g.enemies.splice(i, 1);
    g.kills += 1;
    const worth = e.kind === "chaser" ? 10 : e.kind === "shooter" ? 15 : 20;
    g.score += worth;
    g.shake = Math.max(g.shake, 3);
    burst(g.parts, e.x, e.y, e.kind === "chaser" ? "#fb923c" : e.kind === "shooter" ? "#e879f9" : "#fde047", 14);
    g.floaters.push({ x: e.x, y: e.y - 10, text: `+${worth}`, life: 0.7, c: "#fdba74" });
    g.dirty = true;
  }

  // particles + floaters
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
    p.vx *= 1 - 1.4 * dt;
  }
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.life -= dt;
    f.y -= 30 * dt;
    if (f.life <= 0) g.floaters.splice(i, 1);
  }

  if (g.over) return "over";

  if (g.toSpawn === 0 && g.enemies.length === 0) {
    g.score += 100 + g.room * 25;
    g.room += 1;
    g.dirty = true;
    return "clear";
  }
  return null;
}

export default function StandAndDeliver() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<DeliverGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [room, setRoom] = useState(1);
  const [choices, setChoices] = useState<UpgradeId[]>([]);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("stand-and-deliver", "high");
  const keys = useRef<Record<string, boolean>>({});
  const joy = useRef({ active: false, ox: 0, oy: 0, x: 0, y: 0 });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1c110a");
    bg.addColorStop(1, "#0c0709");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(251, 146, 60, 0.07)";
    ctx.lineWidth = 1;
    for (let x = 46; x < W; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 46; y < H; y += 46) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    ctx.save();
    if (g.shake > 0.2) {
      ctx.translate(Math.sin(time / 21) * g.shake, Math.cos(time / 17) * g.shake);
    }

    // shooter telegraph lines (under everything)
    ctx.lineWidth = 2;
    for (const e of g.enemies) {
      if (e.kind !== "shooter" || e.aim <= 0) continue;
      const pulse = 0.35 + Math.sin(time / 60) * 0.25;
      ctx.strokeStyle = `rgba(244, 114, 182, ${pulse})`;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.aimX, e.aimY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(244, 114, 182, ${pulse + 0.2})`;
      ctx.beginPath();
      ctx.arc(e.aimX, e.aimY, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    // spinner wind-up dashes
    for (const e of g.enemies) {
      if (e.kind !== "spinner" || e.wind <= 0) continue;
      const pulse = 0.4 + Math.sin(time / 55) * 0.3;
      ctx.strokeStyle = `rgba(253, 224, 71, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.dax * 70, e.y + e.day * 70);
      ctx.stroke();
    }

    // enemies
    for (const e of g.enemies) {
      const pop = Math.min(1, e.born / 0.25);
      const r = e.r * (0.4 + 0.6 * pop);
      const flash = e.hitT > 0;
      ctx.save();
      ctx.translate(e.x, e.y);

      if (e.kind === "chaser") {
        ctx.shadowColor = "#fb923c";
        ctx.shadowBlur = 14;
        ctx.fillStyle = flash ? "#ffffff" : "#fb923c";
        ctx.beginPath();
        ctx.ellipse(0, 0, r + Math.sin(time / 130 + e.id) * 1.5, r - Math.sin(time / 130 + e.id) * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#431407";
        ctx.beginPath();
        ctx.arc(-r * 0.32, -r * 0.15, 2.2, 0, Math.PI * 2);
        ctx.arc(r * 0.32, -r * 0.15, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "shooter") {
        ctx.rotate(Math.PI / 4);
        ctx.shadowColor = "#e879f9";
        ctx.shadowBlur = 14;
        ctx.fillStyle = flash ? "#ffffff" : "#d946ef";
        ctx.beginPath();
        ctx.roundRect(-r * 0.78, -r * 0.78, r * 1.56, r * 1.56, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#4a044e";
        ctx.fillRect(-r * 0.3, -r * 0.3, r * 0.6, r * 0.6);
        ctx.rotate(-Math.PI / 4);
        if (e.aim > 0) {
          ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(time / 50) * 0.4})`;
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.rotate(e.spin * 2.2);
        ctx.shadowColor = "#fde047";
        ctx.shadowBlur = 14;
        ctx.fillStyle = flash ? "#ffffff" : e.wind > 0 ? "#fffbeb" : "#fde047";
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2;
          const px = Math.cos(a) * r * 1.25;
          const py = Math.sin(a) * r * 1.25;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#713f12";
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (e.maxHp > 2 && e.hp < e.maxHp) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 3);
        ctx.fillStyle = "#fda4af";
        ctx.fillRect(e.x - e.r, e.y - e.r - 8, (e.r * 2 * e.hp) / e.maxHp, 3);
      }
    }

    // arrows
    ctx.save();
    ctx.shadowColor = "#fde68a";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "#fef3c7";
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    for (const a of g.arrows) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x - a.vx * 0.028, a.y - a.vy * 0.028);
      ctx.stroke();
    }
    ctx.restore();

    // enemy bullets
    for (const b of g.bullets) {
      const pulse = 1 + Math.sin(time / 70) * 0.18;
      ctx.save();
      ctx.shadowColor = "#fb7185";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#fda4af";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * pulse, 0, Math.PI * 2);
      ctx.fill();
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
    ctx.font = "bold 14px ui-monospace, monospace";
    ctx.textAlign = "center";
    for (const f of g.floaters) {
      ctx.globalAlpha = Math.min(1, f.life / 0.4);
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";

    // charge line hint to nearest target
    const target = nearestEnemy(g);
    if (target && g.charge > 0.05) {
      ctx.strokeStyle = `rgba(253, 230, 138, ${0.12 + g.charge * 0.2})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 8]);
      ctx.beginPath();
      ctx.moveTo(g.px, g.py);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // charge ring
    ctx.save();
    ctx.translate(g.px, g.py);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_R + 9, 0, Math.PI * 2);
    ctx.stroke();
    const full = g.charge >= 1;
    ctx.shadowColor = full ? "#fff7ed" : "#fbbf24";
    ctx.shadowBlur = full ? 16 : 6;
    ctx.strokeStyle = full ? "#fff7ed" : "#fbbf24";
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_R + 9, -Math.PI / 2, -Math.PI / 2 + g.charge * Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // player (blinks during i-frames)
    const blink = g.iframes > 0 && Math.floor(time / 90) % 2 === 0;
    if (!blink) {
      ctx.save();
      ctx.translate(g.px, g.py);
      ctx.shadowColor = "#67e8f9";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#67e8f9";
      ctx.beginPath();
      ctx.moveTo(PLAYER_R + 3, 0);
      ctx.lineTo(-PLAYER_R * 0.7, -PLAYER_R * 0.85);
      ctx.lineTo(-PLAYER_R * 0.2, 0);
      ctx.lineTo(-PLAYER_R * 0.7, PLAYER_R * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#0e7490";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(2, 0, PLAYER_R + 3, -1.1, 1.1);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // room banner
    if (g.bannerT > 0 && g.banner) {
      ctx.globalAlpha = Math.min(1, g.bannerT);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(g.banner, W / 2, 74);
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
    }

    // hurt flash
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(225, 29, 72, ${g.flash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
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
    const g = createGame();
    startRoom(g);
    gameRef.current = g;
    keys.current = {};
    joy.current = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
    setScore(0);
    setHearts(3);
    setRoom(1);
    setChoices([]);
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

      // ---- input + player (charge only while standing) ----
      let ix = 0;
      let iy = 0;
      if (keys.current.ArrowLeft || keys.current.a) ix -= 1;
      if (keys.current.ArrowRight || keys.current.d) ix += 1;
      if (keys.current.ArrowUp || keys.current.w) iy -= 1;
      if (keys.current.ArrowDown || keys.current.s) iy += 1;
      const j = joy.current;
      if (j.active) {
        const jx = (j.x - j.ox) / 46;
        const jy = (j.y - j.oy) / 46;
        const len = Math.hypot(jx, jy);
        if (len > 0.18) {
          const s = Math.min(1, len);
          ix = (jx / len) * s;
          iy = (jy / len) * s;
        }
      }
      const moving = ix !== 0 || iy !== 0;
      if (moving) {
        const d = Math.hypot(ix, iy) || 1;
        g.px += (ix / d) * g.mods.speed * dt;
        g.py += (iy / d) * g.mods.speed * dt;
        g.px = Math.max(PAD, Math.min(W - PAD, g.px));
        g.py = Math.max(PAD, Math.min(H - PAD, g.py));
        g.charge = 0;
      } else if (g.enemies.length > 0 && g.iframes < 0.9) {
        g.charge += dt / (BASE_CHARGE * g.mods.charge);
        if (g.charge >= 1) {
          g.charge = 0;
          fireVolley(g);
        }
      }

      const result = stepGame(g, dt);

      if (g.dirty) {
        g.dirty = false;
        setScore(g.score);
        setHearts(g.hearts);
        setRoom(g.room);
      }

      if (result === "over") {
        setScore(g.score);
        setNewBest(submit(g.score));
        setStatus("over");
        draw(t);
        return;
      }
      if (result === "clear") {
        const pool = [...UPGRADES];
        const picked: UpgradeId[] = [];
        while (picked.length < 3 && pool.length > 0) {
          const i = Math.floor(Math.random() * pool.length);
          picked.push(pool[i].id);
          pool.splice(i, 1);
        }
        setScore(g.score);
        setRoom(g.room);
        setChoices(picked);
        setStatus("upgrade");
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
      const dir = KEY_DIRS[key];
      if (dir) {
        e.preventDefault();
        keys.current[key] = true;
        return;
      }
      if (key === " " || key === "Enter") {
        e.preventDefault();
        if (status === "idle" || status === "over") start();
      }
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

  const toCanvas = (clientX: number, clientY: number, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const choose = (id: UpgradeId) => {
    const g = gameRef.current;
    if (!g) return;
    if (id === "pierce") g.mods.pierce += 1;
    else if (id === "multishot") g.mods.multishot += 1;
    else if (id === "speed") g.mods.speed *= 1.15;
    else if (id === "dmg") g.mods.dmg += 1;
    else if (id === "charge") g.mods.charge *= 0.75;
    else {
      g.hearts = Math.min(5, g.hearts + 1);
      setHearts(g.hearts);
    }
    startRoom(g);
    setRoom(g.room);
    setStatus("playing");
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-rose-400">
          Hearts{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${hearts} hearts`}>
            {"❤️".repeat(Math.max(0, hearts)) || "—"}
          </b>
        </span>
        <span className="text-orange-400">
          Room <b className="ml-1 text-sm text-ink">{room}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(251,146,60,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none select-none"
          aria-label="Stand and Deliver arena"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
            joy.current = { active: true, ox: p.x, oy: p.y, x: p.x, y: p.y };
          }}
          onPointerMove={(e) => {
            if (!joy.current.active) return;
            const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
            joy.current.x = p.x;
            joy.current.y = p.y;
          }}
          onPointerUp={() => {
            joy.current.active = false;
          }}
          onPointerCancel={() => {
            joy.current.active = false;
          }}
        />

        {status === "playing" && (
          <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            Move to charge · stand to shoot
          </p>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">STAND &amp; DELIVER</p>
            <p className="mt-2 text-sm text-muted">
              Rooms of rogue machines pour in. Move to stay alive — stand still and your bow
              charges on its own, loosing at the nearest foe.
            </p>
            <PrimaryButton onClick={start} tone="from-orange-500 to-rose-600">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              WASD / arrows or drag to move · stand still to shoot · pick an upgrade per room
            </p>
          </Overlay>
        )}

        {status === "upgrade" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-orange-300">
              ROOM {Math.max(1, room - 1)} CLEARED
            </p>
            <p className="mt-1 text-sm text-muted">Choose one upgrade</p>
            <div className="mt-4 flex flex-col items-center gap-2">
              {choices.map((id) => {
                const u = UPGRADES.find((x) => x.id === id);
                if (!u) return null;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => choose(u.id)}
                    className={`w-64 rounded-xl bg-gradient-to-r ${u.tone} px-5 py-2.5 text-left text-black shadow-lg transition hover:brightness-110 active:scale-95`}
                  >
                    <span className="block text-sm font-bold">{u.name}</span>
                    <span className="block text-xs opacity-80">{u.desc}</span>
                  </button>
                );
              })}
            </div>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">OUT OF HEARTS</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Fell in room {room} · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-orange-500 to-rose-600">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Pink dashes are aimed shots · yellow spikes mean a spinner is about to dash
      </p>
    </div>
  );
}
