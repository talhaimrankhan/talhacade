"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 520;
const PAD = 18;

type Status = "idle" | "playing" | "over";

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pierce: number;
}

interface Zombie {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  kind: 0 | 1 | 2; // 0 slow blob, 1 runner, 2 tank
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

interface Pickup {
  x: number;
  y: number;
  kind: "health" | "rapid";
  t: number;
}

interface SiegeGame {
  px: number;
  py: number;
  hp: number;
  aim: number;
  moveSpeed: number;
  fireT: number;
  fireRate: number;
  pierce: number;
  rapidT: number;
  trigger: boolean;
  bullets: Bullet[];
  zombies: Zombie[];
  parts: Particle[];
  pickups: Pickup[];
  wave: number;
  toSpawn: number;
  spawnT: number;
  kills: number;
  score: number;
  shake: number;
  flash: number;
  banner: string;
  bannerT: number;
  paused: boolean;
  over: boolean;
  dirty: boolean;
}

function randEdge(): { x: number; y: number } {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: Math.random() * W, y: -24 };
  if (side === 1) return { x: W + 24, y: Math.random() * H };
  if (side === 2) return { x: Math.random() * W, y: H + 24 };
  return { x: -24, y: Math.random() * H };
}

function spawnZombie(wave: number): Zombie {
  const p = randEdge();
  const roll = Math.random();
  let kind: 0 | 1 | 2 = 0;
  if (wave >= 2 && roll < Math.min(0.42, 0.12 + wave * 0.03)) kind = 1;
  if (wave >= 4 && roll > 0.88) kind = 2;

  if (kind === 1) {
    const speed = 84 + wave * 2.5;
    return {
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      hp: 1,
      maxHp: 1,
      r: 9,
      speed,
      kind,
      wob: Math.random() * 6,
      hit: 0,
    };
  }
  if (kind === 2) {
    const speed = 34 + wave * 1.2;
    return {
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      hp: 6,
      maxHp: 6,
      r: 17,
      speed,
      kind,
      wob: Math.random() * 6,
      hit: 0,
    };
  }
  const speed = 46 + wave * 2;
  return {
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    hp: 2,
    maxHp: 2,
    r: 12,
    speed,
    kind,
    wob: Math.random() * 6,
    hit: 0,
  };
}

function burst(parts: Particle[], x: number, y: number, c: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 130;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.35 + Math.random() * 0.3,
      max: 0.65,
      r: 1.5 + Math.random() * 2.5,
      c,
    });
  }
}

function waveCount(wave: number): number {
  return Math.min(34, 5 + wave * 3);
}

function createGame(): SiegeGame {
  return {
    px: W / 2,
    py: H / 2,
    hp: 100,
    aim: -Math.PI / 2,
    moveSpeed: 185,
    fireT: 0,
    fireRate: 0.19,
    pierce: 0,
    rapidT: 0,
    trigger: false,
    bullets: [],
    zombies: [],
    parts: [],
    pickups: [],
    wave: 1,
    toSpawn: waveCount(1),
    spawnT: 0.8,
    kills: 0,
    score: 0,
    shake: 0,
    flash: 0,
    banner: "WAVE 1",
    bannerT: 1.6,
    paused: false,
    over: false,
    dirty: true,
  };
}

