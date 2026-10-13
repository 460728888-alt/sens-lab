import type { Parameter } from "../types";
import { uid } from "../types";

export type ScreenshotPage = "touch" | "gyro" | "unknown";

/** Coordinates refer to the processed image; confidence is OCR's 0–100 score. */
export interface OcrLine {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface ScreenshotField {
  name: string;
  value: string;
  confidence: number;
  sourceText: string;
}

export interface ScreenshotParseResult {
  page: ScreenshotPage;
  fields: ScreenshotField[];
  warnings: string[];
}

const normalize = (text: string) =>
  text
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/靈/g, "灵")
    .replace(/儀/g, "仪")
    .replace(/鍵/g, "键")
    .replace(/調/g, "调")
    .replace(/節/g, "节")
    .replace(/軸/g, "轴");

interface Row {
  lines: OcrLine[];
  y0: number;
  y1: number;
}

/** OCR engines may split a settings row into separate label/value text boxes. */
function rowsFromLines(lines: OcrLine[]): Row[] {
  const rows: Row[] = [];
  const usable = lines
    .filter(
      ({ text, confidence, bbox: b }) =>
        text.trim() &&
        Number.isFinite(confidence) &&
        Object.values(b).every(Number.isFinite) &&
        b.x1 > b.x0 &&
        b.y1 > b.y0,
    )
    .slice()
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);

  for (const line of usable) {
    const b = line.bbox;
    const height = b.y1 - b.y0;
    const center = (b.y1 + b.y0) / 2;
    const row = rows
      .filter((r) => {
        const rowHeight = r.y1 - r.y0;
        const overlap = Math.min(r.y1, b.y1) - Math.max(r.y0, b.y0);
        return (
          overlap >= Math.min(height, rowHeight) * 0.5 &&
          Math.abs(center - (r.y1 + r.y0) / 2) <=
            Math.min(height, rowHeight) * 0.6 &&
          Math.max(height, rowHeight) <= Math.min(height, rowHeight) * 2
        );
      })
      .sort(
        (a, b) =>
          Math.abs(center - (a.y1 + a.y0) / 2) -
          Math.abs(center - (b.y1 + b.y0) / 2),
      )[0];
    if (row) {
      row.lines.push(line);
      row.y0 = Math.min(row.y0, b.y0);
      row.y1 = Math.max(row.y1, b.y1);
    } else {
      rows.push({ lines: [line], y0: b.y0, y1: b.y1 });
    }
  }
  for (const row of rows) {
    row.lines.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  }
  return rows;
}

function rowText(row: Row): string {
  return row.lines.map((line) => line.text.trim()).join(" ");
}

const labels = [
  {
    match: /灵敏度[一—-][键健]调节/,
    name: "灵敏度一键调节（%）",
  },
  {
    // The game explicitly labels this same setting both 垂直灵敏度 and Y轴灵敏度.
    // Either exact label is sufficient; no correction of numeric OCR is applied.
    match: /垂直灵敏度(?:[（(]?Y轴灵敏度[）)]?)?|Y轴灵敏度/i,
    name: "垂直灵敏度（%）",
  },
];

