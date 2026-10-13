import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Play, Pause, RotateCcw, Crosshair } from "lucide-react";
import { AimEngine } from "../lib/engine";
import {
  modes,
  uid,
  type Mode,
  type Run,
  type Config,
  type Profile,
} from "../types";
export function Training({
  mode,
  config,
  profile,
  onComplete,
  onBack,
}: {
  mode: Mode;
  config: Config;
  profile: Profile;
  onComplete: (run: Run) => void;
  onBack: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef(new AimEngine(mode, config.gain));
  const running = useRef(false);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const interruptions = useRef(0);
  const size = useRef({ width: 0, height: 0 });
  const [status, setStatus] = useState<"ready" | "running" | "paused" | "done">(
    "ready",
  );
  const [time, setTime] = useState(0);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(true);
  const pause = (reason = "已暂停。继续时从当前有效训练时间开始。") => {
    if (running.current) {
      running.current = false;
      pointer.current = null;
      interruptions.current++;
      setStatus("paused");
      setMessage(reason);
    }
  };
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d");
    if (!ctx) {
      setSupported(false);
      setMessage("浏览器不支持 Canvas 2D，请使用新版 Safari 或 Chrome。");
      return;
    }
    let raf = 0,
      last = 0,
      accumulator = 0;
    let completed = false;
    const draw = (now: number) => {
      const rect = c.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (
        c.width !== Math.round(rect.width * dpr) ||
        c.height !== Math.round(rect.height * dpr)
      ) {
        if (size.current.width && running.current)
          pause(
            "屏幕尺寸发生变化，已暂停。本轮将标记为不可用于参数比较，请重新测试。",
          );
        size.current = { width: rect.width, height: rect.height };
        c.width = Math.round(rect.width * dpr);
        c.height = Math.round(rect.height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = rect.width,
        h = rect.height,
        unit = Math.min(w, h) / 100;
      const e = engine.current;
      if (running.current) {
        const delta = last ? now - last : 0;
        if (delta > 250) {
          pause("检测到页面卡顿或中断，已暂停。建议重测以保证可比性。");
          accumulator = 0;
        } else {
          accumulator += delta;
          while (accumulator >= 1000 / 30 && running.current) {
            accumulator -= 1000 / 30;
            if (e.step(1000 / 30)) {
              running.current = false;
              setStatus("done");
              completed = true;
            }
          }
        }
        setTime(Math.min(modes[mode].duration, e.elapsed / 1000));
      } else accumulator = 0;
      last = now;
      ctx.fillStyle = "#101417";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#20292c";
      ctx.lineWidth = 1;
      const grid = unit * 10;
      for (let x = (w / 2 - e.aim.x * unit) % grid; x < w; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = (h / 2 - e.aim.y * unit) % grid; y < h; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      const tx = w / 2 + (e.target.x - e.aim.x) * unit,
        ty = h / 2 + (e.target.y - e.aim.y) * unit;
      ctx.beginPath();
      ctx.arc(tx, ty, e.radius * unit, 0, Math.PI * 2);
      ctx.fillStyle = "#ff4b58";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#ff4b5855";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ff99a1";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, e.radius * unit + 7, 0, Math.PI * 2);
      ctx.strokeStyle = "#ff4b5844";
      ctx.stroke();
      if (tx < 0 || tx > w || ty < 0 || ty > h) {
        ctx.fillStyle = "#ff6873";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${tx < w / 2 ? "←" : "→"} 向目标方向滑动`, w / 2, 55);
      }
      ctx.strokeStyle = "#edf9f8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 13, h / 2);
      ctx.lineTo(w / 2 - 4, h / 2);
      ctx.moveTo(w / 2 + 4, h / 2);
      ctx.lineTo(w / 2 + 13, h / 2);
      ctx.moveTo(w / 2, h / 2 - 13);
      ctx.lineTo(w / 2, h / 2 - 4);
      ctx.moveTo(w / 2, h / 2 + 4);
      ctx.lineTo(w / 2, h / 2 + 13);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillRect(w / 2 - 1, h / 2 - 1, 2, 2);
      if (completed) {
        completed = false;
        const valid =
          e.touches.filter((t) => t.type === "move").length >= 20 &&
          e.trials.reduce((sum, t) => sum + t.path, 0) > 1 &&
          interruptions.current === 0;
        onComplete({
          id: uid(),
          created: new Date().toISOString(),
          mode,
          config: structuredClone(config),
          profile: structuredClone(profile),
          protocol: "sens-v1-seed731-8x3s",
          ...size.current,
          pointer: e.pointerType,
          duration: e.elapsed,
          samples: e.samples,
          touches: e.touches,
          trials: e.trials,
          metrics: e.metrics(),
          valid,
          invalidReason: valid
            ? ""
            : interruptions.current
              ? "本轮发生暂停、尺寸变化或中断，请重测后再用于比较。"
              : "有效滑动不足，请实际滑动瞄准后重测。",
          interruptions: interruptions.current,
        });
        return;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const visibility = () => {
      if (document.hidden) pause("页面进入后台，已暂停。");
    };
    const blur = () => pause("页面失去焦点，已暂停。");
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
    };
  }, [mode, config, profile, onComplete]);
  const coords = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - r.left) / Math.min(r.width, r.height)) * 100,
      y: ((event.clientY - r.top) / Math.min(r.width, r.height)) * 100,
    };
  };
  return (
    <div className="page">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={16} /> 返回检测中心
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">触控实验 / {config.name}</span>
          <h1>{modes[mode].name}</h1>
          <p>{modes[mode].description} 不要直接点击目标。</p>
        </div>
        <span className="tag">网页增益 ×{config.gain}</span>
      </div>
      <div className="training-frame">
        <div className="training-top">
          <span>
            <i className={status === "running" ? "live-dot" : "dot"} />{" "}
            {status === "running"
              ? "正在记录真实轨迹"
              : status === "paused"
                ? "训练已暂停"
                : "准备就绪"}
          </span>
          <span>
            {time.toFixed(1)} / {modes[mode].duration} 秒
          </span>
        </div>
        <canvas
          aria-label="滑动瞄准训练区域"
          ref={canvas}
          className="aim-canvas"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            if (!running.current || pointer.current) return;
            e.preventDefault();
            const p = coords(e);
            pointer.current = { id: e.pointerId, ...p };
            e.currentTarget.setPointerCapture(e.pointerId);
            engine.current.touch("down", p.x, p.y, e.pointerType);
          }}
          onPointerMove={(e) => {
            if (!running.current || pointer.current?.id !== e.pointerId) return;
            e.preventDefault();
            const p = coords(e);
            engine.current.move(
              p.x - pointer.current.x,
              p.y - pointer.current.y,
            );
            engine.current.touch("move", p.x, p.y, e.pointerType);
            pointer.current = { id: e.pointerId, ...p };
          }}
          onPointerUp={(e) => {
            if (pointer.current?.id === e.pointerId) {
              const p = coords(e);
              engine.current.touch("up", p.x, p.y, e.pointerType);
              pointer.current = null;
            }
          }}
          onPointerCancel={(e) => {
            if (pointer.current?.id === e.pointerId) {
              const p = coords(e);
              engine.current.touch("cancel", p.x, p.y, e.pointerType);
              pause("触控被系统取消，已暂停。");
            }
          }}
          onLostPointerCapture={() => {
            if (pointer.current) pause("触控捕获中断，已暂停。");
          }}
        />
        <div className="training-bottom">
          <Crosshair size={16} /> 在画布内滑动 · 中央准星瞄准 · 每个目标保留 3
          秒
        </div>
      </div>
      <div className="button-row">
        {status === "running" ? (
          <button className="primary" onClick={() => pause()}>
            <Pause size={17} />
            暂停
          </button>
        ) : (
          <button
            className="primary"
            disabled={!supported || typeof window.PointerEvent !== "function"}
            onClick={() => {
              running.current = true;
              setStatus("running");
              setMessage("");
            }}
          >
            <Play size={17} />
            {status === "paused" ? "继续训练" : "开始训练"}
          </button>
        )}
        <button
          className="secondary"
          onClick={() => {
            running.current = false;
            engine.current = new AimEngine(mode, config.gain);
            pointer.current = null;
            interruptions.current = 0;
            setTime(0);
            setStatus("ready");
            setMessage("");
          }}
        >
          <RotateCcw size={17} />
          重新测试
        </button>
      </div>
      {message && <p className="notice">{message}</p>}
      {typeof window.PointerEvent !== "function" && (
        <p className="notice">
          此浏览器不支持 Pointer
          Events，无法采集触控。仍可使用录像分析；触控测试请升级浏览器。
        </p>
      )}
      <p className="muted">
        每轮 24 秒，共 8
        个固定顺序目标。请保持相同设备、屏幕方向和握持方式。网页增益仅作用于此模拟器，不能直接换算为游戏灵敏度。
      </p>
    </div>
  );
}
