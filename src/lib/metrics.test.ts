import { describe, it, expect } from "vitest";
import { videoError, calculateMetrics } from "./metrics";
import { AimEngine } from "./engine";
describe("真实轨迹指标", () => {
  it("归一化录像误差考虑实际宽高比", () => {
    expect(videoError({ x: 0, y: 0 }, { x: 1, y: 1 }, 1920, 1080)).toBeCloseTo(
      100,
    );
  });
  it("空样本不虚构瞄准时间", () => {
    expect(calculateMetrics([], [], []).acquisitionMs).toBeNull();
  });
  it("点击不改变瞄准，滑动才改变视角", () => {
    const e = new AimEngine("flick", 1);
    e.touch("down", 20, 20, "touch");
    expect(e.aim.x).toBe(0);
    e.move(5, 2);
    expect(e.aim).toEqual({ x: 5, y: 2 });
  });
  it("不同增益产生相应位移", () => {
    const e = new AimEngine("micro", 0.9);
    e.move(10, 0);
    expect(e.aim.x).toBe(9);
  });
  it("固定时长产生八个目标并保留未命中", () => {
    const e = new AimEngine("flick", 1);
    for (let i = 0; i < 720; i++) e.step(1000 / 30);
    expect(e.trials).toHaveLength(8);
    expect(e.metrics().missRate).toBe(1);
    expect(e.metrics().acquisitionMs).toBeNull();
  });
});
describe("几何判定与采样边界", () => {
  it("RMS 不等同于平均误差", () => {
    const base = { t: 0, trial: 0, aimX: 0, aimY: 0, targetX: 0, targetY: 0 };
    const m = calculateMetrics(
      [
        { ...base, error: 3 },
        { ...base, error: 4 },
      ],
      [],
      [],
    );
    expect(m.meanError).toBe(3.5);
    expect(m.rmsError).toBeCloseTo(Math.sqrt(12.5));
  });
  it("缓慢越过目标仍计入过冲", () => {
    const e = new AimEngine("flick", 1),
      x = e.target.x,
      y = e.target.y;
    for (let i = 0; i < 120; i++) e.move(x / 100, y / 100);
    expect(e.overshoot).toBe(true);
  });
  it("曾稳定命中，离开后仍保留命中事实", () => {
    const e = new AimEngine("micro", 1);
    e.move(e.target.x, e.target.y);
    for (let i = 0; i < 6; i++) e.step(1000 / 30);
    e.move(20, 20);
    for (let i = 6; i < 90; i++) e.step(1000 / 30);
    expect(e.trials[0].hit).toBe(true);
    expect(e.trials[0].acquiredMs).not.toBeNull();
  });
  it("每轮采集 720 个固定时间间隔样本", () => {
    const e = new AimEngine("track", 1);
    for (let i = 0; i < 720; i++) e.step(1000 / 30);
    expect(e.samples.length).toBe(720);
  });
  it("触点跨目标窗口不会少算重滑", () => {
    const e = new AimEngine("turn", 1);
    e.touch("down", 1, 1, "touch");
    for (let i = 0; i < 90; i++) e.step(1000 / 30);
    e.touch("up", 1, 1, "touch");
    e.touch("down", 1, 1, "touch");
    expect(e.swipes).toBe(2);
  });
});
