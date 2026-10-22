"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { formatCentsToBRL, formatPercent } from "@/lib/formatters";
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
import { TransactionModal } from "@/components/TransactionModal";

export default function DashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports/dashboard?month=${selectedMonth}`);
      if (!res.ok) throw new Error("Erro ao carregar dados do dashboard");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const handleUpdate = () => fetchDashboardData();
    window.addEventListener("snack:transaction-updated", handleUpdate);
    return () => window.removeEventListener("snack:transaction-updated", handleUpdate);
  }, [selectedMonth]);

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
    <AppLayout>
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
              onClick={() => setIsModalOpen(true)}
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
                Saldo Total Atual
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {loading ? "..." : formatCentsToBRL(data?.cards?.totalBalanceCents ?? 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Soma de todas as contas ativas
            </p>
          </div>

          {/* Card 2: Entradas do Mês */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Entradas do Mês
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 tracking-tight">
              {loading ? "..." : formatCentsToBRL(data?.cards?.monthIncomeCents ?? 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Vendas e outras receitas
            </p>
          </div>

          {/* Card 3: Saídas do Mês */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Saídas do Mês
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-600 tracking-tight">
              {loading ? "..." : formatCentsToBRL(data?.cards?.monthExpenseCents ?? 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Custos, despesas e deduções
            </p>
          </div>

          {/* Card 4: Resultado do Mês */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Resultado do Mês
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div
              className={`text-2xl font-black tracking-tight ${
                (data?.cards?.monthResultCents ?? 0) >= 0
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {loading ? "..." : formatCentsToBRL(data?.cards?.monthResultCents ?? 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Entradas − Saídas do período
            </p>
          </div>
        </div>

        {/* Linha do Meio: Gráfico de 12 Meses e Top 5 Categorias */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gráfico 12 Meses (2 Colunas) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Entradas × Saídas (Últimos 12 Meses)
                </h2>
                <p className="text-xs text-slate-500">
                  Evolução do faturamento e dos gastos operacionais
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Carregando gráfico...
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Nenhum dado registrado para o período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
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
                      dataKey="Entradas"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="Saídas"
                      fill="#f43f5e"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top 5 Categorias de Gasto do Mês */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Maiores Gastos do Mês
                  </h2>
                  <p className="text-xs text-slate-500">
                    Top 5 categorias com maior saída
                  </p>
                </div>
                <ShoppingBag className="w-5 h-5 text-slate-400" />
              </div>

              {loading ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  Carregando categorias...
                </div>
              ) : !data?.top5Expenses || data.top5Expenses.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  Nenhum gasto registrado neste mês.
                </div>
              ) : (
                <div className="space-y-4">
                  {data.top5Expenses.map((cat: any, index: number) => (
                    <div key={cat.categoryId} className="space-y-1">
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
              <a
                href="/relatorios/categorias"
                className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline"
              >
                Ver análise detalhada de categorias →
              </a>
            </div>
          </div>
        </div>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchDashboardData()}
      />
    </AppLayout>
  );
}
