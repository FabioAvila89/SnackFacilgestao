"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCentsToBRL, formatPercent } from "@/lib/formatters";
import { useCachedFetch } from "@/lib/useCachedFetch";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  Calendar,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
} from "lucide-react";
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

export default function DashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data, loading } = useCachedFetch<any>(
    `/api/reports/dashboard?month=${selectedMonth}`
  );

  const handleOpenNewTransaction = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("snack:open-transaction-modal"));
    }
  };

  // Formata dados para o gráfico do Recharts
  const chartData = (data?.chartLast12Months || []).map((m: any) => ({
    name: m.label,
    Entradas: m.incomeCents / 100,
    Saídas: m.expenseCents / 100,
  }));

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700">
          <p className="font-bold text-slate-300 mb-1">{label}</p>
          <p className="text-emerald-400 font-semibold">
            Entradas: R$ {Number(payload[0]?.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-rose-400 font-semibold">
            Saídas: R$ {Number(payload[1]?.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Header com Seletor de Mês e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Visão Geral
          </h1>
          <p className="text-sm text-slate-500">
            Controle de caixa e operação Snack Fácil
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor de mês */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-xl shadow-sm text-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <label htmlFor="monthPicker" className="text-xs font-semibold text-slate-500">
              Mês:
            </label>
            <input
              id="monthPicker"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer text-sm"
            />
          </div>

          <button
            onClick={handleOpenNewTransaction}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-orange-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* 4 Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Total Atual */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Saldo em Caixa
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {loading && !data ? (
              <span className="inline-block w-28 h-7 bg-slate-100 animate-pulse rounded" />
            ) : (
              formatCentsToBRL(data?.cards?.totalBalanceCents || 0)
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Saldo acumulado de todas as contas
          </p>
        </div>

        {/* Card 2: Entradas do Mês */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Entradas no Mês
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {loading && !data ? (
              <span className="inline-block w-28 h-7 bg-slate-100 animate-pulse rounded" />
            ) : (
              formatCentsToBRL(data?.cards?.monthIncomeCents || 0)
            )}
          </div>
          {data?.cards?.monthPendingIncomeCents > 0 && (
            <p className="text-[11px] text-amber-600 mt-1 font-medium flex items-center gap-1">
              <span>+ {formatCentsToBRL(data.cards.monthPendingIncomeCents)} a receber</span>
            </p>
          )}
        </div>

        {/* Card 3: Saídas do Mês */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              Saídas no Mês
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">
            {loading && !data ? (
              <span className="inline-block w-28 h-7 bg-slate-100 animate-pulse rounded" />
            ) : (
              formatCentsToBRL(data?.cards?.monthExpenseCents || 0)
            )}
          </div>
          {data?.cards?.monthPendingExpenseCents > 0 && (
            <p className="text-[11px] text-amber-600 mt-1 font-medium flex items-center gap-1">
              <span>+ {formatCentsToBRL(data.cards.monthPendingExpenseCents)} a pagar</span>
            </p>
          )}
        </div>

        {/* Card 4: Resultado do Mês */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Resultado Líquido
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              (data?.cards?.monthResultCents || 0) >= 0
                ? "bg-emerald-50 text-emerald-600"
                : "bg-rose-50 text-rose-600"
            }`}>
              {(data?.cards?.monthResultCents || 0) >= 0 ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className={`text-2xl font-black ${
            (data?.cards?.monthResultCents || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
          }`}>
            {loading && !data ? (
              <span className="inline-block w-28 h-7 bg-slate-100 animate-pulse rounded" />
            ) : (
              formatCentsToBRL(data?.cards?.monthResultCents || 0)
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Diferença (Entradas - Saídas pagas)
          </p>
        </div>
      </div>

      {/* Gráficos e Seções Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Barras: Comparativo 12 Meses */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Evolução Financeira (Últimos 12 Meses)
              </h2>
              <p className="text-xs text-slate-500">
                Comparativo mensal de entradas versus despesas realizadas
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            {loading && !data ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Carregando gráfico...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Nenhum dado financeiro para o período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
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
            )}
          </div>
        </div>

        {/* Top 5 Categorias de Despesas */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Maiores Despesas
                </h2>
                <p className="text-xs text-slate-500">
                  Top categorias no mês selecionado
                </p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>

            {loading && !data ? (
              <div className="space-y-4 pt-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-1.5 animate-pulse">
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                    <div className="h-2 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
            ) : !data?.top5Expenses || data.top5Expenses.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Nenhuma despesa registrada neste mês.
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {data.top5Expenses.map((cat: any, index: number) => (
                  <div key={cat.categoryId || index} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                        {index + 1}. {cat.categoryName}
                      </span>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">
                          {formatCentsToBRL(cat.amountCents)}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1.5 font-medium">
                          ({formatPercent(cat.percentage)})
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 text-center">
            <Link
              href="/relatorios/categorias"
              className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline"
            >
              Ver análise detalhada de categorias →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
