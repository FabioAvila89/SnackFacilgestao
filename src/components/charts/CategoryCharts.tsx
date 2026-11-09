"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { formatPercent } from "@/lib/formatters";

const COLORS = [
  "#f97316", // orange
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#eab308", // yellow
  "#06b6d4", // cyan
  "#64748b", // slate
  "#14b8a6", // teal
  "#f43f5e", // rose
];

interface CategoryChartItem {
  name: string;
  value: number;
  pct: number;
}

interface CategoryPieChartProps {
  data: CategoryChartItem[];
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const pieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0];
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700">
          <p className="font-bold text-slate-200">{p.name}</p>
          <p className="text-orange-400 font-semibold mt-1">
            R${" "}
            {Number(p.value).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p className="text-slate-400 text-[11px]">
            {formatPercent(p.payload?.pct)} do total
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip content={pieTooltip} />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface CategoryBarChartProps {
  data: CategoryChartItem[];
  kind: "EXPENSE" | "INCOME";
}

export function CategoryBarChart({ data, kind }: CategoryBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data.slice(0, 7)}
        layout="vertical"
        margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" hide />
        <YAxis
          dataKey="name"
          type="category"
          width={120}
          tick={{ fill: "#475569", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(val: any) => [
            `R$ ${Number(val).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}`,
            "Valor",
          ]}
        />
        <Bar
          dataKey="value"
          fill={kind === "EXPENSE" ? "#f43f5e" : "#10b981"}
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

