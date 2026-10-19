"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { Overlay, PrimaryButton } from "./parts";

const W = 560;
const H = 420;
const WORLD_W = 1640;
const WORLD_H = 1080;
const HALF_W = 44;
const LAPS = 3;
const STEP = 1000 / 60;

const PLAYER_MAX = 348;
const AI_MAX = 326;
const ACCEL = 310;
const BRAKE = 430;
const DRAG = 70;
const OFF_MAX = 168;
const OFF_DRAG = 230;
const TURN = 2.35;

type Status = "idle" | "playing" | "over";

interface Pt {
  x: number;
  y: number;
}

interface Track {
  pts: Pt[];
  cum: number[];
  len: number;
}

interface Kart {
  x: number;
  y: number;
  ang: number;
  speed: number;
  s: number;
  hint: number;
  crossings: number;
  lapTime: number;
  lastLap: number;
  total: number;
  color: string;
  name: string;
}

interface RaceGame {
  karts: Kart[];
  countdown: number;
  goT: number;
  shake: number;
  sparks: { x: number; y: number; life: number; c: string }[];
  done: boolean;
  prevCross: number;
}

/* ---------------- track geometry ---------------- */

const CTRL: Pt[] = [
  { x: 300, y: 840 },
  { x: 660, y: 880 },
  { x: 840, y: 780 },
  { x: 1000, y: 880 },
  { x: 1300, y: 840 },
  { x: 1450, y: 620 },
  { x: 1360, y: 380 },
  { x: 1150, y: 250 },
  { x: 960, y: 330 },
  { x: 800, y: 230 },
  { x: 520, y: 210 },
  { x: 280, y: 300 },
  { x: 170, y: 520 },
  { x: 200, y: 700 },
];

function cr(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function buildTrack(): Track {
  const pts: Pt[] = [];
  const n = CTRL.length;
  for (let i = 0; i < n; i++) {
    const p0 = CTRL[(i - 1 + n) % n];
    const p1 = CTRL[i];
    const p2 = CTRL[(i + 1) % n];
    const p3 = CTRL[(i + 2) % n];
    for (let k = 0; k < 16; k++) pts.push(cr(p0, p1, p2, p3, k / 16));
  }
  const cum: number[] = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i % pts.length];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return { pts, cum, len: cum[pts.length] };
}

interface OnTrack {
  i: number;
  t: number;
  s: number;
  lat: number;
  dist: number;
}

