"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBestScore, useStored } from "@/lib/storage";
import { GameHud, Overlay, PrimaryButton } from "./parts";

const W = 460;
const H = 400;
const PW = 88;
const PH = 12;
const R = 8;
const PLAYER_Y = H - 34;
const AI_Y = 20;
const START_SPEED = 5.2;
const MAX_SPEED = 9.6;
const GROWTH = 0.16;
const AI_SPEED = 4.7;
const WIN = 7;

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
}

interface Game {
  px: number;
  ax: number;
  ball: Ball;
  rally: number;
  serveDir: 1 | -1;
  serving: boolean;
  pScore: number;
  aScore: number;
  aiErr: number;
}

interface Series {
  you: number;
  cpu: number;
}

/* ------------------------------------------------------------------ */
/* Module-level helpers                                                */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function createGame(): Game {
  return {
    px: (W - PW) / 2,
    ax: (W - PW) / 2,
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: START_SPEED },
    rally: 0,
    serveDir: -1,
    serving: true,
    pScore: 0,
    aScore: 0,
    aiErr: 0,
  };
}

/** Angle comes from *where* the ball lands on the blade; pace grows per rally hit. */
function bounce(g: Game, paddleX: number, upward: boolean): void {
  const offset = clamp((g.ball.x - (paddleX + PW / 2)) / (PW / 2), -1, 1);
  const angle = offset * (Math.PI / 3.1);
  g.rally += 1;
  g.ball.speed = Math.min(MAX_SPEED, START_SPEED + g.rally * GROWTH);
  const s = g.ball.speed;
  g.ball.vx = Math.sin(angle) * s;
  const vy = Math.cos(angle) * s;
  g.ball.vy = upward ? -vy : vy;
  if (Math.abs(g.ball.vy) < 1.7) g.ball.vy = g.ball.vy < 0 ? -1.7 : 1.7;
}

