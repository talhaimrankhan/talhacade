"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 480;
const H = 540;
const ORIGIN_X = W / 2;
const ORIGIN_Y = 22;
const START_LIVES = 3;
const CORE_STEP = 10;

type Status = "idle" | "playing" | "upgrade" | "over";

interface Unit {
  x: number;
  y: number;
  axis: "h" | "v";
  dir: number;
  speed: number;
  robot: boolean;
  r: number;
  spin: number;
}

interface Shell {
  tx: number;
  ty: number;
  t: number;
  dur: number;
}

interface Core {
  x: number;
  y: number;
  life: number;
}

interface Splash {
  x: number;
  y: number;
  age: number;
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
  splash: number;
  shellDur: number;
  sonar: number;
}

interface DroneGame {
  units: Unit[];
  shells: Shell[];
  cores: Core[];
  splashes: Splash[];
  parts: Part[];
  floaters: Floater[];
  t: number;
  spawnT: number;
  lives: number;
  score: number;
  kills: number;
  coreCount: number;
  nextUpgrade: number;
  cooldown: number;
  mods: Mods;
  shake: number;
  flash: number;
  banner: string;
  bannerT: number;
  over: boolean;
  dirty: boolean;
}

const UPGRADES = [
  { id: "splash", name: "WIDER SPLASH", desc: "Blast radius +35%", tone: "from-fuchsia-500 to-purple-500" },
  { id: "speed", name: "FAST SHELL", desc: "0.8s travel cut by a third", tone: "from-purple-500 to-indigo-500" },
  { id: "sonar", name: "SONAR PULSE", desc: "Robots pinged through the grid", tone: "from-indigo-500 to-violet-500" },
] as const;

type UpgradeId = (typeof UPGRADES)[number]["id"];

const LANES_X = [13, 126, 240, 354, 467];
const LANES_Y = [34, 147, 261, 375, 507];
const BLOCK_W = 84;
const BLOCK_H = 84;
const BLOCK_X = [27, 141, 255, 369];
const BLOCK_Y = [48, 162, 276, 390];

function createGame(): DroneGame {
  return {
    units: [],
    shells: [],
    cores: [],
    splashes: [],
    parts: [],
    floaters: [],
    t: 0,
    spawnT: 1.2,
    lives: START_LIVES,
    score: 0,
    kills: 0,
    coreCount: 0,
    nextUpgrade: CORE_STEP,
    cooldown: 0,
    mods: { splash: 46, shellDur: 0.8, sonar: 0 },
    shake: 0,
    flash: 0,
    banner: "",
    bannerT: 0,
    over: false,
    dirty: true,
  };
}

function robotCap(t: number): number {
  return Math.min(9, 3 + Math.floor(t / 18));
}

function civCap(t: number): number {
  return Math.min(8, 4 + Math.floor(t / 25));
}

function spawnUnit(g: DroneGame): void {
  const robots = g.units.filter((u) => u.robot).length;
  const civs = g.units.length - robots;
  const wantRobot =
    robots < robotCap(g.t) && (civs >= civCap(g.t) || Math.random() < 0.45);
  const axis: "h" | "v" = Math.random() < 0.5 ? "h" : "v";
  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = (wantRobot ? 52 : 64) + Math.random() * 26 + Math.min(40, g.t * 0.35);
  if (axis === "h") {
    const lane = LANES_Y[Math.floor(Math.random() * LANES_Y.length)];
    g.units.push({
      x: dir > 0 ? -16 : W + 16,
      y: lane,
      axis,
      dir,
      speed,
      robot: wantRobot,
      r: wantRobot ? 12 : 11,
      spin: Math.random() * Math.PI * 2,
    });
  } else {
    const lane = LANES_X[Math.floor(Math.random() * LANES_X.length)];
    g.units.push({
      x: lane,
      y: dir > 0 ? -16 : H + 16,
      axis,
      dir,
      speed,
      robot: wantRobot,
      r: wantRobot ? 12 : 11,
      spin: Math.random() * Math.PI * 2,
    });
  }
}

function burst(parts: Part[], x: number, y: number, c: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 50 + Math.random() * 180;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.3 + Math.random() * 0.35,
      max: 0.65,
      r: 1.4 + Math.random() * 2.4,
      c,
    });
  }
}

