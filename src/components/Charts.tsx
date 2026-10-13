import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
export function ErrorChart({
  data,
  label = "误差（视口单位）",
}: {
  data: { time: number; error: number }[];
  label?: string;
}) {
  return (
    <div className="chart" role="img" aria-label={label + "随时间变化曲线"}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#2c3036" strokeDasharray="3 5" />
          <XAxis
            dataKey="time"
            tick={{ fill: "#939ba6", fontSize: 11 }}
            minTickGap={30}
            unit="秒"
          />
          <YAxis tick={{ fill: "#939ba6", fontSize: 11 }} width={45} />
          <Tooltip
            contentStyle={{
              background: "#202329",
              border: "1px solid #3b414b",
              color: "#fff",
            }}
            formatter={(v) => [Number(v).toFixed(2), label]}
          />
          <Line
            type="linear"
            dataKey="error"
            stroke="#ff4b58"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CompareChart({
  data,
}: {
  data: { name: string; error: number }[];
}) {
  return (
    <div className="chart" role="img" aria-label="各配置平均误差对比">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#2c3036" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#939ba6", fontSize: 11 }} />
          <YAxis tick={{ fill: "#939ba6", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#202329",
              border: "1px solid #3b414b",
            }}
            formatter={(v) => [Number(v).toFixed(2), "平均误差"]}
          />
          <Bar
            dataKey="error"
            fill="#ff4b58"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
