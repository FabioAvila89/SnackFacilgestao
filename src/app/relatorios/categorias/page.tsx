"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { formatCentsToBRL, formatPercent, formatDateToBR } from "@/lib/formatters";
import {
  PieChart as PieChartIcon,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight,
} from "lucide-react";
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

export default function CategoryExpensesPage() {
  const [kind, setKind] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [period, setPeriod] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Controle de linhas expandidas para drill-down
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const fetchCategoryData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("kind", kind);
      params.set("period", period);
      if (period === "custom" && startDate && endDate) {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
      }

      const res = await fetch(`/api/reports/categories?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar despesas por categoria");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategoryData();
  }, [kind, period]);

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const chartData = (data?.categories || []).map((c: any) => ({
    name: c.categoryName,
    value: c.amountCents / 100,
    pct: c.percentage,
  }));

  const pieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0];
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700">
          <p className="font-bold text-slate-200">{p.name}</p>
          <p className="text-orange-400 font-semibold mt-1">
            R$ {Number(p.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {kind === "EXPENSE" ? "Gastos por Categoria" : "Receitas por Categoria"}
            </h1>
            <p className="text-sm text-slate-500">
              Análise vertical detalhada e drill-down de subcategorias
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Alternador de Tipo */}
            <div className="bg-slate-200 p-1 rounded-xl flex items-center text-xs font-bold">
              <button
                onClick={() => setKind("EXPENSE")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  kind === "EXPENSE"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Saídas (Gastos)
              </button>
              <button
                onClick={() => setKind("INCOME")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  kind === "INCOME"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Entradas (Receitas)
              </button>
            </div>

            {/* Filtros de Período */}
            <div className="flex items-center gap-1.5">
              {[
                { id: "month", label: "Mês" },
                { id: "quarter", label: "Trimestre" },
                { id: "year", label: "Ano" },
                { id: "custom", label: "Livre" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    period === p.id
                      ? "bg-orange-600 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card de Total Geral */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total de {kind === "EXPENSE" ? "Saídas" : "Entradas"} no Período
            </span>
            <div
              className={`text-2xl font-black mt-1 ${
                kind === "EXPENSE" ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {loading ? "..." : formatCentsToBRL(data?.totalCents ?? 0)}
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium text-right">
            <span>Classificação em 100% da movimentação</span>
          </div>
        </div>

        {/* Visualização em Donut & Barras */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico Donut */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Participação Percentual
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Distribuição relativa dos gastos no período
            </p>

            <div className="h-64 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Carregando gráfico...
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Nenhum dado para o período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {chartData.map((_: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={pieTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Gráfico Barras Horizontais */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Ranking por Valor
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Ordenado da maior despesa para a menor
            </p>

            <div className="h-64 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Carregando gráfico...
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Nenhum dado para o período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData.slice(0, 7)}
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
                        `R$ ${Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
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
              )}
            </div>
          </div>
        </div>

        {/* Tabela com Drill-Down (Expansão de Categorias -> Subcategorias -> Lançamentos) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              Detalhamento de Categorias e Drill-Down
            </h2>
            <p className="text-xs text-slate-500">
              Clique em qualquer categoria para expandir subcategorias e lançamentos que a compõem
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-12 text-center text-sm text-slate-400">
                Carregando detalhamento...
              </div>
            ) : !data?.categories || data.categories.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                Nenhum lançamento no período selecionado.
              </div>
            ) : (
              data.categories.map((cat: any) => {
                const isExpanded = !!expandedCategories[cat.categoryId];

                // Filtra lançamentos que pertencem a esta categoria pai
                const catTransactions = (data.transactions || []).filter(
                  (t: any) =>
                    t.categoryId === cat.categoryId ||
                    t.categoryParentId === cat.categoryId
                );

                return (
                  <div key={cat.categoryId} className="transition-colors">
                    {/* Linha Principal da Categoria */}
                    <div
                      onClick={() => toggleCategoryExpand(cat.categoryId)}
                      className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <button className="text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-orange-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>
                        <div>
                          <span className="font-bold text-slate-900 text-sm">
                            {cat.categoryName}
                          </span>
                          <span className="text-xs text-slate-400 ml-2">
                            ({cat.subcategories?.length || 0} subcategorias • {catTransactions.length} lançamentos)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-right">
                        <div className="w-24 bg-slate-100 rounded-full h-2 hidden sm:block overflow-hidden">
                          <div
                            className="bg-orange-500 h-2 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-500 w-12 text-right">
                          {formatPercent(cat.percentage)}
                        </span>
                        <span className="font-black text-slate-900 text-sm w-28 text-right">
                          {formatCentsToBRL(cat.amountCents)}
                        </span>
                      </div>
                    </div>

                    {/* Conteúdo Expandido (Subcategorias e Lançamentos) */}
                    {isExpanded && (
                      <div className="bg-slate-50/70 px-6 py-3 pl-12 border-t border-slate-100 space-y-3">
                        {/* Subcategorias */}
                        {cat.subcategories && cat.subcategories.length > 0 && (
                          <div className="space-y-1.5 pb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Subcategorias:
                            </span>
                            {cat.subcategories.map((sub: any) => (
                              <div
                                key={sub.id}
                                className="flex items-center justify-between text-xs py-1 px-3 bg-white rounded-lg border border-slate-200/60"
                              >
                                <span className="font-semibold text-slate-700">
                                  ↳ {sub.name}
                                </span>
                                <div className="flex items-center gap-4">
                                  <span className="text-slate-400 text-[11px]">
                                    {formatPercent(sub.percentage)} da categoria
                                  </span>
                                  <span className="font-bold text-slate-900">
                                    {formatCentsToBRL(sub.amountCents)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Lançamentos que compõem */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Lançamentos individuais:
                          </span>
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-100/60 text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="py-2 px-3 text-left">Data</th>
                                  <th className="py-2 px-3 text-left">Descrição</th>
                                  <th className="py-2 px-3 text-left">Conta</th>
                                  <th className="py-2 px-3 text-right">Valor</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {catTransactions.map((tx: any) => (
                                  <tr key={tx.id} className="hover:bg-slate-50">
                                    <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                                      {formatDateToBR(tx.date)}
                                    </td>
                                    <td className="py-2 px-3 font-medium text-slate-800">
                                      {tx.description}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                      {tx.accountName}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                      {formatCentsToBRL(tx.amountCents)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
