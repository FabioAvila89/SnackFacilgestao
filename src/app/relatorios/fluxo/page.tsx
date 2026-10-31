"use client";

import { useState } from "react";
import { useCachedFetch } from "@/lib/useCachedFetch";
import { formatCentsToBRL } from "@/lib/formatters";
import {
  Calendar,
  ArrowUpDown,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
} from "lucide-react";
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

export default function CashFlowReportPage() {
  const [period, setPeriod] = useState("year"); // month, quarter, year, custom
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
    const [customSubmitted, setCustomSubmitted] = useState(0);

  const queryParams = new URLSearchParams();
  queryParams.set("period", period);
  if (period === "custom" && startDate && endDate) {
    queryParams.set("startDate", startDate);
    queryParams.set("endDate", endDate);
  }
  const apiUrl = (period === "custom" && (!startDate || !endDate))
    ? null
    : `/api/reports/flow?${queryParams.toString()}`;

  const { data, loading, refetch } = useCachedFetch<any>(apiUrl);

  const handleCustomFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSubmitted((c) => c + 1);
    refetch(true);
  };

  const chartData = (data?.monthlyFlow || []).map((m: any) => ({
    name: m.monthLabel,
    Entradas: m.incomeCents / 100,
    Saídas: m.expenseCents / 100,
    "Saldo Acumulado": m.accumulatedBalanceCents / 100,
  }));

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs border border-slate-700">
          <p className="font-bold text-slate-200 mb-1.5">{label}</p>
          <p className="text-emerald-400 font-semibold">
            Entradas: R$ {Number(payload[0]?.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-rose-400 font-semibold">
            Saídas: R$ {Number(payload[1]?.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <div className="pt-1 mt-1 border-t border-slate-700">
            <p className="text-amber-300 font-bold">
              Saldo Acumulado: R$ {Number(payload[2]?.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Relatório de Entradas × Saídas
            </h1>
            <p className="text-sm text-slate-500">
              Acompanhamento mensal de fluxo de caixa e saldo acumulado
            </p>
          </div>

          {/* Filtros Rápidos de Período */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "month", label: "Mês Atual" },
              { id: "quarter", label: "Trimestre" },
              { id: "year", label: "Ano Atual" },
              { id: "custom", label: "Personalizado" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  period === p.id
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro Livre (se selecionado) */}
        {period === "custom" && (
          <form
            onSubmit={handleCustomFilterSubmit}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-3 text-xs"
          >
            <div>
              <label className="block font-bold text-slate-600 mb-1">Data Início</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 mb-1">Data Fim</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors"
            >
              Aplicar Filtro
            </button>
          </form>
        )}

        {/* 4 Cards de Totais do Período */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Entradas (Período)
            </span>
            <div className="text-xl font-black text-emerald-600 mt-1">
              {loading ? "..." : formatCentsToBRL(data?.totals?.totalIncomeCents ?? 0)}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Saídas (Período)
            </span>
            <div className="text-xl font-black text-rose-600 mt-1">
              {loading ? "..." : formatCentsToBRL(data?.totals?.totalExpenseCents ?? 0)}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Resultado Líquido do Período
            </span>
            <div
              className={`text-xl font-black mt-1 ${
                (data?.totals?.totalResultCents ?? 0) >= 0
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {loading ? "..." : formatCentsToBRL(data?.totals?.totalResultCents ?? 0)}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Saldo Acumulado Final
            </span>
            <div className="text-xl font-black text-slate-900 mt-1">
              {loading
                ? "..."
                : formatCentsToBRL(data?.totals?.finalAccumulatedBalanceCents ?? 0)}
            </div>
          </div>
        </div>

        {/* Gráfico Composto: Barras de Entradas/Saídas + Linha de Saldo */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">
              Evolução e Saldo Acumulado
            </h2>
            <p className="text-xs text-slate-500">
              Comparativo de entradas × saídas com linha de tendência do saldo
            </p>
          </div>

          <div className="h-80 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Carregando gráfico...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Nenhum dado encontrado para o período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#f59e0b", fontSize: 11 }}
                    tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
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
            )}
          </div>
        </div>

        {/* Tabela Mês a Mês */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Detalhamento Mensal</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-6">Mês</th>
                  <th className="py-3 px-6 text-right">Entradas</th>
                  <th className="py-3 px-6 text-right">Saídas</th>
                  <th className="py-3 px-6 text-right">Resultado do Mês</th>
                  <th className="py-3 px-6 text-right">Saldo Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      Carregando tabela...
                    </td>
                  </tr>
                ) : !data?.monthlyFlow || data.monthlyFlow.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      Nenhum mês para exibir.
                    </td>
                  </tr>
                ) : (
                  <>
                    {data.monthlyFlow.map((row: any) => (
                      <tr key={row.month} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-6 font-semibold text-slate-800">
                          {row.monthLabel}
                        </td>
                        <td className="py-3.5 px-6 text-right font-medium text-emerald-600">
                          {formatCentsToBRL(row.incomeCents)}
                        </td>
                        <td className="py-3.5 px-6 text-right font-medium text-rose-600">
                          {formatCentsToBRL(row.expenseCents)}
                        </td>
                        <td
                          className={`py-3.5 px-6 text-right font-bold ${
                            row.resultCents >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {formatCentsToBRL(row.resultCents)}
                        </td>
                        <td className="py-3.5 px-6 text-right font-black text-slate-900">
                          {formatCentsToBRL(row.accumulatedBalanceCents)}
                        </td>
                      </tr>
                    ))}

                    {/* Linha de Total do Período */}
                    <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300">
                      <td className="py-4 px-6 uppercase tracking-wider text-xs">
                        TOTAL DO PERÍODO
                      </td>
                      <td className="py-4 px-6 text-right text-emerald-700">
                        {formatCentsToBRL(data.totals.totalIncomeCents)}
                      </td>
                      <td className="py-4 px-6 text-right text-rose-700">
                        {formatCentsToBRL(data.totals.totalExpenseCents)}
                      </td>
                      <td
                        className={`py-4 px-6 text-right ${
                          data.totals.totalResultCents >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }`}
                      >
                        {formatCentsToBRL(data.totals.totalResultCents)}
                      </td>
                      <td className="py-4 px-6 text-right text-slate-900">
                        {formatCentsToBRL(data.totals.finalAccumulatedBalanceCents)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