function stepGame(g: SiegeGame, dt: number): void {
  if (g.paused || g.over) return;

  g.bannerT = Math.max(0, g.bannerT - dt);
  g.rapidT = Math.max(0, g.rapidT - dt);
  g.shake = Math.max(0, g.shake - dt * 22);
  g.flash = Math.max(0, g.flash - dt);

  // spawn trickle
  if (g.toSpawn > 0) {
    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      g.spawnT = Math.max(0.22, 0.85 - g.wave * 0.04);
      g.zombies.push(spawnZombie(g.wave));
      g.toSpawn -= 1;
    }
  }

  // zombies
  for (const z of g.zombies) {
    const dx = g.px - z.x;
    const dy = g.py - z.y;
    const d = Math.hypot(dx, dy) || 1;
    z.vx = (dx / d) * z.speed;
    z.vy = (dy / d) * z.speed;
    z.x += z.vx * dt;
    z.y += z.vy * dt;
    z.wob += dt * 6;
    z.hit = Math.max(0, z.hit - dt * 5);

    if (d < z.r + 11) {
      g.hp -= (z.kind === 2 ? 22 : 14) * dt;
      g.shake = Math.max(g.shake, 4);
      // knock the zombie back so hits read clearly
      z.x -= (dx / d) * 30 * dt;
      z.y -= (dy / d) * 30 * dt;
      if (g.hp <= 0) {
        g.hp = 0;
        g.over = true;
        g.dirty = true;
        burst(g.parts, g.px, g.py, "#a3e635", 26);
        return;
      }
    }
  }

  // soft separation so the horde doesn't stack into one dot
  for (let i = 0; i < g.zombies.length; i++) {
    for (let j = i + 1; j < g.zombies.length; j++) {
      const a = g.zombies[i];
      const b = g.zombies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r - 4;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = ((min - d) / d) * 0.5;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }

  // firing (only while the trigger is held)
  if (!g.trigger) g.fireT = Math.min(g.fireT, 0.08);
  g.fireT -= dt;
  if (g.trigger && g.fireT <= 0 && g.bullets.length < 40) {
    const rate = g.rapidT > 0 ? g.fireRate * 0.55 : g.fireRate;
    g.fireT = rate;
    const spread = (Math.random() - 0.5) * 0.06;
    const a = g.aim + spread;
    const mx = g.px + Math.cos(a) * 16;
    const my = g.py + Math.sin(a) * 16;
    g.bullets.push({
      x: mx,
      y: my,
      vx: Math.cos(a) * 560,
      vy: Math.sin(a) * 560,
      pierce: g.pierce,
    });
    g.flash = 0.05;
    burst(g.parts, mx, my, "#bef264", 2);
  }

  // bullets
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
      g.bullets.splice(i, 1);
      continue;
    }
    for (let j = g.zombies.length - 1; j >= 0; j--) {
      const z = g.zombies[j];
      const dx = b.x - z.x;
      const dy = b.y - z.y;
      if (dx * dx + dy * dy > (z.r + 3) * (z.r + 3)) continue;
      z.hp -= 1;
      z.hit = 1;
      burst(g.parts, b.x, b.y, "#d9f99d", 3);
      if (z.hp <= 0) {
        const color = z.kind === 1 ? "#a3e635" : z.kind === 2 ? "#166534" : "#4ade80";
        burst(g.parts, z.x, z.y, color, z.kind === 2 ? 22 : 12);
        g.zombies.splice(j, 1);
        g.kills += 1;
        g.score += z.kind === 2 ? 30 : z.kind === 1 ? 15 : 10;
        g.shake = Math.max(g.shake, z.kind === 2 ? 6 : 2.5);
        g.dirty = true;
      }
      if (b.pierce > 0) {
        b.pierce -= 1;
      } else {
        g.bullets.splice(i, 1);
      }
      break;
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
    p.vx *= 1 - dt * 2.4;
    p.vy *= 1 - dt * 2.4;
  }

  // pickups
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const p = g.pickups[i];
    p.t += dt;
    const dx = p.x - g.px;
    const dy = p.y - g.py;
    if (dx * dx + dy * dy < 24 * 24) {
      if (p.kind === "health") g.hp = Math.min(100, g.hp + 30);
      else g.rapidT = 6;
      burst(g.parts, p.x, p.y, p.kind === "health" ? "#34d399" : "#facc15", 14);
      g.pickups.splice(i, 1);
      g.dirty = true;
    } else if (p.t > 14) {
      g.pickups.splice(i, 1);
    }
  }

  // wave cleared
  if (g.toSpawn === 0 && g.zombies.length === 0 && !g.over) {
    g.score += 50 * g.wave;
    g.wave += 1;
    g.toSpawn = waveCount(g.wave);
    g.spawnT = 1.1;
    g.banner = `WAVE ${g.wave}`;
    g.bannerT = 1.6;
    // supply drop
    const drop: Pickup = {
      x: 60 + Math.random() * (W - 120),
      y: 60 + Math.random() * (H - 120),
      kind: g.hp < 62 ? "health" : Math.random() < 0.5 ? "health" : "rapid",
      t: 0,
    };
    g.pickups.push(drop);
    g.paused = true;
    g.dirty = true;
  }
}

const UPGRADES = [
  { id: "rapid", name: "RAPID FIRE", desc: "30% faster trigger pull", tone: "from-lime-400 to-green-500" },
  { id: "pierce", name: "PIERCE ROUNDS", desc: "Bullets punch through a zombie", tone: "from-green-400 to-emerald-500" },
  { id: "speed", name: "COMBAT BOOTS", desc: "+18% movement speed", tone: "from-emerald-400 to-teal-500" },
] as const;

