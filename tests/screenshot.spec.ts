import { test, expect } from "@playwright/test";
test("真实本机 OCR 读取两张设置截图，核对填入后持久保存", async ({ page }) => {
  test.setTimeout(120000);
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("#/settings");
  await page
    .getByLabel("选择灵敏度截图", { exact: true })
    .setInputFiles([
      "tests/fixtures/settings-touch.png",
      "tests/fixtures/settings-gyro.png",
    ]);
  await expect(
    page.getByText("识别完成。请对照截图核对数值，勾选后确认填入。"),
  ).toBeVisible({ timeout: 100000 });
  for (const [name, value] of [
    ["滑屏－灵敏度一键调节（%）", "105"],
    ["滑屏－垂直灵敏度（%）", "90"],
    ["陀螺仪－灵敏度一键调节（%）", "95"],
    ["陀螺仪－垂直灵敏度（%）", "55"],
  ]) {
    await expect(
      page.getByLabel(`识别数值 ${name}`, { exact: true }),
    ).toHaveValue(value);
    await page.getByLabel(`填入 ${name}`, { exact: true }).check();
  }
  await expect(
    page.getByRole("textbox", { name: "参数名称 1", exact: true }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "确认填入 4 项" }).click();
  await expect(
    page.getByRole("textbox", { name: "参数值 1", exact: true }),
  ).toHaveValue("105");
  await expect(
    page.getByRole("textbox", { name: "参数值 4", exact: true }),
  ).toHaveValue("55");
  await page.waitForTimeout(400);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "参数值 4", exact: true }),
  ).toHaveValue("55");
  expect(
    requests
      .filter((url) => /^https?:/.test(url))
      .every((url) => new URL(url).hostname === "127.0.0.1"),
  ).toBe(true);
});
test("截图导入拒绝无效文件且不修改原参数", async ({ page }) => {
  await page.goto("#/settings");
  await page
    .getByRole("textbox", { name: "参数值 1", exact: true })
    .fill("137");
  await page.getByLabel("选择灵敏度截图", { exact: true }).setInputFiles({
    name: "wrong.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await expect(page.getByRole("alert")).toContainText("PNG");
  await expect(
    page.getByRole("textbox", { name: "参数值 1", exact: true }),
  ).toHaveValue("137");
});
test("加载模型时取消可重试，截图不写入参数", async ({ page }) => {
  await page.route("**/ocr/lang/**", (route) => route.abort());
  await page.goto("#/settings");
  await page
    .getByLabel("选择灵敏度截图", { exact: true })
    .setInputFiles("tests/fixtures/settings-touch.png");
  await page.getByRole("button", { name: "取消识别" }).click();
  await expect(
    page.getByLabel("选择灵敏度截图", { exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("textbox", { name: "参数名称 1", exact: true }),
  ).toHaveValue("");
  await expect(page.getByRole("button", { name: "重新识别" })).toBeEnabled();
});
test("模型下载失败明确提示，保留原有配置", async ({ page }) => {
  await page.route("**/ocr/lang/**", (route) => route.abort());
  await page.goto("#/settings");
  await page
    .getByRole("textbox", { name: "参数值 1", exact: true })
    .fill("123");
  await page
    .getByLabel("选择灵敏度截图", { exact: true })
    .setInputFiles("tests/fixtures/settings-touch.png");
  await expect(
    page.getByText(
      "未能完成识别，请查看截图下方的错误提示后重试，或手动填写。",
    ),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("textbox", { name: "参数值 1", exact: true }),
  ).toHaveValue("123");
  await expect(
    page.getByRole("button", { name: "确认填入 0 项" }),
  ).toBeDisabled();
});

test("一张损坏的截图不会阻止另一张有效截图识别", async ({ page }) => {
  await page.goto("#/settings");
  await page.getByLabel("选择灵敏度截图", { exact: true }).setInputFiles([
    {
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("invalid image"),
    },
    {
      name: "settings-touch.png",
      mimeType: "image/png",
      buffer: await (
        await import("node:fs/promises")
      ).readFile("tests/fixtures/settings-touch.png"),
    },
  ]);
  await expect(
    page.getByText("无法读取这张截图，请改用 PNG 或 JPG 文件。"),
  ).toBeVisible();
  await expect(
    page.getByLabel("识别数值 滑屏－灵敏度一键调节（%）", { exact: true }),
  ).toHaveValue("105", { timeout: 40000 });
  await expect(
    page.getByRole("textbox", { name: "参数名称 1", exact: true }),
  ).toHaveValue("");
});
