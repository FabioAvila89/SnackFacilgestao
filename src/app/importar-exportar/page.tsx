"use client";

import { useState, useRef } from "react";
import { formatCentsToBRL } from "@/lib/formatters";
import { useAuth } from "@/contexts/AuthContext";
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
  HardDriveDownload,
  ShieldCheck,
  Loader2,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

export default function ImportExportPage() {
  const { user: authUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Confirmação
  const [importMode, setImportMode] = useState<"ONLY_VALID" | "ALL_OR_NOTHING">("ONLY_VALID");
  const [confirming, setConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Backup & Restauração
  const [backupLoading, setBackupLoading] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restorePayload, setRestorePayload] = useState<any>(null);
  const [restoreFileName, setRestoreFileName] = useState("");
  const [confirmRestoreText, setConfirmRestoreText] = useState("");
  const [restoring, setRestoring] = useState(false);

  // Modal de Resultado da Restauração (Sucesso ou Falha)
  const [restoreResult, setRestoreResult] = useState<{
    status: "success" | "error";
    title: string;
    message: string;
    totalRecords?: number;
    backupDate?: string;
    tables?: Record<string, number>;
  } | null>(null);

  const handleBackupDownload = async () => {
    setBackupLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao gerar backup");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      a.download = `backup_snack_facil_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMessage("Backup baixado com sucesso! Guarde o arquivo em local seguro.");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setRestoreFileName(selected.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.metadata || !json.data) {
          throw new Error("Formato inválido. O arquivo de backup deve conter as seções 'metadata' e 'data'.");
        }
        setRestorePayload(json);
        setConfirmRestoreText("");
        setShowRestoreModal(true);
      } catch (err: any) {
        setErrorMessage(`Arquivo de backup inválido: ${err.message}`);
      }
    };
    reader.onerror = () => {
      setErrorMessage("Erro ao ler o arquivo selecionado");
    };
    reader.readAsText(selected);

    // Reseta o input para permitir selecionar o mesmo arquivo novamente se necessário
    if (restoreFileInputRef.current) {
      restoreFileInputRef.current.value = "";
    }
  };

  const handleConfirmRestore = async () => {
    if (!restorePayload || confirmRestoreText.trim().toUpperCase() !== "RESTAURAR") {
      return;
    }

    setRestoring(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restorePayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao restaurar banco de dados");
      }

      setShowRestoreModal(false);
      setRestorePayload(null);
      setConfirmRestoreText("");
      
      // Exibe modal de confirmação de sucesso
      setRestoreResult({
        status: "success",
        title: "Banco de Dados Restaurado com Sucesso!",
        message: `Todos os dados foram recuperados com sucesso a partir do backup.`,
        totalRecords: data.totalRecords,
        backupDate: data.backupDate,
        tables: data.tables,
      });

      setSuccessMessage(
        `Banco de dados restaurado com sucesso! Foram recuperados ${data.totalRecords || "todos os"} registros.`
      );
    } catch (err: any) {
      setShowRestoreModal(false);
      // Exibe modal de confirmação de falha
      setRestoreResult({
        status: "error",
        title: "Falha na Restauração do Banco",
        message: err.message || "Ocorreu um erro inesperado durante a restauração.",
      });
      setErrorMessage(err.message);
    } finally {
      setRestoring(false);
    }
  };

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
          notes: r.notes || null,
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
    <>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

          {/* Card Backup Completo — Somente Admin */}
          {authUser?.role === "ADMIN" && (
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between space-y-3 ring-1 ring-amber-100">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                  <HardDriveDownload className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  Backup Completo
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Exporte ou restaure <strong>todos os dados</strong> do banco em formato JSON com segurança.
                </p>
              </div>

              {/* Input escondido para selecionar o arquivo de restauração */}
              <input
                ref={restoreFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleSelectRestoreFile}
                className="hidden"
              />

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={handleBackupDownload}
                  disabled={backupLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {backupLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gerando backup...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Baixar Backup (.json)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => restoreFileInputRef.current?.click()}
                  disabled={restoring}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50 border border-slate-200 hover:border-red-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Backup (.json)</span>
                </button>
              </div>
            </div>
          )}
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

      {/* Modal de Confirmação Crítica de Restauração do Banco */}
      {showRestoreModal && restorePayload && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabeçalho de Perigo */}
            <div className="bg-gradient-to-r from-red-600 to-rose-700 px-6 py-5 text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-black text-lg tracking-tight">
                  Restaurar Banco de Dados
                </h3>
                <p className="text-xs text-red-100">
                  Substituição completa de todos os dados do sistema
                </p>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-4">
              {/* Alerta Crítico */}
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-900 leading-relaxed flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block mb-1">Ação Irreversível!</strong>
                  Esta operação apagará todos os lançamentos, produtos, categorias e cadastros atuais do sistema e os substituirá pelo conteúdo deste arquivo de backup.
                </div>
              </div>

              {/* Informações do Arquivo */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Arquivo:</span>
                  <span className="font-mono font-bold text-slate-800">{restoreFileName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Data do Backup:</span>
                  <span className="font-bold text-slate-800">
                    {restorePayload.metadata?.createdAt
                      ? new Date(restorePayload.metadata.createdAt).toLocaleString("pt-BR")
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">Total de Registros:</span>
                  <span className="font-bold text-emerald-700">
                    {Object.values(
                      (restorePayload.metadata?.tables as Record<string, number>) || {}
                    ).reduce((a, b) => a + b, 0)}{" "}
                    registros
                  </span>
                </div>

                {/* Grade rápida de tabelas */}
                {restorePayload.metadata?.tables && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>
                      • Lançamentos:{" "}
                      <strong>{restorePayload.metadata.tables.transactions || 0}</strong>
                    </div>
                    <div>
                      • Produtos:{" "}
                      <strong>{restorePayload.metadata.tables.products || 0}</strong>
                    </div>
                    <div>
                      • Categorias:{" "}
                      <strong>{restorePayload.metadata.tables.categories || 0}</strong>
                    </div>
                    <div>
                      • Contas:{" "}
                      <strong>{restorePayload.metadata.tables.accounts || 0}</strong>
                    </div>
                    <div>
                      • Fornecedores:{" "}
                      <strong>{restorePayload.metadata.tables.suppliers || 0}</strong>
                    </div>
                    <div>
                      • Máquinas:{" "}
                      <strong>{restorePayload.metadata.tables.machines || 0}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Trava de Segurança por Digitação */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Para confirmar, digite <span className="text-red-600 font-black">RESTAURAR</span> no campo abaixo:
                </label>
                <input
                  type="text"
                  value={confirmRestoreText}
                  onChange={(e) => setConfirmRestoreText(e.target.value)}
                  placeholder="Digite RESTAURAR"
                  disabled={restoring}
                  className="w-full px-3.5 py-2.5 border-2 border-slate-300 focus:border-red-500 rounded-xl text-sm font-mono font-bold tracking-wider uppercase outline-none transition-colors"
                />
              </div>
            </div>

            {/* Rodapé com Botões */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreModal(false);
                  setRestorePayload(null);
                  setConfirmRestoreText("");
                }}
                disabled={restoring}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={
                  restoring ||
                  confirmRestoreText.trim().toUpperCase() !== "RESTAURAR"
                }
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {restoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Restaurando banco...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Confirmar Restauração Completa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Status/Resultado da Restauração (Sucesso ou Erro) */}
      {restoreResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 text-center space-y-4">
            {/* Ícone Indicador de Status */}
            <div
              className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
                restoreResult.status === "success"
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {restoreResult.status === "success" ? (
                <CheckCircle2 className="w-10 h-10" />
              ) : (
                <AlertCircle className="w-10 h-10" />
              )}
            </div>

            {/* Título e Mensagem */}
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                {restoreResult.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {restoreResult.message}
              </p>
            </div>

            {/* Detalhes de Sucesso */}
            {restoreResult.status === "success" && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-xs text-left space-y-2">
                <div className="flex justify-between py-1 border-b border-emerald-200/50">
                  <span className="text-emerald-800 font-medium">Total restaurado:</span>
                  <span className="font-bold text-emerald-950 font-mono">
                    {restoreResult.totalRecords} registros
                  </span>
                </div>
                {restoreResult.backupDate && (
                  <div className="flex justify-between py-1 border-b border-emerald-200/50">
                    <span className="text-emerald-800 font-medium">Data do backup:</span>
                    <span className="font-bold text-emerald-950">
                      {new Date(restoreResult.backupDate).toLocaleString("pt-BR")}
                    </span>
                  </div>
                )}
                {restoreResult.tables && (
                  <div className="pt-2 grid grid-cols-2 gap-1.5 text-[11px] text-emerald-900">
                    <div>• Lançamentos: <strong>{restoreResult.tables.transactions || 0}</strong></div>
                    <div>• Produtos: <strong>{restoreResult.tables.products || 0}</strong></div>
                    <div>• Categorias: <strong>{restoreResult.tables.categories || 0}</strong></div>
                    <div>• Contas: <strong>{restoreResult.tables.accounts || 0}</strong></div>
                  </div>
                )}
              </div>
            )}

            {/* Detalhes de Erro */}
            {restoreResult.status === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-left text-red-800 leading-relaxed">
                <p className="font-medium">
                  Nenhum dado foi corrompido. Certifique-se de que o arquivo JSON foi gerado pelo sistema Snack Fácil e tente novamente.
                </p>
              </div>
            )}

            {/* Botão de Fechar / Ação */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  const wasSuccess = restoreResult.status === "success";
                  setRestoreResult(null);
                  if (wasSuccess) {
                    // Recarrega a página para atualizar os dados de todas as telas
                    window.location.reload();
                  }
                }}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer ${
                  restoreResult.status === "success"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                    : "bg-slate-800 hover:bg-slate-900 text-white shadow-slate-800/20"
                }`}
              >
                {restoreResult.status === "success"
                  ? "Entendido, Atualizar Sistema"
                  : "Fechar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
