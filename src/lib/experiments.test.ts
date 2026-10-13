import { describe, it, expect } from "vitest";
import {
  compareRuns,
  compareVideos,
  numericCandidates,
  estimate,
  regularVideo,
} from "./experiments";
import { AimEngine } from "./engine";
import { initialData, type Config, type Run, type VideoRecord } from "../types";
const data = initialData(),
  a = data.configs[0];
a.parameters = [{ id: "p", name: "自定义参数", value: "100" }];
const b: Config = { ...a, id: "b", gain: 0.9 };
function run(c: Config, error: number): Run {
  return {
    id: Math.random().toString(),
    created: "2026-01-01",
    mode: "flick",
    config: structuredClone(c),
    profile: data.profile,
    protocol: "v1",
    width: 400,
    height: 400,
    pointer: "touch",
    duration: 24000,
    samples: [],
    touches: [],
    trials: [],
    metrics: {
      ...new AimEngine("flick", 1).metrics(),
      meanError: error,
      rmsError: error,
      acquisitionMs: 400,
      missRate: 0,
    },
    valid: true,
    invalidReason: "",
    interruptions: 0,
  };
}
describe("可解释推荐", () => {
  it("没有数据绝不强行推荐", () => {
    expect(compareRuns([], a, b, "flick").status).toBe("insufficient");
  });
  it("每轮独立样本不足", () => {
    expect(compareRuns([run(a, 10), run(b, 1)], a, b, "flick").status).toBe(
      "insufficient",
    );
  });
  it("稳定改善可支持降低网页增益", () => {
    const r = [10, 10.1, 9.9]
      .map((n) => run(a, n))
      .concat([7, 7.1, 6.9].map((n) => run(b, n)));
    expect(compareRuns(r, a, b, "flick").status).toBe("promising");
  });
  it("差异不稳定保留判断", () => {
    const r = [5, 15, 10]
      .map((n) => run(a, n))
      .concat([4, 14, 9].map((n) => run(b, n)));
    expect(compareRuns(r, a, b, "flick").status).toBe("uncertain");
  });
  it("设备不同不合并", () => {
    const r = [10, 10, 10]
      .map((n) => run(a, n))
      .concat([7, 7, 7].map((n) => ({ ...run(b, n), width: 600 })));
    expect(compareRuns(r, a, b, "flick").candidate.n).toBe(0);
  });
  it("同时改游戏参数和网页增益不可判定", () => {
    expect(
      compareRuns(
        [],
        a,
        { ...b, parameters: [{ id: "p", name: "自定义参数", value: "90" }] },
        "flick",
      ).status,
    ).toBe("incomparable");
  });
  it("排除同配置旧参数快照", () => {
    expect(
      compareRuns([run({ ...a, gain: 2 }, 10)], a, b, "flick").baseline.n,
    ).toBe(0);
  });
  it("候选值来自实际数值", () => {
    expect(numericCandidates("80")).toEqual([72, 80, 88]);
    expect(numericCandidates("")).toEqual([]);
    expect(numericCandidates("文本")).toEqual([]);
  });
  it("重复结果区间反映波动", () => {
    expect(estimate([1, 10, 19]).high).toBeGreaterThan(19);
  });
  it("位置误差变好但速度退化不推荐", () => {
    const r = [10, 10, 10]
      .map((n) => run(a, n))
      .concat(
        [7, 7, 7].map((n) => ({
          ...run(b, n),
          metrics: { ...run(b, n).metrics, acquisitionMs: 2000 },
        })),
      );
    expect(compareRuns(r, a, b, "flick").status).toBe("uncertain");
  });
  it("不规则挑帧录像不用于推荐", () => {
    const v = {
      start: 0,
      end: 10,
      annotations: [0, 1, 2, 3, 4, 5, 6, 7].map((t) => ({
        t: t / 10,
        crosshair: { x: 0, y: 0 },
        target: { x: 1, y: 1 },
        error: 1,
      })),
    } as VideoRecord;
    expect(regularVideo(v)).toBe(false);
  });
  it("录像不能比较多个变化参数", () => {
    expect(compareVideos([], a, { ...b, parameters: [] }, "task").status).toBe(
      "incomparable",
    );
  });
});
