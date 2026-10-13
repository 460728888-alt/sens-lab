import {
  type Mode,
  type Sample,
  type Touch,
  type Trial,
  modes,
} from "../types";
import { calculateMetrics } from "./metrics";
// Reproducible pseudo-random directions/distances keep candidate tests comparable.
let protocolSeed = 731;
const random = () => {
  protocolSeed = (Math.imul(protocolSeed, 1664525) + 1013904223) >>> 0;
  return protocolSeed / 4294967296;
};
const positions = Array.from({ length: 8 }, () => {
  const angle = random() * Math.PI * 2;
  const distance = 0.22 + random() * 0.14;
  return [Math.cos(angle) * distance, Math.sin(angle) * distance];
});
export class AimEngine {
  aim = { x: 0, y: 0 };
  target = { x: 0, y: 0 };
  samples: Sample[] = [];
  touches: Touch[] = [];
  trials: Trial[] = [];
  responses: number[] = [];
  touching = false;
  stableHit = false;
  elapsed = 0;
  index = 0;
  trialStart = 0;
  radius = 2.8;
  hold = 0;
  acquired: number | null = null;
  overshoot = false;
  corrections = 0;
  path = 0;
  swipes = 0;
  initialDistance = 0;
  lastProjection = 0;
  lastDirection = 0;
  lastSample = -100;
  pointerType = "";
  pendingResponse: number | null = null;
  trackDirection = 1;
  lastAimX = 0;
  constructor(
    public mode: Mode,
    public gain: number,
  ) {
    this.newTarget();
  }
  newTarget() {
    const p = positions[this.index % positions.length];
    const scale = this.mode === "micro" ? 16 : this.mode === "turn" ? 350 : 100;
    this.target = {
      x: this.aim.x + p[0] * scale,
      y: this.aim.y + p[1] * (this.mode === "turn" ? 65 : scale),
    };
    this.radius = this.mode === "micro" ? 0.85 : 2.8;
    this.initialDistance = Math.hypot(
      this.target.x - this.aim.x,
      this.target.y - this.aim.y,
    );
    this.trialStart = this.elapsed;
    this.hold = 0;
    this.stableHit = false;
    this.acquired = null;
    this.overshoot = false;
    this.corrections = 0;
    this.path = 0;
    this.swipes = this.touching ? 1 : 0;
    this.lastProjection = this.initialDistance;
    this.lastDirection = 0;
  }
  touch(type: Touch["type"], x: number, y: number, pointer: string) {
    this.touches.push({ t: this.elapsed, type, x, y, pointer });
    this.pointerType = pointer;
    if (type === "down") {
      this.swipes++;
      this.touching = true;
    }
    if (type === "up" || type === "cancel") this.touching = false;
  }
  move(dx: number, dy: number) {
    this.aim.x += dx * this.gain;
    this.aim.y += dy * this.gain;
    this.path += Math.hypot(dx, dy) * this.gain;
    const ex = this.target.x - this.aim.x,
      ey = this.target.y - this.aim.y;
    const p = positions[this.index % positions.length];
    const norm = Math.hypot(
      p[0] * (this.mode === "turn" ? 350 : 1),
      p[1] * (this.mode === "turn" ? 65 : 1),
    );
    const projection =
      (ex * p[0] * (this.mode === "turn" ? 350 : 1) +
        ey * p[1] * (this.mode === "turn" ? 65 : 1)) /
      norm;
    if (this.lastProjection >= -this.radius && projection < -this.radius)
      this.overshoot = true;
    const diff = projection - this.lastProjection;
    if (Math.abs(diff) > 0.15) {
      const direction = Math.sign(diff);
      if (this.lastDirection && this.lastDirection !== direction)
        this.corrections++;
      this.lastDirection = direction;
    }
    this.lastProjection = projection;
    if (
      this.pendingResponse !== null &&
      Math.abs(this.aim.x - this.lastAimX) > 0.15 &&
      Math.sign(this.aim.x - this.lastAimX) === this.trackDirection
    ) {
      this.responses.push(this.elapsed - this.pendingResponse);
      this.pendingResponse = null;
    }
    this.lastAimX = this.aim.x;
  }
  finishTrial(hit: boolean) {
    this.trials.push({
      id: this.index,
      start: this.trialStart,
      end: this.elapsed,
      radius: this.radius,
      initialDistance: this.initialDistance,
      acquiredMs: this.acquired,
      hit,
      overshoot: this.overshoot,
      corrections: this.corrections,
      finalError: Math.hypot(
        this.target.x - this.aim.x,
        this.target.y - this.aim.y,
      ),
      path: this.path,
      swipes: this.swipes,
    });
    this.index++;
    this.newTarget();
  }
  step(dt: number) {
    this.elapsed += dt;
    if (this.mode === "track") {
      const segment = Math.floor(this.elapsed / 3000);
      const phase = (this.elapsed % 3000) / 3000;
      const dir = segment % 2 === 0 ? 1 : -1;
      if (dir !== this.trackDirection) {
        this.trackDirection = dir;
        this.pendingResponse = this.elapsed;
      }
      this.target = {
        x: dir === 1 ? -22 + 44 * phase : 22 - 44 * phase,
        y: 8 * Math.sin(this.elapsed / 1800),
      };
    }
    const error = Math.hypot(
      this.target.x - this.aim.x,
      this.target.y - this.aim.y,
    );
    if (this.elapsed - this.lastSample >= 1000 / 30 - 0.001) {
      this.samples.push({
        t: this.elapsed,
        trial: this.index,
        aimX: this.aim.x,
        aimY: this.aim.y,
        targetX: this.target.x,
        targetY: this.target.y,
        error,
      });
      this.lastSample = this.elapsed;
    }
    if (error <= this.radius) {
      if (this.acquired === null)
        this.acquired = this.elapsed - this.trialStart;
      this.hold += dt;
      if (this.hold >= 160) this.stableHit = true;
    } else this.hold = 0;
    // Fixed 3-second trials ensure identical target count/exposure for A/B tests.
    if (this.elapsed - this.trialStart >= 3000 - 0.01)
      this.finishTrial(
        this.acquired !== null && (this.mode === "track" || this.stableHit),
      );
    return this.elapsed >= modes[this.mode].duration * 1000 - 0.01;
  }
  metrics() {
    return calculateMetrics(this.samples, this.trials, this.responses);
  }
}
