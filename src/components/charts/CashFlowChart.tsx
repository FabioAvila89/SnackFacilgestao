"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CashFlowChartItem {
  name: string;
  Entradas: number;
  Saídas: number;
  "Saldo Acumulado": number;
}

interface CashFlowChartProps {
  data: CashFlowChartItem[];
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs border border-slate-700">
          <p className="font-bold text-slate-200 mb-1.5">{label}</p>
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
          <div className="pt-1 mt-1 border-t border-slate-700">
            <p className="text-amber-300 font-bold">
              Saldo Acumulado: R${" "}
              {Number(payload[2]?.value || 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#64748b", fontSize: 11 }}
        />
        <YAxis
          yAxisId="left"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickFormatter={(val) =>
            `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`
          }
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#f59e0b", fontSize: 11 }}
          tickFormatter={(val) =>
            `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`
          }
        />
        <Tooltip content={customTooltip} />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
        />
        <Bar
          yAxisId="left"
          dataKey="Entradas"
          fill="#10b981"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          yAxisId="left"
          dataKey="Saídas"
          fill="#f43f5e"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="Saldo Acumulado"
          stroke="#f59e0b"
          strokeWidth={3}
          dot={{ r: 4, fill: "#f59e0b" }}
          activeDot={{ r: 6 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

