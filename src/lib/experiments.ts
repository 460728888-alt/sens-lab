import type { Config, Mode, Run, VideoRecord } from "../types";
import { mean, sd, videoSummary } from "./metrics";
export interface Estimate {
  n: number;
  mean: number;
  low: number;
  high: number;
}
export interface Verdict {
  status:
    "insufficient" | "incomparable" | "uncertain" | "promising" | "retain";
  title: string;
  reason: string;
  confidence: string;
  baseline: Estimate;
  candidate: Estimate;
  direction: string;
  next: string;
}
function critical(n: number) {
  return n <= 2
    ? 12.706
    : n === 3
      ? 4.303
      : n === 4
        ? 3.182
        : n === 5
          ? 2.776
          : n <= 10
            ? 2.571
            : n <= 20
              ? 2.262
              : 2.086;
}
export function estimate(values: number[]): Estimate {
  const average = mean(values),
    margin =
      values.length > 1
        ? (critical(values.length) * sd(values)) / Math.sqrt(values.length)
        : 0;
  return {
    n: values.length,
    mean: average,
    low: average - margin,
    high: average + margin,
  };
}
export const signature = (c: Config) =>
  JSON.stringify({
    gain: c.gain,
    parameters: c.parameters
      .filter((p) => p.name.trim())
      .map((p) => [p.name.trim(), p.value.trim()])
      .sort((a, b) => a[0].localeCompare(b[0])),
  });
