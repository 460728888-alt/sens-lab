import { test, expect, type Page } from "@playwright/test";
async function setup(page: Page) {
  await page.goto("#/device");
  await page.getByLabel("手机或平板型号").fill("测试设备");
  await page.getByRole("link", { name: "下一步：填写灵敏度" }).click();
  await page
    .getByRole("textbox", { name: "参数名称 1", exact: true })
    .fill("玩家自定义参数");
  await page
    .getByRole("textbox", { name: "参数值 1", exact: true })
    .fill("100");
  await page.getByRole("link", { name: "保存并开始检测" }).click();
}
test("移动布局、自动保存、哈希路由刷新、实验候选与导出", async ({ page }) => {
  await setup(page);
  await expect(
    page.getByRole("heading", { name: "开始检测", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.getByText("当前配置：")).toBeVisible();
  await page.goto("#/experiments");
  await page.getByRole("button", { name: "创建 ×0.9 候选" }).click();
  await expect(
    page.getByRole("heading", { name: "需要更多重复测试" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "保存报告快照" }).click();
  await page.goto("#/history");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出全部" }).click();
  expect((await download).suggestedFilename()).toContain(".json");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("四项真实滑动训练、暂停重置与报告", async ({ page }) => {
  await setup(page);
  for (const mode of ["flick", "micro", "track", "turn"]) {
    await page.goto(`#/train/${mode}`);
    await page.getByRole("button", { name: "开始训练", exact: true }).click();
    const canvas = page.getByLabel("滑动瞄准训练区域");
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6);
    await page.mouse.down();
    for (let i = 0; i < 24; i++)
      await page.mouse.move(
        box.x + box.width * (0.3 + i * 0.01),
        box.y + box.height * 0.6,
      );
    await page.mouse.up();
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    await expect(page.getByText("已暂停。继续时")).toBeVisible();
    await page.getByRole("button", { name: "重新测试" }).click();
    await expect(page.getByText("0.0 / 24 秒")).toBeVisible();
  }
});
test("完成一轮记录真实样本并立即展示报告", async ({ page }) => {
  await setup(page);
  await page.goto("#/train/flick");
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  const box = (await page.getByLabel("滑动瞄准训练区域").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  for (let i = 0; i < 30; i++)
    await page.mouse.move(
      box.x + box.width * (0.2 + i * 0.015),
      box.y + box.height * 0.5,
    );
  await page.mouse.up();
  await expect(
    page.getByRole("heading", { name: "综合检测报告", exact: true }),
  ).toBeVisible({ timeout: 35000 });
  await expect(page.getByText("已完成有效触控采样。")).toBeVisible();
  await expect(page.getByText("有效目标样本", { exact: true })).toBeVisible();
});
test("不兼容文件显示明确错误", async ({ page }) => {
  await page.goto("#/video");
  await page.getByLabel("选择训练录像", { exact: true }).setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.getByRole("alert")).toContainText("请选择");
});
test("首页桌面与移动截图", async ({ page }, info) => {
  await page.goto("");
  await expect(
    page.getByRole("heading", { name: /找到属于你的/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/home-${info.project.name}.png`,
    fullPage: true,
  });
});
test("本地视频解码、定位、关键帧标注与保存", async ({ page }) => {
  await page.goto("#/video");
  await page
    .getByLabel("选择训练录像", { exact: true })
    .setInputFiles("tests/fixtures/training.mp4");
  await expect(page.locator("video")).toHaveJSProperty("videoWidth", 320);
  const overlay = page.getByLabel("录像标注画布");
  const box = (await overlay.boundingBox())!;
  await overlay.click({
    position: { x: box.width * 0.5, y: box.height * 0.5 },
  });
  await overlay.click({
    position: { x: box.width * 0.6, y: box.height * 0.4 },
  });
  await page.getByRole("button", { name: "记录当前关键帧" }).click();
  await page.getByRole("button", { name: "后移约 1/30 秒" }).click();
  await expect(
    page.getByRole("button", { name: "播放", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "标注准星", exact: true }).click();
  await overlay.click({
    position: { x: box.width * 0.5, y: box.height * 0.5 },
  });
  await overlay.click({
    position: { x: box.width * 0.65, y: box.height * 0.4 },
  });
  await page.getByRole("button", { name: "记录当前关键帧" }).click();
  await page.getByLabel("可比任务标识（必填）").fill("测试用固定目标");
  await page.getByRole("button", { name: "保存分析", exact: true }).click();
  await expect(page.getByText("1 段已保存")).toBeVisible();
  await expect(page.getByText(/2 帧 · 平均误差/)).toBeVisible();
  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.getByText("1 段已保存")).toBeVisible();
});
test("视口变化自动暂停，不混用训练坐标", async ({ page }) => {
  await setup(page);
  await page.goto("#/train/turn");
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  await page.waitForTimeout(150);
  const current = page.viewportSize()!;
  await page.setViewportSize({
    width: current.width + 30,
    height: current.height,
  });
  await expect(page.getByText(/屏幕尺寸发生变化，已暂停/)).toBeVisible();
});
test("不支持触控 API 时明确降级", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "PointerEvent", {
      value: undefined,
      configurable: true,
    });
  });
  await setup(page);
  await page.goto("#/train/flick");
  await expect(
    page.getByRole("button", { name: "开始训练", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/此浏览器不支持 Pointer Events/)).toBeVisible();
});
test("系统触控取消自动暂停", async ({ page }) => {
  await setup(page);
  await page.goto("#/train/micro");
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  const canvas = page.getByLabel("滑动瞄准训练区域"),
    box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 50, box.y + 100);
  await page.mouse.down();
  await canvas.dispatchEvent("pointercancel", {
    pointerId: 1,
    pointerType: "mouse",
    clientX: box.x + 50,
    clientY: box.y + 100,
  });
  await page.mouse.up();
  await expect(page.getByText("触控被系统取消，已暂停。")).toBeVisible();
});
