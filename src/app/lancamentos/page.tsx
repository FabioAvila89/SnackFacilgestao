"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { formatCentsToBRL, formatDateToBR } from "@/lib/formatters";
import {
  Search,
  Filter,
  PlusCircle,
  Download,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  Repeat,
  Truck,
  AlertCircle,
  Ban,
} from "lucide-react";
import { TransactionModal } from "@/components/TransactionModal";

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: number[] = [];
  pages.push(1);
  if (currentPage > 3) {
    pages.push(-1); // indicador de reticências
  }
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (currentPage < totalPages - 2) {
    pages.push(-1); // indicador de reticências
  }
  pages.push(totalPages);
  return pages;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totals, setTotals] = useState({
    incomeCents: 0,
    expenseCents: 0,
    resultCents: 0,
    pendingIncomeCents: 0,
    pendingExpenseCents: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 25, totalPages: 1, totalCount: 0 });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [kind, setKind] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "PENDING" | "RECURRING">("ALL");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Debounce de 300ms no campo de busca para evitar enxurrada de requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Dados auxiliares para selects
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categoriesTree, setCategoriesTree] = useState<any[]>([]);
  const { user: currentUser } = useAuth();

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<any>(null);
  const [deleteTx, setDeleteTx] = useState<any | null>(null);
  const [stopRecurrenceTx, setStopRecurrenceTx] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStoppingRecurrence, setIsStoppingRecurrence] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  // Carrega opções de contas e categorias
  useEffect(() => {
    async function loadFilters() {
      try {
        const [accRes, catRes] = await Promise.all([
          fetch("/api/accounts"),
          fetch("/api/categories?includeInactive=true"),
        ]);
        const accData = await accRes.json();
        const catData = await catRes.json();
        setAccounts(accData.accounts || []);
        setCategoriesTree(catData.tree || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadFilters();
  }, []);

  const fetchTransactions = async (
    pageToFetch = pagination.page,
    limitToFetch = pagination.limit,
    searchOverride?: string
  ) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(pageToFetch));
      params.set("limit", String(limitToFetch));
      const s = searchOverride !== undefined ? searchOverride : debouncedSearch;
      if (s) params.set("search", s);
      if (kind !== "ALL") params.set("kind", kind);
      if (statusFilter === "RECURRING") {
        params.set("isRecurring", "true");
      } else if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (accountId) params.set("accountId", accountId);
      if (categoryId) params.set("categoryId", categoryId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar lançamentos");
      const json = await res.json();

      setTransactions(json.transactions || []);
      setTotals(
        json.totals || {
          incomeCents: 0,
          expenseCents: 0,
          resultCents: 0,
          pendingIncomeCents: 0,
          pendingExpenseCents: 0,
        }
      );
      setPagination(
        json.pagination || {
          page: pageToFetch,
          limit: limitToFetch,
          totalPages: 1,
          totalCount: 0,
        }
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(1, pagination.limit, debouncedSearch);
  }, [debouncedSearch, kind, statusFilter, accountId, categoryId, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions(1, pagination.limit, search);
  };

  const handleEdit = (tx: any) => {
    setTransactionToEdit(tx);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setTransactionToEdit(null);
    setIsModalOpen(true);
  };

  // Ação rápida: Dar Baixa (Marcar como Pago/Recebido)
  const handleQuickMarkPaid = async (txId: string) => {
    try {
      setMarkingPaidId(txId);
      const res = await fetch(`/api/transactions/${txId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      if (!res.ok) throw new Error("Falha ao dar baixa no lançamento");
      fetchTransactions(pagination.page);
    } catch (err) {
      console.error(err);
      alert("Erro ao marcar lançamento como pago.");
    } finally {
      setMarkingPaidId(null);
    }
  };

  // Ação rápida: Encerrar Recorrência (isRecurring: false)
  const handleStopRecurrenceDirect = async (txId: string) => {
    try {
      setIsStoppingRecurrence(true);
      const res = await fetch(`/api/transactions/${txId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRecurring: false }),
      });
      if (!res.ok) throw new Error("Falha ao encerrar recorrência");
      setStopRecurrenceTx(null);
      if (deleteTx?.id === txId) setDeleteTx(null);
      fetchTransactions(pagination.page);
    } catch (err) {
      console.error(err);
      alert("Erro ao encerrar recorrência do lançamento.");
    } finally {
      setIsStoppingRecurrence(false);
    }
  };

  const confirmDelete = async (txId?: string) => {
    const idToDelete = txId || deleteTx?.id;
    if (!idToDelete) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/transactions/${idToDelete}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir");
      setDeleteTx(null);
      fetchTransactions(pagination.page);
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir lançamento.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportXLSX = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (kind !== "ALL") params.set("kind", kind);
    if (statusFilter === "RECURRING") {
      params.set("isRecurring", "true");
    } else if (statusFilter !== "ALL") {
      params.set("status", statusFilter);
    }
    if (accountId) params.set("accountId", accountId);
    if (categoryId) params.set("categoryId", categoryId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    window.open(`/api/export/transactions?${params.toString()}`, "_blank");
  };

  // Verifica se uma data de vencimento está atrasada (menor que hoje)
  const isDateOverdue = (dueDateStr?: string | Date | null) => {
    if (!dueDateStr) return false;
    const due = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Lançamentos Financeiros
            </h1>
            <p className="text-sm text-slate-500">
              Gerencie todas as entradas e saídas do caixa
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportXLSX}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm px-4 py-2.5 rounded-xl border border-slate-300 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Exportar Excel</span>
            </button>

            {currentUser?.role !== "VIEWER" && (
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-orange-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Novo Lançamento</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          {/* Busca e Filtro Rápido de Status */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por descrição, fornecedor ou observações..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Buscar
              </button>
            </form>

            {/* Filtro Rápido de Status */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start md:self-auto">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PAID")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === "PAID"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Pagos / Recebidos
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PENDING")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === "PENDING"
                    ? "bg-white text-amber-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Pendentes
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("RECURRING")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  statusFilter === "RECURRING"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Recorrentes</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100 text-xs">
            {/* Tipo */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Tipo
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              >
                <option value="ALL">Todos os Tipos</option>
                <option value="INCOME">Entradas (+)</option>
                <option value="EXPENSE">Saídas (-)</option>
              </select>
            </div>

            {/* Conta */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Conta
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Todas as Contas</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Categoria
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Todas as Categorias</option>
                {categoriesTree.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    <option value={cat.id}>Todos de {cat.name}</option>
                    {cat.subcategories?.map((sub: any) => (
                      <option key={sub.id} value={sub.id}>
                        ↳ {sub.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Data Inicial */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                De
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              />
            </div>

            {/* Data Final */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Até
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>
        </div>

        {/* Totais do Filtro Aplicado */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-sm shadow-md">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-orange-400" />
            <span className="font-semibold text-slate-300">
              Totais do filtro ({pagination.totalCount} registros):
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-5 sm:gap-6">
            <div>
              <span className="text-[11px] text-slate-400 block">Entradas Realizadas:</span>
              <span className="font-bold text-emerald-400">
                {formatCentsToBRL(totals.incomeCents)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Saídas Pagas:</span>
              <span className="font-bold text-rose-400">
                {formatCentsToBRL(totals.expenseCents)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Resultado Caixa:</span>
              <span
                className={`font-bold ${
                  totals.resultCents >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatCentsToBRL(totals.resultCents)}
              </span>
            </div>

            {(totals.pendingExpenseCents > 0 || totals.pendingIncomeCents > 0) && (
              <div className="pl-4 border-l border-slate-800 flex items-center gap-4 text-xs">
                {totals.pendingExpenseCents > 0 && (
                  <div>
                    <span className="text-[10px] text-amber-400 uppercase font-bold block">
                      A Pagar (Pendente):
                    </span>
                    <span className="font-bold text-amber-300">
                      {formatCentsToBRL(totals.pendingExpenseCents)}
                    </span>
                  </div>
                )}
                {totals.pendingIncomeCents > 0 && (
                  <div>
                    <span className="text-[10px] text-sky-400 uppercase font-bold block">
                      A Receber (Pendente):
                    </span>
                    <span className="font-bold text-sky-300">
                      {formatCentsToBRL(totals.pendingIncomeCents)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabela de Lançamentos */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Conta</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      Carregando lançamentos...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      Nenhum lançamento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isIncome = tx.kind === "INCOME";
                    const isPending = tx.status === "PENDING";
                    const isOverdue = isPending && isDateOverdue(tx.dueDate);
                    const hasSub = !!tx.category.parentId;
                    const catTitle = hasSub ? tx.category.parent?.name : tx.category.name;
                    const subTitle = hasSub ? tx.category.name : null;

                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Data */}
                        <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                          <div>{formatDateToBR(tx.date)}</div>
                          {tx.dueDate && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              Venc: {formatDateToBR(tx.dueDate)}
                            </div>
                          )}
                        </td>

                        {/* Descrição + Badges de Parcela / Recorrência / Fornecedor */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{tx.description}</span>

                            {/* Badge Parcela */}
                            {tx.isInstallment && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Layers className="w-2.5 h-2.5" />
                                <span>{tx.installmentNumber}/{tx.totalInstallments}</span>
                              </span>
                            )}

                            {/* Badge Recorrência */}
                            {tx.isRecurring && (
                              <span
                                title={`Recorrência: ${
                                  tx.recurrenceFrequency === "WEEKLY"
                                    ? "Semanal"
                                    : tx.recurrenceFrequency === "YEARLY"
                                    ? "Anual"
                                    : "Mensal"
                                }`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                              >
                                <Repeat className="w-2.5 h-2.5" />
                                <span>
                                  {tx.recurrenceFrequency === "WEEKLY"
                                    ? "Semanal"
                                    : tx.recurrenceFrequency === "YEARLY"
                                    ? "Anual"
                                    : "Mensal"}
                                </span>
                              </span>
                            )}

                            {/* Badge Fornecedor */}
                            {tx.supplier && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                <Truck className="w-2.5 h-2.5 text-slate-500" />
                                <span>{tx.supplier.name}</span>
                              </span>
                            )}
                          </div>

                          {tx.notes && (
                            <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs mt-0.5">
                              {tx.notes}
                            </div>
                          )}
                        </td>

                        {/* Categoria */}
                        <td className="py-3.5 px-4 text-slate-600">
                          <span className="font-medium text-slate-800">{catTitle}</span>
                          {subTitle && (
                            <span className="block text-[11px] text-slate-400">
                              ↳ {subTitle}
                            </span>
                          )}
                        </td>

                        {/* Conta */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {tx.account.name}
                          </span>
                        </td>

                        {/* Status (Badge elegante com alerta para vencidos) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {!isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{isIncome ? "Recebido" : "Pago"}</span>
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300 animate-pulse">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Atrasado</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>{isIncome ? "A Receber" : "A Pagar"}</span>
                            </span>
                          )}
                        </td>

                        {/* Valor */}
                        <td className="py-3.5 px-4 text-right font-black whitespace-nowrap">
                          <span
                            className={
                              isIncome ? "text-emerald-600" : "text-rose-600"
                            }
                          >
                            {isIncome ? "+ " : "- "}
                            {formatCentsToBRL(tx.amountCents)}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {currentUser?.role === "VIEWER" ? (
                            <span className="text-xs text-slate-400 italic">Consulta</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 opacity-90 group-hover:opacity-100">
                              {/* Ação Rápida: Dar Baixa */}
                              {isPending && (
                                <button
                                  onClick={() => handleQuickMarkPaid(tx.id)}
                                  disabled={markingPaidId === tx.id}
                                  title={isIncome ? "Marcar como Recebido" : "Marcar como Pago"}
                                  className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}

                              {/* Ação Rápida: Encerrar Recorrência */}
                              {tx.isRecurring && (
                                <button
                                  onClick={() => setStopRecurrenceTx(tx)}
                                  disabled={isStoppingRecurrence}
                                  title="Encerrar Recorrência (interromper repetições futuras)"
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => handleEdit(tx)}
                                title="Editar"
                                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTx(tx)}
                                title="Excluir"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Paginação Server-Side Otimizada */}
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 bg-slate-50/50">
            {/* Contagem de registros e Seletor de Itens por Página */}
            <div className="flex flex-wrap items-center gap-4">
              <span>
                {pagination.totalCount > 0 ? (
                  <>
                    Mostrando{" "}
                    <strong className="text-slate-800">
                      {(pagination.page - 1) * pagination.limit + 1}
                    </strong>{" "}
                    a{" "}
                    <strong className="text-slate-800">
                      {Math.min(pagination.page * pagination.limit, pagination.totalCount)}
                    </strong>{" "}
                    de{" "}
                    <strong className="text-slate-800">{pagination.totalCount}</strong> lançamentos
                  </>
                ) : (
                  "Nenhum lançamento encontrado"
                )}
              </span>

              <div className="flex items-center gap-1.5 pl-2 sm:border-l sm:border-slate-200">
                <span className="text-slate-400">Exibir:</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => {
                    const newLimit = Number(e.target.value);
                    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
                    fetchTransactions(1, newLimit);
                  }}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-slate-400">por página</span>
              </div>
            </div>

            {/* Controles de Navegação por Páginas */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchTransactions(pagination.page - 1, pagination.limit)}
                  className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg disabled:opacity-40 hover:bg-slate-100 text-slate-700 font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                {/* Números de página */}
                <div className="flex items-center gap-1 mx-1">
                  {getPageNumbers(pagination.page, pagination.totalPages).map((p, idx) =>
                    p === -1 ? (
                      <span key={`dots-${idx}`} className="px-1 text-slate-400 select-none">
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => fetchTransactions(p, pagination.limit)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          p === pagination.page
                            ? "bg-orange-600 text-white shadow-sm shadow-orange-600/30"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchTransactions(pagination.page + 1, pagination.limit)}
                  className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg disabled:opacity-40 hover:bg-slate-100 text-slate-700 font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Criar / Editar */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTransactionToEdit(null);
        }}
        onSuccess={() => fetchTransactions(pagination.page)}
        transactionToEdit={transactionToEdit}
      />

      {/* Modal de Confirmação de Encerramento de Recorrência */}
      {stopRecurrenceTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Encerrar Recorrência?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                O lançamento <strong>&quot;{stopRecurrenceTx.description}&quot;</strong> continuará salvo no seu histórico e nos relatórios financeiros, mas deixará de se repetir nos próximos períodos.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStopRecurrenceTx(null)}
                disabled={isStoppingRecurrence}
                className="flex-1 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleStopRecurrenceDirect(stopRecurrenceTx.id)}
                disabled={isStoppingRecurrence}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95"
              >
                {isStoppingRecurrence ? "Encerrando..." : "Encerrar Recorrência"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                {deleteTx.isRecurring ? "Lançamento Recorrente" : "Excluir Lançamento?"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {deleteTx.isRecurring
                  ? `"${deleteTx.description}" é uma movimentação recorrente. Você pode apenas encerrar a recorrência (mantendo o histórico contábil) ou excluir o registro definitivamente do sistema.`
                  : `Deseja realmente excluir "${deleteTx.description}"? Esta ação é irreversível e atualizará imediatamente o saldo das contas.`}
              </p>
            </div>

            {deleteTx.isRecurring ? (
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleStopRecurrenceDirect(deleteTx.id)}
                  disabled={isStoppingRecurrence || isDeleting}
                  className="w-full py-2.5 px-3 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors cursor-pointer"
                >
                  {isStoppingRecurrence ? "Encerrando..." : "Apenas Encerrar Recorrência (Manter histórico)"}
                </button>
                <button
                  type="button"
                  onClick={() => confirmDelete(deleteTx.id)}
                  disabled={isStoppingRecurrence || isDeleting}
                  className="w-full py-2.5 px-3 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-colors cursor-pointer"
                >
                  {isDeleting ? "Excluindo..." : "Excluir Definitivamente"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTx(null)}
                  disabled={isStoppingRecurrence || isDeleting}
                  className="w-full py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTx(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => confirmDelete(deleteTx.id)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20"
                >
                  {isDeleting ? "Excluindo..." : "Sim, Excluir"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
