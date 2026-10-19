"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 640;
const H = 480;
const STEP = 1000 / 60;
const TAU = Math.PI * 2;

const SLED_Y = H - 118; // the sled never moves on screen; the world scrolls
const AHEAD = 1500; // metres of world kept ahead of the sled

type Status = "idle" | "playing" | "over";
type ObsKind = "pine" | "rock" | "camp";

interface Obs {
  d: number; // world distance
  x: number;
  kind: ObsKind;
  r: number;
}

interface Gap {
  d0: number; // chasm start
  d1: number; // chasm end
  rampX: number;
  done: boolean; // jumped (or fallen into) already
}

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: string;
  r: number;
}

interface G {
  x: number;
  s: number;
  speed: number;
  air: boolean;
  airGap: number;
  invuln: number;
  bonus: number;
  obs: Obs[];
  gaps: Gap[];
  nextThing: number;
  nextGap: number;
  parts: Part[];
  shake: number;
  flash: number;
  toast: string;
  toastT: number;
  hudAcc: number;
  lastScore: number;
  alive: true | false;
}

function createGame(): G {
  return {
    x: W / 2,
    s: 0,
    speed: 215,
    air: false,
    airGap: -1,
    invuln: 0,
    bonus: 0,
    obs: [],
    gaps: [],
    nextThing: 320,
    nextGap: 1400,
    parts: [],
    shake: 0,
    flash: 0,
    toast: "",
    toastT: 0,
    hudAcc: 0,
    lastScore: 0,
    alive: true,
  };
}

/* ---------------- drawing helpers ---------------- */

