export type Mode = "flick" | "micro" | "track" | "turn";
export const modes: Record<
  Mode,
  { name: string; description: string; duration: number }
> = {
  flick: {
    name: "甩枪测试",
    description: "快速滑动，把中央准星移向目标，停稳即可命中。",
    duration: 24,
  },
  micro: {
    name: "微调测试",
    description: "用小幅滑动对准小目标，观察细微修正与稳定性。",
    duration: 24,
  },
  track: {
    name: "跟枪测试",
    description: "持续滑动，使中央准星跟随移动目标。",
    duration: 24,
  },
  turn: {
    name: "快速转向",
    description: "沿方向提示大幅滑动寻找目标，可抬手后继续滑动。",
    duration: 24,
  },
};
export interface Parameter {
  id: string;
  name: string;
  value: string;
}
export interface Profile {
  model: string;
  screen: string;
  fingers: string;
  gyro: boolean;
  notes: string;
}
export interface Config {
  id: string;
  name: string;
  gain: number;
  parameters: Parameter[];
}
export interface Sample {
  t: number;
  trial: number;
  aimX: number;
  aimY: number;
  targetX: number;
  targetY: number;
  error: number;
}
export interface Touch {
  t: number;
  type: "down" | "move" | "up" | "cancel";
  x: number;
  y: number;
  pointer: string;
}
export interface Trial {
  id: number;
  start: number;
  end: number;
  radius: number;
  initialDistance: number;
  acquiredMs: number | null;
  hit: boolean;
  overshoot: boolean;
  corrections: number;
  finalError: number;
  path: number;
  swipes: number;
}
export interface Metrics {
  meanError: number;
  rmsError: number;
  stability: number;
  acquisitionMs: number | null;
  overshootRate: number;
  missRate: number;
  undershootRate: number;
  corrections: number;
  finalError: number;
  swipeDistance: number;
  reswipes: number;
  efficiency: number;
  responseMs: number | null;
  responseEvents: number;
  validTrials: number;
}
export interface Run {
  id: string;
  created: string;
  mode: Mode;
  config: Config;
  profile: Profile;
  protocol: string;
  width: number;
  height: number;
  pointer: string;
  duration: number;
  samples: Sample[];
  touches: Touch[];
  trials: Trial[];
  metrics: Metrics;
  valid: boolean;
  invalidReason: string;
  interruptions: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface Annotation {
  t: number;
  crosshair: Point;
  target: Point;
  error: number;
}
export interface VideoRecord {
  id: string;
  created: string;
  filename: string;
  width: number;
  height: number;
  duration: number;
  start: number;
  end: number;
  config: Config;
  annotations: Annotation[];
  task: string;
}
export interface ReportSnapshot {
  id: string;
  created: string;
  runIds: string[];
  videoIds: string[];
  conclusion: string;
  configs?: Config[];
  evidence?: { runId: string; mode: Mode; metrics: Metrics }[];
}
export interface LabData {
  profile: Profile;
  configs: Config[];
  activeConfig: string;
  runs: Run[];
  videos: VideoRecord[];
  reports: ReportSnapshot[];
}
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const initialData = (): LabData => {
  const id = uid();
  return {
    profile: { model: "", screen: "", fingers: "二指", gyro: false, notes: "" },
    configs: [
      {
        id,
        name: "我的基准配置",
        gain: 1,
        parameters: [{ id: uid(), name: "", value: "" }],
      },
    ],
    activeConfig: id,
    runs: [],
    videos: [],
    reports: [],
  };
};
