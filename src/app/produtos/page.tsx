"use client";

import { useState, useEffect, useMemo } from "react";
import { getCachedData, setCachedData, fetchWithDedupe, invalidateCache } from "@/lib/useCachedFetch";
import { useAuth } from "@/contexts/AuthContext";
import { formatCentsToBRL } from "@/lib/formatters";
import { UNIT_MEASURES, getUnitLabel, getUnitSymbol } from "@/lib/units";
import {
  Package,
  PlusCircle,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  Barcode,
  TrendingUp,
  Boxes,
  DollarSign,
  CheckCircle2,
  X,
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface CategoryOption {
  id: string;
  name: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface ProductItem {
  id: string;
  name: string;
  description?: string | null;
  sku: string;
  barcode?: string | null;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  salePrice: number;
  costPrice: number;
  unit?: string;
  unitPerPack: number;
  minStock: number;
  currentStock: number;
  active: boolean;
  isLowStock: boolean;
  movementCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SummaryKPIs {
  totalActiveProducts: number;
  totalStockUnits: number;
  totalStockValue: number;
  lowStockCount: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [summary, setSummary] = useState<SummaryKPIs>({
    totalActiveProducts: 0,
    totalStockUnits: 0,
    totalStockValue: 0,
    lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Listas auxiliares
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const { user: currentUser } = useAuth();

  // Modal de Produto
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<ProductItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formBarcode, setFormBarcode] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formCostPrice, setFormCostPrice] = useState("0,00");
  const [formSalePrice, setFormSalePrice] = useState("0,00");
  const [formUnit, setFormUnit] = useState("UN");
  const [formUnitPerPack, setFormUnitPerPack] = useState("1");
  const [formMinStock, setFormMinStock] = useState("10");
  const [formCurrentStock, setFormCurrentStock] = useState("0");
  const [formDescription, setFormDescription] = useState("");
  const [formActive, setFormActive] = useState(true);

  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Carrega dados auxiliares
  useEffect(() => {
    async function loadAuxData() {
      try {
        const [catRes, supRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/suppliers?status=ACTIVE"),
        ]);
        if (catRes.ok) {
          const c = await catRes.json();
          // Achata categorias para select
          const flat: CategoryOption[] = [];
          (c.categories || []).forEach((cat: any) => {
            flat.push({ id: cat.id, name: cat.name });
            if (cat.subcategories) {
              cat.subcategories.forEach((sub: any) => {
                flat.push({ id: sub.id, name: `${cat.name} > ${sub.name}` });
              });
            }
          });
          setCategories(flat);
        }
        if (supRes.ok) {
          const s = await supRes.json();
          setSuppliers(s.suppliers || []);
        }
      } catch (e) {
        console.error("Erro ao carregar dados auxiliares:", e);
      }
    }
    loadAuxData();
  }, []);

  // Busca produtos
  const fetchProducts = async (silent = false) => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
      if (selectedSupplierId) params.set("supplierId", selectedSupplierId);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (onlyLowStock) params.set("lowStock", "true");

      const cacheKey = `/api/products?${params.toString()}`;
      const cached = getCachedData(cacheKey);

      if (cached) {
        setProducts(cached.products || []);
        if (cached.summary) {
          setSummary(cached.summary);
        }
        setLoading(false);
      } else if (!silent) {
        setLoading(true);
      }

      const data = await fetchWithDedupe(cacheKey);
      setCachedData(cacheKey, data);
      setProducts(data.products || []);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [statusFilter, selectedCategoryId, selectedSupplierId, onlyLowStock]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  // Funções de formatação de moeda para input
  const parseCurrencyInput = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrencyInput = (val: number): string => {
    return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Cálculo de Margem em tempo real no Modal
  const costNumber = parseCurrencyInput(formCostPrice);
  const saleNumber = parseCurrencyInput(formSalePrice);
  const profitMarginBRL = saleNumber - costNumber;
  const profitMarginPercent = saleNumber > 0 ? (profitMarginBRL / saleNumber) * 100 : 0;

  // Gerador automático de SKU inteligente
  const generateSku = () => {
    const cleanName = formName
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

    const prefix = cleanName.slice(0, 4) || "PROD";
    const rand = Math.floor(1000 + Math.random() * 9000);
    setFormSku(`${prefix}-${rand}`);
  };

  const handleOpenCreate = () => {
    setProductToEdit(null);
    setFormName("");
    setFormSku("");
    setFormBarcode("");
    setFormCategoryId("");
    setFormSupplierId("");
    setFormCostPrice("0,00");
    setFormSalePrice("0,00");
    setFormUnit("UN");
    setFormUnitPerPack("1");
    setFormMinStock("10");
    setFormCurrentStock("0");
    setFormDescription("");
    setFormActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: ProductItem) => {
    setProductToEdit(p);
    setFormName(p.name);
    setFormSku(p.sku);
    setFormBarcode(p.barcode || "");
    setFormCategoryId(p.categoryId || "");
    setFormSupplierId(p.supplierId || "");
    setFormCostPrice(formatCurrencyInput(p.costPrice));
    setFormSalePrice(formatCurrencyInput(p.salePrice));
    setFormUnit(p.unit || "UN");
    setFormUnitPerPack(p.unitPerPack.toString());
    setFormMinStock(p.minStock.toString());
    setFormCurrentStock(p.currentStock.toString());
    setFormDescription(p.description || "");
    setFormActive(p.active);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formName.trim()) {
      setModalError("Nome do produto é obrigatório.");
      return;
    }
    if (!formSku.trim()) {
      setModalError("SKU é obrigatório (você pode clicar no botão gerar).");
      return;
    }

    const costPrice = parseCurrencyInput(formCostPrice);
    const salePrice = parseCurrencyInput(formSalePrice);
    const unitPerPack = parseInt(formUnitPerPack, 10) || 1;
    const minStock = parseInt(formMinStock, 10) || 0;
    const currentStock = parseInt(formCurrentStock, 10) || 0;

    setSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        sku: formSku.trim().toUpperCase(),
        barcode: formBarcode.trim() || null,
        categoryId: formCategoryId || null,
        supplierId: formSupplierId || null,
        costPrice,
        salePrice,
        unit: formUnit || "UN",
        unitPerPack,
        minStock,
        currentStock,
        description: formDescription.trim() || null,
        active: formActive,
      };

      const url = productToEdit ? `/api/products/${productToEdit.id}` : "/api/products";
      const method = productToEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao salvar produto.");
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setModalError(err.message || "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: ProductItem) => {
    const confirmMessage = p.movementCount > 0
      ? `O produto "${p.name}" possui ${p.movementCount} movimentações registradas. Ele será desativado (soft delete) para preservar o histórico. Deseja prosseguir?`
      : `Tem certeza que deseja excluir o produto "${p.name}"?`;

    if (!confirm(confirmMessage)) return;

    try {
      const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao excluir produto.");
      fetchProducts();
    } catch (e: any) {
      alert(e.message || "Erro ao excluir produto.");
    }
  };

  const canEdit = currentUser?.role !== "VIEWER";

  return (
    <>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Package className="w-7 h-7 text-orange-500" />
              Catálogo de Produtos
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerencie os produtos comercializados nas vending machines e o saldo no depósito central.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/estoque"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-sm transition-colors"
            >
              <Boxes className="w-4 h-4 text-amber-500" />
              <span>Controle de Estoque</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>

            {canEdit && (
              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Novo Produto</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Produtos */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Produtos Ativos
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {summary.totalActiveProducts}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Itens disponíveis para venda</p>
          </div>

          {/* Card 2: Saldo em Unidades */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Unidades no Depósito
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {summary.totalStockUnits.toLocaleString("pt-BR")}{" "}
              <span className="text-sm font-normal text-slate-400">un</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Saldo físico central atual</p>
          </div>

          {/* Card 3: Valor Financeiro em Estoque */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Valor em Estoque (Custo)
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatCentsToBRL(Math.round(summary.totalStockValue * 100))}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Patrimônio imobilizado em mercadorias</p>
          </div>

          {/* Card 4: Alerta Estoque Mínimo */}
          <div
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`p-5 rounded-2xl border shadow-sm cursor-pointer transition-all relative overflow-hidden ${
              onlyLowStock
                ? "bg-rose-50/70 border-rose-300 ring-2 ring-rose-400/40"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Abaixo do Mínimo
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-600 tracking-tight flex items-center justify-between">
              <span>{summary.lowStockCount}</span>
              {onlyLowStock && (
                <span className="text-[11px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                  Filtro Ativo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {onlyLowStock ? "Clique para desmarcar filtro" : "Clique para filtrar itens críticos"}
            </p>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, SKU, código de barras (EAN)..."
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Buscar
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3">
            {/* Categoria */}
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Fornecedor */}
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Todos os Fornecedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="ACTIVE">Ativos</option>
              <option value="INACTIVE">Inativos</option>
              <option value="ALL">Todos os Status</option>
            </select>
          </div>
        </div>

        {/* Tabela de Produtos */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mb-2"></div>
              <p className="text-sm">Carregando catálogo de produtos...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-semibold text-slate-700">Nenhum produto encontrado</p>
              <p className="text-xs text-slate-500 mt-1">
                Tente ajustar os filtros ou cadastre um novo produto para começar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 border-b border-slate-200 font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Produto / SKU</th>
                    <th className="py-3 px-4">Categoria / Fornecedor</th>
                    <th className="py-3 px-4 text-right">Custo Unit.</th>
                    <th className="py-3 px-4 text-right">Preço Venda</th>
                    <th className="py-3 px-4 text-center">Margem</th>
                    <th className="py-3 px-4 text-center">Unidade</th>
                    <th className="py-3 px-4 text-right">Saldo Depósito</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => {
                    const marginVal = p.salePrice - p.costPrice;
                    const marginPct = p.salePrice > 0 ? (marginVal / p.salePrice) * 100 : 0;
                    const isCriticallyLow = p.currentStock <= p.minStock;

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          !p.active ? "opacity-60 bg-slate-50/40" : ""
                        }`}
                      >
                        {/* Produto / SKU */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 leading-snug">{p.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 font-semibold">
                              {p.sku}
                            </span>
                            {p.barcode && (
                              <span className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
                                <Barcode className="w-3 h-3 text-slate-400" />
                                {p.barcode}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Categoria / Fornecedor */}
                        <td className="py-3.5 px-4">
                          <div className="text-slate-800 font-medium">
                            {p.category?.name || "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {p.supplier?.name || "Sem fornecedor padrão"}
                          </div>
                        </td>

                        {/* Custo Unitário */}
                        <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                          {formatCentsToBRL(Math.round(p.costPrice * 100))}
                        </td>

                        {/* Preço de Venda */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCentsToBRL(Math.round(p.salePrice * 100))}
                        </td>

                        {/* Margem de Lucro */}
                        <td className="py-3.5 px-4 text-center">
                          <div className={`text-xs font-bold ${marginPct >= 35 ? "text-emerald-600" : marginPct > 0 ? "text-amber-600" : "text-rose-600"}`}>
                            {marginPct.toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {formatCentsToBRL(Math.round(marginVal * 100))}
                          </div>
                        </td>

                        {/* Unidade */}
                        <td className="py-3.5 px-4 text-center text-xs text-slate-600">
                          <span className="bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 font-medium">
                            {getUnitLabel(p.unit)}
                          </span>
                        </td>

                        {/* Saldo / Mínimo */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={`text-base font-black font-mono ${
                                isCriticallyLow ? "text-rose-600" : "text-emerald-600"
                              }`}
                            >
                              {p.currentStock} {getUnitSymbol(p.unit)}
                            </span>
                            {isCriticallyLow && (
                              <span
                                title={`Abaixo do mínimo (${p.minStock} ${getUnitSymbol(p.unit)})`}
                                className="p-1 rounded-md bg-rose-50 text-rose-600 border border-rose-200"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Mínimo: {p.minStock} {getUnitSymbol(p.unit)}
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(p)}
                                  title="Editar Produto"
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(p)}
                                  title="Excluir ou Desativar Produto"
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de Cadastro / Edição */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <Package className="w-5 h-5 text-orange-500" />
                  <h2 className="text-lg font-bold text-slate-800">
                    {productToEdit ? "Editar Produto" : "Novo Produto no Catálogo"}
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {modalError && (
                  <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nome */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Nome do Produto *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ex: Coca-Cola Lata 350ml, Snack Doritos 55g..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>

                  {/* SKU com gerador automático */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Código SKU *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={formSku}
                        onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                        placeholder="Ex: COCA-350"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono uppercase focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <button
                        type="button"
                        onClick={generateSku}
                        title="Gerar código SKU automático a partir do nome"
                        className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-amber-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Gerar</span>
                      </button>
                    </div>
                  </div>

                  {/* Código de Barras EAN */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Código de Barras (EAN / Leitor)
                    </label>
                    <div className="relative">
                      <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={formBarcode}
                        onChange={(e) => setFormBarcode(e.target.value)}
                        placeholder="Ex: 7894900010015"
                        className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-900 font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Categoria */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Categoria do Produto
                    </label>
                    <select
                      value={formCategoryId}
                      onChange={(e) => setFormCategoryId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Selecione uma categoria...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Fornecedor Padrão */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Fornecedor Padrão
                    </label>
                    <select
                      value={formSupplierId}
                      onChange={(e) => setFormSupplierId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Nenhum fornecedor vinculado</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Preço de Custo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Preço de Custo Unitário (R$)
                    </label>
                    <input
                      type="text"
                      value={formCostPrice}
                      onChange={(e) => setFormCostPrice(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>

                  {/* Preço de Venda Padrão */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Preço de Venda na Máquina (R$)
                    </label>
                    <input
                      type="text"
                      value={formSalePrice}
                      onChange={(e) => setFormSalePrice(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Banner de Margem em Tempo Real */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span className="text-slate-600 font-medium">Margem Bruta Estimada:</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-600">
                      Lucro: <strong className="text-slate-900">{formatCentsToBRL(Math.round(profitMarginBRL * 100))}</strong> por {getUnitSymbol(formUnit)}
                    </span>
                    <span
                      className={`font-black font-mono px-2 py-0.5 rounded-full text-xs ${
                        profitMarginPercent >= 35
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : profitMarginPercent > 0
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {profitMarginPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Unidade de Medida */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Unidade de Medida
                    </label>
                    <select
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {UNIT_MEASURES.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-slate-500">Padrão de controle de estoque</span>
                  </div>

                  {/* Estoque Mínimo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Estoque Mínimo (Alerta)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formMinStock}
                      onChange={(e) => setFormMinStock(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <span className="text-[11px] text-slate-500">Disparo de reposição</span>
                  </div>

                  {/* Saldo Atual */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      {productToEdit ? "Saldo Atual (Depósito)" : "Estoque Inicial"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formCurrentStock}
                      onChange={(e) => setFormCurrentStock(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <span className="text-[11px] text-slate-500">Em {getUnitSymbol(formUnit)} base</span>
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Descrição / Observações (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Detalhes adicionais, sabor, gramatura..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* Status Ativo */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="productActive"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-500 border-slate-300 focus:ring-orange-500"
                  />
                  <label htmlFor="productActive" className="text-sm text-slate-700 font-medium cursor-pointer">
                    Produto ativo para operações e abastecimento
                  </label>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-bold shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {submitting && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                    <span>{productToEdit ? "Salvar Alterações" : "Cadastrar Produto"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

