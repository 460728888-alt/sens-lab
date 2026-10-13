import { describe, expect, it } from "vitest";
import {
  mergeReviewedParameters,
  parameterNameKey,
  parseScreenshot,
  type OcrLine,
} from "./screenshot-parser";

function line(
  text: string,
  y: number,
  x = 200,
  width = 700,
  confidence = 92,
): OcrLine {
  return {
    text,
    confidence,
    bbox: { x0: x, y0: y, x1: x + width, y1: y + 22 },
  };
}

const tabs = () => [line("滑屏设置 陀螺仪设置", 60)];
const touch = () => [
  ...tabs(),
  line("滑屏灵敏度", 320),
  line("灵敏度一键调节 开启 105%", 370),
  line("开火复用镜头灵敏度 开启", 430),
  line("垂直灵敏度（Y轴灵敏度）90%", 490),
];
const gyro = () => [
  ...tabs(),
  line("陀螺仪灵敏度", 120),
  line("陀螺仪 关闭 开镜开启 总是开启", 160),
  line("灵敏度一键调节 开启 95%", 330),
  line("开火复用陀螺仪灵敏度 开启", 390),
  line("垂直灵敏度（Y轴灵敏度）55%", 440),
];

describe("截图参数提取", () => {
  it("从截图正文识别滑屏百分比，忽略同时出现的陀螺仪页签", () => {
    const result = parseScreenshot(touch());
    expect(result.page).toBe("touch");
    expect(result.fields.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: "滑屏－灵敏度一键调节（%）", value: "105" },
      { name: "滑屏－垂直灵敏度（%）", value: "90" },
    ]);
    expect(result.fields[0].sourceText).toContain("105%");
  });

  it("识别陀螺仪正文，不从页面文字推断开关选择状态", () => {
    const result = parseScreenshot(gyro());
    expect(result.page).toBe("gyro");
    expect(result.fields.map((field) => field.value)).toEqual(["95", "55"]);
    expect(
      result.fields.every((field) => field.name.startsWith("陀螺仪－")),
    ).toBe(true);
    expect(result).not.toHaveProperty("gyroEnabled");
  });

  it("只有顶部页签或开火复用标签，不能确定截图页面", () => {
    const input = [
      ...tabs(),
      line("开火复用陀螺仪灵敏度 开启", 200),
      line("灵敏度一键调节 95%", 340),
    ];
    expect(parseScreenshot(input).fields).toEqual([]);
    expect(parseScreenshot(input).page).toBe("unknown");
    expect(parseScreenshot(input, "gyro").fields[0].value).toBe("95");
  });

  it("合并同一行的文字和右侧数值，不拿邻行的数值补齐", () => {
    const input = [
      ...tabs(),
      line("滑屏灵敏度", 320),
      line("灵敏度一键调节", 370, 200, 240),
      line("105 %", 372, 810, 60),
      line("垂直灵敏度（Y轴灵敏度）", 490, 200, 310),
      line("90%", 535, 810, 60),
    ];
    expect(parseScreenshot(input).fields.map((field) => field.value)).toEqual([
      "105",
    ]);
  });

  it("支持 OCR 将标签和值识别成多个单词框", () => {
    const input = [
      line("滑屏灵敏度", 320),
      line("灵敏度", 370, 200, 80),
      line("一键调节", 370, 286, 90),
      line("开启", 370, 690, 42),
      line("１０５", 372, 810, 50),
      line("％", 372, 862, 16),
    ];
    expect(parseScreenshot(input).fields[0].value).toBe("105");
  });

  it("垂直文字误识别时可依据明确的 Y轴灵敏度 标签和同排百分比", () => {
    const result = parseScreenshot([
      line("滑屏灵敏度", 320),
      line("垂直有灵敏度 〈Y轴灵敏度)", 490, 200, 310),
      line("90%", 491, 810, 60),
    ]);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toMatchObject({
      name: "滑屏－垂直灵敏度（%）",
      value: "90",
    });
    expect(result.fields[0].sourceText).toContain("〈Y轴灵敏度)");
  });

  it("只有模糊的垂直名称、X轴标签或含糊数值时不推断 Y轴数值", () => {
    for (const text of [
      "垂直有灵敏度 90%",
      "X轴灵敏度 90%",
      "XY轴灵敏度 90%",
      "垂直有灵敏度 〈Y轴灵敏度) 9O%",
    ]) {
      expect(
        parseScreenshot([line("滑屏灵敏度", 320), line(text, 490)]).fields,
      ).toEqual([]);
    }
  });

  it("Y轴标签检查前字符，且不会被前面的 XY 标签遮住", () => {
    for (const text of [
      "Y轴灵敏度 90%",
      "（Y轴灵敏度）90%",
      "XY轴灵敏度 / Y轴灵敏度 90%",
    ]) {
      expect(
        parseScreenshot([line("滑屏灵敏度", 320), line(text, 490)]).fields[0]
          .value,
      ).toBe("90");
    }
    expect(
      parseScreenshot([line("滑屏灵敏度", 320), line("xy轴灵敏度 90%", 490)])
        .fields,
    ).toEqual([]);
  });

  it("百分比边界不截取字母后数字或不完整的符号及小数", () => {
    for (const value of [
      "O105%",
      "A105%",
      "x-105%",
      "++105%",
      "--105%",
      "..5%",
      "1e3%",
    ]) {
      expect(
        parseScreenshot([
          line("滑屏灵敏度", 120),
          line(`灵敏度一键调节 ${value}`, 330),
        ]).fields,
      ).toEqual([]);
    }
    for (const [value, expected] of [
      ["+95.5%", "95.5"],
      ["-.5%", "-0.5"],
    ]) {
      const result = parseScreenshot([
        line("滑屏灵敏度", 120),
        line("灵敏度一键调节", 330, 200, 250, 88),
        line("开启", 330, 650, 50, 20),
        line(value, 330, 810, 60, 94),
      ]);
      expect(result.fields[0]).toMatchObject({
        value: expected,
        confidence: 88,
      });
    }
  });

  it("容忍空格、全角符号与保守的字形差异", () => {
    const input = [
      line("陀 螺 儀 靈 敏 度", 120),
      line("靈敏度一健調節 ９５．５％", 330),
    ];
    expect(parseScreenshot(input).fields[0]).toMatchObject({
      name: "陀螺仪－灵敏度一键调节（%）",
      value: "95.5",
    });
  });

  it("不凭空限定游戏数值范围", () => {
    const input = [
      line("滑屏灵敏度", 120),
      line("灵敏度一键调节 1001.25%", 330),
    ];
    expect(parseScreenshot(input).fields[0].value).toBe("1001.25");
  });

  it.each(["105", "1O5%", "1,05%", "1.2.3%", "Infinity%", "105%%"])(
    "拒绝缺少百分号或格式含糊的数值 %s",
    (value) => {
      expect(
        parseScreenshot([
          line("滑屏灵敏度", 120),
          line(`灵敏度一键调节 ${value}`, 330),
        ]).fields,
      ).toEqual([]);
    },
  );

  it("同一行有多个数值时留空，不能选择看起来更合理的值", () => {
    const input = [
      line("滑屏灵敏度", 120),
      line("灵敏度一键调节 105% 90%", 330),
    ];
    expect(parseScreenshot(input).fields).toEqual([]);
    expect(parseScreenshot(input).warnings.join()).toContain("多个");
  });

  it("重复的同名行出现冲突时留空，相同值可去重", () => {
    const input = [...touch(), line("灵敏度一键调节 110%", 600)];
    expect(parseScreenshot(input).fields.map((field) => field.value)).toEqual([
      "90",
    ]);
    expect(
      parseScreenshot([...touch(), line("灵敏度一键调节 105%", 600)]).fields,
    ).toHaveLength(2);
  });

  it("正文页面冲突或手动选择与正文不符时，不冒险填写", () => {
    expect(
      parseScreenshot([...touch(), line("陀螺仪灵敏度", 600)], "touch").fields,
    ).toEqual([]);
    expect(parseScreenshot(touch(), "gyro").fields).toEqual([]);
  });

  it("没有页面标题时只在用户指定归属后提取", () => {
    const input = [line("灵敏度一键调节 105%", 330)];
    expect(parseScreenshot(input).fields).toEqual([]);
    expect(parseScreenshot(input, "touch").fields[0].value).toBe("105");
    expect(parseScreenshot(input, "touch").warnings.join()).toContain(
      "手动指定",
    );
  });

  it("无法从空截图、无效坐标或低质量识别中制造参数", () => {
    expect(parseScreenshot([]).fields).toEqual([]);
    expect(
      parseScreenshot([
        { ...line("滑屏灵敏度", 120), bbox: { x0: NaN, x1: 1, y0: 1, y1: 2 } },
      ]).page,
    ).toBe("unknown");
    const result = parseScreenshot([
      line("滑屏灵敏度", 120),
      line("灵敏度一键调节 105%", 330, 200, 700, 30),
    ]);
    expect(result.fields).toEqual([]);
    expect(result.warnings.join()).toContain("质量不足");
  });

  it("保留识别质量信息并提示核对，不把 OCR 置信度当匹配度", () => {
    const result = parseScreenshot([
      line("滑屏灵敏度", 120),
      line("灵敏度一键调节 105%", 330, 200, 700, 68),
    ]);
    expect(result.fields[0].confidence).toBe(68);
    expect(result.warnings.join()).toContain("逐字核对");
  });

  it("无关的开关框或图标低分不降低已识别的标签及数值质量", () => {
    const result = parseScreenshot([
      line("滑屏灵敏度", 120),
      line("灵敏度一键调节", 330, 200, 250, 88),
      line("开启", 330, 650, 50, 20),
      line("105%", 330, 810, 60, 94),
    ]);
    expect(result.fields[0].confidence).toBe(88);
  });

  it("正文标题识别质量不足时请用户选择页面，不自动归类", () => {
    const input = [
      line("滑屏灵敏度", 120, 200, 200, 20),
      line("灵敏度一键调节 105%", 330),
    ];
    expect(parseScreenshot(input).page).toBe("unknown");
    expect(parseScreenshot(input, "touch").fields[0].value).toBe("105");
  });
});

