import type { OcrLine } from "./screenshot-parser";
export interface OcrRequest {
  id: number;
  buffer: ArrayBuffer;
  base: string;
}
export type OcrResponse =
  | { id: number; type: "progress"; status: string; progress: number }
  | { id: number; type: "result"; lines: OcrLine[]; text: string }
  | { id: number; type: "error"; message: string };
export interface OcrResult {
  lines: OcrLine[];
  text: string;
}
export function validateScreenshot(file: File) {
  if (
    !/\.(png|jpe?g|webp)$/i.test(file.name) &&
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new Error(
      "请选择 PNG、JPG 或 WebP 截图；暂不支持 HEIC、SVG 和视频。",
    );
  if (file.size > 12 * 1024 * 1024)
    throw new Error("单张截图请小于 12 MB。建议使用游戏设置页的原始截图。");
  if (!file.size) throw new Error("截图文件为空，请重新选择。");
}
const abortError = () => new DOMException("识别已取消", "AbortError");
async function prepareImage(
  file: File,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  validateScreenshot(file);
  if (signal.aborted) throw abortError();
  const image = new Image();
  const url = URL.createObjectURL(file);
  const canvas = document.createElement("canvas");
  let onAbort: () => void = () => {};
  try {
    await new Promise<void>((resolve, reject) => {
      onAbort = () => {
        image.src = "";
        reject(abortError());
      };
      signal.addEventListener("abort", onAbort, { once: true });
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("无法读取这张截图，请改用 PNG 或 JPG 文件。"));
      image.src = url;
    });
    if (signal.aborted) throw abortError();
    if (
      !image.naturalWidth ||
      image.naturalWidth * image.naturalHeight > 24_000_000
    )
      throw new Error("图片尺寸过大，请裁剪为游戏设置区域后重试。");
    const scale = Math.min(
      2560 / Math.max(image.naturalWidth, image.naturalHeight),
      Math.sqrt(3_200_000 / (image.naturalWidth * image.naturalHeight)),
      2,
    );
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx)
      throw new Error("浏览器不支持截图处理，请使用新版 Safari 或 Chrome。");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Keep pixel expansion deterministic across Safari and Chromium.
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < pixels.data.length; i += 4)
      sum +=
        0.299 * pixels.data[i] +
        0.587 * pixels.data[i + 1] +
        0.114 * pixels.data[i + 2];
    const invert = sum / (canvas.width * canvas.height) < 128;
    for (let i = 0; i < pixels.data.length; i += 4) {
      let gray =
        0.299 * pixels.data[i] +
        0.587 * pixels.data[i + 1] +
        0.114 * pixels.data[i + 2];
      if (invert) gray = 255 - gray;
      pixels.data[i] =
        pixels.data[i + 1] =
        pixels.data[i + 2] =
          Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
    }
    ctx.putImageData(pixels, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error("截图转换失败，请重试。")),
        "image/png",
      ),
    );
    if (signal.aborted) throw abortError();
    return await blob.arrayBuffer();
  } finally {
    signal.removeEventListener("abort", onAbort);
    image.onload = null;
    image.onerror = null;
    image.src = "";
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 1;
  }
}
export class ScreenshotOcr {
  private worker: Worker;
  private id = 0;
  private disposed = false;
  private pending: {
    id: number;
    resolve: (value: OcrResult) => void;
    reject: (e: Error) => void;
    progress: (label: string) => void;
    cleanup: () => void;
  } | null = null;
  constructor() {
    if (typeof Worker === "undefined" || typeof WebAssembly === "undefined")
      throw new Error(
        "此浏览器不支持本机文字识别，请改用新版 Safari 或 Chrome，或手动填写。",
      );
    this.worker = new Worker(
      new URL("./screenshot.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = (event: MessageEvent<OcrResponse>) => {
      const message = event.data,
        p = this.pending;
      if (!p || p.id !== message.id) return;
      if (message.type === "progress") {
        const label =
          message.status === "recognizing text"
            ? `正在读取文字 ${Math.round(message.progress * 100)}%`
            : "正在加载本机识别引擎…";
        p.progress(label);
        return;
      }
      if (message.type === "error") {
        // Engine errors can arrive before Tesseract finishes unwinding its job.
        // Terminate the whole worker tree so the next image gets a fresh engine.
        this.reject(new Error(message.message));
        return;
      }
      this.pending = null;
      p.cleanup();
      p.resolve({ lines: message.lines, text: message.text });
    };
    this.worker.onerror = () =>
      this.reject(
        new Error("本机识别引擎无法启动，请检查网络或换用 Safari/Chrome。"),
      );
  }
  get isDisposed() {
    return this.disposed;
  }
  private reject(error: Error) {
    const p = this.pending;
    this.pending = null;
    p?.cleanup();
    p?.reject(error);
    if (!this.disposed) this.worker.terminate();
    this.disposed = true;
  }
  async recognize(
    file: File,
    signal: AbortSignal,
    progress: (label: string) => void,
  ) {
    if (this.disposed) throw new Error("识别引擎已关闭，请重新识别这张截图。");
    if (this.pending) throw new Error("请等待当前截图完成识别。");
    progress("正在准备截图…");
    const buffer = await prepareImage(file, signal);
    if (signal.aborted) throw abortError();
    if (this.disposed) throw new Error("识别引擎已关闭，请重新识别这张截图。");
    return new Promise<OcrResult>((resolve, reject) => {
      const id = ++this.id;
      const abort = () => this.reject(abortError());
      const timeout = setTimeout(
        () =>
          this.reject(
            new Error("识别超过 90 秒，请检查网络或使用更小、更清晰的截图。"),
          ),
        90_000,
      );
      this.pending = {
        id,
        resolve,
        reject,
        progress,
        cleanup: () => {
          clearTimeout(timeout);
          signal.removeEventListener("abort", abort);
        },
      };
      signal.addEventListener("abort", abort, { once: true });
      this.worker.postMessage(
        {
          id,
          buffer,
          base: new URL(`${import.meta.env.BASE_URL}ocr/`, location.origin)
            .href,
        } satisfies OcrRequest,
        [buffer],
      );
    });
  }
  dispose() {
    this.reject(abortError());
  }
}
