"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { formatPhoneBR, formatCpfCnpj } from "@/lib/formatters";
import {
  Truck,
  PlusCircle,
  Edit2,
  Trash2,
  Search,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  X,
  Check,
  Building2,
} from "lucide-react";

interface SupplierItem {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  document?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  transactionCount?: number;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Modal de Criar / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<SupplierItem | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+55 ");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Usuário para permissões
  const { user: currentUser } = useAuth();

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/suppliers?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar fornecedores");
      const json = await res.json();
      setSuppliers(json.suppliers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSuppliers();
  };

  const handleOpenCreate = () => {
    setSupplierToEdit(null);
    setName("");
    setPhone("+55 ");
    setEmail("");
    setDocument("");
    setNotes("");
    setActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup: SupplierItem) => {
    setSupplierToEdit(sup);
    setName(sup.name);
    setPhone(sup.phone || "+55 ");
    setEmail(sup.email || "");
    setDocument(sup.document || "");
    setNotes(sup.notes || "");
    setActive(sup.active);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handlePhoneChange = (val: string) => {
    setPhone(formatPhoneBR(val));
  };

  const handleDocumentChange = (val: string) => {
    setDocument(formatCpfCnpj(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!name.trim()) {
      setModalError("Nome do fornecedor é obrigatório.");
      return;
    }

    const cleanPhoneDigits = phone.replace(/\D/g, "");
    if (cleanPhoneDigits.length < 10) {
      setModalError("Por favor informe um telefone válido com DDD (ex: +55 (11) 98765-4321).");
      return;
    }

    setSubmitting(true);

    try {
      const url = supplierToEdit ? `/api/suppliers/${supplierToEdit.id}` : "/api/suppliers";
      const method = supplierToEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          document: document.trim() || null,
          notes: notes.trim() || null,
          active,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar fornecedor");

      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      setModalError(err.message || "Erro desconhecido ao salvar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrDeactivate = async (sup: SupplierItem) => {
    const hasTransactions = (sup.transactionCount || 0) > 0;
    const confirmMessage = hasTransactions
      ? `O fornecedor "${sup.name}" possui ${sup.transactionCount} lançamentos vinculados e será desativado para preservar o histórico financeiro. Deseja continuar?`
      : `Deseja realmente excluir o fornecedor "${sup.name}"?`;

    if (!confirm(confirmMessage)) return;

    try {
      const res = await fetch(`/api/suppliers/${sup.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao excluir");
      fetchSuppliers();
    } catch (err: any) {
      alert(err.message || "Erro ao processar");
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Truck className="w-7 h-7 text-orange-500" />
              <span>Fornecedores</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerencie seus fornecedores, parceiros comerciais e prestadores de serviço
            </p>
          </div>

          {currentUser?.role !== "VIEWER" && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-orange-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Novo Fornecedor</span>
            </button>
          )}
        </div>

        {/* Filtros e Barra de Busca */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Busca */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone, CPF/CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
            />
          </form>

          {/* Filtro Todos / Ativos / Inativos */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
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
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === "ACTIVE"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ativos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("INACTIVE")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === "INACTIVE"
                  ? "bg-white text-slate-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Inativos
            </button>
          </div>
        </div>

        {/* Lista de Fornecedores (Grid de Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-12 text-center text-sm text-slate-400">
              Carregando fornecedores...
            </div>
          ) : suppliers.length === 0 ? (
            <div className="col-span-full py-12 text-center text-sm text-slate-400">
              Nenhum fornecedor cadastrado ou encontrado para os filtros informados.
            </div>
          ) : (
            suppliers.map((sup) => (
              <div
                key={sup.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 relative transition-all ${
                  sup.active ? "border-slate-200 hover:border-slate-300" : "border-slate-200 bg-slate-50/70 opacity-75"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <span>{sup.name}</span>
                        {!sup.active && (
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                            Inativo
                          </span>
                        )}
                      </h3>
                      {sup.document && (
                        <span className="text-xs text-slate-400 font-mono">
                          {sup.document}
                        </span>
                      )}
                    </div>
                  </div>

                  {currentUser?.role !== "VIEWER" && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(sup)}
                        title="Editar Fornecedor"
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteOrDeactivate(sup)}
                        title={(sup.transactionCount || 0) > 0 ? "Desativar Fornecedor" : "Excluir Fornecedor"}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Contatos */}
                <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-semibold text-slate-800">{sup.phone}</span>
                  </div>

                  {sup.email && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{sup.email}</span>
                    </div>
                  )}

                  {sup.notes && (
                    <div className="pt-1 text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {sup.notes}
                    </div>
                  )}
                </div>

                {/* Rodapé do Card */}
                <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between border-t border-slate-50">
                  <span>{sup.transactionCount || 0} lançamentos vinculados</span>
                  <span className={sup.active ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                    {sup.active ? "● Ativo" : "○ Inativo"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Criar / Editar Fornecedor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-500" />
                <span>{supplierToEdit ? "Editar Fornecedor" : "Novo Fornecedor"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome da empresa ou pessoa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                />
              </div>

              {/* Linha com Telefone e E-mail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Telefone *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+55 (11) 98765-4321"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="block w-full px-3.5 py-2.5 text-sm font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    placeholder="contato@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                  />
                </div>
              </div>

              {/* CPF / CNPJ */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  CPF / CNPJ
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  value={document}
                  onChange={(e) => handleDocumentChange(e.target.value)}
                  className="block w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Observações (opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Informações adicionais sobre o fornecedor..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="block w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white resize-none"
                />
              </div>

              {/* Status Ativo (em edição) */}
              {supplierToEdit && (
                <div className="pt-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="supplier-active"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                  />
                  <label htmlFor="supplier-active" className="text-sm font-medium text-slate-700">
                    Fornecedor ativo
                  </label>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Salvando...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{supplierToEdit ? "Atualizar Fornecedor" : "Cadastrar Fornecedor"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