function impact(g: DroneGame, x: number, y: number): void {
  const R = g.mods.splash;
  g.splashes.push({ x, y, age: 0, r: R });
  g.shake = Math.max(g.shake, 7);
  burst(g.parts, x, y, "#f0abfc", 18);

  for (let i = g.units.length - 1; i >= 0; i--) {
    const u = g.units[i];
    if (Math.hypot(u.x - x, u.y - y) > R + u.r) continue;
    g.units.splice(i, 1);
    if (u.robot) {
      g.kills += 1;
      g.score += 25;
      g.cores.push({ x: u.x, y: u.y, life: 12 });
      g.floaters.push({ x: u.x, y: u.y - 10, text: "+25", life: 0.7, c: "#f0abfc" });
      burst(g.parts, u.x, u.y, "#f43f5e", 16);
    } else {
      g.lives -= 1;
      g.flash = 0.5;
      g.shake = 11;
      g.floaters.push({ x: u.x, y: u.y - 10, text: "SIGNAL LOST", life: 1, c: "#fda4af" });
      burst(g.parts, u.x, u.y, "#60a5fa", 16);
      g.dirty = true;
      if (g.lives <= 0) {
        g.lives = 0;
        g.over = true;
      }
    }
    g.dirty = true;
  }
}

function stepGame(g: DroneGame, dt: number): "over" | "upgrade" | null {
  if (g.over) return "over";
  g.t += dt;
  g.shake = Math.max(0, g.shake - dt * 26);
  g.flash = Math.max(0, g.flash - dt);
  g.bannerT = Math.max(0, g.bannerT - dt);
  g.cooldown = Math.max(0, g.cooldown - dt);

  // spawn traffic
  g.spawnT -= dt;
  if (g.spawnT <= 0) {
    g.spawnT = Math.max(0.55, 2.3 - g.t * 0.035) * (0.75 + Math.random() * 0.5);
    const robots = g.units.filter((u) => u.robot).length;
    const civs = g.units.length - robots;
    if (robots < robotCap(g.t) || civs < civCap(g.t)) spawnUnit(g);
  }

  // patrol movement (with lane switching at intersections)
  for (const u of g.units) {
    u.spin += dt * 3;
    const step = u.speed * u.dir * dt;
    if (u.axis === "h") {
      const prev = u.x;
      u.x += step;
      let crossed: number | null = null;
      for (const lane of LANES_X) {
        if ((prev - lane) * (u.x - lane) <= 0 && prev !== lane) {
          crossed = lane;
          break;
        }
      }
      if (crossed !== null && Math.random() < 0.22) {
        u.axis = "v";
        u.x = crossed;
        u.dir = Math.random() < 0.5 ? 1 : -1;
      } else if (u.x < -24) u.x = W + 24;
      else if (u.x > W + 24) u.x = -24;
    } else {
      const prev = u.y;
      u.y += step;
      let crossed: number | null = null;
      for (const lane of LANES_Y) {
        if ((prev - lane) * (u.y - lane) <= 0 && prev !== lane) {
          crossed = lane;
          break;
        }
      }
      if (crossed !== null && Math.random() < 0.22) {
        u.axis = "h";
        u.y = crossed;
        u.dir = Math.random() < 0.5 ? 1 : -1;
      } else if (u.y < -24) u.y = H + 24;
      else if (u.y > H + 24) u.y = -24;
    }
  }

  // shells in flight
  for (let i = g.shells.length - 1; i >= 0; i--) {
    const s = g.shells[i];
    s.t += dt;
    if (s.t >= s.dur) {
      g.shells.splice(i, 1);
      impact(g, s.tx, s.ty);
    }
  }

  // cores: expire + collect by crosshair proximity
  for (let i = g.cores.length - 1; i >= 0; i--) {
    const c = g.cores[i];
    c.life -= dt;
    if (c.life <= 0) {
      g.cores.splice(i, 1);
      continue;
    }
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
    p.vy += 240 * dt;
    p.vx *= 1 - 1.6 * dt;
  }
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.life -= dt;
    f.y -= 30 * dt;
    if (f.life <= 0) g.floaters.splice(i, 1);
  }
  for (let i = g.splashes.length - 1; i >= 0; i--) {
    g.splashes[i].age += dt;
    if (g.splashes[i].age > 0.5) g.splashes.splice(i, 1);
  }

  if (g.over) return "over";
  if (g.coreCount >= g.nextUpgrade) {
    g.nextUpgrade += CORE_STEP;
    return "upgrade";
  }
  return null;
}