function drawPine(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.fillStyle = "rgba(15,40,60,0.25)";
  ctx.beginPath();
  ctx.ellipse(3, 4, 15, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#7c4a1e";
  ctx.fillRect(-2.5, -8, 5, 12);
  ctx.fillStyle = "#0f5c46";
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(14, -8);
  ctx.lineTo(-14, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#137a5b";
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(11, -2);
  ctx.lineTo(-11, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(240,253,250,0.85)";
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(6, -22);
  ctx.lineTo(-6, -22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.fillStyle = "rgba(15,40,60,0.22)";
  ctx.beginPath();
  ctx.ellipse(2, 4, 16, 6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#64748b";
  ctx.beginPath();
  ctx.moveTo(-15, 2);
  ctx.lineTo(-10, -12);
  ctx.lineTo(2, -17);
  ctx.lineTo(14, -8);
  ctx.lineTo(13, 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(-10, -12);
  ctx.lineTo(2, -17);
  ctx.lineTo(6, -8);
  ctx.lineTo(-6, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(240,253,250,0.8)";
  ctx.beginPath();
  ctx.ellipse(1, -14, 7, 3.4, -0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawCamp(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.fillStyle = "rgba(15,40,60,0.25)";
  ctx.beginPath();
  ctx.ellipse(2, 4, 20, 6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(19, 4);
  ctx.lineTo(-19, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#c2410c";
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(19, 4);
  ctx.lineTo(6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3f2716";
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(7, 4);
  ctx.lineTo(-7, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRamp(ctx: CanvasRenderingContext2D, x: number, y: number, half: number) {
  ctx.save();
  ctx.translate(x, y);
  const grd = ctx.createLinearGradient(0, 16, 0, -20);
  grd.addColorStop(0, "#b45309");
  grd.addColorStop(1, "#fbbf24");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(-half, 16);
  ctx.lineTo(half, 16);
  ctx.lineTo(half - 9, -18);
  ctx.lineTo(-half + 9, -18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(120,53,15,0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();
  // chevrons
  ctx.strokeStyle = "rgba(69,26,3,0.75)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) {
    const yy = 4 - i * 11;
    ctx.beginPath();
    ctx.moveTo(-half + 12, yy + 5);
    ctx.lineTo(0, yy - 3);
    ctx.lineTo(half - 12, yy + 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSled(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lean: number,
  air: boolean,
  t: number,
) {
  const sc = air ? 1.14 : 1;
  ctx.save();
  ctx.translate(x, y + (air ? -6 + Math.sin(t * 0.012) * 2 : 0));
  ctx.rotate(lean * 0.16);
  ctx.scale(sc, sc);

  // shadow
  ctx.fillStyle = air ? "rgba(15,40,60,0.14)" : "rgba(15,40,60,0.3)";
  ctx.beginPath();
  ctx.ellipse(2, air ? 16 : 8, 15, air ? 5 : 6, 0, 0, TAU);
  ctx.fill();

  // runners
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-8, 6);
  ctx.lineTo(-8, -6);
  ctx.moveTo(8, 6);
  ctx.lineTo(8, -6);
  ctx.stroke();
  // deck
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.roundRect(-12, -8, 24, 14, 4);
  ctx.fill();
  ctx.fillStyle = "#fecaca";
  ctx.fillRect(-12, -3, 24, 3);
  // rider
  ctx.fillStyle = "#0f766e";
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 14, 5);
  ctx.fill();
  ctx.fillStyle = "#fcd34d";
  ctx.beginPath();
  ctx.arc(0, -24, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#78350f";
  ctx.beginPath();
  ctx.arc(0, -26, 6, Math.PI, TAU);
  ctx.fill();
  ctx.restore();
}

/* ---------------- component ---------------- */

export default function SnowSled() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<G | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, submit } = useBestScore("snow-sled", "high");
  const inputRef = useRef({ left: false, right: false });

  /* ---------------- drawing ---------------- */

  const draw = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    const s = g.s;

    /* snow field */
    const snow = ctx.createLinearGradient(0, 0, 0, H);
    snow.addColorStop(0, "#dbeafe");
    snow.addColorStop(1, "#f0fdfa");
    ctx.fillStyle = snow;
    ctx.fillRect(0, 0, W, H);

    // wind-blown drift texture (deterministic, scrolls with the world)
    ctx.strokeStyle = "rgba(148,163,184,0.22)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) {
      const band = i * 61;
      const sy = SLED_Y - (((band + s * 0.9) % (H + 120)) - 60);
      const sx = ((i * 137 + Math.floor((band + s * 0.9) / (H + 120)) * 71) % (W + 80)) - 40;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + 26, sy - 6, sx + 54, sy);
      ctx.stroke();
    }

    const shakeX = Math.sin(time * 0.014) * g.shake;
    ctx.save();
    ctx.translate(shakeX, 0);

    /* chasms */
    for (const gap of g.gaps) {
      const y0 = SLED_Y - (gap.d0 - s);
      const y1 = SLED_Y - (gap.d1 - s);
      if (y1 > H + 40 || y0 < -40) continue;
      const grd = ctx.createLinearGradient(0, y1, 0, y0);
      grd.addColorStop(0, "#0c4a6e");
      grd.addColorStop(1, "#082f49");
      ctx.fillStyle = grd;
      ctx.fillRect(26, y1, W - 52, y0 - y1);
      // icy lips
      ctx.fillStyle = "#ecfeff";
      ctx.fillRect(26, y1 - 6, W - 52, 6);
      ctx.fillRect(26, y0, W - 52, 6);
      ctx.strokeStyle = "#67e8f9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(26, y0);
      ctx.lineTo(W - 26, y0);
      ctx.stroke();
      // frozen cracks
      ctx.strokeStyle = "rgba(125,211,252,0.35)";
      ctx.lineWidth = 1;
      for (let c = 0; c < 5; c++) {
        const cx = 60 + c * 110;
        ctx.beginPath();
        ctx.moveTo(cx, y1 + 4);
        ctx.lineTo(cx + 14, (y0 + y1) / 2);
        ctx.lineTo(cx - 6, y0 - 4);
        ctx.stroke();
      }
    }

    /* ramps */
    for (const gap of g.gaps) {
      const sy = SLED_Y - (gap.d0 + 34 - s);
      if (sy < -60 || sy > H + 60) continue;
      drawRamp(ctx, gap.rampX, sy, 54);
    }

    /* snow banks / trail markers on the sides */
    for (let i = Math.floor(s / 90); i < Math.floor((s + AHEAD) / 90); i++) {
      const d = i * 90;
      const sy = SLED_Y - (d - s);
      if (sy < -40 || sy > H + 40) continue;
      const wob = Math.sin(i * 2.3) * 10;
      ctx.fillStyle = "rgba(203,213,225,0.9)";
      ctx.beginPath();
      ctx.roundRect(2 + wob, sy - 8, 22, 16, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(W - 24 - wob, sy - 8, 22, 16, 8);
      ctx.fill();
      if (i % 3 === 0) {
        // marker poles
        ctx.fillStyle = "#0ea5e9";
        ctx.fillRect(12 + wob, sy - 26, 3, 20);
        ctx.fillRect(W - 15 - wob, sy - 26, 3, 20);
      }
    }

    /* obstacles (far → near) */
    for (let i = g.obs.length - 1; i >= 0; i--) {
      const o = g.obs[i];
      const sy = SLED_Y - (o.d - s);
      if (sy < -50 || sy > H + 50) continue;
      const sc = 1 + Math.max(0, (sy - SLED_Y + 200) / 900);
      if (o.kind === "pine") drawPine(ctx, o.x, sy, sc);
      else if (o.kind === "rock") drawRock(ctx, o.x, sy, sc);
      else drawCamp(ctx, o.x, sy, sc);
    }

    /* sled tracks */
    if (!g.air) {
      ctx.strokeStyle = "rgba(148,163,184,0.5)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(g.x - 8, SLED_Y + 10);
      ctx.lineTo(g.x - 8 - (inputRef.current.left ? 6 : 0), SLED_Y + 70);
      ctx.moveTo(g.x + 8, SLED_Y + 10);
      ctx.lineTo(g.x + 8 + (inputRef.current.right ? 6 : 0), SLED_Y + 70);
      ctx.stroke();
    }

    /* particles */
    for (const pt of g.parts) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.c;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* invulnerability shimmer */
    if (g.invuln > 0) {
      ctx.strokeStyle = `rgba(34,211,238,${0.35 + Math.sin(time * 0.03) * 0.2})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x, SLED_Y - 8, 34, 0, TAU);
      ctx.stroke();
    }

    /* sled */
    drawSled(
      ctx,
      g.x,
      SLED_Y,
      (inputRef.current.right ? 1 : 0) - (inputRef.current.left ? 1 : 0),
      g.air,
      time,
    );

    ctx.restore();

    /* speed streaks */
    if (g.speed > 260 && !g.air) {
      ctx.globalAlpha = Math.min(0.5, (g.speed - 260) / 240);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const sx = 40 + ((i * 83 + Math.floor(s * 0.8)) % (W - 80));
        const sy = (i * 97 + Math.floor(s * 2.2)) % H;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + 26);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    /* toast */
    if (g.toastT > 0) {
      const a = Math.min(1, g.toastT * 2);
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.font = "bold 22px ui-monospace, monospace";
      ctx.fillStyle = "#fde68a";
      ctx.shadowColor = "#0ea5e9";
      ctx.shadowBlur = 14;
      ctx.fillText(g.toast, W / 2, 76 - (1 - a) * 10);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    }

    /* speed readout */
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(W - 128, H - 40, 112, 26, 8);
    ctx.fill();
    ctx.font = "bold 11px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "#ecfeff";
    ctx.fillText(`${Math.round(g.speed * 0.42)} KM/H`, W - 32, H - 22);
    ctx.textAlign = "left";

    /* wipeout flash */
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(14,165,233,${Math.min(0.55, g.flash * 0.55)})`;
      ctx.fillRect(0, 0, W, H);
      if (!g.alive) {
        ctx.font = "54px serif";
        ctx.textAlign = "center";
        ctx.fillText("❄️", W / 2, H / 2);
        ctx.textAlign = "left";
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

  /* ---------------- transitions ---------------- */

  const gameOver = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.alive) return;
    g.alive = false;
    g.shake = 14;
    g.flash = 1;
    for (let i = 0; i < 28; i++) {
      const ang = Math.random() * TAU;
      const sp = 50 + Math.random() * 220;
      g.parts.push({
        x: g.x,
        y: SLED_Y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        life: 0.5 + Math.random() * 0.6,
        max: 1.1,
        c: i % 2 === 0 ? "#ffffff" : "#bae6fd",
        r: 2 + Math.random() * 3.5,
      });
    }
    const final = Math.max(0, Math.floor(g.s / 12) + g.bonus);
    setScore(final);
    setNewBest(submit(final));
    setStatus("over");
    draw(performance.now());
  }, [draw, submit]);

  const start = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setNewBest(false);
    setStatus("playing");
  }, []);

  // main loop — all mutable game logic runs inline here (react-compiler safe)
  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      const frame = Math.min(t - last, 250);
      last = t;
      acc += frame;
      while (acc >= STEP) {
        acc -= STEP;
        const g = gameRef.current;
        if (!g || !g.alive) break;
        const dt = STEP / 1000;
        const k = inputRef.current;

        /* speed climbs the longer the run holds */
        g.speed = 215 + Math.min(255, g.s * 0.018);
        g.s += g.speed * dt;

        /* steering */
        const steer = (k.right ? 1 : 0) - (k.left ? 1 : 0);
        g.x += steer * (300 + (g.air ? 60 : 0)) * dt;
        if (g.x < 44) g.x = 44;
        if (g.x > W - 44) g.x = W - 44;

        /* spawn the world */
        while (g.nextThing < g.s + AHEAD) {
          if (g.nextGap < g.s + 320) g.nextGap = g.s + 1100;
          if (g.nextThing > g.nextGap - 260) {
            // ramp + chasm pair
            const rampX = 150 + Math.random() * (W - 300);
            g.gaps.push({ d0: g.nextGap, d1: g.nextGap + 220, rampX, done: false });
            g.nextThing = g.nextGap + 260;
            g.nextGap += 1100 + Math.random() * 700;
          } else {
            const roll = Math.random();
            const kind: ObsKind = roll < 0.5 ? "pine" : roll < 0.85 ? "rock" : "camp";
            g.obs.push({
              d: g.nextThing,
              x: 62 + Math.random() * (W - 124),
              kind,
              r: kind === "pine" ? 15 : kind === "rock" ? 16 : 21,
            });
            g.nextThing += 130 - Math.min(70, g.s * 0.004) + Math.random() * 90;
          }
        }

        /* gap jumps */
        for (let i = 0; i < g.gaps.length; i++) {
          const gap = g.gaps[i];
          if (gap.done) continue;
          if (!g.air && g.s >= gap.d0 - 8) {
            if (Math.abs(g.x - gap.rampX) <= 62) {
              g.air = true;
              g.airGap = gap.d0;
              g.invuln = 1;
              g.shake = Math.max(g.shake, 5);
            } else {
              // rode straight past the kicker into the chasm
              gameOver();
              break;
            }
          }
          if (g.air && g.airGap === gap.d0 && g.s >= gap.d1) {
            gap.done = true;
            g.air = false;
            g.airGap = -1;
            g.bonus += 40;
            g.toast = "GAP JUMP  +40";
            g.toastT = 1.2;
            g.shake = Math.max(g.shake, 6);
            for (let sp = 0; sp < 14; sp++) {
              g.parts.push({
                x: g.x + (Math.random() - 0.5) * 40,
                y: SLED_Y + 6,
                vx: (Math.random() - 0.5) * 200,
                vy: -40 - Math.random() * 110,
                life: 0.5,
                max: 0.5,
                c: "#ffffff",
                r: 2 + Math.random() * 3,
              });
            }
          }
        }
        if (!g.alive) break;

        /* obstacle collisions */
        if (!g.air && g.invuln <= 0) {
          for (const o of g.obs) {
            const dd = o.d - g.s;
            if (dd > 40) break;
            if (dd < -40) continue;
            if (Math.abs(g.x - o.x) < o.r + 11) {
              gameOver();
              break;
            }
          }
        }
        if (!g.alive) break;

        /* snow spray off the runners */
        if (!g.air && (steer !== 0 || Math.random() < 0.5)) {
          g.parts.push({
            x: g.x + (Math.random() - 0.5) * 18,
            y: SLED_Y + 10,
            vx: steer * 90 + (Math.random() - 0.5) * 60,
            vy: 40 + Math.random() * 70,
            life: 0.4,
            max: 0.4,
            c: "rgba(255,255,255,0.9)",
            r: 1.4 + Math.random() * 2.4,
          });
        }

        /* particles + decay */
        for (const pt of g.parts) {
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.vy += 60 * dt;
          pt.life -= dt;
        }
        if (g.parts.length > 200) g.parts.splice(0, g.parts.length - 200);
        g.parts = g.parts.filter((pt) => pt.life > 0);
        if (g.invuln > 0) g.invuln -= dt;
        g.shake = Math.max(0, g.shake - 0.4);
        g.flash = Math.max(0, g.flash - dt * 1.9);
        g.toastT = Math.max(0, g.toastT - dt);

        /* trim the world behind us */
        while (g.obs.length > 0 && g.obs[0].d < g.s - 260) g.obs.shift();
        while (g.gaps.length > 0 && g.gaps[0].d1 < g.s - 260) g.gaps.shift();

        /* throttled HUD sync */
        g.hudAcc += STEP;
        if (g.hudAcc >= 90) {
          g.hudAcc = 0;
          const sc = Math.max(0, Math.floor(g.s / 12) + g.bonus);
          if (sc !== g.lastScore) {
            g.lastScore = sc;
            setScore(sc);
          }
        }
      }
      draw(t);
      const g = gameRef.current;
      if (g && !g.alive) return;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, draw, gameOver]);

  useEffect(() => {
    if (status !== "playing") draw(performance.now());
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const set = (code: string, v: boolean) => {
      const k = inputRef.current;
      if (code === "ArrowLeft" || code === "KeyA") k.left = v;
      if (code === "ArrowRight" || code === "KeyD") k.right = v;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if ((e.code === "Space" || e.code === "Enter") && status !== "playing") {
        start();
        return;
      }
      set(e.code, true);
    };
    const onKeyUp = (e: KeyboardEvent) => set(e.code, false);
    const onBlur = () => {
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

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "playing") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const left = e.clientX - rect.left < rect.width / 2;
    inputRef.current.left = left;
    inputRef.current.right = !left;
  };
  const clearPointer = () => {
    inputRef.current.left = false;
    inputRef.current.right = false;
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[680px]">
      <GameHud score={score} best={best ?? "—"} />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(20,184,166,0.9)]">
        <canvas
          ref={canvasRef}
          className="block w-full max-w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerUp={clearPointer}
          onPointerCancel={clearPointer}
          onPointerLeave={clearPointer}
          aria-label="Snow Sled downhill run"
        />

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">SNOW SLED</p>
            <p className="mt-2 text-sm text-muted">
              One rider, one sled, and a mountain that keeps getting faster. Weave the
              pines, dodge the rocks, and hit every amber kicker straight — the chasms
              only close behind you.
            </p>
            <PrimaryButton onClick={start} tone="from-teal-400 via-emerald-500 to-green-600">
              Push off
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              ← → steer · touch left / right half · speed climbs on its own
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-sky-300">SPLASHED OUT</p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">{score}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {score} pts · Best {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-teal-400 via-emerald-500 to-green-600">
              Fresh snow
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">Space / Enter to retry</p>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Kickers clear the chasm for +40 · miss one and the cold does the rest
      </p>
    </div>
  );
}
