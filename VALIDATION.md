# 实际验证记录

## V1.1 截图导入：本地验证结果

本次新增本地 Tesseract.js `chi_sim+eng` 截图 OCR，只提取滑屏／陀螺仪两页的一键调节及垂直灵敏度数值。截图不上传，不从开关文字推断选中状态；核对并确认后才将参数保存。识别成功不代表灵敏度适合玩家，也不构成游戏目标追踪能力。

- `npm ci` 成功；`npm test` 最终 51 / 51 通过，其中解析及合并单元测试 29 项。覆盖两个顶部页签并存、正文页面判定、标签和数值分列、明确的 Y 轴标签、百分比格式、同名冲突、低质量识别、手动页面归属和参数合并。
- `npm run build` 成功。完整浏览器测试 45 / 45 通过，覆盖 Chromium 手机、WebKit 手机及桌面各 15 项。消除 Safari 图片放大插值差异后，四项数值均正确读取。
- 最后一次旧版 Safari 正则兼容修正及上传按钮样式调整后，重新通过 51 / 51 单元测试、生产构建和全部截图 E2E 15 / 15。未修改训练测试或放宽断言。
- 额外在 WebKit 的 iPad Pro 11 模拟视口（834 × 1194）检查双图识别，读取 105、90、95、55，未发生页面水平溢出；此项不等于实体 iPad 验收。
- 测试使用的 `settings-touch.png` 和 `settings-gyro.png` 为自制合成 PNG，不是真实游戏截图、官方美术资源或真实玩家数据。浏览器测试调用实际 OCR 引擎和模型；合成样例的结果不能外推成真实游戏截图识别率。
- 新版 Playwright 使用生产预览服务，验证顺序为 `npm run build` 后 `npm run test:e2e`。修改源代码后必须重新构建，避免验证旧的 `dist`。
- 首次 OCR 从本站下载约 9 MB 模型及核心资源；最多两张图片顺序处理，每张限制 12 MB 和 2400 万像素。仍需实体 iPhone、Android、iPad 上的内存占用、长时间识别和真实设置截图验收。
- 2026-10-13 再次检查 `gh auth status`，环境令牌仍无效，无法替用户推送 GitHub。已准备完整源码更新包；V1.1 尚未完成远端构建部署，不能声称线上已更新。

本地 Playwright 沿用下述系统库补充及 `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` 环境设置；浏览器和真实 OCR 引擎确实执行，没有模拟 OCR 响应。

## V1.0 初次交付验证（历史记录）

执行日期：2026-10-13。环境：Node.js 24.19.0 / npm 11.9.0 / Debian 13；CI 配置使用 Node.js 22。

### 当时已通过

- `npm install`：成功。
- 干净 `npm ci`：成功。
- `npm run build`：TypeScript 检查及 Vite 生产构建成功。
- `npm test`：22 / 22 单元测试通过。
- `npm run test:e2e`：27 / 27 用例通过，覆盖 Chromium 手机视口、WebKit iPhone 视口和桌面 Chromium，每组 9 项。
- 本地生产预览 `/sens-lab/` 返回 HTTP 200；HTML 中 JS/CSS 均以 `/sens-lab/` 为前缀，资源请求成功；`#/video` 刷新仍可打开。
- 生产页面未捕获到 JavaScript 运行错误，已检查桌面与手机截图。
- `git diff --check`：通过。

端到端覆盖资料保存与刷新、Hash 路由、候选配置、JSON 下载、四种滑动训练的暂停重测、完整 24 秒训练自动报告、本地合成 MP4 的解码和关键帧保存、文件失败提示、屏幕变化暂停、Pointer Events 缺失降级、触控取消暂停。

### 当时的测试环境说明

云容器缺少 WebKit 系统库且无 root 安装权限。测试所需 Debian 共享库下载到项目之外的独立目录，校验包的 SHA-256 后接入浏览器运行库目录。Playwright 的系统库清单检查依赖系统级位置，所以本地最终命令为：

```bash
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm run test:e2e
```

该变量只跳过环境预检，**全部 27 项浏览器测试实际执行并通过**，没有跳过或模拟断言。此临时环境处理未写入项目或 CI；GitHub Actions 使用 `npx playwright install --with-deps chromium webkit` 安装常规依赖。

浏览器设备模拟与鼠标驱动的 Pointer Events 测试不等同于真机手指测试。尚未进行实体 iPhone、Android 和平板上的延迟、系统手势、长时间运行及各类真实游戏录屏编码验收。推荐算法是透明的探索性实验规则，没有经过大规模玩家数据验证；录像 V1 为人工标注，没有自动 AI 识别。

### 初次交付时的发布状态

以下为初次交付那次核验的历史状态，不代表当前网站状态，也不用于证明 V1.1 已发布。

- 仓库已成功读取：`460728888-alt/sens-lab`，初始远端 main 为 `3cdb71c43570d8cde7d5604572bf4307a2ef9896`。
- 当前环境 `gh auth status` 报告凭据无效，无法认证推送或创建 PR。
- 核验时 `https://460728888-alt.github.io/sens-lab/` 返回 **HTTP 404**。
- 已准备 GitHub Pages 工作流，**未完成远端构建与部署，不能视为已经上线**。

完整上传、Pages 设置和运行说明见 README.md。

### 后续 CI 暂停测试修复

用户的 GitHub Actions 日志显示 26 / 27 项通过，WebKit 的四项训练交互测试在等待“暂停”按钮时超时。训练存在超过 250 ms 长帧即自动暂停的保护；原测试依赖墙钟时间，没有隔离 CI 调度延迟。

修复：该交互测试使用 Playwright 可控时钟，显式推进绘制时间；另外新增模拟 1000 ms 长帧的自动暂停、恢复及手动暂停测试。未删除断言、未跳过 WebKit、未放宽产品保护阈值。对变更相关用例进行三种浏览器配置复测，6 / 6 通过。

后续用户提供的 GitHub Actions 截图显示提交 `c77eb95` 对应的检查部署工作流为绿色。该截图属于 V1.0 后续部署记录，不能替代 V1.1 的构建、部署及页面核验。
