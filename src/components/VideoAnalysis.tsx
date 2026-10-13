import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Play,
  Pause,
  Save,
  Crosshair,
  Target,
  Download,
} from "lucide-react";
import {
  type LabData,
  type Config,
  type Annotation,
  type Point,
  type VideoRecord,
  uid,
} from "../types";
import { videoError, videoSummary } from "../lib/metrics";
import { downloadJSON } from "../lib/storage";
import { ErrorChart, CompareChart } from "./Charts";
export function VideoAnalysis({
  data,
  save,
}: {
  data: LabData;
  save: (v: VideoRecord) => void;
}) {
  const player = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const objectURL = useRef("");
  const [src, setSrc] = useState("");
  const [filename, setFilename] = useState("");
  const [meta, setMeta] = useState({ width: 0, height: 0, duration: 0 });
  const [time, setTime] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [mark, setMark] = useState<"crosshair" | "target">("crosshair");
  const [crosshair, setCrosshair] = useState<Point | null>(null);
  const [target, setTarget] = useState<Point | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [playing, setPlaying] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [recordId, setRecordId] = useState(uid);
  const [config, setConfig] = useState<Config>(
    structuredClone(data.configs.find((c) => c.id === data.activeConfig)!),
  );
  const [task, setTask] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(
    () => () => {
      if (objectURL.current) URL.revokeObjectURL(objectURL.current);
    },
    [],
  );
  useEffect(() => {
    const c = overlay.current,
      v = player.current;
    if (!c || !v) return;
    const paint = () => {
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const r = c.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      ctx.scale(dpr, dpr);
      const scale = Math.min(
        r.width / (meta.width || 1),
        r.height / (meta.height || 1),
      );
      const w = meta.width * scale,
        h = meta.height * scale,
        left = (r.width - w) / 2,
        top = (r.height - h) / 2;
      for (const [p, color, label] of [
        [crosshair, "#83d6b7", "准星"],
        [target, "#ff5f6c", "目标"],
      ] as const) {
        if (!p) continue;
        const x = left + p.x * w,
          y = top + p.y * h;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.moveTo(x - 16, y);
        ctx.lineTo(x + 16, y);
        ctx.moveTo(x, y - 16);
        ctx.lineTo(x, y + 16);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = "12px sans-serif";
        ctx.fillText(label, x + 15, y - 12);
      }
    };
    paint();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(paint) : null;
    ro?.observe(c);
    window.addEventListener("resize", paint);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", paint);
    };
  }, [crosshair, target, meta, src]);
  const resetMarks = () => {
    setCrosshair(null);
    setTarget(null);
  };
  const seek = (t: number) => {
    if (!player.current || !Number.isFinite(t)) return;
    player.current.pause();
    resetMarks();
    setSeeking(true);
    player.current.currentTime = Math.max(start, Math.min(end, t));
    setTime(player.current.currentTime);
  };
  const validRange =
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end <= meta.duration &&
    end > start;
  const choose = (file: File) => {
    if (
      !file.type.startsWith("video/") &&
      !/\.(mp4|mov|webm|m4v)$/i.test(file.name)
    ) {
      setError("请选择 MP4、MOV 或 WebM 视频文件。");
      return;
    }
    player.current?.pause();
    if (objectURL.current) URL.revokeObjectURL(objectURL.current);
    objectURL.current = URL.createObjectURL(file);
    setSrc(objectURL.current);
    setFilename(file.name);
    setMeta({ width: 0, height: 0, duration: 0 });
    setAnnotations([]);
    setTime(0);
    setStart(0);
    setEnd(0);
    resetMarks();
    setError("");
    setNotice("视频仅在本机读取；保存的是标注数据，不复制原视频。");
    setRecordId(uid());
    setSeeking(false);
  };
  const add = () => {
    if (!crosshair || !target || !validRange || seeking || playing) return;
    const t = player.current!.currentTime;
    if (t < start || t > end) {
      setError("当前帧不在所选分析区间内。");
      return;
    }
    const a = {
      t,
      crosshair,
      target,
      error: videoError(crosshair, target, meta.width, meta.height),
    };
    setAnnotations((old) =>
      [...old.filter((x) => Math.abs(x.t - t) > 0.015), a].sort(
        (a, b) => a.t - b.t,
      ),
    );
    setNotice("当前关键帧已记录。移动时间轴后重新标注两个点。");
    setError("");
  };
  const selectedRecords = data.videos.filter((v) => selected.includes(v.id));
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">本机视频实验室</span>
          <h1>录像分析</h1>
          <p>
            手动标注真实游戏画面，计算准星与目标的相对误差。V1 不包含自动 AI
            识别。
          </p>
        </div>
        <span className="tag">零上传 · 逐帧处理</span>
      </div>
      <section className="panel">
        <div className="two-grid">
          <label>
            <Upload size={18} />
            选择训练录像
            <input
              aria-label="选择训练录像"
              type="file"
              accept="video/*,.mp4,.mov,.webm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) choose(f);
              }}
            />
          </label>
          <label>
            录像对应的配置（保存快照）
            <select
              value={config.id}
              onChange={(e) =>
                setConfig(
                  structuredClone(
                    data.configs.find((c) => c.id === e.target.value)!,
                  ),
                )
              }
            >
              {data.configs.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">
          建议使用短片段
          MP4（H.264）。只解码播放器当前位置，不将整段视频转成图像。原视频不持久保存，刷新后需重新选择。
        </p>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        {src && (
          <>
            <div className="video-stage">
              <video
                ref={player}
                src={src}
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (!Number.isFinite(v.duration) || !v.videoWidth) {
                    setError(
                      "无法读取有效视频时长或尺寸，请转为常规 MP4 后重试。",
                    );
                    return;
                  }
                  setMeta({
                    width: v.videoWidth,
                    height: v.videoHeight,
                    duration: v.duration,
                  });
                  setEnd(v.duration);
                }}
                onError={() =>
                  setError(
                    "视频无法解码。iPhone Safari 对部分 WebM/编码不支持，请尝试 H.264 编码的 MP4。",
                  )
                }
                onPlay={() => {
                  setPlaying(true);
                  resetMarks();
                }}
                onPause={() => setPlaying(false)}
                onSeeking={() => {
                  setSeeking(true);
                  resetMarks();
                }}
                onSeeked={() => {
                  setSeeking(false);
                  setTime(player.current?.currentTime ?? 0);
                }}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  setTime(v.currentTime);
                  if (v.currentTime >= end && end > 0 && !v.paused) {
                    v.pause();
                    v.currentTime = end;
                  }
                }}
              />
              <canvas
                aria-label="录像标注画布"
                ref={overlay}
                onPointerDown={(e) => {
                  const v = player.current;
                  if (!v || !v.paused || seeking || !meta.width) {
                    setNotice("请先暂停播放并等待定位完成，再标注。");
                    return;
                  }
                  const r = e.currentTarget.getBoundingClientRect(),
                    scale = Math.min(
                      r.width / meta.width,
                      r.height / meta.height,
                    ),
                    w = meta.width * scale,
                    h = meta.height * scale,
                    x = (e.clientX - r.left - (r.width - w) / 2) / w,
                    y = (e.clientY - r.top - (r.height - h) / 2) / h;
                  if (x < 0 || x > 1 || y < 0 || y > 1) return;
                  if (mark === "crosshair") {
                    setCrosshair({ x, y });
                    setMark("target");
                  } else setTarget({ x, y });
                }}
              />
            </div>
            <div className="video-controls">
              <button
                className="secondary"
                disabled={!meta.duration || seeking || !validRange}
                onClick={() => {
                  const v = player.current!;
                  if (v.paused) {
                    if (v.currentTime >= end || v.currentTime < start)
                      v.currentTime = start;
                    v.play().catch(() =>
                      setError(
                        "播放失败，请再次手动点击播放或换用兼容的视频文件。",
                      ),
                    );
                  } else v.pause();
                }}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
                {playing ? "暂停" : "播放"}
              </button>
              <button
                className="text-button"
                disabled={!validRange}
                onClick={() => seek(time - 1 / 30)}
              >
                前移约 1/30 秒
              </button>
              <button
                className="text-button"
                disabled={!validRange}
                onClick={() => seek(time + 1 / 30)}
              >
                后移约 1/30 秒
              </button>
              <span className="tag">
                {time.toFixed(3)} / {meta.duration.toFixed(2)} 秒
              </span>
            </div>
            <label>
              时间轴
              <input
                aria-label="视频时间轴"
                type="range"
                min={0}
                max={meta.duration || 1}
                step="0.001"
                value={time}
                disabled={!validRange}
                onChange={(e) => seek(Number(e.target.value))}
              />
            </label>
            <div className="two-grid">
              <label>
                分析起点（秒）
                <input
                  type="number"
                  min={0}
                  max={meta.duration}
                  step="0.01"
                  value={start}
                  onChange={(e) => setStart(Number(e.target.value))}
                />
              </label>
              <label>
                分析终点（秒）
                <input
                  type="number"
                  min={0}
                  max={meta.duration}
                  step="0.01"
                  value={end}
                  onChange={(e) => setEnd(Number(e.target.value))}
                />
              </label>
            </div>
            {!validRange && (
              <p className="notice">
                区间必须满足 0 ≤ 起点 &lt; 终点 ≤ 视频时长。
              </p>
            )}
            <div className="button-row" style={{ marginTop: 20 }}>
              <button
                className={mark === "crosshair" ? "primary" : "secondary"}
                onClick={() => setMark("crosshair")}
              >
                <Crosshair size={16} />
                标注准星
              </button>
              <button
                className={mark === "target" ? "primary" : "secondary"}
                onClick={() => setMark("target")}
              >
                <Target size={16} />
                标注目标
              </button>
              <button
                className="secondary"
                disabled={
                  !crosshair || !target || playing || seeking || !validRange
                }
                onClick={add}
              >
                记录当前关键帧
              </button>
            </div>
            <p className="muted">
              ① 暂停视频 → ② 点击准星中心 → ③ 点击同一目标中心 → ④
              记录关键帧。每次定位后都需重新标注。时间步进是近似定位，不宣称精确原始帧编号。
            </p>
            <label>
              可比任务标识（必填）
              <input
                placeholder="例如：训练场同一距离同一武器，固定目标跟踪 10 秒"
                value={task}
                onChange={(e) => setTask(e.target.value)}
              />
            </label>
            {notice && (
              <p role="status" className="muted">
                {notice}
              </p>
            )}
            <ErrorChart
              label="误差（画面对角线 %）"
              data={annotations
                .filter((a) => a.t >= start && a.t <= end)
                .map((a) => ({ time: Number(a.t.toFixed(3)), error: a.error }))}
            />
            <div className="annotation-list">
              {annotations.map((a) => (
                <div className="annotation-row" key={a.t}>
                  <button className="text-button" onClick={() => seek(a.t)}>
                    {a.t.toFixed(3)} 秒
                  </button>
                  <span>
                    {a.error.toFixed(3)}% 对角线{" "}
                    {a.t < start || a.t > end ? "（区间外，不保存）" : ""}
                  </span>
                  <button
                    className="text-button danger"
                    onClick={() =>
                      setAnnotations((v) => v.filter((x) => x !== a))
                    }
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
            <button
              className="primary"
              disabled={
                !validRange ||
                !task.trim() ||
                annotations.filter((a) => a.t >= start && a.t <= end).length < 2
              }
              onClick={() => {
                save({
                  id: recordId,
                  created: new Date().toISOString(),
                  filename,
                  ...meta,
                  start,
                  end,
                  config: structuredClone(config),
                  annotations: annotations.filter(
                    (a) => a.t >= start && a.t <= end,
                  ),
                  task: task.trim(),
                });
                setNotice(
                  "分析已保存至历史录像记录。继续编辑后可再次保存更新。",
                );
              }}
            >
              <Save size={16} />
              保存分析
            </button>
          </>
        )}
      </section>
      <div className="section-heading">
        <h2>录像记录与配置对比</h2>
        <span className="tag">{data.videos.length} 段已保存</span>
      </div>
      {data.videos.length === 0 ? (
        <p className="muted">
          选择录像并标注至少两个关键帧后，即可保存分析记录。
        </p>
      ) : (
        <section className="panel">
          {data.videos.map((v) => {
            const s = videoSummary(v.annotations);
            return (
              <div className="history-row" key={v.id}>
                <label style={{ flexDirection: "row", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    style={{ width: 18 }}
                    checked={selected.includes(v.id)}
                    onChange={(e) =>
                      setSelected((ids) =>
                        e.target.checked
                          ? [...ids, v.id]
                          : ids.filter((id) => id !== v.id),
                      )
                    }
                  />
                  <span>
                    {v.config.name} · {v.filename}
                    <small className="muted" style={{ display: "block" }}>
                      {v.task} · {s.count} 帧 · 平均误差 {s.mean.toFixed(3)}%
                    </small>
                  </span>
                </label>
                <button
                  className="text-button"
                  onClick={() => downloadJSON(v, `sens-lab-video-${v.id}.json`)}
                >
                  <Download size={15} />
                  导出
                </button>
              </div>
            );
          })}
          {selectedRecords.map((v) => (
            <div key={v.id}>
              <h3>
                {v.config.name} · {v.filename}
              </h3>
              <ErrorChart
                label="误差（画面对角线 %）"
                data={v.annotations.map((a) => ({
                  time: Number(a.t.toFixed(3)),
                  error: a.error,
                }))}
              />
            </div>
          ))}
          {selectedRecords.length >= 2 && (
            <>
              <CompareChart
                data={selectedRecords.map((v) => ({
                  name: v.config.name,
                  error: videoSummary(v.annotations).mean,
                }))}
              />
              <p className="notice">
                此图为所选人工关键帧的描述性比较，单位为画面对角线百分比。关键帧选择可能带来偏差；不同任务、画面比例或采样策略不能作因果比较。
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
