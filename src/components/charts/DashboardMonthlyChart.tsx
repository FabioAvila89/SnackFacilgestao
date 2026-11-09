"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface MonthlyChartItem {
  name: string;
  Entradas: number;
  Saídas: number;
}

interface DashboardMonthlyChartProps {
  data: MonthlyChartItem[];
}

export function DashboardMonthlyChart({ data }: DashboardMonthlyChartProps) {
  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700">
          <p className="font-bold text-slate-300 mb-1">{label}</p>
          <p className="text-emerald-400 font-semibold">
            Entradas: R${" "}
            {Number(payload[0]?.value || 0).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p className="text-rose-400 font-semibold">
            Saídas: R${" "}
            {Number(payload[1]?.value || 0).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="name"
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(val) =>
            `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`
          }
        />
        <Tooltip content={customTooltip} />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          wrapperStyle={{ paddingBottom: 15, fontSize: 12 }}
        />
        <Bar dataKey="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={14} />
        <Bar dataKey="Saídas" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

