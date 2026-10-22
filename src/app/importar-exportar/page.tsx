"use client";

import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { formatCentsToBRL } from "@/lib/formatters";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  FileText,
} from "lucide-react";

export default function ImportExportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Confirmação
  const [importMode, setImportMode] = useState<"ONLY_VALID" | "ALL_OR_NOTHING">("ONLY_VALID");
  const [confirming, setConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  };

  const handleUploadPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/preview", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao processar arquivo");

      setPreview(data.preview);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;

    setConfirming(true);
    setErrorMessage(null);

    try {
      const validRows = preview.rows
        .filter((r: any) => r.isValid)
        .map((r: any) => ({
          date: r.date,
          kind: r.kind,
          amountCents: r.amountCents,
          description: r.description,
          accountId: r.accountId,
          categoryId: r.categoryId,
          notes: null,
        }));

      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: importMode,
          rows: validRows,
          hasErrors: preview.invalidRowsCount > 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao confirmar importação");

      setSuccessMessage(data.message || "Importação concluída com sucesso!");
      setPreview(null);
      setFile(null);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Cabeçalho */}
        <div className="pb-2 border-b border-slate-200">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Importação e Exportação de Dados
          </h1>
          <p className="text-sm text-slate-500">
            Importe lançamentos em lote via CSV/Excel e exporte relatórios consolidados
          </p>
        </div>

        {/* Mensagens de Sucesso / Erro */}
        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Seção 1: Download de Modelo & Exportações Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card Modelo */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                Planilha Modelo de Importação
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Baixe o modelo pré-formatado com cabeçalhos e exemplos para preenchimento.
              </p>
            </div>
            <a
              href="/api/export/template"
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Modelo (.xlsx)</span>
            </a>
          </div>

          {/* Card Exportar Lançamentos */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                Exportar Lançamentos
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Gere uma planilha Excel completa com todos os lançamentos financeiros cadastrados.
              </p>
            </div>
            <a
              href="/api/export/transactions"
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Lançamentos (.xlsx)</span>
            </a>
          </div>

          {/* Card Exportar DRE */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Exportar DRE Anual</h3>
              <p className="text-xs text-slate-500 mt-1">
                Baixe o demonstrativo de resultado com todas as linhas de receitas, deduções e margens.
              </p>
            </div>
            <a
              href="/api/export/dre?period=year"
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Exportar DRE (.xlsx)</span>
            </a>
          </div>
        </div>

        {/* Seção 2: Upload e Pré-Visualização */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Importar Arquivo de Lançamentos
              </h2>
              <p className="text-xs text-slate-500">
                Selecione um arquivo .CSV ou .XLSX com as colunas: <code>data</code>, <code>tipo</code>, <code>valor</code>, <code>descricao</code>, <code>categoria</code>, <code>subcategoria</code>, <code>conta</code>
              </p>
            </div>
          </div>

          <form onSubmit={handleUploadPreview} className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-orange-500 transition-colors bg-slate-50/50">
              <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <input
                type="file"
                id="fileUpload"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="fileUpload"
                className="text-sm font-bold text-orange-600 hover:text-orange-700 cursor-pointer block"
              >
                {file ? file.name : "Clique para selecionar o arquivo (.csv ou .xlsx)"}
              </label>
              <span className="text-xs text-slate-400 mt-1 block">
                Tamanho máximo permitido: 10MB
              </span>
            </div>

            {file && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-600/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <span>Processando e Validando...</span>
                  ) : (
                    <>
                      <span>Validar e Pré-visualizar Arquivo</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </form>

          {/* Pré-Visualização e Validação Linha por Linha */}
          {preview && (
            <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Resultado da Validação
                  </h3>
                  <p className="text-xs text-slate-500">
                    Total: {preview.totalRows} linhas •{" "}
                    <span className="text-emerald-600 font-bold">
                      {preview.validRowsCount} válidas
                    </span>{" "}
                    •{" "}
                    <span className="text-rose-600 font-bold">
                      {preview.invalidRowsCount} com erros
                    </span>
                  </p>
                </div>

                {/* Opções de importação */}
                <div className="flex items-center gap-3 text-xs">
                  <label className="font-semibold text-slate-700">Regra:</label>
                  <select
                    value={importMode}
                    onChange={(e: any) => setImportMode(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    <option value="ONLY_VALID">
                      Importar somente as linhas válidas
                    </option>
                    <option value="ALL_OR_NOTHING">
                      Cancelar tudo se houver qualquer erro
                    </option>
                  </select>

                  <button
                    onClick={handleConfirmImport}
                    disabled={
                      confirming ||
                      (importMode === "ALL_OR_NOTHING" && preview.invalidRowsCount > 0) ||
                      preview.validRowsCount === 0
                    }
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-40 cursor-pointer transition-all"
                  >
                    {confirming ? "Importando..." : "Confirmar Importação"}
                  </button>
                </div>
              </div>

              {/* Tabela de Linhas com Erros e Válidas */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-bold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 w-16">Linha</th>
                      <th className="py-2.5 px-3 w-20">Status</th>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Valor</th>
                      <th className="py-2.5 px-3">Descrição</th>
                      <th className="py-2.5 px-3">Categoria</th>
                      <th className="py-2.5 px-3">Conta</th>
                      <th className="py-2.5 px-3">Validação / Motivo do Erro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.map((row: any) => (
                      <tr
                        key={row.rowIndex}
                        className={row.isValid ? "bg-white" : "bg-red-50/70"}
                      >
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          #{row.rowIndex}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              Erro
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          {row.dateFormatted || "—"}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">
                          {row.kind === "INCOME" ? (
                            <span className="text-emerald-600">Entrada</span>
                          ) : row.kind === "EXPENSE" ? (
                            <span className="text-rose-600">Saída</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {row.amountCents ? formatCentsToBRL(row.amountCents) : "—"}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {row.description || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {row.categoryName || "—"}
                          {row.subcategoryName && (
                            <span className="block text-[10px] text-slate-400">
                              ↳ {row.subcategoryName}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {row.accountName || "—"}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">
                          {row.isValid ? (
                            <span className="text-emerald-700 text-[11px]">
                              Linha pronta para importar
                            </span>
                          ) : (
                            <ul className="text-red-700 text-[11px] list-disc list-inside space-y-0.5">
                              {row.errors.map((err: string, i: number) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