export default function DroneStrike() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<DroneGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [cores, setCores] = useState(0);
  const [choices, setChoices] = useState<UpgradeId[]>([]);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("drone-strike", "high");
  const cursor = useRef({ x: W / 2, y: H / 2 });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const g = gameRef.current;
    if (!canvas || !ctx || !g) return;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#150b2e");
    bg.addColorStop(1, "#0a0618");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // streets
    ctx.strokeStyle = "rgba(167, 139, 250, 0.16)";
    ctx.lineWidth = 14;
    ctx.lineCap = "butt";
    for (const y of LANES_Y) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (const x of LANES_X) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(167, 139, 250, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 10]);
    for (const y of LANES_Y) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (const x of LANES_X) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // blocks
    for (let r = 0; r < BLOCK_Y.length; r++) {
      for (let c = 0; c < BLOCK_X.length; c++) {
        const x = BLOCK_X[c];
        const y = BLOCK_Y[r];
        ctx.fillStyle = "#1e1145";
        ctx.beginPath();
        ctx.roundRect(x, y, BLOCK_W, BLOCK_H, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(217, 70, 239, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // windows
        ctx.fillStyle = "rgba(196, 181, 253, 0.35)";
        for (let wy = 0; wy < 3; wy++) {
          for (let wx = 0; wx < 3; wx++) {
            const lit = (r * 3 + c * 5 + wx * 7 + wy * 3 + Math.floor(g.t * 0.4)) % 4 !== 0;
            if (!lit) continue;
            ctx.fillRect(x + 12 + wx * 24, y + 14 + wy * 22, 10, 8);
          }
        }
      }
    }

    ctx.save();
    if (g.shake > 0.2) {
      ctx.translate(Math.sin(time / 19) * g.shake, Math.cos(time / 15) * g.shake);
    }

    // cores
    for (const c of g.cores) {
      const pulse = 1 + Math.sin(time / 140 + c.x) * 0.15;
      const fade = c.life < 2.5 ? 0.35 + Math.sin(time / 90) * 0.35 : 1;
      ctx.globalAlpha = Math.max(0.1, fade);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(time / 400);
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.moveTo(0, -9 * pulse);
      ctx.lineTo(7 * pulse, 0);
      ctx.lineTo(0, 9 * pulse);
      ctx.lineTo(-7 * pulse, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // units
    for (const u of g.units) {
      if (u.robot) {
        ctx.save();
        ctx.translate(u.x, u.y);
        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + u.spin * 0.15;
          const px = Math.cos(a) * u.r;
          const py = Math.sin(a) * u.r;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#4c0519";
        ctx.beginPath();
        ctx.arc(0, 0, u.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff1f2";
        ctx.beginPath();
        ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (g.mods.sonar > 0) {
          const fast = g.mods.sonar > 1;
          const ph = (time / (fast ? 380 : 700) + u.x * 0.01) % 1;
          ctx.strokeStyle = `rgba(244, 63, 94, ${0.7 * (1 - ph)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(u.x, u.y, u.r + 6 + ph * 22, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        ctx.save();
        ctx.translate(u.x, u.y);
        ctx.shadowColor = "#60a5fa";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#60a5fa";
        ctx.beginPath();
        ctx.arc(0, 0, u.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        const rotor = Math.sin(time / 45 + u.spin) * 0.5 + 0.5;
        ctx.strokeStyle = "#bfdbfe";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-u.r - 5 * rotor, -u.r + 3);
        ctx.lineTo(-u.r + 3, -u.r + 3);
        ctx.moveTo(u.r + 5 * rotor, u.r - 3);
        ctx.lineTo(u.r - 3, u.r - 3);
        ctx.stroke();
        ctx.fillStyle = "#1e3a8a";
        ctx.beginPath();
        ctx.arc(0, 0, u.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // shells in flight
    for (const s of g.shells) {
      const k = Math.min(1, s.t / s.dur);
      const sx = ORIGIN_X + (s.tx - ORIGIN_X) * k;
      const sy = ORIGIN_Y + (s.ty - ORIGIN_Y) * k;
      // flight line
      ctx.strokeStyle = `rgba(240, 171, 252, ${0.45 * (1 - k) + 0.12})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(ORIGIN_X, ORIGIN_Y);
      ctx.lineTo(s.tx, s.ty);
      ctx.stroke();
      ctx.setLineDash([]);
      // reticle
      const rr = 16 + Math.sin(time / 60) * 4;
      ctx.strokeStyle = "rgba(244, 63, 94, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.tx, s.ty, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.tx - rr - 6, s.ty);
      ctx.lineTo(s.tx - rr + 2, s.ty);
      ctx.moveTo(s.tx + rr - 2, s.ty);
      ctx.lineTo(s.tx + rr + 6, s.ty);
      ctx.stroke();
      // shell
      ctx.save();
      ctx.shadowColor = "#f0abfc";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#fdf4ff";
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // splashes
    for (const sp of g.splashes) {
      const k = sp.age / 0.5;
      const r = Math.max(2, sp.r * (0.3 + k * 0.9));
      const grad = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r);
      grad.addColorStop(0, `rgba(255, 255, 255, ${0.7 * (1 - k)})`);
      grad.addColorStop(0.5, `rgba(232, 121, 249, ${0.55 * (1 - k)})`);
      grad.addColorStop(1, "rgba(139, 92, 246, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(240, 171, 252, ${0.8 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
      ctx.stroke();
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

    // drone origin
    ctx.save();
    ctx.shadowColor = "#e879f9";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#d946ef";
    ctx.beginPath();
    ctx.ellipse(ORIGIN_X, ORIGIN_Y, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();

    // crosshair
    const cx = cursor.current.x;
    const cy = cursor.current.y;
    ctx.strokeStyle = "rgba(240, 171, 252, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy);
    ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5);
    ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    // banner
    if (g.bannerT > 0 && g.banner) {
      ctx.globalAlpha = Math.min(1, g.bannerT);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(g.banner, W / 2, H / 2);
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
    }

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
    g.banner = "CONTACT";
    g.bannerT = 1.4;
    gameRef.current = g;
    cursor.current = { x: W / 2, y: H / 2 };
    setScore(0);
    setLives(START_LIVES);
    setCores(0);
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

      // scoop nearby cores with the crosshair
      for (let i = g.cores.length - 1; i >= 0; i--) {
        const c = g.cores[i];
        if (Math.hypot(c.x - cursor.current.x, c.y - cursor.current.y) > 28) continue;
        g.cores.splice(i, 1);
        g.coreCount += 1;
        g.score += 5;
        burst(g.parts, c.x, c.y, "#fde047", 10);
        g.floaters.push({ x: c.x, y: c.y - 8, text: "+5", life: 0.6, c: "#fde047" });
        g.dirty = true;
      }

      const result = stepGame(g, dt);

      if (g.dirty) {
        g.dirty = false;
        setScore(g.score);
        setLives(g.lives);
        setCores(g.coreCount);
      }

      if (result === "over") {
        setScore(g.score);
        setNewBest(submit(g.score));
        setStatus("over");
        draw(t);
        return;
      }
      if (result === "upgrade") {
        const pool = [...UPGRADES];
        const picked: UpgradeId[] = [];
        while (picked.length < 3 && pool.length > 0) {
          const i = Math.floor(Math.random() * pool.length);
          picked.push(pool[i].id);
          pool.splice(i, 1);
        }
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
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status === "idle" || status === "over") start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, start]);

  const toCanvas = (clientX: number, clientY: number, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const fire = (p: { x: number; y: number }) => {
    const g = gameRef.current;
    if (!g || g.cooldown > 0 || g.shells.length >= 2) return;
    g.shells.push({ tx: p.x, ty: p.y, t: 0, dur: g.mods.shellDur });
    g.cooldown = 0.3;
    burst(g.parts, ORIGIN_X, ORIGIN_Y, "#f0abfc", 6);
  };

  const choose = (id: UpgradeId) => {
    const g = gameRef.current;
    if (!g) return;
    if (id === "splash") g.mods.splash *= 1.35;
    else if (id === "speed") g.mods.shellDur = Math.max(0.32, g.mods.shellDur * 0.66);
    else g.mods.sonar += 1;
    g.banner = `CORE BANK ${g.coreCount}`;
    g.bannerT = 1.2;
    setStatus("playing");
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={score} best={best ?? "—"}>
        <span className="text-rose-400">
          Signal{" "}
          <b className="ml-1 text-sm text-ink" aria-label={`${lives} signal lives`}>
            {"▮".repeat(Math.max(0, lives)) || "—"}
          </b>
        </span>
        <span className="text-amber-300">
          Cores <b className="ml-1 text-sm text-ink">{cores}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(217,70,239,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-crosshair select-none"
          aria-label="Drone Strike camera feed"
          onPointerMove={(e) => {
            cursor.current = toCanvas(e.clientX, e.clientY, e.currentTarget);
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            if (status !== "playing") return;
            const p = toCanvas(e.clientX, e.clientY, e.currentTarget);
            cursor.current = p;
            const g = gameRef.current;
            if (g) {
              for (let i = g.cores.length - 1; i >= 0; i--) {
                if (Math.hypot(g.cores[i].x - p.x, g.cores[i].y - p.y) > 30) continue;
                g.cores.splice(i, 1);
                g.coreCount += 1;
                g.score += 5;
                g.dirty = true;
                return;
              }
            }
            fire(p);
          }}
        />

        {status === "playing" && (
          <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            Red = rogue · blue = civilian
          </p>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">DRONE STRIKE</p>
            <p className="mt-2 text-sm text-muted">
              A live feed over neon city blocks: rogue red robots patrol among blue civilian
              drones. Call the shell, wait out the 0.8-second fall, and never splash a civilian.
            </p>
            <PrimaryButton onClick={start} tone="from-fuchsia-500 via-purple-500 to-indigo-600">
              Start game
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Click to strike · hover cores to scoop them · every 10 cores = an upgrade
            </p>
          </Overlay>
        )}

        {status === "upgrade" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-fuchsia-300">
              {cores} CORES BANKED
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
            <p className="font-display text-2xl font-bold text-rose-400">SIGNAL LOST</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {cores} cores · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-fuchsia-500 via-purple-500 to-indigo-600">
              Play again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Civilians cost one of three signal lives · robots pay 25 and drop a core
      </p>
    </div>
  );
}
