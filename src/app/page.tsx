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
  Clock,
  RotateCcw,
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

  const now = new Date();
  const currentMonthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = selectedMonth === currentMonthString;

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

  const isResultPositive = (data?.cards?.monthResultCents || 0) >= 0;

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
          {/* Seletor de mês com atalho de retorno ao mês atual */}
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
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => setSelectedMonth(currentMonthString)}
                title="Voltar para o mês atual"
                className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2 py-0.5 rounded-lg border border-orange-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Atual</span>
              </button>
            )}
          </div>

          <button
            onClick={handleOpenNewTransaction}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* 4 Cards de Resumo com Alta Hierarquia Visual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Total Atual (Hero Card) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Saldo em Caixa
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Geral
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-orange-400 flex items-center justify-center shadow-sm">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {loading && !data ? (
                <span className="inline-block w-28 h-8 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                formatCentsToBRL(data?.cards?.totalBalanceCents || 0)
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Saldo acumulado de todas as contas
            </p>
          </div>
        </div>

        {/* Card 2: Entradas do Mês */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Entradas
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Recebido
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
              {loading && !data ? (
                <span className="inline-block w-28 h-8 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                formatCentsToBRL(data?.cards?.monthIncomeCents || 0)
              )}
            </div>
            {data?.cards?.monthPendingIncomeCents > 0 ? (
              <Link
                href="/lancamentos"
                title="Ver lançamentos a receber"
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors mt-2"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>+ {formatCentsToBRL(data.cards.monthPendingIncomeCents)} a receber</span>
              </Link>
            ) : (
              <p className="text-xs text-slate-400 mt-1.5">Nenhuma entrada pendente</p>
            )}
          </div>
        </div>

        {/* Card 3: Saídas do Mês */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Saídas
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                Pago
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight">
              {loading && !data ? (
                <span className="inline-block w-28 h-8 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                formatCentsToBRL(data?.cards?.monthExpenseCents || 0)
              )}
            </div>
            {data?.cards?.monthPendingExpenseCents > 0 ? (
              <Link
                href="/lancamentos"
                title="Ver contas a pagar pendentes"
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors mt-2"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>+ {formatCentsToBRL(data.cards.monthPendingExpenseCents)} a pagar</span>
              </Link>
            ) : (
              <p className="text-xs text-slate-400 mt-1.5">Nenhuma saída pendente</p>
            )}
          </div>
        </div>

        {/* Card 4: Resultado do Mês */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Resultado
              </span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                isResultPositive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}>
                {isResultPositive ? "Superávit" : "Déficit"}
              </span>
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isResultPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            }`}>
              {isResultPositive ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
            </div>
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-black tracking-tight ${
              isResultPositive ? "text-emerald-600" : "text-rose-600"
            }`}>
              {loading && !data ? (
                <span className="inline-block w-28 h-8 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                formatCentsToBRL(data?.cards?.monthResultCents || 0)
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Diferença (Entradas - Saídas pagas)
            </p>
          </div>
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