function findLabel(
  text: string,
  pattern: RegExp,
): RegExpMatchArray | undefined {
  // Check the preceding character in code instead of using lookbehind: older
  // Safari must still be able to parse this module and offer manual entry.
  return [
    ...text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`)),
  ].find(
    (match) =>
      !/^Y轴灵敏度$/i.test(match[0]) ||
      match.index === 0 ||
      !/[A-Za-z]/.test(text[match.index! - 1]),
  );
}

/**
 * Extract only screenshot-backed percentages. It does not infer slider ranges,
 * toggle states, device settings, or the relationship to the web trainer's gain.
 */
export function parseScreenshot(
  lines: OcrLine[],
  pageHint: ScreenshotPage = "unknown",
): ScreenshotParseResult {
  const rows = rowsFromLines(lines);
  const warnings: string[] = [];
  const result: ScreenshotParseResult = {
    page: "unknown",
    fields: [],
    warnings,
  };
  if (!rows.length) {
    warnings.push("未识别到可用文字，请上传清晰、完整的游戏灵敏度设置截图。");
    return result;
  }

  // Both tab titles appear in both pages. Only body section headings count.
  const headings = new Set<ScreenshotPage>();
  for (const row of rows) {
    if (row.lines.some((line) => line.confidence < 45)) continue;
    const text = normalize(rowText(row)).replace(/[：:]/g, "");
    if (/^滑屏灵敏度$/.test(text)) headings.add("touch");
    if (/^陀螺仪灵敏度$/.test(text)) headings.add("gyro");
  }
  if (headings.size > 1) {
    warnings.push(
      "截图同时包含滑屏和陀螺仪正文标题，无法确认参数归属，请分别上传两页截图。",
    );
    return result;
  }
  const detected = [...headings][0] ?? "unknown";
  result.page = detected === "unknown" ? pageHint : detected;
  if (
    detected !== "unknown" &&
    pageHint !== "unknown" &&
    pageHint !== detected
  ) {
    warnings.push(
      "所选页面类型与识别到的正文标题不同，请核对页面类型后重新识别。",
    );
    return result;
  }
  if (result.page === "unknown") {
    warnings.push(
      "未识别到滑屏或陀螺仪的正文标题，请先选择截图所属页面。顶部标签不能确定当前页面。",
    );
    return result;
  }
  if (detected === "unknown") {
    warnings.push("页面类型由你手动指定，请确认这些数值属于该页面。");
  }

  const prefix = result.page === "touch" ? "滑屏" : "陀螺仪";
  const found = new Map<string, ScreenshotField[]>();
  const ambiguous = new Set<string>();
  for (const row of rows) {
    const sourceText = rowText(row);
    const text = normalize(sourceText);
    const matched = labels.flatMap((label) => {
      const labelMatch = findLabel(text, label.match);
      return labelMatch ? [{ name: label.name, labelMatch }] : [];
    });
    if (!matched.length) continue;
    for (const label of matched) {
      const name = `${prefix}－${label.name}`;
      const { labelMatch } = label;
      const labelStart = labelMatch.index!;
      const labelEnd = labelStart + labelMatch[0].length;
      const suffix = text.slice(labelEnd);
      // Do not turn O/l into 0/1 or guess a missing %. Reject malformed numbers
      // such as 1,05%, 1.2.3%, and multiple readings in the same setting row.
      const numbers = [
        ...suffix.matchAll(/([+\-]?(?:\d+(?:\.\d+)?|\.\d+))%(?!%)/g),
      ].filter(
        (match) =>
          match.index === 0 || !/[\dA-Za-z.,+\-]/.test(suffix[match.index - 1]),
      );
      const numericRuns = text.match(/[\d.,]+/g) ?? [];
      if (matched.length > 1 || numbers.length > 1 || numericRuns.length > 1) {
        ambiguous.add(name);
        warnings.push(`${name}存在多个或含糊的数值，未自动填写，请核对截图。`);
        continue;
      }
      if (numbers.length !== 1 || !Number.isFinite(Number(numbers[0][1]))) {
        warnings.push(`${name}未识别到明确的百分比数值，请手动核对。`);
        continue;
      }
      const numberStart = labelEnd + numbers[0].index;
      const numberEnd = numberStart + numbers[0][0].length;
      let offset = 0;
      const relevant = row.lines.filter((line) => {
        const start = offset;
        offset += normalize(line.text).length;
        return (
          (start < labelEnd && offset > labelStart) ||
          (start < numberEnd && offset > numberStart)
        );
      });
      const confidence = Math.min(
        ...relevant.map((line) => Math.max(0, Math.min(100, line.confidence))),
      );
      if (confidence < 45) {
        warnings.push(
          `${name}文字识别质量不足，未自动填写，请换清晰截图或手动填写。`,
        );
        continue;
      }
      if (confidence < 75) {
        warnings.push(`${name}文字识别把握较低，请逐字核对原图和数值。`);
      }
      const field: ScreenshotField = {
        name,
        value: String(Number(numbers[0][1])),
        confidence,
        sourceText,
      };
      found.set(name, [...(found.get(name) ?? []), field]);
    }
  }

  for (const [name, fields] of found) {
    if (ambiguous.has(name)) continue;
    if (new Set(fields.map((field) => field.value)).size > 1) {
      warnings.push(`${name}出现互相冲突的数值，未自动填写，请核对截图。`);
      continue;
    }
    result.fields.push({
      ...fields[0],
      confidence: Math.min(...fields.map((field) => field.confidence)),
      sourceText: fields.map((field) => field.sourceText).join("；"),
    });
  }
  if (!result.fields.length) {
    warnings.push("没有可自动填写的参数。请保留原配置，换清晰截图或手动填写。");
  }
  return { ...result, warnings: [...new Set(warnings)] };
}

/** Use the same exact-name key for import previews and applied replacements. */
export const parameterNameKey = (name: string) =>
  name
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[－—–]/g, "-");

/**
 * Call only after the user reviews and explicitly applies the fields. Exact
 * normalized names replace their old values; unrelated fields/IDs are retained.
 * Conflicting duplicate reviewed values throw instead of choosing silently.
 */
export function mergeReviewedParameters(
  existing: Parameter[],
  reviewed: Pick<Parameter, "name" | "value">[],
  createId: () => string = uid,
): Parameter[] {
  const updates = new Map<string, Pick<Parameter, "name" | "value">>();
  for (const field of reviewed) {
    const name = field.name.trim();
    const value = field.value.trim();
    if (!name || !value) throw new Error("请填写参数名称和数值后再应用。");
    const key = parameterNameKey(name);
    const previous = updates.get(key);
    if (previous && previous.value !== value) {
      throw new Error(`「${name}」存在不同的待导入数值，请先核对。`);
    }
    updates.set(key, { name, value });
  }
  const result = existing.map((field) => {
    const update = updates.get(parameterNameKey(field.name));
    return update ? { ...field, value: update.value } : { ...field };
  });
  for (const [key, field] of updates) {
    if (!existing.some((entry) => parameterNameKey(entry.name) === key)) {
      result.push({ id: createId(), ...field });
    }
  }
  // Remove only the initial completely blank form row when something is added.
  return reviewed.length
    ? result.filter((field) => field.name.trim() || field.value.trim())
    : result;
}
