import { useState } from "react";
import { FlaskConical, Copy, Save } from "lucide-react";
import { modes, uid, type LabData, type Mode, type Config } from "../types";
import {
  compareRuns,
  compareVideos,
  numericCandidates,
  signature,
  compatibleRuns,
  type Verdict,
} from "../lib/experiments";
import { mean } from "../lib/metrics";
import { CompareChart } from "./Charts";
export function Experiments({
  data,
  update,
}: {
  data: LabData;
  update: (fn: (d: LabData) => LabData) => void;
}) {
  const [baseline, setBaseline] = useState(data.configs[0].id);
  const [candidate, setCandidate] = useState(
    data.configs[1]?.id ?? data.configs[0].id,
  );
  const [mode, setMode] = useState<Mode>("flick");
  const [scope, setScope] = useState<"web" | "video">("web");
  const [parameter, setParameter] = useState("");
  const [saved, setSaved] = useState(false);
  const tasks = [...new Set(data.videos.map((v) => v.task))];
  const [task, setTask] = useState(tasks[0] ?? "");
  const a = data.configs.find((c) => c.id === baseline)!;
  const b = data.configs.find((c) => c.id === candidate)!;
  const verdict =
    scope === "web"
      ? compareRuns(data.runs, a, b, mode)
      : compareVideos(data.videos, a, b, task);
  const create = (factor: number) => {
    const c: Config = {
      ...structuredClone(a),
      id: uid(),
      name: `${a.name} · ${scope === "web" ? "网页增益" : parameter} ×${factor}`,
    };
    if (scope === "web")
      c.gain = Number(Math.min(3, Math.max(0.2, a.gain * factor)).toFixed(3));
    else
      c.parameters = c.parameters.map((p) =>
        p.name === parameter
          ? {
              ...p,
              value: String(Number((Number(p.value) * factor).toPrecision(6))),
            }
          : p,
      );
    update((d) => ({ ...d, configs: [...d.configs, c] }));
    setCandidate(c.id);
  };
  const anchor = data.runs.find(
    (r) =>
      r.valid &&
      r.mode === mode &&
      r.config.id === a.id &&
      signature(r.config) === signature(a),
  );
  const values = (c: Config) =>
    data.runs.filter(
      (r) =>
        r.valid &&
        r.mode === mode &&
        r.config.id === c.id &&
        signature(r.config) === signature(c) &&
        anchor &&
        compatibleRuns(r, anchor),
    );
  const saveReport = () => {
    update((d) => ({
      ...d,
      reports: [
        ...d.reports,
        {
          id: uid(),
          created: new Date().toISOString(),
          configs: [structuredClone(a), structuredClone(b)],
          evidence: [...values(a), ...values(b)].map((r) => ({
            runId: r.id,
            mode: r.mode,
            metrics: r.metrics,
          })),
          runIds:
            scope === "web"
              ? [...values(a), ...values(b)].map((r) => r.id)
              : [],
          videoIds:
            scope === "video"
              ? d.videos
                  .filter(
                    (v) =>
                      v.task === task &&
                      (v.config.id === a.id || v.config.id === b.id),
                  )
                  .map((v) => v.id)
              : [],
          conclusion: `${scope === "web" ? "网页增益" : "真实录像"}：${a.name} 对比 ${b.name}。${verdict.title}。${verdict.reason} 有效重复：${verdict.baseline.n} / ${verdict.candidate.n}；可信度：${verdict.confidence}。下一轮：${verdict.next}`,
        },
      ],
    }));
    setSaved(true);
  };
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">一次只改变一个变量</span>
          <h1>灵敏度参数实验</h1>
          <p>比较独立重复测试，数据不足时明确保留判断。</p>
        </div>
        <FlaskConical className="heading-icon" />
      </div>
      <div className="config-tabs">
        <button
          className={`config-tab ${scope === "web" ? "selected" : ""}`}
          onClick={() => {
            setScope("web");
            setSaved(false);
          }}
        >
          网页模拟增益
        </button>
        <button
          className={`config-tab ${scope === "video" ? "selected" : ""}`}
          onClick={() => {
            setScope("video");
            setSaved(false);
          }}
        >
          真实游戏录像
        </button>
      </div>
      <section className="panel">
        <div className="two-grid">
          <label>
            基准配置 A
            <select
              value={baseline}
              onChange={(e) => {
                setBaseline(e.target.value);
                setParameter("");
                setSaved(false);
              }}
            >
              {data.configs.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            候选配置 B
            <select
              value={candidate}
              onChange={(e) => {
                setCandidate(e.target.value);
                setSaved(false);
              }}
            >
              {data.configs.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="divider" />
        {scope === "web" ? (
          <label>
            训练任务
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as Mode);
                setSaved(false);
              }}
            >
              {Object.entries(modes).map(([id, m]) => (
                <option key={id} value={id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label>
              同条件任务标识
              <select
                value={task}
                onChange={(e) => {
                  setTask(e.target.value);
                  setSaved(false);
                }}
              >
                <option value="">选择录像任务</option>
                {tasks.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <p className="muted">
              每段至少 8 个大致等间隔关键帧，覆盖区间两端；每组至少 3
              段独立录像。重复保存同一条记录只更新，不增加样本数。不要把同一录像另存为多次独立实验。
            </p>
            <label>
              创建候选时只修改这一项
              <select
                value={parameter}
                onChange={(e) => setParameter(e.target.value)}
              >
                <option value="">选择游戏参数</option>
                {a.parameters
                  .filter(
                    (p) => p.name.trim() && numericCandidates(p.value).length,
                  )
                  .map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}（当前 {p.value}）
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}
        <div className="button-row" style={{ marginTop: 18 }}>
          {[0.9, 1.1].map((f) => (
            <button
              key={f}
              className="secondary"
              disabled={scope === "video" && !parameter}
              onClick={() => create(f)}
            >
              <Copy size={15} />
              创建 ×{f} 候选
            </button>
          ))}
        </div>
        <p className="muted">
          候选值只是待验证实验条件，不是自动推荐。网页增益限制在
          0.2–3；游戏值请自行确认在实际游戏中可设置。修改已有配置后，旧数值的记录会被排除。
        </p>
      </section>
      <VerdictCard verdict={verdict} />
      {verdict.baseline.n + verdict.candidate.n > 0 && (
        <section className="panel">
          <h2>{scope === "web" ? "视口单位" : "画面对角线 %"} · 越低越好</h2>
          <CompareChart
            data={[
              { name: a.name, error: verdict.baseline.mean },
              { name: b.name, error: verdict.candidate.mean },
            ]}
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>配置</th>
                  <th>独立有效次数</th>
                  <th>平均误差</th>
                  <th>均值区间（约 95%）</th>
                  {scope === "web" && (
                    <>
                      <th>瞄准时间</th>
                      <th>过冲率</th>
                      <th>修正次数</th>
                      <th>RMS</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {[a, b].map((c, i) => {
                  const e = i ? verdict.candidate : verdict.baseline,
                    rs = values(c);
                  return (
                    <tr key={i}>
                      <td>{c.name}</td>
                      <td>{e.n}</td>
                      <td>{e.n ? e.mean.toFixed(2) : "—"}</td>
                      <td>
                        {e.n > 1
                          ? `${e.low.toFixed(2)}～${e.high.toFixed(2)}`
                          : "不足"}
                      </td>
                      {scope === "web" && (
                        <>
                          <td>
                            {rs.length
                              ? `${Math.round(mean(rs.map((r) => r.metrics.acquisitionMs ?? 3000)))} ms`
                              : "—"}
                          </td>
                          <td>
                            {rs.length
                              ? `${(mean(rs.map((r) => r.metrics.overshootRate)) * 100).toFixed(0)}%`
                              : "—"}
                          </td>
                          <td>
                            {rs.length
                              ? mean(
                                  rs.map((r) => r.metrics.corrections),
                                ).toFixed(1)
                              : "—"}
                          </td>
                          <td>
                            {rs.length
                              ? mean(rs.map((r) => r.metrics.rmsError)).toFixed(
                                  2,
                                )
                              : "—"}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted">
            表中未到达目标的瞄准时间按 3000 ms
            计入比较惩罚。均值区间可能包含负下界，这是统计区间，实际误差非负。
          </p>
        </section>
      )}
      <div className="button-row">
        <button className="primary" onClick={saveReport}>
          <Save size={16} />
          {saved ? "已保存，可再次记录" : "保存报告快照"}
        </button>
        <a href="#/settings" className="secondary">
          选择配置并复测 →
        </a>
      </div>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>判定方法与可信度边界</h2>
        <p>
          以每轮或每段录像为独立样本，计算均值、标准差与保守 t
          近似区间。候选改善必须超过基准误差的
          5%，且差值区间仍支持该改善；再检查
          RMS、瞄准时间、过冲、修正与未命中是否退化。跟枪只使用位置误差与 RMS
          辅助约束。
        </p>
        <p>
          这是探索性单人实验，要求重复样本近似独立；样本少、练习效应、疲劳及多次挑选最佳候选都会降低可信度。网页数据不推算真实游戏数值，人工录像不推断未测得的操作过程。
        </p>
        <p className="muted">
          网页比较仅接受相同设备资料、画布尺寸、输入类型和目标协议。录像建议先约定标注间隔，完整标记所有预定时间点，避免只挑表现好的帧。
        </p>
      </section>
    </div>
  );
}
export function VerdictCard({ verdict }: { verdict: Verdict }) {
  return (
    <section className="panel">
      <div className="section-heading" style={{ marginTop: 0 }}>
        <h2>{verdict.title}</h2>
        <span className="confidence">{verdict.confidence}</span>
      </div>
      <p>{verdict.reason}</p>
      <div className="chips">
        <span className="tag">基准：{verdict.baseline.n} 次</span>
        <span className="tag">候选：{verdict.candidate.n} 次</span>
      </div>
      <h3>下一轮测试建议</h3>
      <p className="muted">{verdict.next}</p>
    </section>
  );
}