function drawScene(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.fillStyle = "#0b0b16";
  ctx.fillRect(0, 0, W, H);

  // court markings
  ctx.strokeStyle = "rgba(139,92,246,0.35)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 8);
  ctx.lineTo(W / 2, H - 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(34,211,238,0.25)";
  ctx.strokeRect(6, 6, W - 12, H - 12);

  // ghost scoreline
  ctx.textAlign = "center";
  ctx.font = "700 44px ui-monospace, monospace";
  ctx.fillStyle = "rgba(103,232,249,0.16)";
  ctx.fillText(String(g.pScore), W / 2 - 58, 60);
  ctx.fillStyle = "rgba(251,113,133,0.16)";
  ctx.fillText(String(g.aScore), W / 2 + 58, 60);

  // paddles
  ctx.save();
  ctx.shadowColor = "#22d3ee";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#67e8f9";
  ctx.beginPath();
  ctx.roundRect(g.px, PLAYER_Y, PW, PH, 6);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "#fb7185";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#fb7185";
  ctx.beginPath();
  ctx.roundRect(g.ax, AI_Y, PW, PH, 6);
  ctx.fill();
  ctx.restore();

  // ball
  ctx.save();
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(g.ball.x, g.ball.y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function VolleyPong({ gameId }: { gameId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  if (gameRef.current === null) gameRef.current = createGame();

  const [status, setStatus] = useState<"idle" | "playing" | "over">("idle");
  const [pts, setPts] = useState({ you: 0, ai: 0, rally: 0 });
  const [serving, setServing] = useState(true);
  const [result, setResult] = useState<"win" | "lose">("lose");
  const [newBest, setNewBest] = useState(false);
  const [series, setSeries] = useStored<Series>(`series:${gameId}`, {
    you: 0,
    cpu: 0,
  });
  const { best, submit } = useBestScore(gameId, "high");

  const aim = useRef<number | null>(null);
  const keys = useRef({ left: false, right: false });

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    drawScene(ctx, g);
  }, []);

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

  const start = useCallback(() => {
    gameRef.current = createGame();
    aim.current = null;
    keys.current.left = false;
    keys.current.right = false;
    setPts({ you: 0, ai: 0, rally: 0 });
    setServing(true);
    setNewBest(false);
    setStatus("playing");
  }, []);

  const serve = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.serving) return;
    g.serving = false;
    setServing(false);
    g.rally = 0;
    g.ball.speed = START_SPEED;
    const tilt = (Math.random() - 0.5) * 0.7;
    g.ball.x = W / 2;
    g.ball.y = H / 2;
    g.ball.vx = Math.sin(tilt) * g.ball.speed;
    g.ball.vy = Math.cos(tilt) * g.ball.speed * g.serveDir;
    setPts({ you: g.pScore, ai: g.aScore, rally: 0 });
  }, []);

  /* ---------------- simulation ---------------- */

  const tick = useCallback(
    (f: number): boolean => {
      const g = gameRef.current;
      if (!g) return false;

      // player blade: keys override the pointer, both clamp to the court
      const dir = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
      if (dir !== 0) {
        aim.current = null;
        g.px = clamp(g.px + dir * 17 * f, 0, W - PW);
      } else if (aim.current !== null) {
        const target = clamp(aim.current - PW / 2, 0, W - PW);
        g.px += (target - g.px) * Math.min(1, 0.5 * f);
      }

      // AI blade: reads the ball, capped speed, a little human error
      const tracking = !g.serving && g.ball.vy < 0;
      const target = tracking ? g.ball.x + g.aiErr : W / 2 + (g.ball.x - W / 2) * 0.3;
      const step = clamp(target - (g.ax + PW / 2), -AI_SPEED * f, AI_SPEED * f);
      g.ax = clamp(g.ax + step, 0, W - PW);

      if (g.serving) {
        g.ball.x = W / 2;
        g.ball.y = H / 2;
        return true;
      }

      g.ball.x += g.ball.vx * f;
      g.ball.y += g.ball.vy * f;

      if (g.ball.x < R) {
        g.ball.x = R;
        g.ball.vx = Math.abs(g.ball.vx);
      } else if (g.ball.x > W - R) {
        g.ball.x = W - R;
        g.ball.vx = -Math.abs(g.ball.vx);
      }

      // your blade
      if (
        g.ball.vy > 0 &&
        g.ball.y + R >= PLAYER_Y &&
        g.ball.y - R <= PLAYER_Y + PH &&
        g.ball.x >= g.px - R &&
        g.ball.x <= g.px + PW + R
      ) {
        g.ball.y = PLAYER_Y - R;
        bounce(g, g.px, true);
        setPts({ you: g.pScore, ai: g.aScore, rally: g.rally });
      }

      // their blade
      if (
        g.ball.vy < 0 &&
        g.ball.y - R <= AI_Y + PH &&
        g.ball.y + R >= AI_Y &&
        g.ball.x >= g.ax - R &&
        g.ball.x <= g.ax + PW + R
      ) {
        g.ball.y = AI_Y + PH + R;
        bounce(g, g.ax, false);
        setPts({ you: g.pScore, ai: g.aScore, rally: g.rally });
      }

      // point scored
      if (g.ball.y - R > H || g.ball.y + R < 0) {
        const playerScored = g.ball.y + R < 0;
        if (playerScored) g.pScore += 1;
        else g.aScore += 1;
        setPts({ you: g.pScore, ai: g.aScore, rally: 0 });

        if (g.pScore >= WIN || g.aScore >= WIN) {
          const youWon = g.pScore >= WIN;
          const nextYou = series.you + (youWon ? 1 : 0);
          setSeries((s) => ({
            you: s.you + (youWon ? 1 : 0),
            cpu: s.cpu + (youWon ? 0 : 1),
          }));
          setNewBest(submit(nextYou));
          setResult(youWon ? "win" : "lose");
          setStatus("over");
          return false;
        }

        g.serving = true;
        setServing(true);
        g.serveDir = playerScored ? -1 : 1; // the side that conceded receives
        g.aiErr = (Math.random() - 0.5) * 110;
        g.ball.speed = START_SPEED;
        g.ball.x = W / 2;
        g.ball.y = H / 2;
      }

      return true;
    },
    [series.you, setSeries, submit],
  );

  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const f = Math.min((t - last) / 16.667, 2.4);
      last = t;
      if (!tick(f)) {
        draw();
        return;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, tick, draw]);

  useEffect(() => {
    if (status !== "playing") draw();
  }, [status, draw]);

  /* ---------------- input ---------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === " " || key.startsWith("arrow")) e.preventDefault();
      if (key === "arrowleft" || key === "a") keys.current.left = true;
      else if (key === "arrowright" || key === "d") keys.current.right = true;
      else if (key === " ") {
        if (status !== "playing") start();
        else serve();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "a") keys.current.left = false;
      else if (key === "arrowright" || key === "d") keys.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, start, serve]);

  const pointX = (clientX: number, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * W;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const x = pointX(e.clientX, e.currentTarget);
    aim.current = x;
    if (status !== "playing") start();
    else serve();
  };

  /* ---------------- view ---------------- */

  return (
    <div className="w-full max-w-[520px]">
      <GameHud score={`${pts.you} – ${pts.ai}`} best={best ?? "—"}>
        <span className="text-cyan-400">
          Series <b className="ml-1 text-sm text-ink">{series.you}</b>
        </span>
        <span className="text-rose-400">
          CPU <b className="ml-1 text-sm text-ink">{series.cpu}</b>
        </span>
        <span className="text-accent">
          Rally <b className="ml-1 text-sm text-ink">{pts.rally}</b>
        </span>
      </GameHud>

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_0_60px_-22px_rgba(34,211,238,0.85)]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          onPointerMove={(e) => {
            aim.current = pointX(e.clientX, e.currentTarget);
          }}
          onPointerDown={onPointerDown}
          aria-label="Volley Pong court"
        />

        {status === "playing" && serving && (
          <div className="pointer-events-none absolute inset-x-0 top-[46%] grid place-items-center">
            <span className="animate-pop rounded-full border border-white/25 bg-black/70 px-5 py-2 font-display text-sm font-bold tracking-[0.25em] text-white backdrop-blur">
              SPACE OR TAP TO SERVE
            </span>
          </div>
        )}

        {status === "idle" && (
          <Overlay>
            <p className="font-display text-2xl font-bold text-white">VOLLEY PONG</p>
            <p className="mt-2 text-sm text-muted">
              Edge-of-the-blade angles, one stubborn CPU, first to 7.
            </p>
            <p className="mt-1 text-xs text-muted">
              The ball creeps faster with every rally hit
            </p>
            <PrimaryButton onClick={start} tone="from-violet-500 via-purple-500 to-fuchsia-500">
              Start match
            </PrimaryButton>
            <p className="mt-3 text-xs text-muted">
              Mouse / finger / ← → to move · Space or tap to serve
            </p>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay>
            <p
              className={`font-display text-2xl font-bold ${
                result === "win" ? "text-success" : "text-rose-400"
              }`}
            >
              {result === "win" ? "MATCH WON" : "MATCH LOST"}
            </p>
            {newBest && (
              <p className="animate-pop mt-2 rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warn">
                ✦ New best score!
              </p>
            )}
            <p className="mt-3 font-mono text-4xl font-bold text-white">
              {pts.you} – {pts.ai}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted">
              Games won {best ?? "—"}
            </p>
            <PrimaryButton onClick={start} tone="from-violet-500 via-purple-500 to-fuchsia-500">
              Rematch
            </PrimaryButton>
          </Overlay>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Hit the blade edges for steep angles · the CPU always has a tell
      </p>
    </div>
  );
}
