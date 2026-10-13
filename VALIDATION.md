# V1.0 实际验证记录

执行日期：2026-10-13。环境：Node.js 24.19.0 / npm 11.9.0 / Debian 13；CI 配置使用 Node.js 22。

## 已通过

- `npm install`：成功。
- 干净 `npm ci`：成功。
- `npm run build`：TypeScript 检查及 Vite 生产构建成功。
- `npm test`：22 / 22 单元测试通过。
- `npm run test:e2e`：27 / 27 用例通过，覆盖 Chromium 手机视口、WebKit iPhone 视口和桌面 Chromium，每组 9 项。
- 本地生产预览 `/sens-lab/` 返回 HTTP 200；HTML 中 JS/CSS 均以 `/sens-lab/` 为前缀，资源请求成功；`#/video` 刷新仍可打开。
- 生产页面未捕获到 JavaScript 运行错误，已检查桌面与手机截图。
- `git diff --check`：通过。

端到端覆盖资料保存与刷新、Hash 路由、候选配置、JSON 下载、四种滑动训练的暂停重测、完整 24 秒训练自动报告、本地合成 MP4 的解码和关键帧保存、文件失败提示、屏幕变化暂停、Pointer Events 缺失降级、触控取消暂停。

## 测试环境说明

云容器缺少 WebKit 系统库且无 root 安装权限。测试所需 Debian 共享库下载到项目之外的独立目录，校验包的 SHA-256 后接入浏览器运行库目录。Playwright 的系统库清单检查依赖系统级位置，所以本地最终命令为：

```bash
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm run test:e2e
```

该变量只跳过环境预检，**全部 27 项浏览器测试实际执行并通过**，没有跳过或模拟断言。此临时环境处理未写入项目或 CI；GitHub Actions 使用 `npx playwright install --with-deps chromium webkit` 安装常规依赖。

浏览器设备模拟与鼠标驱动的 Pointer Events 测试不等同于真机手指测试。尚未进行实体 iPhone、Android 和平板上的延迟、系统手势、长时间运行及各类真实游戏录屏编码验收。推荐算法是透明的探索性实验规则，没有经过大规模玩家数据验证；录像 V1 为人工标注，没有自动 AI 识别。

## 发布状态

- 仓库已成功读取：`460728888-alt/sens-lab`，初始远端 main 为 `3cdb71c43570d8cde7d5604572bf4307a2ef9896`。
- 当前环境 `gh auth status` 报告凭据无效，无法认证推送或创建 PR。
- 核验时 `https://460728888-alt.github.io/sens-lab/` 返回 **HTTP 404**。
- 已准备 GitHub Pages 工作流，**未完成远端构建与部署，不能视为已经上线**。

完整上传、Pages 设置和运行说明见 README.md。
