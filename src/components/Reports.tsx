import { Download, Activity, ArrowUpRight } from "lucide-react";
import { modes, type LabData } from "../types";
import { VerdictCard } from "./Experiments";
import { compareRuns, compareVideos, signature } from "../lib/experiments";
import { ErrorChart } from "./Charts";
import { downloadJSON } from "../lib/storage";
export function Reports({
  data,
  selectedId,
}: {
  data: LabData;
  selectedId?: string;
}) {
  const run = selectedId
    ? data.runs.find((r) => r.id === selectedId)
    : data.runs.at(-1);
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">每一次滑动，都有依据</span>
          <h1>综合检测报告</h1>
          <p>真实记录 · 可解释指标 · 本机保存</p>
        </div>
        <button
          className="secondary"
          onClick={() => downloadJSON(data, "sens-lab-data.json")}
        >
          <Download size={16} />
          导出 JSON
        </button>
      </div>
      {!run ? (
        <div className="empty panel">
          <Activity size={36} />
          <h2>你的第一份报告，从一次训练开始</h2>
          <p>完成检测后，在这里查看触控轨迹与表现。</p>
          <a href="#/train" className="primary">
            开始检测 <ArrowUpRight size={16} />
          </a>
        </div>
      ) : (
        <>
          <section className="panel">
            <div className="section-heading">
              <h2>最近一次 · {modes[run.mode].name}</h2>
              <span className="tag">
                {run.config.name} / 增益 ×{run.config.gain}
              </span>
            </div>
            <p className={run.valid ? "muted" : "notice"}>
              {run.valid
                ? "已完成有效触控采样。单轮结果不能确定最佳灵敏度。"
                : run.invalidReason}
            </p>
            <div className="metric-grid">
              <div>
                <span>平均误差</span>
                <strong>
                  {run.metrics.meanError.toFixed(2)}
                  <small> 单位</small>
                </strong>
              </div>
              <div>
                <span>RMS 误差</span>
                <strong>
                  {run.metrics.rmsError.toFixed(2)}
                  <small> 单位</small>
                </strong>
              </div>
              <div>
                <span>首次瞄准时间</span>
                <strong>
                  {run.metrics.acquisitionMs === null
                    ? "未到达"
                    : Math.round(run.metrics.acquisitionMs)}
                  <small>
                    {run.metrics.acquisitionMs === null ? "" : " ms"}
                  </small>
                </strong>
              </div>
              <div>
                <span>有效目标样本</span>
                <strong>
                  {run.metrics.validTrials}
                  <small> 个</small>
                </strong>
              </div>
            </div>
            <ErrorChart
              data={run.samples
                .filter((_, i) => i % 3 === 0)
                .map((s) => ({
                  time: Number((s.t / 1000).toFixed(1)),
                  error: s.error,
                }))}
            />
            <div className="detail-grid">
              <p>
                过冲率 <b>{(run.metrics.overshootRate * 100).toFixed(0)}%</b>
              </p>
              <p>
                未稳定命中率 <b>{(run.metrics.missRate * 100).toFixed(0)}%</b>
              </p>
              <p>
                从未到达目标率{" "}
                <b>{(run.metrics.undershootRate * 100).toFixed(0)}%</b>
              </p>
              <p>
                平均修正次数 <b>{run.metrics.corrections.toFixed(1)}</b>
              </p>
              <p>
                最终误差 <b>{run.metrics.finalError.toFixed(2)}</b>
              </p>
              <p>
                误差标准差 <b>{run.metrics.stability.toFixed(2)}</b>
              </p>
              <p>
                累计滑动距离（增益后）{" "}
                <b>{run.metrics.swipeDistance.toFixed(1)} 单位</b>
              </p>
              <p>
                重新滑屏次数 <b>{run.metrics.reswipes}</b>
              </p>
              <p>
                路径效率 <b>{(run.metrics.efficiency * 100).toFixed(0)}%</b>
              </p>
              <p>
                反向响应{" "}
                <b>
                  {run.metrics.responseMs === null
                    ? "未测得"
                    : `${Math.round(run.metrics.responseMs)} ms`}
                </b>
              </p>
              <p>
                已响应的反向事件{" "}
                <b>
                  {run.metrics.responseEvents} / {run.mode === "track" ? 7 : 0}
                </b>
              </p>
            </div>
            <p className="muted">
              1 单位 = 画布短边的 1%。路径效率是目标直线距离 /
              增益后滑动路径，最高
              100%，不是匹配度。跟枪的过冲、命中与路径效率不参与推荐。反向响应仅统计测得事件，未响应事件不会被当作
              0 ms。
            </p>
          </section>
          {data.configs
            .filter((c) => c.id !== run.config.id)
            .map((c) => (
              <div key={c.id}>
                <h3>
                  {run.config.name} → {c.name}
                </h3>
                <VerdictCard
                  verdict={compareRuns(data.runs, run.config, c, run.mode)}
                />
                {data.videos.some((v) => v.config.id === c.id) && (
                  <VerdictCard
                    verdict={compareVideos(
                      data.videos,
                      run.config,
                      c,
                      data.videos.filter((v) => v.config.id === c.id).at(-1)!
                        .task,
                    )}
                  />
                )}
              </div>
            ))}
          <div className="section-heading">
            <h2>四项表现</h2>
            <a href="#/experiments" className="text-button">
              比较配置 <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="four-grid">
            {Object.entries(modes).map(([key, m]) => {
              const r = data.runs
                .filter(
                  (r) =>
                    r.mode === key &&
                    r.config.id === run.config.id &&
                    signature(r.config) === signature(run.config),
                )
                .at(-1);
              return (
                <section className="panel small" key={key}>
                  <span className="muted">{m.name}</span>
                  <h2>
                    {r ? `${r.metrics.meanError.toFixed(2)} 单位` : "待测试"}
                  </h2>
                  <p>
                    {r
                      ? `RMS ${r.metrics.rmsError.toFixed(2)} · ${r.valid ? "有效" : "需重测"}`
                      : m.description}
                  </p>
                  <a className="text-button" href={`#/train/${key}`}>
                    再测一次 →
                  </a>
                </section>
              );
            })}
          </div>
          <section className="panel">
            <h2>当前参数快照</h2>
            <p>
              {run.profile.model} · {run.profile.fingers} ·{" "}
              {run.profile.gyro ? "使用" : "不使用"}陀螺仪
            </p>
            <div className="chips">
              {run.config.parameters
                .filter((p) => p.name)
                .map((p) => (
                  <span className="tag" key={p.id}>
                    {p.name}：{p.value}
                  </span>
                ))}
            </div>
            <h3>下一轮建议</h3>
            <p className="muted">
              在相同条件下重复基准配置至少 3
              轮，再用候选配置交替测试。完成游戏录像标注后，在参数实验中查看证据。单轮数据不足以修改游戏灵敏度；多轮判定请参考上方结果及参数实验页。
            </p>
          </section>
        </>
      )}
    </div>
  );
}
export function History({
  data,
  remove,
}: {
  data: LabData;
  remove: (id: string) => void;
}) {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">你的训练档案</span>
          <h1>历史记录</h1>
          <p>原始触控轨迹、配置快照和录像标注都保留在本机。</p>
        </div>
        <button
          className="secondary"
          onClick={() => downloadJSON(data, "sens-lab-history.json")}
        >
          <Download size={16} />
          导出全部
        </button>
      </div>
      {data.runs.length === 0 ? (
        <div className="empty panel">
          <h2>还没有检测记录</h2>
          <a className="primary" href="#/train">
            开始第一轮
          </a>
        </div>
      ) : (
        <div className="panel">
          {[...data.runs].reverse().map((r) => (
            <div className="history-row" key={r.id}>
              <div>
                <h3>
                  {modes[r.mode].name}{" "}
                  <span className="tag">{r.valid ? "有效" : "需重测"}</span>
                </h3>
                <p>
                  {r.config.name} ·{" "}
                  {new Date(r.created).toLocaleString("zh-CN")} · 误差{" "}
                  {r.metrics.meanError.toFixed(2)}
                </p>
              </div>
              <div className="button-row">
                <a className="text-button" href={`#/report/${r.id}`}>
                  查看报告
                </a>
                <button
                  className="text-button"
                  onClick={() => downloadJSON(r, `sens-lab-${r.id}.json`)}
                >
                  导出
                </button>
                <button
                  className="text-button danger"
                  onClick={() => {
                    if (confirm("删除此训练记录？已保存的报告快照仍会保留。"))
                      remove(r.id);
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <h2>已保存报告 · {data.reports.length}</h2>
      {data.reports.map((r) => (
        <div className="panel" key={r.id}>
          <h3>{new Date(r.created).toLocaleString("zh-CN")}</h3>
          <p>{r.conclusion}</p>
          <button
            className="text-button"
            onClick={() => downloadJSON(r, `sens-lab-report-${r.id}.json`)}
          >
            导出报告快照
          </button>
        </div>
      ))}
    </div>
  );
}
