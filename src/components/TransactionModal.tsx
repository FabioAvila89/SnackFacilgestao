"use client";

import { useState, useEffect } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { formatDateToInput, parseBRLToCents, formatCentsToBRL } from "@/lib/formatters";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transactionToEdit?: {
    id: string;
    date: string | Date;
    kind: "INCOME" | "EXPENSE";
    amountCents: number;
    description: string;
    accountId: string;
    categoryId: string;
    notes?: string | null;
    createdAt?: string | Date;
    updatedAt?: string | Date;
    createdBy?: { id: string; name: string; email?: string } | null;
    updatedBy?: { id: string; name: string; email?: string } | null;
  } | null;
}

export function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  transactionToEdit,
}: TransactionModalProps) {
  const isEditing = !!transactionToEdit;

  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [date, setDate] = useState(formatDateToInput(new Date()));
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [selectedParentCatId, setSelectedParentCatId] = useState("");
  const [selectedSubCatId, setSelectedSubCatId] = useState("");
  const [notes, setNotes] = useState("");

  const [accounts, setAccounts] = useState<any[]>([]);
  const [categoriesTree, setCategoriesTree] = useState<any[]>([]);
  const [flatCategories, setFlatCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrega contas e categorias ativas
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      try {
        setLoadingInitial(true);
        const [accRes, catRes] = await Promise.all([
          fetch("/api/accounts"),
          fetch("/api/categories"),
        ]);
        const accData = await accRes.json();
        const catData = await catRes.json();

        const activeAccounts = (accData.accounts || []).filter((a: any) => a.active);
        setAccounts(activeAccounts);
        setCategoriesTree(catData.tree || []);
        setFlatCategories(catData.flat || []);

        if (transactionToEdit) {
          setKind(transactionToEdit.kind);
          setDate(formatDateToInput(transactionToEdit.date));
          setAmountStr((transactionToEdit.amountCents / 100).toFixed(2).replace(".", ","));
          setDescription(transactionToEdit.description);
          setAccountId(transactionToEdit.accountId);
          setNotes(transactionToEdit.notes || "");

          // Identificar se a categoria selecionada é pai ou filha
          const cat = (catData.flat || []).find((c: any) => c.id === transactionToEdit.categoryId);
          if (cat) {
            if (cat.parentId) {
              setSelectedParentCatId(cat.parentId);
              setSelectedSubCatId(cat.id);
            } else {
              setSelectedParentCatId(cat.id);
              setSelectedSubCatId("");
            }
          }
        } else {
          // Defaults para novo lançamento
          setKind("EXPENSE");
          setDate(formatDateToInput(new Date()));
          setAmountStr("");
          setDescription("");
          setNotes("");
          setSelectedParentCatId("");
          setSelectedSubCatId("");
          if (activeAccounts.length > 0) {
            setAccountId(activeAccounts[0].id);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados do formulário:", err);
      } finally {
        setLoadingInitial(false);
      }
    }

    loadData();
  }, [isOpen, transactionToEdit]);

  if (!isOpen) return null;

  // Filtra categorias pelo tipo selecionado (INCOME ou EXPENSE)
  const filteredParentCategories = categoriesTree.filter((c) => c.kind === kind && c.active);

  // Subcategorias disponíveis para a categoria pai selecionada
  const activeParent = filteredParentCategories.find((c) => c.id === selectedParentCatId);
  const availableSubcategories = activeParent?.subcategories?.filter((s: any) => s.active) || [];

  const handleKindChange = (newKind: "INCOME" | "EXPENSE") => {
    setKind(newKind);
    setSelectedParentCatId("");
    setSelectedSubCatId("");
  };

  const handleParentCatChange = (parentId: string) => {
    setSelectedParentCatId(parentId);
    setSelectedSubCatId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountCents = parseBRLToCents(amountStr);
    if (amountCents <= 0) {
      setError("O valor do lançamento deve ser maior que zero.");
      return;
    }

    if (!description.trim()) {
      setError("Por favor preencha a descrição.");
      return;
    }

    if (!accountId) {
      setError("Por favor selecione uma conta.");
      return;
    }

    // A categoria final é a subcategoria (se selecionada) ou a categoria pai
    const finalCategoryId = selectedSubCatId || selectedParentCatId;
    if (!finalCategoryId) {
      setError("Por favor selecione uma categoria.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        date,
        kind,
        amountCents,
        description: description.trim(),
        accountId,
        categoryId: finalCategoryId,
        notes: notes.trim() || null,
      };

      const url = isEditing
        ? `/api/transactions/${transactionToEdit.id}`
        : "/api/transactions";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao salvar lançamento.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800">
            {isEditing ? "Editar Lançamento" : "Novo Lançamento"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isEditing && (
          <div className="mx-6 mt-3 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-500 flex flex-col gap-0.5">
            {transactionToEdit?.updatedBy ? (
              <span>
                Última alteração por <strong className="text-slate-700">{transactionToEdit.updatedBy.name}</strong> em{" "}
                {transactionToEdit.updatedAt ? new Date(transactionToEdit.updatedAt).toLocaleString("pt-BR") : "—"}
              </span>
            ) : transactionToEdit?.createdBy ? (
              <span>
                Lançado por <strong className="text-slate-700">{transactionToEdit.createdBy.name}</strong> em{" "}
                {transactionToEdit.createdAt ? new Date(transactionToEdit.createdAt).toLocaleString("pt-BR") : "—"}
              </span>
            ) : null}
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Seletor Tipo: Entrada x Saída */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Tipo de Movimentação
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleKindChange("INCOME")}
                className={`py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                  kind === "INCOME"
                    ? "bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>↑ Entrada (Receita)</span>
              </button>
              <button
                type="button"
                onClick={() => handleKindChange("EXPENSE")}
                className={`py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                  kind === "EXPENSE"
                    ? "bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/20"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>↓ Saída (Gasto)</span>
              </button>
            </div>
          </div>

          {/* Campo Valor (Destaque Amigável para Celular) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Valor (R$) *
            </label>
            <div className="relative rounded-xl shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-lg">
                R$
              </div>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="0,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="block w-full pl-12 pr-4 py-3 text-2xl font-extrabold text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Data e Conta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Data *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full px-3 py-2.5 text-sm font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Conta *
              </label>
              <select
                required
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="block w-full px-3 py-2.5 text-sm font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
              >
                <option value="">Selecione a conta...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type === "BANK" ? "Banco" : acc.type === "CASH" ? "Caixa" : "Cartão"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Descrição *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Venda máquina academia, Reposição salgadinhos..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
            />
          </div>

          {/* Categoria e Subcategoria (Selects Dependentes) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Categoria *
              </label>
              <select
                required
                value={selectedParentCatId}
                onChange={(e) => handleParentCatChange(e.target.value)}
                className="block w-full px-3 py-2.5 text-sm font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
              >
                <option value="">Selecione categoria...</option>
                {filteredParentCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Subcategoria (opcional)
              </label>
              <select
                value={selectedSubCatId}
                onChange={(e) => setSelectedSubCatId(e.target.value)}
                disabled={!selectedParentCatId || availableSubcategories.length === 0}
                className="block w-full px-3 py-2.5 text-sm font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">
                  {availableSubcategories.length === 0
                    ? "(Sem subcategorias)"
                    : "Geral (ou selecione...)"}
                </option>
                {availableSubcategories.map((sub: any) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Observações (opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: NF 1234, Pago via Pix pelo sócio..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="block w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
            />
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? "Atualizar" : "Salvar Lançamento"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
