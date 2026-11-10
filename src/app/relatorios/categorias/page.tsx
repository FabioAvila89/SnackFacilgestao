"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useCachedFetch } from "@/lib/useCachedFetch";
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



const CategoryPieChart = dynamic(
  () => import("@/components/charts/CategoryCharts").then((mod) => mod.CategoryPieChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center text-sm text-slate-400 animate-pulse">
        Carregando gráfico...
      </div>
    ),
  }
);

const CategoryBarChart = dynamic(
  () => import("@/components/charts/CategoryCharts").then((mod) => mod.CategoryBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center text-sm text-slate-400 animate-pulse">
        Carregando gráfico...
      </div>
    ),
  }
);



export default function CategoryExpensesPage() {
  const [kind, setKind] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [period, setPeriod] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const queryParams = new URLSearchParams();
  queryParams.set("kind", kind);
  queryParams.set("period", period);
  if (period === "custom" && startDate && endDate) {
    queryParams.set("startDate", startDate);
    queryParams.set("endDate", endDate);
  }
  const apiUrl = (period === "custom" && (!startDate || !endDate))
    ? null
    : `/api/reports/categories?${queryParams.toString()}`;

  const { data, loading } = useCachedFetch<any>(apiUrl);

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

  

  return (
    <>
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
                <CategoryPieChart data={chartData} />
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
                <CategoryBarChart data={chartData} kind={kind} />
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
    </>
  );
}
