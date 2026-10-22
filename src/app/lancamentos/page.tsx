"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { formatCentsToBRL, formatDateToBR } from "@/lib/formatters";
import {
  Search,
  Filter,
  PlusCircle,
  Download,
  Trash2,
  Edit2,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { TransactionModal } from "@/components/TransactionModal";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totals, setTotals] = useState({ incomeCents: 0, expenseCents: 0, resultCents: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 25, totalPages: 1, totalCount: 0 });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("ALL");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Dados auxiliares para selects
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categoriesTree, setCategoriesTree] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Carrega opções de contas, categorias e usuário logado
  useEffect(() => {
    async function loadFilters() {
      try {
        const [accRes, catRes, meRes] = await Promise.all([
          fetch("/api/accounts"),
          fetch("/api/categories?includeInactive=true"),
          fetch("/api/auth/me"),
        ]);
        const accData = await accRes.json();
        const catData = await catRes.json();
        const meData = await meRes.json();
        setAccounts(accData.accounts || []);
        setCategoriesTree(catData.tree || []);
        setCurrentUser(meData.user || null);
      } catch (err) {
        console.error(err);
      }
    }
    loadFilters();
  }, []);

  const fetchTransactions = async (pageToFetch = pagination.page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(pageToFetch));
      params.set("limit", String(pagination.limit));
      if (search) params.set("search", search);
      if (kind !== "ALL") params.set("kind", kind);
      if (accountId) params.set("accountId", accountId);
      if (categoryId) params.set("categoryId", categoryId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar lançamentos");
      const json = await res.json();

      setTransactions(json.transactions || []);
      setTotals(json.totals || { incomeCents: 0, expenseCents: 0, resultCents: 0 });
      setPagination(json.pagination || { page: 1, limit: 25, totalPages: 1, totalCount: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(1);
  }, [kind, accountId, categoryId, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions(1);
  };

  const handleEdit = (tx: any) => {
    setTransactionToEdit(tx);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setTransactionToEdit(null);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/transactions/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir");
      setDeleteId(null);
      fetchTransactions(pagination.page);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportXLSX = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (kind !== "ALL") params.set("kind", kind);
    if (accountId) params.set("accountId", accountId);
    if (categoryId) params.set("categoryId", categoryId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    window.open(`/api/export/transactions?${params.toString()}`, "_blank");
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
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-orange-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Novo Lançamento</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por descrição ou observações..."
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

          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-slate-400 block">Entradas:</span>
              <span className="font-bold text-emerald-400">
                {formatCentsToBRL(totals.incomeCents)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Saídas:</span>
              <span className="font-bold text-rose-400">
                {formatCentsToBRL(totals.expenseCents)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Resultado:</span>
              <span
                className={`font-bold ${
                  totals.resultCents >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatCentsToBRL(totals.resultCents)}
              </span>
            </div>
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
                  <th className="py-3 px-4">Lançado por</th>
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
                    const hasSub = !!tx.category.parentId;
                    const catTitle = hasSub
                      ? tx.category.parent?.name
                      : tx.category.name;
                    const subTitle = hasSub ? tx.category.name : null;

                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                          {formatDateToBR(tx.date)}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div>{tx.description}</div>
                          {tx.notes && (
                            <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs">
                              {tx.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <span className="font-medium text-slate-800">{catTitle}</span>
                          {subTitle && (
                            <span className="block text-[11px] text-slate-400">
                              ↳ {subTitle}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {tx.account.name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                            {tx.createdBy?.name || "Sistema"}
                          </span>
                        </td>
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
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {currentUser?.role === "VIEWER" ? (
                            <span className="text-xs text-slate-400 italic">Consulta</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 opacity-90 group-hover:opacity-100">
                              <button
                                onClick={() => handleEdit(tx)}
                                title="Editar"
                                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteId(tx.id)}
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

          {/* Paginação */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Página <b>{pagination.page}</b> de <b>{pagination.totalPages}</b> ({pagination.totalCount} lançamentos)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => fetchTransactions(pagination.page - 1)}
                  className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchTransactions(pagination.page + 1)}
                  className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
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

      {/* Modal de Confirmação de Exclusão */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Excluir Lançamento?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Esta ação é irreversível e atualizará imediatamente o saldo das contas e os relatórios.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20"
              >
                {isDeleting ? "Excluindo..." : "Sim, Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