describe("应用已经核对的截图参数", () => {
  it("预览和合并使用相同的参数名键，不混淆滑屏及陀螺仪参数", () => {
    expect(parameterNameKey(" 滑屏-灵敏度一键调节(%) ")).toBe(
      parameterNameKey("滑屏－灵敏度一键调节（%）"),
    );
    expect(parameterNameKey("陀螺仪－灵敏度一键调节（%）")).not.toBe(
      parameterNameKey("滑屏－灵敏度一键调节（%）"),
    );
  });
  it("保留其他参数、既有 ID 和入参数组，只更新确切的同名字段", () => {
    const existing = [
      { id: "a", name: "滑屏－灵敏度一键调节（%）", value: "100" },
      { id: "b", name: "自定义镜头值", value: "5" },
    ];
    const merged = mergeReviewedParameters(
      existing,
      [
        { name: "滑屏-灵敏度一键调节(%)", value: "105" },
        { name: "陀螺仪－垂直灵敏度（%）", value: "55" },
      ],
      () => "new",
    );
    expect(merged).toEqual([
      { id: "a", name: "滑屏－灵敏度一键调节（%）", value: "105" },
      existing[1],
      { id: "new", name: "陀螺仪－垂直灵敏度（%）", value: "55" },
    ]);
    expect(existing[0].value).toBe("100");
  });

  it("不给未命名的手填数值擅自指定字段，只去掉完全空白初始行", () => {
    const merged = mergeReviewedParameters(
      [
        { id: "blank", name: "", value: "" },
        { id: "manual", name: "", value: "105" },
      ],
      [{ name: "滑屏－灵敏度一键调节（%）", value: "105" }],
      () => "new",
    );
    expect(merged.map((field) => field.id)).toEqual(["manual", "new"]);
  });

  it("同一批导入存在同名冲突时，要求核对而非保留最后一项", () => {
    expect(() =>
      mergeReviewedParameters(
        [],
        [
          { name: "滑屏－灵敏度一键调节（%）", value: "105" },
          { name: "滑屏－灵敏度一键调节（%）", value: "110" },
        ],
      ),
    ).toThrow("不同的待导入数值");
    expect(() =>
      mergeReviewedParameters([], [{ name: "", value: "105" }]),
    ).toThrow("参数名称");
  });
});