export function changedParameters(a: Config, b: Config) {
  const ma = new Map(
      a.parameters
        .filter((p) => p.name.trim())
        .map((p) => [p.name.trim(), p.value.trim()]),
    ),
    mb = new Map(
      b.parameters
        .filter((p) => p.name.trim())
        .map((p) => [p.name.trim(), p.value.trim()]),
    );
  return [...new Set([...ma.keys(), ...mb.keys()])].filter(
    (k) => ma.get(k) !== mb.get(k),
  );
}
export function compareValues(a: number[], b: number[]) {
  const baseline = estimate(a),
    candidate = estimate(b);
  const difference = baseline.mean - candidate.mean;
  const margin =
    critical(Math.min(a.length, b.length)) *
    Math.sqrt(
      sd(a) ** 2 / Math.max(1, a.length) + sd(b) ** 2 / Math.max(1, b.length),
    );
  return { baseline, candidate, difference, margin };
}
function decision(
  a: number[],
  b: number[],
  guard: boolean,
  direction: string,
  scope: string,
): Verdict {
  const { baseline, candidate, difference, margin } = compareValues(a, b);
  const common = {
    baseline,
    candidate,
    direction,
    next: "交替进行基准—候选—候选—基准测试；每组至少 3 轮，尽量增加至 5–10 轮。",
  };
  if (a.length < 3 || b.length < 3)
    return {
      ...common,
      status: "insufficient",
      title: "需要更多重复测试",
      reason: `${scope}每组至少需要 3 次独立有效记录。关键帧和单轮中的目标不能当成独立重复实验。`,
      confidence: "不足",
    };
  if (difference - margin > Math.max(0.05 * baseline.mean, 1e-6) && guard)
    return {
      ...common,
      status: "promising",
      title: `值得尝试${direction}`,
      reason: `候选平均误差下降 ${((difference / Math.max(baseline.mean, 1e-6)) * 100).toFixed(1)}%，保守差值区间仍超过基准均值的 5% 实用阈值，且未触发辅助指标退化限制。只支持在当前任务下继续复测。`,
      confidence: "初步证据 · 非验证性结论",
    };
  if (difference + margin < -Math.max(0.05 * baseline.mean, 1e-6))
    return {
      ...common,
      status: "retain",
      title: "当前配置相对更合适",
      reason:
        "候选误差的退化超过实用阈值，保守差值区间未跨零。建议保留基准并在另一训练任务中验证。",
      confidence: "初步证据",
    };
  return {
    ...common,
    status: "uncertain",
    title: "暂不建议调整",
    reason: guard
      ? "差异较小或重复结果不稳定，保守差值区间不足以支持明确调整方向。"
      : "候选未同时满足误差与辅助指标要求；速度、过冲、修正或未命中出现退化，不能只看单项成绩。",
    confidence: "未分出稳定差异",
  };
}
function blocked(reason: string): Verdict {
  return {
    status: "incomparable",
    title: "这些配置不能直接比较",
    reason,
    confidence: "不可判定",
    baseline: estimate([]),
    candidate: estimate([]),
    direction: "",
    next: "复制基准配置，只修改一个待验证参数；保持设备、任务和采样方式一致。",
  };
}
export function compatibleRuns(r: Run, anchor: Run) {
  return (
    r.protocol === anchor.protocol &&
    r.pointer === anchor.pointer &&
    Math.abs(r.width - anchor.width) < 2 &&
    Math.abs(r.height - anchor.height) < 2 &&
    JSON.stringify(r.profile) === JSON.stringify(anchor.profile)
  );
}
function ambiguous(c: Config) {
  const names = c.parameters
    .filter((p) => p.name.trim())
    .map((p) => p.name.trim());
  return new Set(names).size !== names.length;
}
export function compareRuns(
  runs: Run[],
  a: Config,
  b: Config,
  mode: Mode,
): Verdict {
  if (ambiguous(a) || ambiguous(b))
    return blocked("参数名称存在重复，无法判断唯一变量，请先修正配置。");
  if (a.id === b.id) return blocked("请选择不同的基准和候选配置。");
  if (changedParameters(a, b).length || a.gain === b.gain)
    return blocked(
      "网页增益实验只允许改变网页增益，游戏参数须完全相同。游戏参数请使用下方真实录像实验。",
    );
  const ar = runs.filter(
    (r) =>
      r.valid &&
      r.mode === mode &&
      r.config.id === a.id &&
      signature(r.config) === signature(a),
  );
  const anchor = ar[0];
  const br = runs.filter(
    (r) =>
      r.valid &&
      r.mode === mode &&
      r.config.id === b.id &&
      signature(r.config) === signature(b),
  );
  const left = anchor ? ar.filter((r) => compatibleRuns(r, anchor)) : [],
    right = anchor ? br.filter((r) => compatibleRuns(r, anchor)) : [];
  const avg = (
    rs: Run[],
    key:
      | "acquisitionMs"
      | "overshootRate"
      | "corrections"
      | "missRate"
      | "rmsError",
  ) => mean(rs.map((r) => r.metrics[key] ?? 3000));
  const guard =
    avg(right, "rmsError") <= avg(left, "rmsError") * 1.1 &&
    (mode === "track" ||
      (avg(right, "acquisitionMs") <= avg(left, "acquisitionMs") * 1.1 + 30 &&
        avg(right, "overshootRate") <= avg(left, "overshootRate") + 0.05 &&
        avg(right, "corrections") <= avg(left, "corrections") * 1.1 + 0.2 &&
        avg(right, "missRate") <= avg(left, "missRate") + 0.05));
  return decision(
    left.map((r) => r.metrics.meanError),
    right.map((r) => r.metrics.meanError),
    guard,
    b.gain > a.gain ? "提高网页增益" : "降低网页增益",
    "同条件网页实验",
  );
}
export function regularVideo(v: VideoRecord) {
  const sorted = [...v.annotations].sort((a, b) => a.t - b.t);
  if (sorted.length < 8 || v.end <= v.start) return false;
  const span = v.end - v.start,
    gaps = sorted.slice(1).map((a, i) => a.t - sorted[i].t);
  return (
    sorted[0].t - v.start <= span * 0.15 &&
    v.end - sorted.at(-1)!.t <= span * 0.15 &&
    Math.max(...gaps) <= span * 0.25 &&
    sd(gaps) / Math.max(mean(gaps), 0.001) < 0.5
  );
}
export function compareVideos(
  videos: VideoRecord[],
  a: Config,
  b: Config,
  task: string,
): Verdict {
  if (ambiguous(a) || ambiguous(b))
    return blocked("参数名称存在重复，无法判断唯一变量，请先修正配置。");
  if (a.id === b.id) return blocked("请选择不同配置。");
  const changed = changedParameters(a, b);
  if (changed.length !== 1 || a.gain !== b.gain)
    return blocked(
      "真实游戏录像实验要求只改变一个游戏参数，网页增益保持相同。",
    );
  const name = changed[0],
    av = Number(a.parameters.find((p) => p.name.trim() === name)?.value),
    bv = Number(b.parameters.find((p) => p.name.trim() === name)?.value);
  if (!Number.isFinite(av) || !Number.isFinite(bv) || av === bv)
    return blocked(
      "待比较参数必须是两个不同的有限数值，才能判断提高或降低方向。",
    );
  const filtered = videos.filter((v) => v.task === task && regularVideo(v));
  const left = filtered.filter(
    (v) => v.config.id === a.id && signature(v.config) === signature(a),
  );
  const anchor = left[0];
  const right = filtered.filter(
    (v) =>
      v.config.id === b.id &&
      signature(v.config) === signature(b) &&
      (!anchor ||
        Math.abs(v.width / v.height - anchor.width / anchor.height) < 0.01) &&
      (!anchor ||
        Math.abs(v.end - v.start - (anchor.end - anchor.start)) < 0.5),
  );
  const matched = left.filter(
    (v) =>
      !anchor ||
      (Math.abs(v.width / v.height - anchor.width / anchor.height) < 0.01 &&
        Math.abs(v.end - v.start - (anchor.end - anchor.start)) < 0.5),
  );
  const verdict = decision(
    matched.map((v) => videoSummary(v.annotations).mean),
    right.map((v) => videoSummary(v.annotations).mean),
    mean(right.map((v) => videoSummary(v.annotations).rms)) <=
      mean(matched.map((v) => videoSummary(v.annotations).rms)) * 1.1,
    `${bv > av ? "提高" : "降低"}「${name}」至 ${bv}`,
    "同任务录像",
  );
  return {
    ...verdict,
    reason:
      verdict.reason +
      " 录像仅支持人工关键帧位置误差判断，不能由此判断命中时间或过冲。相同任务标识依赖你确认距离、武器、目标运动和标注规则一致。",
    confidence:
      verdict.status === "promising"
        ? "有限证据 · 人工标注存在选择偏差"
        : verdict.confidence,
  };
}
export function numericCandidates(value: string): number[] {
  if (!value.trim()) return [];
  const n = Number(value);
  return Number.isFinite(n) && n !== 0
    ? [0.9 * n, n, 1.1 * n].map((v) => Number(v.toPrecision(6)))
    : [];
}
