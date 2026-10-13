import type { Point } from "../types";
/** V1 only defines the contract. No automatic tracker is bundled or claimed. */
export interface VisionFrame {
  source: CanvasImageSource;
  width: number;
  height: number;
  timestamp: number;
}
export interface VisionDetection {
  point: Point;
  confidence: number;
  label: "crosshair" | "target";
  modelVersion: string;
}
export interface VisionAdapter {
  readonly name: string;
  initialize(signal: AbortSignal): Promise<void>;
  detect(frame: VisionFrame, signal: AbortSignal): Promise<VisionDetection[]>;
  dispose(): Promise<void>;
}
/** Future OpenCV.js/ONNX adapters process one bounded frame at a time.
 * Confidence is model confidence, never a sensitivity-match score.
 * Model outputs require validation against manual annotations before use. */
export class VisionRegistry {
  private adapter: VisionAdapter | null = null;
  register(adapter: VisionAdapter) {
    if (this.adapter) throw new Error("请先释放现有视觉适配器");
    this.adapter = adapter;
  }
  async initialize(signal: AbortSignal) {
    if (!this.adapter)
      throw new Error("V1 仅提供手动标注，尚未安装经过验证的自动追踪器。");
    await this.adapter.initialize(signal);
  }
  async detect(frame: VisionFrame, signal: AbortSignal) {
    if (!this.adapter) throw new Error("自动视觉识别尚未实现");
    if (signal.aborted) throw new DOMException("操作已取消", "AbortError");
    return this.adapter.detect(frame, signal);
  }
  async dispose() {
    await this.adapter?.dispose();
    this.adapter = null;
  }
}
