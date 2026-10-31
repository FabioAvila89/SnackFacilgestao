"use client";

import { useState } from "react";
import { useCachedFetch } from "@/lib/useCachedFetch";
import { formatCentsToBRL, formatPercent } from "@/lib/formatters";
import {
  FileSpreadsheet,
  Download,
  ChevronDown,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export default function DreReportPage() {
  const [period, setPeriod] = useState("month"); // month, quarter, year, custom
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const queryParams = new URLSearchParams();
  queryParams.set("period", period);
  if (period === "custom" && startDate && endDate) {
    queryParams.set("startDate", startDate);
    queryParams.set("endDate", endDate);
  }
  const apiUrl = (period === "custom" && (!startDate || !endDate))
    ? null
    : `/api/reports/dre?${queryParams.toString()}`;

  const { data, loading } = useCachedFetch<any>(apiUrl);

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExportXLSX = () => {
    const params = new URLSearchParams();
    params.set("period", period);
    if (period === "custom" && startDate && endDate) {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }
    window.open(`/api/export/dre?${params.toString()}`, "_blank");
  };

  const dre = data?.dre;

  return (
    <>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Demonstração do Resultado (DRE)
            </h1>
            <p className="text-sm text-slate-500">
              Regime de caixa com comparativo do período anterior e análise vertical
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filtros Rápidos */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              {[
                { id: "month", label: "Mês" },
                { id: "quarter", label: "Trimestre" },
                { id: "year", label: "Ano" },
                { id: "custom", label: "Livre" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    period === p.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportXLSX}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Aviso Legal de Regime de Caixa */}
        <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Nota informativa sobre o modelo: </span>
            <span>
              {data?.disclaimer ||
                "DRE em regime de caixa. O custo das mercadorias reflete as compras do período, não o estoque consumido."}
            </span>
          </div>
        </div>

        {/* Tabela Principal do DRE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] uppercase tracking-wider font-bold">
                  <th className="py-3 px-4 sm:px-6">Linha do DRE</th>
                  <th className="py-3 px-4 text-right">
                    {dre?.periodLabel || "Atual"}
                  </th>
                  <th className="py-3 px-3 text-right">AV %</th>
                  <th className="py-3 px-4 text-right text-slate-300">
                    {dre?.previousPeriodLabel || "Anterior"}
                  </th>
                  <th className="py-3 px-3 text-right text-slate-300">AV %</th>
                  <th className="py-3 px-4 text-right">Var. (R$)</th>
                  <th className="py-3 px-3 text-right">Var. %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      Calculando Demonstração do Resultado...
                    </td>
                  </tr>
                ) : !dre?.rows || dre.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      Nenhum dado encontrado para o período.
                    </td>
                  </tr>
                ) : (
                  dre.rows.map((row: any) => {
                    const isExpanded = !!expandedRows[row.key];
                    const hasCategories =
                      row.categories && row.categories.length > 0;

                    const rowBg = row.isCalculated
                      ? "bg-slate-100/90 font-bold text-slate-900"
                      : "hover:bg-slate-50 text-slate-800";

                    return (
                      <tbody key={row.key} className="border-t border-slate-100">
                        <tr className={`${rowBg} transition-colors select-none`}>
                          <td className="py-3 px-4 sm:px-6">
                            <div className="flex items-center gap-2">
                              {hasCategories ? (
                                <button
                                  type="button"
                                  onClick={() => toggleRow(row.key)}
                                  className="text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-orange-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-4" />
                              )}
                              <span
                                className={`${
                                  row.isCalculated
                                    ? "font-extrabold text-slate-900 text-sm"
                                    : "font-semibold"
                                }`}
                              >
                                {row.name}
                              </span>
                            </div>
                          </td>

                          {/* Atual R$ */}
                          <td className="py-3 px-4 text-right font-black whitespace-nowrap">
                            {formatCentsToBRL(row.currentCents)}
                          </td>

                          {/* AV % Atual */}
                          <td className="py-3 px-3 text-right font-semibold text-slate-500 whitespace-nowrap text-xs">
                            {formatPercent(row.currentMarginPercent)}
                          </td>

                          {/* Anterior R$ */}
                          <td className="py-3 px-4 text-right font-medium text-slate-500 whitespace-nowrap">
                            {formatCentsToBRL(row.previousCents)}
                          </td>

                          {/* AV % Anterior */}
                          <td className="py-3 px-3 text-right text-slate-400 whitespace-nowrap text-xs">
                            {formatPercent(row.previousMarginPercent)}
                          </td>

                          {/* Variação R$ */}
                          <td className="py-3 px-4 text-right font-semibold whitespace-nowrap">
                            <span
                              className={
                                row.changeCents > 0
                                  ? "text-emerald-600"
                                  : row.changeCents < 0
                                  ? "text-rose-600"
                                  : "text-slate-500"
                              }
                            >
                              {row.changeCents > 0 ? "+ " : ""}
                              {formatCentsToBRL(row.changeCents)}
                            </span>
                          </td>

                          {/* Variação % */}
                          <td className="py-3 px-3 text-right font-bold whitespace-nowrap text-xs">
                            <span
                              className={
                                (row.changePercent ?? 0) > 0
                                  ? "text-emerald-600"
                                  : (row.changePercent ?? 0) < 0
                                  ? "text-rose-600"
                                  : "text-slate-500"
                              }
                            >
                              {row.changePercent !== null && row.changePercent > 0
                                ? "+ "
                                : ""}
                              {formatPercent(row.changePercent)}
                            </span>
                          </td>
                        </tr>

                        {/* Detalhes de Categorias e Lançamentos Expandidos */}
                        {isExpanded && hasCategories && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={7} className="py-3 px-6 pl-12">
                              <div className="space-y-3">
                                {row.categories.map((catGroup: any) => (
                                  <div
                                    key={catGroup.categoryId}
                                    className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm space-y-2"
                                  >
                                    <div className="flex items-center justify-between font-bold text-xs text-slate-800">
                                      <span>{catGroup.categoryName}</span>
                                      <span className="text-orange-600">
                                        Total: {formatCentsToBRL(catGroup.amountCents)}
                                      </span>
                                    </div>

                                    {/* Lançamentos que compõem a categoria */}
                                    {catGroup.items && catGroup.items.length > 0 && (
                                      <div className="divide-y divide-slate-100 text-[11px] pt-1 border-t border-slate-100">
                                        {catGroup.items.map((item: any) => (
                                          <div
                                            key={item.id}
                                            className="py-1 flex items-center justify-between text-slate-600"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="text-slate-400">
                                                {item.date}
                                              </span>
                                              <span>{item.description}</span>
                                              <span className="text-slate-400 text-[10px]">
                                                ({item.accountName})
                                              </span>
                                            </div>
                                            <span className="font-semibold text-slate-900">
                                              {formatCentsToBRL(item.amountCents)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Seção Separada: Fora do DRE (Investimentos / Compra de Máquinas) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Fora do DRE: Investimentos & Bens de Capital
              </h2>
              <p className="text-xs text-slate-500">
                Lançamentos categorizados como investimentos (ex: compra de vending machines) que não compõem o resultado do exercício
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-semibold uppercase">
                Total de Investimentos
              </span>
              <span className="text-xl font-black text-slate-900">
                {formatCentsToBRL(dre?.foraDreTotalCents ?? 0)}
              </span>
            </div>
          </div>

          {dre?.foraDreItems && dre.foraDreItems.length > 0 ? (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {dre.foraDreItems.map((cat: any) => (
                <div
                  key={cat.categoryId}
                  className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-slate-800">{cat.categoryName}</span>
                  <span className="font-black text-slate-900">
                    {formatCentsToBRL(cat.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic pt-2 border-t border-slate-100">
              Nenhum investimento registrado neste período.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
