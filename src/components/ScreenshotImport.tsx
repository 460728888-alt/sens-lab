import { useEffect, useRef, useState } from "react";
import { ImagePlus, Check, X } from "lucide-react";
import { uid, type Parameter } from "../types";
import {
  parseScreenshot,
  parameterNameKey,
  type ScreenshotPage,
} from "../lib/screenshot-parser";
import {
  validateScreenshot,
  type OcrResult,
  ScreenshotOcr,
} from "../lib/screenshot-ocr";
interface ReviewedField {
  name: string;
  value: string;
  confidence: number;
  sourceText: string;
  selected: boolean;
}
interface ScreenshotItem {
  id: string;
  file: File;
  url: string;
  hint: ScreenshotPage;
  result: OcrResult | null;
  fields: ReviewedField[];
  warnings: string[];
  error: string;
}
const fieldsFrom = (result: OcrResult, hint: ScreenshotPage) => {
  const parsed = parseScreenshot(result.lines, hint);
  return {
    fields: parsed.fields.map((f) => ({ ...f, selected: f.confidence >= 75 })),
    warnings: parsed.warnings,
  };
};
export function ScreenshotImport({
  parameters,
  onApply,
}: {
  parameters: Parameter[];
  onApply: (fields: { name: string; value: string }[]) => void;
}) {
  const [items, setItems] = useState<ScreenshotItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const resources = useRef<{
    urls: string[];
    abort: AbortController | null;
    ocr: ScreenshotOcr | null;
    generation: number;
  }>({ urls: [], abort: null, ocr: null, generation: 0 });
  useEffect(
    () => () => {
      resources.current.generation++;
      resources.current.abort?.abort();
      resources.current.ocr?.dispose();
      resources.current.urls.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const updateItem = (
    id: string,
    change: (item: ScreenshotItem) => ScreenshotItem,
  ) =>
    setItems((old) =>
      old.map((item) => (item.id === id ? change(item) : item)),
    );
  const run = async (selected: ScreenshotItem[]) => {
    const current = resources.current;
    const generation = ++current.generation;
    current.abort?.abort();
    current.ocr?.dispose();
    const controller = new AbortController();
    current.abort = controller;
    setBusy(true);
    setError("");
    setNotice("");
    setItems((old) =>
      old.map((item) => ({
        ...item,
        result: null,
        fields: [],
        warnings: [],
        error: "",
      })),
    );
    let ocr: ScreenshotOcr | null = null;
    let succeeded = 0;
    try {
      if (controller.signal.aborted) return;
      ocr = new ScreenshotOcr();
      current.ocr = ocr;
      for (let index = 0; index < selected.length; index++) {
        const item = selected[index];
        try {
          if (ocr.isDisposed) {
            ocr = new ScreenshotOcr();
            current.ocr = ocr;
          }
          const result = await ocr.recognize(
            item.file,
            controller.signal,
            (label) => {
              if (generation === current.generation)
                setProgress(`第 ${index + 1}/${selected.length} 张 · ${label}`);
            },
          );
          if (generation !== current.generation || controller.signal.aborted)
            return;
          succeeded++;
          updateItem(item.id, (old) => ({
            ...old,
            result,
            ...fieldsFrom(result, old.hint),
            error: "",
          }));
        } catch (e) {
          if (controller.signal.aborted) throw e;
          updateItem(item.id, (old) => ({
            ...old,
            error: e instanceof Error ? e.message : "读取截图失败",
          }));
        }
      }
      if (!controller.signal.aborted && generation === current.generation) {
        if (succeeded)
          setNotice("识别完成。请对照截图核对数值，勾选后确认填入。");
        else
          setError(
            "未能完成识别，请查看截图下方的错误提示后重试，或手动填写。",
          );
      }
    } catch (e) {
      if (generation === current.generation)
        setError(
          controller.signal.aborted
            ? "已取消识别。已完成的结果仍可核对。"
            : e instanceof Error
              ? e.message
              : "本机识别失败，请重试或手动填写。",
        );
    } finally {
      ocr?.dispose();
      if (current.ocr === ocr) current.ocr = null;
      if (generation === current.generation) {
        setBusy(false);
        setProgress("");
      }
    }
  };
  const choose = (files: FileList | null) => {
    if (!files?.length) return;
    try {
      if (files.length > 2)
        throw new Error("每次最多选择两张截图：滑屏设置和陀螺仪设置各一张。");
      const list = Array.from(files);
      list.forEach(validateScreenshot);
      resources.current.urls.forEach((url) => URL.revokeObjectURL(url));
      const next = list.map((file) => ({
        id: uid(),
        file,
        url: URL.createObjectURL(file),
        hint: "unknown" as const,
        result: null,
        fields: [],
        warnings: [],
        error: "",
      }));
      resources.current.urls = next.map((v) => v.url);
      setItems(next);
      void run(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "请选择有效截图");
    }
  };
  const selected = items.flatMap((item) =>
    item.fields.filter((f) => f.selected),
  );
  const names = selected.map((f) => f.name);
  const conflict = names.some((name, i) => names.indexOf(name) !== i);
  const valid =
    selected.length > 0 &&
    !conflict &&
    selected.every(
      (f) => f.value.trim() !== "" && Number.isFinite(Number(f.value)),
    );
  return (
    <section className="panel screenshot-import">
      <div className="section-heading">
        <div>
          <span className="eyebrow">更快建立配置</span>
          <h2>
            <ImagePlus size={21} />
            截图自动填写
          </h2>
        </div>
        <span className="tag">本机文字识别</span>
      </div>
      <p>
        上传游戏内的「滑屏设置」或「陀螺仪设置」完整横屏截图，自动读取一键调节和垂直灵敏度。可同时选两张。
      </p>
      <label className="screenshot-upload">
        {busy ? "正在识别，请稍候" : "选择灵敏度截图"}
        <input
          aria-label="选择灵敏度截图"
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          multiple
          disabled={busy}
          onChange={(e) => {
            choose(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <p className="muted">
        截图不上传、不保存。首次需下载约 9 MB
        识别资源；请使用清晰原图。开关选中状态、设备型号和网页增益不会自动改动。
      </p>
      {busy && (
        <div className="ocr-progress" role="status">
          <span>{progress || "正在准备本机识别…"}</span>
          <button
            className="text-button"
            onClick={() => {
              resources.current.abort?.abort();
              resources.current.ocr?.dispose();
            }}
          >
            <X size={15} />
            取消识别
          </button>
        </div>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {items.map((item) => (
        <div className="ocr-result" key={item.id}>
          <div className="section-heading">
            <h3>{item.file.name}</h3>
            <label>
              截图类型
              <select
                aria-label={`截图类型 ${item.file.name}`}
                disabled={busy}
                value={item.hint}
                onChange={(e) => {
                  const hint = e.target.value as ScreenshotPage;
                  updateItem(item.id, (old) => ({
                    ...old,
                    hint,
                    ...(old.result ? fieldsFrom(old.result, hint) : {}),
                  }));
                }}
              >
                <option value="unknown">自动判断</option>
                <option value="touch">滑屏设置</option>
                <option value="gyro">陀螺仪设置</option>
              </select>
            </label>
          </div>
          <details>
            <summary>查看原图与识别文字</summary>
            <img src={item.url} alt={`待核对的设置截图：${item.file.name}`} />
            {item.result && <pre>{item.result.text || "未读到文字"}</pre>}
          </details>
          {item.error && <p className="notice">{item.error}</p>}
          {item.warnings.map((warning, i) => (
            <p className="muted" key={i}>
              {warning}
            </p>
          ))}
          {item.fields.map((field, index) => {
            const old = parameters.find(
              (p) => parameterNameKey(p.name) === parameterNameKey(field.name),
            );
            return (
              <div className="ocr-field" key={field.name}>
                <label className="ocr-check">
                  <input
                    type="checkbox"
                    checked={field.selected}
                    disabled={busy}
                    aria-label={`填入 ${field.name}`}
                    onChange={(e) =>
                      updateItem(item.id, (old) => ({
                        ...old,
                        fields: old.fields.map((f, i) =>
                          i === index
                            ? { ...f, selected: e.target.checked }
                            : f,
                        ),
                      }))
                    }
                  />
                  <span>
                    {field.name}
                    <small>
                      {field.confidence >= 75
                        ? "请核对后填入"
                        : "识别不确定，请核对并手动勾选"}
                    </small>
                    {old && old.value !== field.value && (
                      <small>将替换已有值：{old.value}</small>
                    )}
                  </span>
                </label>
                <label>
                  识别数值
                  <input
                    aria-label={`识别数值 ${field.name}`}
                    inputMode="decimal"
                    value={field.value}
                    disabled={busy}
                    onChange={(e) =>
                      updateItem(item.id, (old) => ({
                        ...old,
                        fields: old.fields.map((f, i) =>
                          i === index ? { ...f, value: e.target.value } : f,
                        ),
                      }))
                    }
                  />
                </label>
              </div>
            );
          })}
        </div>
      ))}
      {conflict && (
        <p className="notice">
          所选截图有重复参数，请对照原图，仅勾选同一参数的一条记录。
        </p>
      )}
      {items.length > 0 && !busy && (
        <div className="button-row">
          <button
            className="primary"
            disabled={!valid}
            onClick={() => {
              onApply(
                selected.map((f) => ({
                  name: f.name,
                  value: String(Number(f.value)),
                })),
              );
              setItems((old) =>
                old.map((item) => ({
                  ...item,
                  fields: item.fields.map((f) => ({ ...f, selected: false })),
                })),
              );
              setNotice(
                `已填入 ${selected.length} 项参数，可继续编辑或开始检测。`,
              );
            }}
          >
            <Check size={16} />
            确认填入 {selected.length} 项
          </button>
          <button className="secondary" onClick={() => void run(items)}>
            重新识别
          </button>
        </div>
      )}
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