export default function ZombieSiege() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<SiegeGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [wave, setWave] = useState(1);
  const [newBest, setNewBest] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { best, submit } = useBestScore("zombie-siege", "high");
  const keys = useRef<Record<string, boolean>>({});
  const firing = useRef(false);
  const pointer = useRef({ x: W / 2, y: 40 });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    ctx.fillStyle = "#080d0a";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    const sh = g.shake;
    if (sh > 0.2) {
      ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    }

    // grid
    ctx.strokeStyle = "rgba(74, 222, 128, 0.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // pickups
    for (const p of g.pickups) {
      const pulse = 1 + Math.sin(p.t * 5) * 0.12;
      const c = p.kind === "health" ? "#34d399" : "#facc15";
      ctx.save();
      ctx.shadowColor = c;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = c;
      ctx.fillStyle = p.kind === "health" ? "rgba(52,211,153,0.18)" : "rgba(250,204,21,0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(p.x - 11 * pulse, p.y - 11 * pulse, 22 * pulse, 22 * pulse, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c;
      if (p.kind === "health") {
        ctx.fillRect(p.x - 5, p.y - 1.5, 10, 3);
        ctx.fillRect(p.x - 1.5, p.y - 5, 3, 10);
      } else {
        ctx.beginPath();
        ctx.moveTo(p.x + 1, p.y - 7);
        ctx.lineTo(p.x - 5, p.y + 1);
        ctx.lineTo(p.x - 1, p.y + 1);
        ctx.lineTo(p.x - 2, p.y + 7);
        ctx.lineTo(p.x + 5, p.y - 1);
        ctx.lineTo(p.x + 1, p.y - 1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // zombies
    for (const z of g.zombies) {
      const wob = Math.sin(z.wob) * 1.6;
      const body = z.hit > 0 ? "#ffffff" : z.kind === 1 ? "#a3e635" : z.kind === 2 ? "#15803d" : "#4ade80";
      const glow = z.kind === 1 ? "#a3e635" : z.kind === 2 ? "#22c55e" : "#22c55e";
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = z.kind === 2 ? 18 : 10;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(z.x, z.y + wob * 0.3, z.r + wob * 0.4, z.r - wob * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // eyes
      ctx.fillStyle = "#052e16";
      const ex = ((g.px - z.x) / (Math.hypot(g.px - z.x, g.py - z.y) || 1)) * 3;
      const ey = ((g.py - z.y) / (Math.hypot(g.px - z.x, g.py - z.y) || 1)) * 3;
      ctx.beginPath();
      ctx.arc(z.x - z.r * 0.35 + ex, z.y - z.r * 0.2 + ey, 1.8, 0, Math.PI * 2);
      ctx.arc(z.x + z.r * 0.35 + ex, z.y - z.r * 0.2 + ey, 1.8, 0, Math.PI * 2);
      ctx.fill();
      if (z.maxHp > 2) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(z.x - z.r, z.y - z.r - 7, z.r * 2, 3);
        ctx.fillStyle = "#86efac";
        ctx.fillRect(z.x - z.r, z.y - z.r - 7, (z.r * 2 * z.hp) / z.maxHp, 3);
      }
    }

    // bullets
    ctx.save();
    ctx.shadowColor = "#bef264";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#ecfccb";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    for (const b of g.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
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

    // player
    ctx.save();
    ctx.translate(g.px, g.py);
    ctx.rotate(g.aim);
    if (g.flash > 0) {
      ctx.fillStyle = "rgba(190,242,100,0.9)";
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(26, -5);
      ctx.lineTo(30, 0);
      ctx.lineTo(26, 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowColor = "#67e8f9";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#67e8f9";
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-9, -10);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0e7490";
    ctx.fillRect(6, -2.5, 12, 5);
    ctx.restore();

    // aim reticle
    ctx.strokeStyle = "rgba(103,232,249,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pointer.current.x, pointer.current.y, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pointer.current.x - 11, pointer.current.y);
    ctx.lineTo(pointer.current.x - 4, pointer.current.y);
    ctx.moveTo(pointer.current.x + 4, pointer.current.y);
    ctx.lineTo(pointer.current.x + 11, pointer.current.y);
    ctx.stroke();

    if (g.rapidT > 0) {
      ctx.strokeStyle = `rgba(250,204,21,${0.35 + Math.sin(time / 80) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.px, g.py, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    if (g.bannerT > 0 && g.banner && !g.paused) {
      ctx.globalAlpha = Math.min(1, g.bannerT);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(g.banner, W / 2, H / 2 - 60);
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
    }

    // hurt vignette
    if (g.hp < 35) {
      ctx.fillStyle = `rgba(220,38,38,${(1 - g.hp / 35) * 0.22})`;
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
    gameRef.current = createGame();
    keys.current = {};
    firing.current = false;
    setScore(0);
    setHp(100);
    setWave(1);
    setNewBest(false);
    setUpgradeOpen(false);
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

      if (!g.paused && !g.over) {
        g.trigger = firing.current || keys.current[" "] === true;
        // movement
        let mx = 0;
        let my = 0;
        if (keys.current.ArrowLeft || keys.current.a) mx -= 1;
        if (keys.current.ArrowRight || keys.current.d) mx += 1;
        if (keys.current.ArrowUp || keys.current.w) my -= 1;
        if (keys.current.ArrowDown || keys.current.s) my += 1;
        if (mx || my) {
          const d = Math.hypot(mx, my);
          g.px += (mx / d) * g.moveSpeed * dt;
          g.py += (my / d) * g.moveSpeed * dt;
        }
        g.px = Math.max(PAD, Math.min(W - PAD, g.px));
        g.py = Math.max(PAD, Math.min(H - PAD, g.py));

        stepGame(g, dt);
      } else {
        // keep particles alive while paused so the screen still breathes
        for (let i = g.parts.length - 1; i >= 0; i--) {
          const p = g.parts[i];
          p.life -= dt;
          if (p.life <= 0) g.parts.splice(i, 1);
        }
      }

      if (g.dirty) {
        g.dirty = false;
        setScore(g.score);
        setHp(Math.ceil(g.hp));
        setWave(g.wave);
      }
      if (g.paused && !g.over && !upgradeOpen) {
        setUpgradeOpen(true);
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
  }, [status, submit, draw, upgradeOpen]);

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
        keys.current[" "] = true;
        if (status !== "playing" && !upgradeOpen) start();
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
  }, [status, start, upgradeOpen]);

  const aimAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas || !g) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    pointer.current = { x, y };
    g.aim = Math.atan2(y - g.py, x - g.px);
  };

  const chooseUpgrade = (id: (typeof UPGRADES)[number]["id"]) => {
    const g = gameRef.current;
    if (!g) return;
    if (id === "rapid") g.fireRate = Math.max(0.07, g.fireRate * 0.7);
    else if (id === "pierce") g.pierce += 1;
    else g.moveSpeed *= 1.18;
    g.paused = false;
    setUpgradeOpen(false);
  };

  return (
    <div className="w-full max-w-[500px]">
      <GameHud score={score} best={best ?? "—"}>
        <span>
          Wave <b className="ml-1 text-sm text-ink">{wave}</b>
        </span>
        <span>
          HP{" "}
          <b
            className={`ml-1 text-sm ${hp > 50 ? "text-ink" : hp > 25 ? "text-warn" : "text-rose-400"}`}
          >
            {hp}
          </b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-24px_rgba(74,222,128,0.8)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          aria-label="Zombie Siege arena"
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing" || upgradeOpen) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            firing.current = true;
            aimAt(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (status !== "playing" || upgradeOpen) return;
            aimAt(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            firing.current = false;
          }}
          onPointerCancel={() => {
            firing.current = false;
          }}
        />

        {status === "playing" && !upgradeOpen && (
          <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            Hold click to fire
          </p>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">ZOMBIE SIEGE</p>
            <p className="mt-2 text-sm text-muted">
              They swarm from every wall. Move, aim, and hold the trigger. Survive waves, grab
              supplies, pick an upgrade.
            </p>
            <PrimaryButton onClick={start} tone="from-lime-400 to-green-500">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              WASD / arrows to move · mouse to aim · hold click to fire
            </p>
          </Overlay>
        )}

        {status === "playing" && upgradeOpen && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-lime-300">WAVE CLEARED</p>
            <p className="mt-1 text-sm text-muted">Choose your reward</p>
            <div className="mt-4 flex flex-col items-center gap-2">
              {UPGRADES.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => chooseUpgrade(u.id)}
                  className={`w-64 rounded-xl bg-gradient-to-r ${u.tone} px-5 py-2.5 text-left text-black shadow-lg transition hover:brightness-110 active:scale-95`}
                >
                  <span className="block text-sm font-bold">{u.name}</span>
                  <span className="block text-xs opacity-80">{u.desc}</span>
                </button>
              ))}
            </div>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-rose-400">OVERRUN</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Best {best ?? "—"} · wave {wave}
            </p>
            <PrimaryButton onClick={start} tone="from-lime-400 to-green-500">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Runners are fast but fragile · tanks eat magazines · green drops heal, yellow = rapid fire
      </p>
    </div>
  );
}
