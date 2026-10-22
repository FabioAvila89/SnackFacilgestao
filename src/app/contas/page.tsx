"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { formatCentsToBRL, parseBRLToCents } from "@/lib/formatters";
import {
  Landmark,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Wallet,
  CreditCard,
} from "lucide-react";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de Criar / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<any>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"BANK" | "CASH" | "CARD">("BANK");
  const [initialBalanceStr, setInitialBalanceStr] = useState("0,00");
  const [active, setActive] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Erro ao carregar contas");
      const json = await res.json();
      setAccounts(json.accounts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleOpenCreate = () => {
    setAccountToEdit(null);
    setName("");
    setType("BANK");
    setInitialBalanceStr("0,00");
    setActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (acc: any) => {
    setAccountToEdit(acc);
    setName(acc.name);
    setType(acc.type);
    setInitialBalanceStr((acc.initialBalanceCents / 100).toFixed(2).replace(".", ","));
    setActive(acc.active);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!name.trim()) {
      setModalError("Nome da conta é obrigatório.");
      return;
    }

    const initialBalanceCents = parseBRLToCents(initialBalanceStr);
    setSubmitting(true);

    try {
      const url = accountToEdit ? `/api/accounts/${accountToEdit.id}` : "/api/accounts";
      const method = accountToEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          initialBalanceCents,
          active,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar conta");

      setIsModalOpen(false);
      fetchAccounts();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrDeactivate = async (acc: any) => {
    const hasTransactions = acc.transactionCount > 0;
    const confirmMsg = hasTransactions
      ? `A conta "${acc.name}" possui lançamentos históricos e será DESATIVADA (não aparecerá em novos lançamentos, mas manterá o histórico). Confirma?`
      : `Deseja realmente EXCLUIR a conta "${acc.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/accounts/${acc.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao processar");
      fetchAccounts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getAccountIcon = (t: string) => {
    switch (t) {
      case "BANK":
        return <Building2 className="w-5 h-5 text-blue-600" />;
      case "CARD":
        return <CreditCard className="w-5 h-5 text-purple-600" />;
      case "CASH":
      default:
        return <Wallet className="w-5 h-5 text-emerald-600" />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Contas Bancárias e Caixas
            </h1>
            <p className="text-sm text-slate-500">
              Cadastre suas contas correntes, caixas físicos e cartões
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-orange-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nova Conta</span>
          </button>
        </div>

        {/* Lista de Contas (Grid de Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-12 text-center text-sm text-slate-400">
              Carregando contas...
            </div>
          ) : accounts.length === 0 ? (
            <div className="col-span-full py-12 text-center text-sm text-slate-400">
              Nenhuma conta cadastrada.
            </div>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 relative ${
                  acc.active ? "border-slate-200" : "border-slate-200 bg-slate-50/70 opacity-75"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      {getAccountIcon(acc.type)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <span>{acc.name}</span>
                        {!acc.active && (
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                            Desativada
                          </span>
                        )}
                      </h3>
                      <span className="text-xs text-slate-400 font-medium">
                        {acc.type === "BANK"
                          ? "Conta Bancária"
                          : acc.type === "CARD"
                          ? "Cartão de Crédito"
                          : "Caixa em Dinheiro"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(acc)}
                      title="Editar Conta"
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteOrDeactivate(acc)}
                      title={acc.transactionCount > 0 ? "Desativar Conta" : "Excluir Conta"}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Saldos */}
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Saldo Inicial:</span>
                    <span className="font-semibold text-slate-700">
                      {formatCentsToBRL(acc.initialBalanceCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Saldo Atual:
                    </span>
                    <span
                      className={`text-xl font-black ${
                        acc.currentBalanceCents >= 0 ? "text-slate-900" : "text-rose-600"
                      }`}
                    >
                      {formatCentsToBRL(acc.currentBalanceCents)}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                  <span>{acc.transactionCount} lançamentos registrados</span>
                  <span className={acc.active ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                    {acc.active ? "● Ativa" : "○ Inativa"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Criar / Editar Conta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-slate-900 text-lg mb-4">
              {accountToEdit ? "Editar Conta" : "Nova Conta"}
            </h3>

            {modalError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Nome da Conta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Banco Itaú PJ, Caixa Moedas Máquina 1..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Tipo de Conta *
                  </label>
                  <select
                    value={type}
                    onChange={(e: any) => setType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="BANK">Banco (Conta Corrente)</option>
                    <option value="CASH">Caixa Físico / Cofre</option>
                    <option value="CARD">Cartão</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Saldo Inicial (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="decimal"
                    value={initialBalanceStr}
                    onChange={(e) => setInitialBalanceStr(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white font-bold"
                  />
                </div>
              </div>

              {accountToEdit && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="activeAccount"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="activeAccount" className="text-xs font-semibold text-slate-700">
                    Conta Ativa (disponível para novos lançamentos)
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-600/20"
                >
                  {submitting ? "Salvando..." : "Salvar Conta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
