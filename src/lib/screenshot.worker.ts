/// <reference lib="webworker" />
import { createWorker, OEM, PSM, type Worker as OcrWorker } from "tesseract.js";
import type { OcrLine } from "./screenshot-parser";
import type { OcrRequest, OcrResponse } from "./screenshot-ocr";
const scope = self as unknown as DedicatedWorkerGlobalScope;
let worker: OcrWorker | null = null;
let activeId = 0;
const send = (message: OcrResponse) => scope.postMessage(message);
scope.onmessage = async (event: MessageEvent<OcrRequest>) => {
  const { id, buffer, base } = event.data;
  activeId = id;
  try {
    if (!worker) {
      worker = await createWorker("chi_sim+eng", OEM.LSTM_ONLY, {
        workerPath: `${base}worker.min.js`,
        corePath: `${base}core`,
        langPath: `${base}lang`,
        workerBlobURL: false,
        cacheMethod: "none",
        logger: (message) =>
          send({
            id: activeId,
            type: "progress",
            status: message.status,
            progress: message.progress,
          }),
        errorHandler: () =>
          send({
            id: activeId,
            type: "error",
            message: "识别引擎加载或运行失败，请检查网络后重试。",
          }),
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        user_defined_dpi: "200",
        preserve_interword_spaces: "1",
      });
    }
    const { data } = await worker.recognize(
      new Blob([buffer], { type: "image/png" }),
      {},
      { text: true, blocks: true },
    );
    const lines: OcrLine[] = (data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((p) =>
        p.lines.map((line) => ({
          text: line.text,
          confidence: line.confidence,
          bbox: line.bbox,
        })),
      ),
    );
    send({ id, type: "result", lines, text: data.text });
  } catch {
    send({
      id,
      type: "error",
      message: "截图识别失败。请重试，或改用清晰的完整横屏截图。",
    });
    await worker?.terminate();
    worker = null;
  }
};
