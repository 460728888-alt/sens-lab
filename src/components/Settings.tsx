import { Plus, Trash2, Check, SlidersHorizontal } from "lucide-react";
import { ScreenshotImport } from "./ScreenshotImport";
import { mergeReviewedParameters } from "../lib/screenshot-parser";
import { uid, type LabData, type Config } from "../types";
export function Settings({
  data,
  update,
  device = false,
}: {
  data: LabData;
  update: (fn: (d: LabData) => LabData) => void;
  device?: boolean;
}) {
  const config = data.configs.find((c) => c.id === data.activeConfig)!;
  const edit = (patch: Partial<Config>) =>
    update((d) => ({
      ...d,
      configs: d.configs.map((c) =>
        c.id === config.id ? { ...c, ...patch } : c,
      ),
    }));
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">建立你的实验基准</span>
          <h1>{device ? "我的设备" : "灵敏度设置"}</h1>
          <p>资料自动保存在当前浏览器。每次实验只改变一个变量。</p>
        </div>
        <SlidersHorizontal className="heading-icon" />
      </div>
      {device ? (
        <section className="panel form-grid">
          <label>
            手机或平板型号{" "}
            <input
              placeholder="例如：iPhone 16 Pro"
              value={data.profile.model}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  profile: { ...d.profile, model: e.target.value },
                }))
              }
            />
          </label>
          <label>
            屏幕尺寸（可选）
            <input
              placeholder="例如：6.3 英寸"
              value={data.profile.screen}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  profile: { ...d.profile, screen: e.target.value },
                }))
              }
            />
          </label>
          <label>
            操作指法
            <select
              value={data.profile.fingers}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  profile: { ...d.profile, fingers: e.target.value },
                }))
              }
            >
              {["二指", "三指", "四指", "五指"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            陀螺仪
            <select
              value={data.profile.gyro ? "yes" : "no"}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  profile: { ...d.profile, gyro: e.target.value === "yes" },
                }))
              }
            >
              <option value="no">不使用</option>
              <option value="yes">使用</option>
            </select>
          </label>
          <label className="full">
            训练条件备注
            <textarea
              placeholder="记录握持方式、屏幕刷新率等，便于保持测试条件一致"
              value={data.profile.notes}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  profile: { ...d.profile, notes: e.target.value },
                }))
              }
            />
          </label>
          <p className="muted full">
            陀螺仪状态仅作为实验条件记录。V1
            的网页训练采集手指滑动，不模拟陀螺仪输入。
          </p>
          <a className="primary fit" href="#/settings">
            下一步：填写灵敏度 →
          </a>
        </section>
      ) : (
        <>
          <div className="config-tabs">
            {data.configs.map((c) => (
              <button
                className={
                  c.id === config.id ? "config-tab selected" : "config-tab"
                }
                key={c.id}
                onClick={() => update((d) => ({ ...d, activeConfig: c.id }))}
              >
                {c.id === config.id && <Check size={14} />} {c.name}
              </button>
            ))}
            <button
              className="secondary"
              onClick={() => {
                const c = {
                  ...structuredClone(config),
                  id: uid(),
                  name: `实验配置 ${data.configs.length + 1}`,
                };
                update((d) => ({
                  ...d,
                  configs: [...d.configs, c],
                  activeConfig: c.id,
                }));
              }}
            >
              <Plus size={16} />
              复制配置
            </button>
          </div>
          <ScreenshotImport
            key={config.id}
            parameters={config.parameters}
            onApply={(fields) =>
              edit({
                parameters: mergeReviewedParameters(config.parameters, fields),
              })
            }
          />
          <section className="panel">
            <label>
              配置名称
              <input
                value={config.name}
                maxLength={60}
                onChange={(e) => edit({ name: e.target.value })}
              />
            </label>
            <div className="section-heading">
              <h2>真实游戏参数</h2>
              <span className="tag">由你定义字段</span>
            </div>
            <p className="muted">
              请按游戏内实际显示的名称和值填写。我们不假设游戏设置项或数值范围。
            </p>
            {config.parameters.map((p, i) => (
              <div className="parameter-row" key={p.id}>
                <label>
                  参数名称
                  <input
                    aria-label={`参数名称 ${i + 1}`}
                    placeholder="输入游戏内的参数名称"
                    value={p.name}
                    onChange={(e) =>
                      edit({
                        parameters: config.parameters.map((x) =>
                          x.id === p.id ? { ...x, name: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  当前值
                  <input
                    aria-label={`参数值 ${i + 1}`}
                    placeholder="输入数值或文本"
                    value={p.value}
                    onChange={(e) =>
                      edit({
                        parameters: config.parameters.map((x) =>
                          x.id === p.id ? { ...x, value: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label={`删除参数 ${i + 1}`}
                  onClick={() =>
                    edit({
                      parameters: config.parameters.filter(
                        (x) => x.id !== p.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            <button
              className="text-button"
              onClick={() =>
                edit({
                  parameters: [
                    ...config.parameters,
                    { id: uid(), name: "", value: "" },
                  ],
                })
              }
            >
              <Plus size={16} />
              添加参数
            </button>
            <div className="divider" />
            <label>
              网页模拟增益：×{config.gain.toFixed(2)}
              <input
                type="range"
                min="0.2"
                max="3"
                step="0.05"
                value={config.gain}
                onChange={(e) => edit({ gain: Number(e.target.value) })}
              />
            </label>
            <p className="muted">
              此范围仅限网页模拟器。增益 ×1 表示手指移动 1 单位，模拟视角移动 1
              单位；它不是游戏灵敏度数值。
            </p>
            <a href="#/train" className="primary fit">
              保存并开始检测 →
            </a>
          </section>
        </>
      )}
    </div>
  );
}
