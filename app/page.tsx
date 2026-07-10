"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Pig = {
  id: number;
  x: number;
  y: number;
  vx: number;
  bob: number;
  size: number;
  caught: boolean;
  color: string;
};

type GameState = "ready" | "playing" | "won" | "lost";

const W = 960;
const H = 600;
const WATER_TOP = 238;
const TARGET = 8;
const SAFE_PLATFORM_X = 792;
const SAFE_PLATFORM_Y = 348;
const DOWNSTREAM_EXIT_X = 760;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const stateRef = useRef<GameState>("ready");
  const scoreRef = useRef(0);
  const rescuedRef = useRef(0);
  const livesRef = useRef(3);
  const timeRef = useRef(60);
  const comboRef = useRef(0);
  const pigsRef = useRef<Pig[]>([]);
  const spawnRef = useRef(0);
  const gripUntilRef = useRef(0);
  const lastHudSecondRef = useRef(60);
  const nextIdRef = useRef(1);
  const heldPigRef = useRef<number | null>(null);
  const pigImageRef = useRef<HTMLImageElement | null>(null);
  const clawRef = useRef({ x: 490, y: 330, closed: false, angle: 0 });
  const keysRef = useRef(new Set<string>());
  const [gameState, setGameState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [rescued, setRescued] = useState(0);
  const [lives, setLives] = useState(3);
  const [time, setTime] = useState(60);
  const [combo, setCombo] = useState(0);

  const syncHud = useCallback(() => {
    setScore(scoreRef.current);
    setRescued(rescuedRef.current);
    setLives(livesRef.current);
    setTime(Math.ceil(timeRef.current));
    setCombo(comboRef.current);
  }, []);

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    rescuedRef.current = 0;
    livesRef.current = 3;
    timeRef.current = 60;
    comboRef.current = 0;
    pigsRef.current = [{
      id: nextIdRef.current++,
      x: 230,
      y: 390,
      vx: 24,
      bob: 0,
      size: 40,
      caught: false,
      color: "#f4aaa4",
    }];
    spawnRef.current = 1.8;
    heldPigRef.current = null;
    gripUntilRef.current = 0;
    lastHudSecondRef.current = 60;
    clawRef.current = { x: 490, y: 330, closed: false, angle: 0 };
    stateRef.current = "playing";
    setGameState("playing");
    syncHud();
  }, [syncHud]);

  const setClawFromPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    clawRef.current.x = clamp(((clientX - rect.left) / rect.width) * W, 170, 870);
    clawRef.current.y = clamp(((clientY - rect.top) / rect.height) * H, 245, 505);
  }, []);

  const clawOverSafePlatform = useCallback(() => {
    const claw = clawRef.current;
    return claw.x >= SAFE_PLATFORM_X && claw.y <= SAFE_PLATFORM_Y;
  }, []);

  const attemptGrip = useCallback(() => {
    if (stateRef.current !== "playing" || heldPigRef.current !== null) return;
    const claw = clawRef.current;
    const pig = pigsRef.current.find((candidate) =>
      !candidate.caught && Math.hypot(candidate.x - claw.x, candidate.y - claw.y) < candidate.size + 48,
    );
    if (!pig) return;
    pig.caught = true;
    heldPigRef.current = pig.id;
  }, []);

  const releaseGrip = useCallback(() => {
    gripUntilRef.current = 0;
    const heldId = heldPigRef.current;
    if (heldId === null) {
      clawRef.current.closed = false;
      return;
    }
    const pig = pigsRef.current.find((candidate) => candidate.id === heldId);
    if (!pig) return;

    if (clawOverSafePlatform()) {
      clawRef.current.closed = false;
      heldPigRef.current = null;
      pigsRef.current = pigsRef.current.filter((candidate) => candidate.id !== heldId);
      rescuedRef.current += 1;
      comboRef.current += 1;
      scoreRef.current += 150 + Math.min(comboRef.current - 1, 5) * 35;
      syncHud();
    } else {
      clawRef.current.closed = true;
    }
  }, [clawOverSafePlatform, syncHud]);

  useEffect(() => {
    const image = new Image();
    image.src = "/pig.png";
    image.onload = () => {
      pigImageRef.current = image;
    };
    return () => {
      pigImageRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "a", "d", "w", "s"].includes(key)) {
        event.preventDefault();
      }
      if ((key === " " || key === "enter") && stateRef.current !== "playing") {
        resetGame();
        return;
      }
      keysRef.current.add(key);
      if (key === " ") {
        clawRef.current.closed = true;
        attemptGrip();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keysRef.current.delete(key);
      if (key === " ") releaseGrip();
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [attemptGrip, releaseGrip, resetGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawPig = (pig: Pig, now: number) => {
      const bob = Math.sin(now / 330 + pig.bob) * 5;
      const x = pig.x;
      const y = pig.y + bob;
      ctx.save();
      ctx.translate(x, y);
      if (pig.caught) ctx.rotate(-0.08);
      ctx.fillStyle = "rgba(10, 52, 61, .24)";
      ctx.beginPath();
      ctx.ellipse(0, pig.size * 0.52, pig.size * 1.05, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      if (pigImageRef.current) {
        const width = pig.size * 3.15;
        const height = pig.size * 2.1;
        ctx.drawImage(pigImageRef.current, -width / 2, -height / 2, width, height);
      } else {
        ctx.fillStyle = pig.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, pig.size * 1.25, pig.size * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const draw = (now: number) => {
      const delta = Math.min((now - (lastRef.current || now)) / 1000, 0.034);
      lastRef.current = now;
      const state = stateRef.current;
      const claw = clawRef.current;

      if (state === "playing") {
        const keys = keysRef.current;
        const speed = 270 * delta;
        if (keys.has("arrowleft") || keys.has("a")) claw.x -= speed;
        if (keys.has("arrowright") || keys.has("d")) claw.x += speed;
        if (keys.has("arrowup") || keys.has("w")) claw.y -= speed;
        if (keys.has("arrowdown") || keys.has("s")) claw.y += speed;
        claw.x = clamp(claw.x, 170, 870);
        claw.y = clamp(claw.y, 245, 505);
        claw.angle += delta * 2.2;
        const gripActive = claw.closed || gripUntilRef.current > now;
        timeRef.current -= delta;
        spawnRef.current -= delta;

        if (spawnRef.current <= 0 && pigsRef.current.length < 6) {
          const size = 36 + Math.random() * 7;
          pigsRef.current.push({
            id: nextIdRef.current++,
            x: -55,
            y: WATER_TOP + 145 + Math.random() * 130,
            vx: 28 + Math.random() * 14,
            bob: Math.random() * Math.PI * 2,
            size,
            caught: false,
            color: Math.random() > 0.4 ? "#f4aaa4" : "#e88e89",
          });
          spawnRef.current = 1.8 + Math.random() * 0.9;
        }

        let hudChanged = false;
        for (const pig of pigsRef.current) {
          if (pig.caught) {
            pig.x += (claw.x - pig.x) * delta * 12;
            pig.y += (claw.y + 12 - pig.y) * delta * 12;
            continue;
          }
          pig.x += pig.vx * delta;
          pig.y += Math.sin(now / 700 + pig.bob) * delta * 8;
          const dx = pig.x - claw.x;
          const dy = pig.y - claw.y;
          const inGrip = Math.hypot(dx, dy) < pig.size + 28;
          if (gripActive && heldPigRef.current === null && inGrip) {
            pig.caught = true;
            heldPigRef.current = pig.id;
          }
        }

        const escaped = pigsRef.current.filter((pig) => !pig.caught && pig.x > DOWNSTREAM_EXIT_X);
        if (escaped.length) {
          livesRef.current -= escaped.length;
          comboRef.current = 0;
          hudChanged = true;
        }
        pigsRef.current = pigsRef.current.filter((pig) => pig.caught || pig.x <= DOWNSTREAM_EXIT_X);

        if (rescuedRef.current >= TARGET) {
          stateRef.current = "won";
          setGameState("won");
          syncHud();
        } else if (livesRef.current <= 0 || timeRef.current <= 0) {
          stateRef.current = "lost";
          setGameState("lost");
          syncHud();
        } else if (hudChanged || Math.ceil(timeRef.current) !== lastHudSecondRef.current) {
          lastHudSecondRef.current = Math.ceil(timeRef.current);
          syncHud();
        }
      }

      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, WATER_TOP);
      sky.addColorStop(0, "#163f4c");
      sky.addColorStop(1, "#557c7b");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, WATER_TOP);
      ctx.fillStyle = "rgba(255,255,255,.15)";
      for (let i = 0; i < 34; i++) {
        const x = (i * 79 + now * 0.18) % (W + 80) - 40;
        const y = (i * 47) % 210;
        ctx.fillRect(x, y, 2, 18);
      }
      // distant hills and homes
      ctx.fillStyle = "#2f5c58";
      ctx.beginPath();
      ctx.moveTo(0, 160);
      ctx.quadraticCurveTo(120, 80, 260, 155);
      ctx.quadraticCurveTo(390, 60, 550, 150);
      ctx.quadraticCurveTo(730, 78, 960, 145);
      ctx.lineTo(960, WATER_TOP);
      ctx.lineTo(0, WATER_TOP);
      ctx.fill();
      ctx.fillStyle = "#d2b064";
      ctx.fillRect(690, 153, 88, 71);
      ctx.fillStyle = "#6b3930";
      ctx.beginPath();
      ctx.moveTo(674, 158);
      ctx.lineTo(734, 112);
      ctx.lineTo(794, 158);
      ctx.fill();
      ctx.fillStyle = "#7fa0a0";
      ctx.fillRect(710, 178, 19, 23);
      ctx.fillRect(750, 178, 19, 23);

      // water
      const water = ctx.createLinearGradient(0, WATER_TOP, 0, H);
      water.addColorStop(0, "#2c8491");
      water.addColorStop(1, "#0e5969");
      ctx.fillStyle = water;
      ctx.fillRect(0, WATER_TOP, W, H - WATER_TOP);
      ctx.strokeStyle = "rgba(182,238,234,.32)";
      ctx.lineWidth = 3;
      for (let row = 0; row < 8; row++) {
        ctx.beginPath();
        const y = WATER_TOP + 20 + row * 48;
        for (let x = -80; x < W + 80; x += 80) {
          const offset = ((now * (0.035 + row * 0.003)) % 80);
          ctx.moveTo(x + offset, y);
          ctx.quadraticCurveTo(x + 20 + offset, y - 7, x + 40 + offset, y);
        }
        ctx.stroke();
      }

      // incoming flood marker
      drawRoundRect(ctx, 12, 265, 120, 31, 7, "rgba(255,243,216,.9)");
      ctx.fillStyle = "#543b2f";
      ctx.font = "700 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("来水方向  →", 72, 286);

      // lower flood exit
      ctx.fillStyle = "rgba(9,47,57,.54)";
      ctx.beginPath();
      ctx.moveTo(DOWNSTREAM_EXIT_X - 24, WATER_TOP + 132);
      ctx.lineTo(W, WATER_TOP + 98);
      ctx.lineTo(W, H);
      ctx.lineTo(DOWNSTREAM_EXIT_X - 10, H);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.32)";
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 10]);
      ctx.beginPath();
      ctx.moveTo(DOWNSTREAM_EXIT_X, WATER_TOP + 130);
      ctx.lineTo(DOWNSTREAM_EXIT_X, H);
      ctx.stroke();
      ctx.setLineDash([]);
      drawRoundRect(ctx, 786, 516, 104, 28, 7, "rgba(255,243,216,.82)");
      ctx.fillStyle = "#543b2f";
      ctx.font = "700 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("下游急流", 838, 535);

      // natural right bank and dock, reachable only by carrying a pig upward
      ctx.fillStyle = "#5f8b4f";
      ctx.beginPath();
      ctx.moveTo(SAFE_PLATFORM_X - 34, WATER_TOP);
      ctx.bezierCurveTo(812, 255, 842, 270, W, 258);
      ctx.lineTo(W, SAFE_PLATFORM_Y + 34);
      ctx.bezierCurveTo(900, 364, 830, 368, SAFE_PLATFORM_X - 22, SAFE_PLATFORM_Y + 22);
      ctx.bezierCurveTo(782, 326, 778, 285, SAFE_PLATFORM_X - 34, WATER_TOP);
      ctx.fill();
      ctx.fillStyle = "#cfa56a";
      ctx.beginPath();
      ctx.moveTo(SAFE_PLATFORM_X - 20, WATER_TOP + 38);
      ctx.bezierCurveTo(833, 284, 885, 293, W, 284);
      ctx.lineTo(W, SAFE_PLATFORM_Y + 54);
      ctx.bezierCurveTo(904, 379, 837, 377, SAFE_PLATFORM_X - 4, SAFE_PLATFORM_Y + 36);
      ctx.bezierCurveTo(789, 333, 787, 297, SAFE_PLATFORM_X - 20, WATER_TOP + 38);
      ctx.fill();

      ctx.fillStyle = "#b5834d";
      drawRoundRect(ctx, SAFE_PLATFORM_X, SAFE_PLATFORM_Y - 44, 154, 78, 10, "#b5834d");
      ctx.strokeStyle = "#6d482e";
      ctx.lineWidth = 5;
      ctx.strokeRect(SAFE_PLATFORM_X, SAFE_PLATFORM_Y - 44, 154, 78);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(92,58,35,.62)";
      for (let x = SAFE_PLATFORM_X + 24; x < SAFE_PLATFORM_X + 150; x += 27) {
        ctx.beginPath();
        ctx.moveTo(x, SAFE_PLATFORM_Y - 41);
        ctx.lineTo(x, SAFE_PLATFORM_Y + 31);
        ctx.stroke();
      }
      ctx.strokeStyle = "#5e4632";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(SAFE_PLATFORM_X + 18, SAFE_PLATFORM_Y + 26);
      ctx.lineTo(SAFE_PLATFORM_X + 18, SAFE_PLATFORM_Y + 92);
      ctx.moveTo(SAFE_PLATFORM_X + 134, SAFE_PLATFORM_Y + 26);
      ctx.lineTo(SAFE_PLATFORM_X + 134, SAFE_PLATFORM_Y + 88);
      ctx.stroke();
      drawRoundRect(ctx, 822, 264, 112, 31, 8, "#ffe9b5");
      ctx.fillStyle = "#543b2f";
      ctx.font = "700 15px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("安全上岸", 878, 285);
      ctx.strokeStyle = "rgba(255,233,181,.9)";
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 7]);
      ctx.strokeRect(SAFE_PLATFORM_X, SAFE_PLATFORM_Y - 44, 154, 78);
      ctx.setLineDash([]);

      for (const pig of pigsRef.current) drawPig(pig, now);

      // excavator arm
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = "#2d2925";
      ctx.lineWidth = 30;
      ctx.beginPath();
      ctx.moveTo(905, 75);
      ctx.lineTo(730, 102);
      ctx.lineTo(claw.x, claw.y - 54);
      ctx.stroke();
      ctx.strokeStyle = "#f7b72b";
      ctx.lineWidth = 21;
      ctx.stroke();
      ctx.strokeStyle = "#211f1d";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(730, 102);
      ctx.lineTo(claw.x, claw.y - 54);
      ctx.stroke();
      ctx.restore();

      // claw joint and jaws
      ctx.fillStyle = "#f7b72b";
      ctx.beginPath();
      ctx.arc(claw.x, claw.y - 54, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#232321";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      const visuallyClosed = claw.closed || gripUntilRef.current > now || heldPigRef.current !== null;
      const spread = visuallyClosed ? 14 : 34;
      ctx.beginPath();
      ctx.moveTo(claw.x, claw.y - 45);
      ctx.lineTo(claw.x - spread, claw.y + 22);
      ctx.lineTo(claw.x - (visuallyClosed ? 8 : 45), claw.y + 38);
      ctx.moveTo(claw.x, claw.y - 45);
      ctx.lineTo(claw.x + spread, claw.y + 22);
      ctx.lineTo(claw.x + (visuallyClosed ? 8 : 45), claw.y + 38);
      ctx.stroke();
      ctx.strokeStyle = visuallyClosed ? "rgba(255,215,67,.9)" : "rgba(255,255,255,.42)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(claw.x, claw.y, 48, 0, Math.PI * 2);
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [syncHud]);

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand">
          <span className="live-dot" aria-hidden="true" />
          <span className="eyebrow">暴雨特别行动</span>
          <h1>洪水夹猪队</h1>
        </div>
        <div className="mission-stamp">
          <span>任务编号</span>
          <strong>GX-0707</strong>
        </div>
      </header>

      <section className="game-layout">
        <aside className="mission-card" aria-label="任务说明">
          <p className="card-kicker">今日任务</p>
          <h2>把八头猪<br />安全送上岸</h2>
          <p className="brief">左侧来水，右上方高台上岸。夹稳以后拖到高台，再松开抓爪。</p>
          <div className="objective">
            <span>救援进度</span>
            <strong>{rescued}<small> / {TARGET}</small></strong>
            <div className="progress"><i style={{ width: `${(rescued / TARGET) * 100}%` }} /></div>
          </div>
          <div className="controls-copy">
            <p><kbd>移动鼠标</kbd><span>瞄准抓爪</span></p>
            <p><kbd>点击鼠标</kbd><span>夹住并锁定</span></p>
            <p><kbd>W A S D</kbd><span>键盘移动</span></p>
            <p><kbd>空格</kbd><span>夹紧抓爪</span></p>
          </div>
          <p className="tip">小贴士：夹住后不会半路掉下，拖到右上方高台再松开。</p>
        </aside>

        <div className="play-column">
          <div className="hud" aria-live="polite">
            <div><span>剩余时间</span><strong className={time <= 10 ? "danger" : ""}>{time}<small>秒</small></strong></div>
            <div><span>救援得分</span><strong>{score.toString().padStart(4, "0")}</strong></div>
            <div><span>漏网次数</span><strong>{"●".repeat(Math.max(0, lives))}<i>{"○".repeat(Math.max(0, 3 - lives))}</i></strong></div>
            <div><span>连续救援</span><strong>× {combo}</strong></div>
          </div>

          <div className="canvas-wrap">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              data-testid="game-canvas"
              aria-label="洪水夹猪游戏区域"
              onPointerMove={(event) => setClawFromPointer(event.clientX, event.clientY)}
              onPointerDown={(event) => {
                if (stateRef.current !== "playing") return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setClawFromPointer(event.clientX, event.clientY);
                clawRef.current.closed = true;
                gripUntilRef.current = performance.now() + 260;
                attemptGrip();
              }}
              onPointerUp={releaseGrip}
              onPointerCancel={releaseGrip}
              onPointerLeave={releaseGrip}
            />

            {gameState !== "playing" && (
              <div className="game-overlay" data-testid="game-overlay">
                <div className="overlay-card">
                  <span className="overlay-icon" aria-hidden="true">
                    {gameState === "won" ? "★" : gameState === "lost" ? "↻" : "🐷"}
                  </span>
                  <p>{gameState === "ready" ? "挖机师傅，准备好了吗？" : gameState === "won" ? "全部安全上岸！" : "洪水把猪冲远了"}</p>
                  <h2>{gameState === "ready" ? "夹住以后，送上高台" : gameState === "won" ? `${score} 分 · 救援成功` : `${rescued} 头获救 · 再试一次`}</h2>
                  <button type="button" data-testid="start-game" onClick={resetGame}>
                    {gameState === "ready" ? "开始救援" : "再来一局"}
                    <span>按 Enter</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mobile-controls" aria-label="触控方向键">
            <button aria-label="抓爪向左" onPointerDown={() => keysRef.current.add("a")} onPointerUp={() => keysRef.current.delete("a")}>←</button>
            <button aria-label="抓爪向上" onPointerDown={() => keysRef.current.add("w")} onPointerUp={() => keysRef.current.delete("w")}>↑</button>
            <button className="grip" aria-label="夹紧抓爪" onPointerDown={() => { clawRef.current.closed = true; attemptGrip(); }} onPointerUp={releaseGrip}>夹</button>
            <button aria-label="抓爪向下" onPointerDown={() => keysRef.current.add("s")} onPointerUp={() => keysRef.current.delete("s")}>↓</button>
            <button aria-label="抓爪向右" onPointerDown={() => keysRef.current.add("d")} onPointerUp={() => keysRef.current.delete("d")}>→</button>
          </div>
        </div>
      </section>

      <footer>
        <span>不伤猪，才是真高手。</span>
      </footer>
    </main>
  );
}
