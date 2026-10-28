"use client";

import { useState, useEffect } from "react";
import { X, Check, AlertCircle, Calendar, Repeat, Layers, CheckCircle2 } from "lucide-react";
import { formatDateToInput, parseBRLToCents, formatCentsToBRL } from "@/lib/formatters";

interface InstallmentRow {
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  amountStr: string;
  status: "PAID" | "PENDING";
}

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
    status?: string;
    paidAt?: string | Date | null;
    dueDate?: string | Date | null;
    supplierId?: string | null;
    isRecurring?: boolean;
    recurrenceFrequency?: string | null;
    isInstallment?: boolean;
    installmentNumber?: number | null;
    totalInstallments?: number | null;
    installmentGroupId?: string | null;
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

  // Novos campos: Status, Vencimento, Fornecedor
  const [status, setStatus] = useState<"PAID" | "PENDING">("PAID");
  const [dueDate, setDueDate] = useState("");
  const [supplierId, setSupplierId] = useState("");

  // Recorrência
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<"MONTHLY" | "WEEKLY" | "YEARLY">("MONTHLY");

  // Parcelamento
  const [isInstallment, setIsInstallment] = useState(false);
  const [numInstallments, setNumInstallments] = useState(2);
  const [installmentRows, setInstallmentRows] = useState<InstallmentRow[]>([]);

  // Listas auxiliares
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categoriesTree, setCategoriesTree] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrega contas, categorias e fornecedores ativos
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      try {
        setLoadingInitial(true);
        const [accRes, catRes, supRes] = await Promise.all([
          fetch("/api/accounts"),
          fetch("/api/categories"),
          fetch("/api/suppliers?status=ACTIVE"),
        ]);
        const accData = await accRes.json();
        const catData = await catRes.json();
        const supData = await supRes.json();

        const activeAccounts = (accData.accounts || []).filter((a: any) => a.active);
        setAccounts(activeAccounts);
        setCategoriesTree(catData.tree || []);
        setSuppliers(supData.suppliers || []);

        if (transactionToEdit) {
          setKind(transactionToEdit.kind);
          setDate(formatDateToInput(transactionToEdit.date));
          setAmountStr((transactionToEdit.amountCents / 100).toFixed(2).replace(".", ","));
          setDescription(transactionToEdit.description);
          setAccountId(transactionToEdit.accountId);
          setNotes(transactionToEdit.notes || "");
          setStatus((transactionToEdit.status as "PAID" | "PENDING") || "PAID");
          setDueDate(transactionToEdit.dueDate ? formatDateToInput(transactionToEdit.dueDate) : "");
          setSupplierId(transactionToEdit.supplierId || "");
          setIsRecurring(!!transactionToEdit.isRecurring);
          setRecurrenceFrequency((transactionToEdit.recurrenceFrequency as any) || "MONTHLY");
          setIsInstallment(false); // edição de parcela individual
          setInstallmentRows([]);

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
          setDueDate("");
          setStatus("PAID");
          setAmountStr("");
          setDescription("");
          setNotes("");
          setSupplierId("");
          setIsRecurring(false);
          setRecurrenceFrequency("MONTHLY");
          setIsInstallment(false);
          setNumInstallments(2);
          setInstallmentRows([]);
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

  // Recalcula parcelas dinâmicas quando valor total ou número de parcelas mudar
  useEffect(() => {
    if (!isInstallment || isEditing) return;

    const totalCents = parseBRLToCents(amountStr);
    const n = Math.max(2, numInstallments || 2);
    const baseCents = Math.floor(totalCents / n);
    const remainder = totalCents - baseCents * n;

    const baseDateObj = date ? new Date(date + "T12:00:00Z") : new Date();

    const rows: InstallmentRow[] = [];
    for (let i = 0; i < n; i++) {
      const rowCents = i === 0 ? baseCents + remainder : baseCents;
      const rowDate = new Date(baseDateObj);
      rowDate.setUTCMonth(rowDate.getUTCMonth() + i);

      // Parcela 1 pode iniciar com status geral; parcelas futuras default PENDING
      const rowStatus: "PAID" | "PENDING" = i === 0 ? status : "PENDING";

      rows.push({
        installmentNumber: i + 1,
        totalInstallments: n,
        dueDate: formatDateToInput(rowDate),
        amountStr: (rowCents / 100).toFixed(2).replace(".", ","),
        status: rowStatus,
      });
    }

    setInstallmentRows(rows);
  }, [isInstallment, numInstallments, amountStr, date, isEditing]);

  if (!isOpen) return null;

  // Filtra categorias pelo tipo selecionado (INCOME ou EXPENSE)
  const filteredParentCategories = categoriesTree.filter((c) => c.kind === kind && c.active);
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

  const handleInstallmentRowChange = (index: number, field: keyof InstallmentRow, value: any) => {
    setInstallmentRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Soma das parcelas para validação
  const installmentsSumCents = installmentRows.reduce(
    (acc, row) => acc + parseBRLToCents(row.amountStr),
    0
  );
  const totalAmountCents = parseBRLToCents(amountStr);
  const isInstallmentsBalanced = installmentsSumCents === totalAmountCents;

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

    const finalCategoryId = selectedSubCatId || selectedParentCatId;
    if (!finalCategoryId) {
      setError("Por favor selecione uma categoria.");
      return;
    }

    if (isInstallment && !isEditing) {
      if (installmentRows.length < 2) {
        setError("O parcelamento deve conter no mínimo 2 parcelas.");
        return;
      }
      if (!isInstallmentsBalanced) {
        setError(
          `A soma das parcelas (${formatCentsToBRL(installmentsSumCents)}) não fecha com o valor total (${formatCentsToBRL(totalAmountCents)}). Ajuste as parcelas.`
        );
        return;
      }
    }

    setLoading(true);

    try {
      const payload: any = {
        date,
        kind,
        amountCents,
        description: description.trim(),
        accountId,
        categoryId: finalCategoryId,
        notes: notes.trim() || null,
        status,
        dueDate: dueDate || null,
        supplierId: supplierId || null,
        isRecurring,
        recurrenceFrequency: isRecurring ? recurrenceFrequency : null,
      };

      if (isInstallment && !isEditing) {
        payload.isInstallment = true;
        payload.totalInstallments = installmentRows.length;
        payload.installments = installmentRows.map((row) => ({
          installmentNumber: row.installmentNumber,
          totalInstallments: row.totalInstallments,
          dueDate: row.dueDate,
          amountCents: parseBRLToCents(row.amountStr),
          status: row.status,
        }));
      }

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
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
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
          <div className="mx-6 mt-3 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-500 flex flex-col gap-0.5 flex-shrink-0">
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
          <div className="mx-6 mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulário com Scroll interno */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
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

          {/* Status da Movimentação (Pago / Pendente) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Status da Movimentação
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus("PAID")}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                  status === "PAID"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-emerald-500/20"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{kind === "INCOME" ? "Recebido (Pago)" : "Pago"}</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus("PENDING")}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                  status === "PENDING"
                    ? "bg-amber-50 text-amber-800 border-amber-500 ring-2 ring-amber-500/20"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>{kind === "INCOME" ? "Pendente (A Receber)" : "Pendente (A Pagar)"}</span>
              </button>
            </div>
          </div>

          {/* Campo Valor Total */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Valor Total (R$) *
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

          {/* Data de Competência e Data de Vencimento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Data do Lançamento *
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
                {kind === "INCOME"
                  ? "Vencimento (Previsão de Recebimento)"
                  : "Data de Vencimento"}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="block w-full px-3 py-2.5 text-sm font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
              />
            </div>
          </div>

          {/* Conta e Fornecedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Fornecedor (Opcional)
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="block w-full px-3 py-2.5 text-sm font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
              >
                <option value="">Nenhum (ou selecione...)</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
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

          {/* Categoria e Subcategoria */}
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

          {/* Informação se a transação em edição for parte de parcelamento */}
          {isEditing && transactionToEdit?.isInstallment && (
            <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200/80 text-xs text-indigo-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span>
                Este lançamento é a parcela <strong>{transactionToEdit.installmentNumber}/{transactionToEdit.totalInstallments}</strong> de uma movimentação parcelada.
              </span>
            </div>
          )}

          {/* Recorrência e Parcelamento */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {isEditing ? "Recorrência" : "Opções Avançadas"}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Checkbox Recorrência */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setIsRecurring(val);
                    if (val && !isEditing) setIsInstallment(false);
                  }}
                  className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                />
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-slate-500" />
                  Esta movimentação se repete (recorrência)
                </span>
              </label>

              {/* Checkbox Parcelamento (apenas na criação de novo lançamento) */}
              {!isEditing && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isInstallment}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setIsInstallment(val);
                      if (val) setIsRecurring(false);
                    }}
                    className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                  />
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    Movimentação parcelada
                  </span>
                </label>
              )}
            </div>

            {/* Detalhe de Frequência de Recorrência */}
            {isRecurring && (
              <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                <span className="text-xs text-slate-600 font-medium">Frequência:</span>
                <select
                  value={recurrenceFrequency}
                  onChange={(e) => setRecurrenceFrequency(e.target.value as any)}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="MONTHLY">Mensal (padrão)</option>
                  <option value="WEEKLY">Semanal</option>
                  <option value="YEARLY">Anual</option>
                </select>
              </div>
            )}

            {/* Bloco de Parcelamento Dinâmico (Apenas na criação) */}
            {!isEditing && isInstallment && (
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700">
                        Número de parcelas *
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Cada parcela vencerá em datas configuráveis (default: +1 mês cada)
                      </span>
                    </div>
                    <input
                      type="number"
                      min={2}
                      max={36}
                      value={numInstallments}
                      onChange={(e) => setNumInstallments(Math.max(2, parseInt(e.target.value, 10) || 2))}
                      className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-center bg-white"
                    />
                  </div>

                  {/* Linhas das Parcelas */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {installmentRows.map((inst, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-bold text-slate-700 w-10">
                          {inst.installmentNumber}/{inst.totalInstallments}
                        </span>

                        <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
                          <span className="text-[11px] text-slate-400">Vencimento:</span>
                          <input
                            type="date"
                            value={inst.dueDate}
                            onChange={(e) => handleInstallmentRowChange(idx, "dueDate", e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded text-xs bg-white flex-1"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 w-32">
                          <span className="text-[11px] text-slate-400">R$</span>
                          <input
                            type="text"
                            value={inst.amountStr}
                            onChange={(e) => handleInstallmentRowChange(idx, "amountStr", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold text-right bg-white"
                          />
                        </div>

                        <select
                          value={inst.status}
                          onChange={(e) => handleInstallmentRowChange(idx, "status", e.target.value)}
                          className={`px-2 py-1 rounded border text-xs font-semibold ${
                            inst.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : "bg-amber-50 text-amber-700 border-amber-300"
                          }`}
                        >
                          <option value="PENDING">Pendente</option>
                          <option value="PAID">Pago</option>
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Validação de Soma */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Validação do Total:</span>
                    <span
                      className={`font-bold ${
                        isInstallmentsBalanced ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      Soma das parcelas: {formatCentsToBRL(installmentsSumCents)}{" "}
                      {isInstallmentsBalanced ? (
                        "✓"
                      ) : (
                        <span>
                          (Diferença: {formatCentsToBRL(totalAmountCents - installmentsSumCents)})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

          {/* Botões de Ação */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 flex-shrink-0">
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
              disabled={loading || (isInstallment && !isEditing && !isInstallmentsBalanced)}
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
