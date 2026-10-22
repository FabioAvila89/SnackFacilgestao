"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  Tags,
  PlusCircle,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderTree,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const DRE_LINES = [
  { id: "RECEITA_BRUTA", label: "1. Receita Bruta (Entrada)" },
  { id: "DEDUCOES", label: "2. Deduções sobre vendas (Saída)" },
  { id: "CMV", label: "3. CMV - Custo das Mercadorias Vendidas (Saída)" },
  { id: "DESPESAS_OPERACIONAIS", label: "4. Despesas Operacionais (Saída)" },
  { id: "RECEITAS_FINANCEIRAS", label: "5. Receitas Financeiras (Entrada)" },
  { id: "DESPESAS_FINANCEIRAS", label: "6. Despesas Financeiras (Saída)" },
  { id: "IMPOSTOS_LUCRO", label: "7. Impostos sobre o Lucro (Saída)" },
  { id: "FORA_DRE", label: "— Fora do DRE: Investimentos e Máquinas (Saída)" },
];

export default function CategoriesPage() {
  const [tree, setTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");

  // Modal de Criar / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [dreLine, setDreLine] = useState("DESPESAS_OPERACIONAIS");
  const [sortOrder, setSortOrder] = useState(0);
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/categories?includeInactive=true");
      if (!res.ok) throw new Error("Erro ao carregar categorias");
      const json = await res.json();
      setTree(json.tree || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenCreateParent = () => {
    setEditingCat(null);
    setParentId(null);
    setName("");
    setKind("EXPENSE");
    setDreLine("DESPESAS_OPERACIONAIS");
    setSortOrder(0);
    setActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenCreateSub = (parentCat: any) => {
    setEditingCat(null);
    setParentId(parentCat.id);
    setName("");
    setKind(parentCat.kind);
    setDreLine(parentCat.dreLine);
    setSortOrder((parentCat.subcategories?.length || 0) + 1);
    setActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: any) => {
    setEditingCat(cat);
    setParentId(cat.parentId || null);
    setName(cat.name);
    setKind(cat.kind);
    setDreLine(cat.dreLine);
    setSortOrder(cat.sortOrder || 0);
    setActive(cat.active);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!name.trim()) {
      setModalError("Nome é obrigatório.");
      return;
    }

    setSubmitting(true);

    try {
      const url = editingCat ? `/api/categories/${editingCat.id}` : "/api/categories";
      const method = editingCat ? "PUT" : "POST";

      const payload: any = {
        name: name.trim(),
        sortOrder: Number(sortOrder) || 0,
        active,
      };

      if (!editingCat) {
        payload.parentId = parentId;
        payload.kind = kind;
        payload.dreLine = dreLine;
      } else {
        if (!editingCat.parentId) {
          payload.dreLine = dreLine;
        }
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar categoria");

      setIsModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrDeactivate = async (cat: any) => {
    const hasTransactions = (cat.transactionCount || 0) > 0;
    const confirmMsg = hasTransactions
      ? `A categoria "${cat.name}" possui lançamentos históricos vinculados e será DESATIVADA (não poderá ser escolhida em novos lançamentos, mas preservará os relatórios passados). Confirma?`
      : `Deseja realmente EXCLUIR a categoria "${cat.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao processar");
      fetchCategories();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredTree = tree.filter((c) => {
    if (kindFilter === "ALL") return true;
    return c.kind === kindFilter;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Plano de Categorias
            </h1>
            <p className="text-sm text-slate-500">
              Estrutura hierárquica em dois níveis com vínculo ao DRE
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filtro por tipo */}
            <div className="bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold flex">
              <button
                onClick={() => setKindFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg ${
                  kindFilter === "ALL" ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setKindFilter("INCOME")}
                className={`px-3 py-1.5 rounded-lg ${
                  kindFilter === "INCOME" ? "bg-emerald-600 text-white" : "text-slate-600"
                }`}
              >
                Entradas
              </button>
              <button
                onClick={() => setKindFilter("EXPENSE")}
                className={`px-3 py-1.5 rounded-lg ${
                  kindFilter === "EXPENSE" ? "bg-rose-600 text-white" : "text-slate-600"
                }`}
              >
                Saídas
              </button>
            </div>

            <button
              onClick={handleOpenCreateParent}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-orange-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nova Categoria Pai</span>
            </button>
          </div>
        </div>

        {/* Árvore de Categorias */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-12 text-center text-sm text-slate-400">
                Carregando categorias...
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                Nenhuma categoria encontrada.
              </div>
            ) : (
              filteredTree.map((cat) => {
                const isIncome = cat.kind === "INCOME";

                return (
                  <div key={cat.id} className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors">
                    {/* Linha Categoria Nível 1 */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isIncome ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        <span className="font-bold text-slate-900 text-base">
                          {cat.name}
                        </span>
                        {!cat.active && (
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                            Desativada
                          </span>
                        )}
                        <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-lg font-medium border border-slate-200">
                          {cat.dreLine}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => handleOpenCreateSub(cat)}
                          className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-bold px-2 py-1 rounded-lg hover:bg-orange-50 cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>+ Subcategoria</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          title="Editar Categoria"
                          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteOrDeactivate(cat)}
                          title="Excluir ou Desativar"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Subcategorias (Indentadas) */}
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <div className="mt-3 ml-4 sm:ml-6 pl-3 border-l-2 border-slate-200 space-y-2">
                        {cat.subcategories.map((sub: any) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-50/80 rounded-xl border border-slate-200/60 hover:bg-white transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-mono">↳</span>
                              <span className="font-semibold text-slate-800">
                                {sub.name}
                              </span>
                              {!sub.active && (
                                <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-semibold">
                                  Inativa
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400">
                                ({sub.transactionCount || 0} lançamentos)
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(sub)}
                                title="Editar Subcategoria"
                                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteOrDeactivate(sub)}
                                title="Excluir ou Desativar"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal Criar / Editar Categoria */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-slate-900 text-lg mb-4">
              {editingCat
                ? `Editar ${editingCat.parentId ? "Subcategoria" : "Categoria"}`
                : parentId
                ? "Nova Subcategoria"
                : "Nova Categoria Nível 1"}
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
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Snacks e Salgadinhos, Aluguel do ponto..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Se for categoria nível 1, escolher tipo e linha do DRE */}
              {!parentId && (!editingCat || !editingCat.parentId) && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Tipo de Movimentação *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setKind("INCOME")}
                        className={`py-2 text-xs font-bold rounded-lg border ${
                          kind === "INCOME"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        Entrada (Receita)
                      </button>
                      <button
                        type="button"
                        onClick={() => setKind("EXPENSE")}
                        className={`py-2 text-xs font-bold rounded-lg border ${
                          kind === "EXPENSE"
                            ? "bg-rose-600 text-white border-rose-600"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        Saída (Despesa)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Linha do DRE Vinculada *
                    </label>
                    <select
                      value={dreLine}
                      onChange={(e) => setDreLine(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white"
                    >
                      {DRE_LINES.map((line) => (
                        <option key={line.id} value={line.id}>
                          {line.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Reordenação */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Ordem de Exibição
                </label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              {editingCat && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="activeCat"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="activeCat" className="text-xs font-semibold text-slate-700">
                    Categoria Ativa (disponível para novos lançamentos)
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
                  {submitting ? "Salvando..." : "Salvar Categoria"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
