import type { Sample, Trial, Metrics, Annotation, Point } from "../types";
export const mean = (v: number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
export const sd = (v: number[]) =>
  v.length > 1
    ? Math.sqrt(v.reduce((s, x) => s + (x - mean(v)) ** 2, 0) / (v.length - 1))
    : 0;
export function videoError(
  crosshair: Point,
  target: Point,
  width: number,
  height: number,
) {
  return (
    (Math.hypot(
      (crosshair.x - target.x) * width,
      (crosshair.y - target.y) * height,
    ) /
      Math.hypot(width, height)) *
    100
  );
}
export function videoSummary(annotations: Annotation[]) {
  const e = annotations.map((a) => a.error);
  return {
    count: e.length,
    mean: mean(e),
    rms: Math.sqrt(mean(e.map((x) => x * x))),
  };
}
export function calculateMetrics(
  samples: Sample[],
  trials: Trial[],
  responses: number[],
): Metrics {
  // Samples are collected on a fixed 30 Hz active-time grid, independent of display refresh rate.
  const errors = samples.map((s) => s.error);
  const acquired = trials.flatMap((t) =>
    t.acquiredMs === null ? [] : [t.acquiredMs],
  );
  return {
    meanError: mean(errors),
    rmsError: Math.sqrt(mean(errors.map((e) => e * e))),
    stability: sd(errors),
    acquisitionMs: acquired.length ? mean(acquired) : null,
    overshootRate: mean(trials.map((t) => +t.overshoot)),
    missRate: mean(trials.map((t) => +!t.hit)),
    undershootRate: mean(trials.map((t) => +(t.acquiredMs === null))),
    corrections: mean(trials.map((t) => t.corrections)),
    finalError: mean(trials.map((t) => t.finalError)),
    swipeDistance: trials.reduce((s, t) => s + t.path, 0),
    reswipes: trials.reduce((s, t) => s + Math.max(0, t.swipes - 1), 0),
    efficiency: mean(
      trials.map((t) => (t.path ? Math.min(1, t.initialDistance / t.path) : 0)),
    ),
    responseMs: responses.length ? mean(responses) : null,
    responseEvents: responses.length,
    validTrials: trials.filter((t) => t.end - t.start >= 300).length,
  };
}
