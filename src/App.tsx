import { useCallback, useEffect, useState } from "react";
import {
  Crosshair,
  LayoutDashboard,
  Smartphone,
  SlidersHorizontal,
  ScanLine,
  ChartNoAxesCombined,
  History as HistoryIcon,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Fingerprint,
  Zap,
  Focus,
  MoveRight,
  Target,
  Menu,
  X,
  Check,
} from "lucide-react";
import { initialData, modes, type LabData, type Mode, type Run } from "./types";
import { loadData, saveData } from "./lib/storage";
import { Training } from "./components/Training";
import { Experiments } from "./components/Experiments";
import { VideoAnalysis } from "./components/VideoAnalysis";
import { Settings } from "./components/Settings";
import { Reports, History } from "./components/Reports";
const navigation = [
  ["/", "实验室概览", LayoutDashboard],
  ["/device", "我的设备", Smartphone],
  ["/settings", "灵敏度设置", SlidersHorizontal],
  ["/train", "开始检测", Crosshair],
  ["/video", "录像分析", ScanLine],
  ["/experiments", "参数实验", ChartNoAxesCombined],
  ["/report", "综合报告", ChartNoAxesCombined],
  ["/history", "历史记录", HistoryIcon],
] as const;
const icons = { flick: Zap, micro: Focus, track: Target, turn: MoveRight };
function TrainingCards() {
  return (
    <div className="four-grid">
      {Object.entries(modes).map(([key, m], i) => {
        const Icon = icons[key as Mode];
        return (
          <a href={`#/train/${key}`} className="training-card" key={key}>
            <div className="card-top">
              <Icon size={24} />
              <span>0{i + 1}</span>
            </div>
            <h3>{m.name}</h3>
            <p>{m.description}</p>
            <div className="card-foot">
              <span>24 秒 · 真实触控</span>
              <ArrowUpRight size={18} />
            </div>
          </a>
        );
      })}
    </div>
  );
}
function Home({ data }: { data: LabData }) {
  return (
    <div className="page home">
      <div className="topline">
        <span>
          <i className="live-dot" /> 本地实验室已就绪
        </span>
        <span>版本 1.1 / 免费开放</span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="red-line" /> 为每一次精准而生
          </div>
          <h1>
            找到属于你的
            <br />
            <span>瞄准手感。</span>
          </h1>
          <p>
            无畏契约手游智能灵敏度实验室
            <br />
            用真实触控与训练录像，让每一次调整都有依据。
          </p>
          <div className="button-row">
            <a
              className="primary large"
              href={data.profile.model ? "#/train" : "#/device"}
            >
              开始检测 <ArrowUpRight size={19} />
            </a>
            <a className="secondary large" href="#/video">
              分析游戏录像 <ScanLine size={18} />
            </a>
          </div>
          <div className="hero-notes">
            <span>
              <ShieldCheck size={14} />
              录像不上传
            </span>
            <span>
              <Fingerprint size={14} />
              真实触控采样
            </span>
            <span>完全免费</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-label">
            触控瞄准实验 <span>01 / 04</span>
          </div>
          <div className="radar">
            <div className="radar-circle one" />
            <div className="radar-circle two" />
            <div className="radar-circle three" />
            <div className="radar-axis horizontal" />
            <div className="radar-axis vertical" />
            <svg viewBox="0 0 360 300">
              <path
                d="M42 245 C95 247 83 122 144 167 S189 203 220 133 S262 98 272 101"
                fill="none"
                stroke="#ff505e"
                strokeWidth="2"
                strokeDasharray="5 5"
              />
              <circle
                cx="272"
                cy="101"
                r="13"
                fill="#ff4b5822"
                stroke="#ff4b58"
              />
              <circle cx="272" cy="101" r="4" fill="#ff4b58" />
            </svg>
            <Crosshair className="radar-cross" size={36} />
            <span className="axis-label">滑动 · 瞄准 · 修正</span>
          </div>
          <div className="visual-bottom">
            <span>
              <i className="live-dot" /> 轨迹示意 · 非测试数据
            </span>
            <span>本机计算 ↗</span>
          </div>
        </div>
      </section>
      <section className="summary-strip">
        <div>
          <span className="summary-icon">
            <Crosshair size={19} />
          </span>
          <div>
            <strong>
              {data.runs.filter((r) => r.valid).length} <small>次</small>
            </strong>
            <span>有效检测</span>
          </div>
        </div>
        <div>
          <span className="summary-icon">
            <SlidersHorizontal size={19} />
          </span>
          <div>
            <strong>
              {data.configs.length} <small>组</small>
            </strong>
            <span>灵敏度配置</span>
          </div>
        </div>
        <div>
          <span className="summary-icon">
            <ScanLine size={19} />
          </span>
          <div>
            <strong>
              {data.videos.length} <small>段</small>
            </strong>
            <span>录像分析</span>
          </div>
        </div>
        <a href="#/report">
          查看我的报告 <ArrowUpRight size={18} />
        </a>
      </section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">训练模块</span>
          <h2>从四个维度，认识你的操作</h2>
        </div>
        <a href="#/train" className="text-button">
          全部检测 <ArrowRight size={16} />
        </a>
      </div>
      <TrainingCards />
      <section className="workflow panel">
        <div>
          <span className="eyebrow">简单三步，开始你的实验</span>
          <h2>少一点猜测，多一点证据。</h2>
          <p>网页增益与游戏灵敏度分别验证，不做未经验证的换算。</p>
        </div>
        <div className="steps">
          <a href="#/device">
            <b>01</b>
            <span>
              建立基准<small>记录设备与当前参数</small>
            </span>
          </a>
          <a href="#/train">
            <b>02</b>
            <span>
              采集表现<small>完成触控或录像标注</small>
            </span>
          </a>
          <a href="#/experiments">
            <b>03</b>
            <span>
              对比与复测<small>每次只改变一个变量</small>
            </span>
          </a>
        </div>
      </section>
      <footer>
        独立玩家工具，与游戏官方无关联。未使用官方游戏美术资源。
        <span>SENS LAB · 让手感有据可循</span>
      </footer>
    </div>
  );
}
export default function App() {
  const [data, setData] = useState<LabData>(initialData);
  const [loaded, setLoaded] = useState(false);
  const [storage, setStorage] = useState("正在读取本地资料");
  const [path, setPath] = useState(location.hash.slice(1) || "/");
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    let active = true;
    loadData()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setStorage(String(e.message));
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    const hash = () => {
      setPath(location.hash.slice(1) || "/");
      setMenu(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", hash);
    return () => {
      active = false;
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    setStorage("正在保存");
    const t = setTimeout(
      () =>
        saveData(data)
          .then(() => setStorage("已自动保存至本机"))
          .catch((e) => setStorage(e.message)),
      200,
    );
    return () => clearTimeout(t);
  }, [data, loaded]);
  const update = useCallback((fn: (d: LabData) => LabData) => setData(fn), []);
  const complete = useCallback((run: Run) => {
    setData((d) => ({ ...d, runs: [...d.runs, run] }));
    location.hash = "/report";
  }, []);
  const config =
    data.configs.find((c) => c.id === data.activeConfig) ?? data.configs[0];
  const mode = path.split("/")[2] as Mode;
  const eligible =
    !!data.profile.model.trim() &&
    config.parameters.some((p) => p.name.trim() && p.value.trim());
  let content: React.ReactNode;
  if (!loaded)
    content = (
      <div className="page">
        <p>正在打开你的实验室…</p>
      </div>
    );
  else if (path === "/device" || path === "/settings")
    content = (
      <Settings data={data} update={update} device={path === "/device"} />
    );
  else if (path.startsWith("/train/") && mode in modes && eligible)
    content = (
      <Training
        key={mode + config.id}
        mode={mode}
        config={config}
        profile={data.profile}
        onComplete={complete}
        onBack={() => (location.hash = "/train")}
      />
    );
  else if (path.startsWith("/train"))
    content = (
      <div className="page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">触控实验</span>
            <h1>开始检测</h1>
            <p>先熟悉操作，再交替测试不同配置。画布内滑动，准星固定在中央。</p>
          </div>
        </div>
        {!eligible ? (
          <section className="panel">
            <h2>先建立你的设备与灵敏度基准</h2>
            <p>填写设备型号，并添加至少一个真实游戏参数名称和值。</p>
            <a
              href={data.profile.model ? "#/settings" : "#/device"}
              className="primary fit"
            >
              完善资料 →
            </a>
          </section>
        ) : (
          <>
            <div className="panel compact">
              <span>
                当前配置：<b>{config.name}</b> · 网页增益 ×{config.gain}
              </span>
              <a href="#/settings" className="text-button">
                切换或编辑 →
              </a>
            </div>
            <TrainingCards />
          </>
        )}
        <p className="notice">
          训练期间请保持方向不变。暂停、后台切换或触控取消会保留记录，但该轮不用于配置推荐。
        </p>
      </div>
    );
  else if (path === "/experiments")
    content = <Experiments data={data} update={update} />;
  else if (path === "/video")
    content = (
      <VideoAnalysis
        data={data}
        save={(v) =>
          update((d) => ({
            ...d,
            videos: [...d.videos.filter((x) => x.id !== v.id), v],
          }))
        }
      />
    );
  else if (path === "/report" || path.startsWith("/report/"))
    content = <Reports data={data} selectedId={path.split("/")[2]} />;
  else if (path === "/history")
    content = (
      <History
        data={data}
        remove={(id) =>
          update((d) => ({ ...d, runs: d.runs.filter((r) => r.id !== id) }))
        }
      />
    );
  else content = <Home data={data} />;
  return (
    <div className="app">
      <div className="mobile-header">
        <a className="brand" href="#/">
          <span className="brand-mark">S</span>SENS<span>LAB</span>
        </a>
        <button
          className="icon-button"
          aria-label="打开导航"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </div>
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a href="#/" className="brand">
          <span className="brand-mark">S</span>SENS<span>LAB</span>
        </a>
        <div className="brand-sub">无畏契约手游 · 灵敏度实验室</div>
        <div className="nav-caption">你的实验空间</div>
        <nav>
          {navigation.map(([url, label, Icon]) => (
            <a
              className={
                path === url || (url === "/train" && path.startsWith("/train/"))
                  ? "nav-link active"
                  : "nav-link"
              }
              href={`#${url}`}
              key={url}
            >
              <Icon size={18} />
              {label}
              {url === "/train" && <span className="nav-mini">4</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={20} />
            <b>数据只属于你</b>
            <p>
              浏览器本地处理
              <br />
              不上传录像，不连接游戏
            </p>
          </div>
          <div className="version">
            <span>
              <i className="live-dot" /> 系统就绪
            </span>
            <span>V1.1</span>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          aria-label="关闭导航"
          className="backdrop"
          onClick={() => setMenu(false)}
        />
      )}
      <main>
        <header className="desktop-header">
          <span>
            实验室 <span className="slash">/</span>{" "}
            {navigation.find((n) => n[0] === path)?.[1] ?? "触控训练"}
          </span>
          <span className="save-status">
            <Check size={13} />
            {storage}
          </span>
        </header>
        {content}
        <div className="mobile-save" role="status">
          {storage}
        </div>
      </main>
    </div>
  );
}