/** Local nearest-point search around a hint index (keeps O(1) per frame). */
function nearest(tr: Track, x: number, y: number, hint: number): OnTrack {
  const n = tr.pts.length;
  let best: OnTrack = { i: hint, t: 0, s: 0, lat: 0, dist: Infinity };
  for (let k = -6; k < 34; k++) {
    const i = ((hint + k) % n + n) % n;
    const a = tr.pts[i];
    const b = tr.pts[(i + 1) % n];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const l2 = vx * vx + vy * vy || 1;
    let t = ((x - a.x) * vx + (y - a.y) * vy) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + vx * t;
    const py = a.y + vy * t;
    const dx = x - px;
    const dy = y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 < best.dist) {
      const segLen = Math.sqrt(l2);
      const lat = (vx * dy - vy * dx) / segLen; // sign: left/right of travel
      best = {
        i,
        t,
        s: tr.cum[i] + t * segLen,
        lat,
        dist: d2,
      };
    }
  }
  return best;
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function pointAt(tr: Track, s: number): { x: number; y: number; ang: number } {
  const n = tr.pts.length;
  const len = tr.len;
  const sv = ((s % len) + len) % len;
  // binary-ish scan: cum is increasing so linear from a coarse step is fine
  let i = 0;
  while (i < n - 1 && tr.cum[i + 1] < sv) i += 1;
  const a = tr.pts[i];
  const b = tr.pts[(i + 1) % n];
  const segLen = tr.cum[i + 1] - tr.cum[i] || 1;
  const t = (sv - tr.cum[i]) / segLen;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    ang: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

function curvatureAt(tr: Track, s: number): number {
  const p = pointAt(tr, s);
  const q = pointAt(tr, s + 150);
  return Math.abs(wrapAngle(q.ang - p.ang));
}

function fmtLap(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "—";
  return `${sec.toFixed(3)}s`;
}

function createGame(tr: Track): RaceGame {
  const karts: Kart[] = [];
  const colors = ["#22d3ee", "#fb7185", "#facc15", "#4ade80"];
  const names = ["YOU", "APEX", "DUST", "NOVA"];
  // grid behind the line: player starts last (k = 0 → furthest back)
  for (let k = 0; k < 4; k++) {
    const back = 40 + (3 - k) * 46; // metres behind the start line
    const s = tr.len - back;
    const pos = pointAt(tr, s);
    const lat = k % 2 === 0 ? 15 : -15;
    karts.push({
      x: pos.x - Math.sin(pos.ang) * lat,
      y: pos.y + Math.cos(pos.ang) * lat,
      ang: pos.ang,
      speed: 0,
      s,
      hint: 0,
      crossings: 0,
      lapTime: 0,
      lastLap: 0,
      total: s,
      color: colors[k] ?? "#22d3ee",
      name: names[k] ?? "CPU",
    });
  }
  return { karts, countdown: 3.2, goT: 0, shake: 0, sparks: [], done: false, prevCross: 0 };
}

export default function CircuitSprint({ gameId = "circuit-sprint" }: { gameId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [track] = useState<Track>(buildTrack);
  const gameRef = useRef<RaceGame | null>(null);
  if (gameRef.current === null) gameRef.current = createGame(track);

  const [status, setStatus] = useState<Status>("idle");
  const [hudLap, setHudLap] = useState(1);
  const [hudPos, setHudPos] = useState(4);
  const [hudBest, setHudBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore(gameId, "low");
  const inputRef = useRef({ up: false, down: false, left: false, right: false });

  /* ---------------- drawing ---------------- */

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    const tr = track;
    const g = gameRef.current;
    if (!ctx || !tr || !g) return;

    const player = g.karts[0];
    if (!player) return;
    const camX = Math.max(0, Math.min(WORLD_W - W, player.x - W / 2));
    const camY = Math.max(0, Math.min(WORLD_H - H, player.y - H / 2));
    const shakeX = (Math.random() - 0.5) * g.shake;
    const shakeY = (Math.random() - 0.5) * g.shake;

    ctx.save();
    ctx.translate(-camX + shakeX, -camY + shakeY);

    // grass
    ctx.fillStyle = "#12241a";
    ctx.fillRect(camX - 20, camY - 20, W + 40, H + 40);
    ctx.fillStyle = "rgba(74,222,128,0.07)";
    for (let gx = Math.floor(camX / 96) * 96; gx < camX + W + 96; gx += 96) {
      for (let gy = Math.floor(camY / 96) * 96; gy < camY + H + 96; gy += 96) {
        ctx.fillRect(gx + 46, gy + 46, 4, 4);
      }
    }

    // asphalt + edges
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const path = new Path2D();
    tr.pts.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
    path.closePath();
    ctx.strokeStyle = "#1c2231";
    ctx.lineWidth = HALF_W * 2;
    ctx.stroke(path);
    ctx.strokeStyle = "rgba(226,232,240,0.75)";
    ctx.lineWidth = HALF_W * 2 - 8;
    ctx.stroke(path);
    ctx.strokeStyle = "#20263a";
    ctx.lineWidth = HALF_W * 2 - 12;
    ctx.stroke(path);

    // start / finish checker
    const start = tr.pts[0];
    const startAng = Math.atan2(tr.pts[1].y - start.y, tr.pts[1].x - start.x);
    ctx.save();
    ctx.translate(start.x, start.y);
    ctx.rotate(startAng);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#f8fafc" : "#0f172a";
        ctx.fillRect(-8 + r * 8, -HALF_W + c * 11, 8, 11);
      }
    }
    ctx.restore();

    // karts
    for (const k of g.karts) {
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.ang);
      ctx.shadowColor = k.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = k.color;
      ctx.beginPath();
      ctx.roundRect(-17, -10, 34, 20, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(11,11,22,0.6)";
      ctx.beginPath();
      ctx.roundRect(1, -6, 9, 12, 3);
      ctx.fill();
      ctx.fillStyle = "#0b1120";
      ctx.fillRect(-12, -12, 7, 4);
      ctx.fillRect(-12, 8, 7, 4);
      ctx.fillRect(7, -12, 7, 4);
      ctx.fillRect(7, 8, 7, 4);
      ctx.restore();
    }

    // sparks
    for (const s of g.sparks) {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.4 * s.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    /* ---- minimap ---- */
    const mapW = 108;
    const mapH = 74;
    const mx = W - mapW - 10;
    const my = 10;
    const sx = mapW / WORLD_W;
    const sy = mapH / WORLD_H;
    ctx.fillStyle = "rgba(8,11,20,0.72)";
    ctx.beginPath();
    ctx.roundRect(mx - 4, my - 4, mapW + 8, mapH + 8, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    tr.pts.forEach((p, i) => {
      const px = mx + p.x * sx;
      const py = my + p.y * sy;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
    for (const k of g.karts) {
      ctx.fillStyle = k.color;
      ctx.beginPath();
      ctx.arc(mx + k.x * sx, my + k.y * sy, k === player ? 3.4 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ---- countdown ---- */
    if (status === "playing" && g.countdown > 0) {
      const n = Math.ceil(g.countdown);
      ctx.font = "bold 84px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#f8fafc";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 24;
      ctx.fillText(String(n), W / 2, H / 2);
      ctx.shadowBlur = 0;
    } else if (g.goT > 0) {
      ctx.font = "bold 64px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = Math.min(1, g.goT * 2);
      ctx.fillStyle = "#4ade80";
      ctx.shadowColor = "#4ade80";
      ctx.shadowBlur = 24;
      ctx.fillText("GO!", W / 2, H / 2);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }, [status, track]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }, [draw]);

  /* ---------------- logic ---------------- */

  const updateKart = useCallback((k: Kart, isPlayer: boolean, dt: number, playerTotal: number) => {
    const tr = track;
    if (!tr) return;

    if (isPlayer) {
      const inp = inputRef.current;
      const steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      const near = nearest(tr, k.x, k.y, k.hint);
      k.hint = near.i;
      const onTrack = Math.abs(near.lat) < HALF_W - 6;
      const max = onTrack ? PLAYER_MAX : OFF_MAX;

      if (inp.up) k.speed += ACCEL * dt;
      if (inp.down) k.speed -= BRAKE * dt;
      k.speed -= Math.sign(k.speed) * (onTrack ? DRAG : OFF_DRAG) * dt;
      if (Math.abs(k.speed) < 4) k.speed = 0;
      k.speed = Math.max(-90, Math.min(max, k.speed));

      k.ang += steer * TURN * Math.min(1, Math.abs(k.speed) / 150) * dt * Math.sign(k.speed || 1);
    } else {
      // AI: follow the racing line, slow into corners
      const targetS = k.s + 105;
      const tp = pointAt(tr, targetS);
      const desired = Math.atan2(tp.y - k.y, tp.x - k.x);
      const diff = wrapAngle(desired - k.ang);
      const steer = Math.max(-1, Math.min(1, diff * 2.6));

      const curv = curvatureAt(tr, k.s + 40);
      const rubber = Math.max(-72, Math.min(72, (playerTotal - k.total) * 0.055));
      const targetSpeed = Math.max(150, (AI_MAX + rubber) - curv * 300);

      if (k.speed < targetSpeed) k.speed += ACCEL * 0.92 * dt;
      else k.speed -= BRAKE * 0.8 * dt;
      k.speed = Math.max(60, Math.min(AI_MAX + 40, k.speed));
      k.ang += steer * TURN * Math.min(1, k.speed / 150) * dt;
    }

    k.x += Math.cos(k.ang) * k.speed * dt;
    k.y += Math.sin(k.ang) * k.speed * dt;

    // progress + laps
    const near = nearest(tr, k.x, k.y, k.hint);
    k.hint = near.i;
    const prevS = k.s;
    k.s = near.s;
    if (prevS > tr.len * 0.75 && k.s < tr.len * 0.25) {
      k.crossings += 1;
      k.lastLap = k.lapTime;
      k.lapTime = 0;
    }
    k.lapTime += dt;
    k.total = k.crossings * tr.len + k.s;
  }, [track]);

  const step = useCallback(() => {
    const g = gameRef.current;
    const tr = track;
    if (!g || !tr || g.done) return;
    const dt = STEP / 1000;

    if (g.countdown > 0) {
      g.countdown -= dt;
      if (g.countdown <= 0) g.goT = 0.9;
      return;
    }
    g.goT = Math.max(0, g.goT - dt);

    const player = g.karts[0];
    if (!player) return;
    const playerTotal = player.total;
    for (const k of g.karts) updateKart(k, k === player, dt, playerTotal);

    // kart-on-kart shoves
    for (let i = 0; i < g.karts.length; i++) {
      for (let j = i + 1; j < g.karts.length; j++) {
        const a = g.karts[i];
        const b = g.karts[j];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 30) {
          const push = (30 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          a.speed *= 0.97;
          b.speed *= 0.97;
          g.shake = Math.max(g.shake, 4);
          if (g.sparks.length < 40) {
            g.sparks.push({
              x: (a.x + b.x) / 2,
              y: (a.y + b.y) / 2,
              life: 1,
              c: "#facc15",
            });
          }
        }
      }
    }
    g.shake = Math.max(0, g.shake - 0.4);
    for (let i = 0; i < g.sparks.length; i++) g.sparks[i].life -= 0.05;
    g.sparks = g.sparks.filter((s) => s.life > 0);

    // HUD state (only on change)
    const lap = Math.min(LAPS, Math.max(1, player.crossings));
    setHudLap((prev) => (prev === lap ? prev : lap));
    let pos = 1;
    for (const k of g.karts) if (k.total > player.total) pos += 1;
    setHudPos((prev) => (prev === pos ? prev : pos));

    // a fresh lap was completed → bank the lap time
    if (player.crossings > g.prevCross) {
      g.prevCross = player.crossings;
      const lapMs = Math.round(player.lastLap * 1000);
      setHudBest((prev) => (prev === 0 ? lapMs : Math.min(prev, lapMs)));
    }

    // finish?
    if (player.crossings >= LAPS + 1 && !g.done) {
      g.done = true;
      const lapMs = Math.round(player.lastLap * 1000);
      setNewBest(submit(lapMs));
      setStatus("over");
    }
  }, [submit, updateKart, track]);

  const start = useCallback(() => {
    const tr = track;
    if (!tr) return;
    gameRef.current = createGame(tr);
    inputRef.current.up = false;
    inputRef.current.down = false;
    inputRef.current.left = false;
    inputRef.current.right = false;
    setHudLap(1);
    setHudPos(4);
    setHudBest(0);
    setNewBest(false);
    setStatus("playing");
  }, [track]);

  // main loop
  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (t: number) => {
      const dt = Math.min(t - last, 250);
      last = t;
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        step();
      }
      draw();
      const g = gameRef.current;
      if (g && g.done) return;
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, step, draw]);

  useEffect(() => {
    if (status !== "playing") draw();
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const MAP: Record<string, keyof typeof inputRef.current> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const field = MAP[k];
      if (field) {
        e.preventDefault();
        inputRef.current[field] = true;
        return;
      }
      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (status !== "playing") start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const field = MAP[k];
      if (field) inputRef.current[field] = false;
    };
    const onBlur = () => {
      inputRef.current.up = false;
      inputRef.current.down = false;
      inputRef.current.left = false;
      inputRef.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [status, start]);

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[600px]">
      <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted">
        <span>
          Lap <b className="ml-1 text-sm text-ink">{hudLap}/{LAPS}</b>
        </span>
        <span>
          Position <b className="ml-1 text-sm text-ink">P{hudPos}/4</b>
        </span>
        <span className="text-warn">
          Best lap <b className="ml-1 text-sm text-ink">{best ? fmtLap(best / 1000) : "—"}</b>
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(56,189,248,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full [touch-action:none]"
          aria-label="Circuit Sprint top-down kart race"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">CIRCUIT SPRINT</p>
            <p className="mt-2 text-sm text-muted">
              Three laps against three rivals on a chicane-laced circuit. Chase the
              racing line — the clock remembers every corner.
            </p>
            <PrimaryButton onClick={start} tone="from-sky-400 via-blue-500 to-indigo-600">
              Lights out
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ↑ throttle · ↓ brake / reverse · ←→ steer · grass is slow
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-sky-300">CHEQUERED FLAG</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best lap!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">P{hudPos}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Finished · best lap {fmtLap(hudBest / 1000)} · record{" "}
              {best ? fmtLap(best / 1000) : "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-sky-400 via-blue-500 to-indigo-600">
              Race again
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        ↑↓←→ / WASD to drive · stay off the grass · the AI rubber-bands, so never relax
      </p>
    </div>
  );
}
