"use client";

import { useState, useEffect, useCallback } from "react";
import { getCachedData, setCachedData, fetchWithDedupe, invalidateCache } from "@/lib/useCachedFetch";
import { useAuth } from "@/contexts/AuthContext";
import { formatCentsToBRL, formatDateToBR, formatDateToInput } from "@/lib/formatters";
import { getUnitSymbol } from "@/lib/units";
import {
  Boxes,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowRight,
  Truck,
  CheckCircle2,
  DollarSign,
  X,
  Building2,
  Package,
  Clock,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  currentStock: number;
  minStock: number;
  costPrice: number;
  unit?: string;
  unitPerPack: number;
  supplierId?: string | null;
  categoryId?: string | null;
}

interface MachineOption {
  id: string;
  name: string;
  location?: string | null;
  active: boolean;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface AccountOption {
  id: string;
  name: string;
  type: string;
  active: boolean;
}

interface CategoryOption {
  id: string;
  name: string;
  kind: string;
}

interface StockMovementItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    currentStock: number;
    unit?: string;
    unitPerPack: number;
  };
  type: "IN" | "OUT" | "ADJUST";
  reason: "PURCHASE" | "MACHINE_REFILL" | "LOSS_EXPIRED" | "LOSS_DAMAGE" | "INVENTORY_ADJUSTMENT";
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost?: number | null;
  totalCost?: number | null;
  expirationDate?: string | null;
  machineId?: string | null;
  machine?: { id: string; name: string } | null;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  transactionId?: string | null;
  transaction?: { id: string; amountCents: number; status: string; date: string } | null;
  notes?: string | null;
  user?: { id: string; name: string; email?: string } | null;
  createdAt: string;
}

export default function StockControlPage() {
  const { user: currentUser } = useAuth();

  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"kardex" | "low_stock" | "expiring">("kardex");

  // Filtros Kardex
  const [filterProductId, setFilterProductId] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [filterMachineId, setFilterMachineId] = useState("");

  // Modal Nova Movimentação
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [movementMode, setMovementMode] = useState<"PURCHASE" | "REFILL" | "LOSS" | "ADJUST">("PURCHASE");
  const [modalDataLoaded, setModalDataLoaded] = useState(false);
  const [loadingModalData, setLoadingModalData] = useState(false);

  // Campos do formulário
  const [selectedProductId, setSelectedProductId] = useState("");
  const [entryUnitType, setEntryUnitType] = useState<"UNITS" | "PACKS">("UNITS");
  const [inputQuantity, setInputQuantity] = useState("1");
  const [unitCostInput, setUnitCostInput] = useState("0,00");
  const [costInputMode, setCostInputMode] = useState<"PER_UNIT" | "PER_PACK">("PER_UNIT");
  const [expirationDate, setExpirationDate] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [lossReason, setLossReason] = useState<"LOSS_EXPIRED" | "LOSS_DAMAGE">("LOSS_EXPIRED");
  const [movementNotes, setMovementNotes] = useState("");

  // Integração Financeira
  const [createFinancial, setCreateFinancial] = useState(false);
  const [financialAccountId, setFinancialAccountId] = useState("");
  const [financialCategoryId, setFinancialCategoryId] = useState("");
  const [financialPaymentStatus, setFinancialPaymentStatus] = useState<"PAID" | "PENDING">("PAID");
  const [financialDate, setFinancialDate] = useState(formatDateToInput(new Date()));
  const [financialDueDate, setFinancialDueDate] = useState("");

  // Modal Nova Máquina Rápida
  const [isNewMachineModalOpen, setIsNewMachineModalOpen] = useState(false);
  const [newMachineName, setNewMachineName] = useState("");
  const [newMachineLocation, setNewMachineLocation] = useState("");

  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 1. Carregamento inicial ultrarrápido: apenas produtos (modo minimal) e máquinas para os filtros
  const loadInitialFilters = useCallback(async () => {
    try {
      const [prodRes, machRes] = await Promise.all([
        fetch("/api/products?status=ACTIVE&minimal=true"),
        fetch("/api/machines"),
      ]);

      if (prodRes.ok) {
        const p = await prodRes.json();
        setProducts(p.products || []);
      }
      if (machRes.ok) {
        const m = await machRes.json();
        const machList = m.machines || [];
        setMachines(machList);
        // Pré-seleciona a primeira máquina ou Máquina 01 para formulário
        if (machList.length > 0 && !selectedMachineId) {
          const defaultMach = machList.find((x: any) => x.name.toLowerCase().includes("01")) || machList[0];
          setSelectedMachineId(defaultMach.id);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar filtros de produtos e máquinas:", e);
    }
  }, [selectedMachineId]);

  // 2. Carregamento sob demanda (lazy): fornecedores, contas e categorias carregam somente quando o modal abrir
  const loadModalData = useCallback(async () => {
    if (modalDataLoaded || loadingModalData) return;
    try {
      setLoadingModalData(true);
      const [supRes, accRes, catRes] = await Promise.all([
        fetch("/api/suppliers?status=ACTIVE"),
        fetch("/api/accounts"),
        fetch("/api/categories"),
      ]);

      if (supRes.ok) {
        const s = await supRes.json();
        setSuppliers(s.suppliers || []);
      }
      if (accRes.ok) {
        const a = await accRes.json();
        const activeAccs = (a.accounts || []).filter((x: any) => x.active);
        setAccounts(activeAccs);
        if (activeAccs.length > 0 && !financialAccountId) {
          setFinancialAccountId(activeAccs[0].id);
        }
      }
      if (catRes.ok) {
        const c = await catRes.json();
        const expenseCategories: CategoryOption[] = [];
        (c.categories || []).forEach((cat: any) => {
          if (cat.kind === "EXPENSE") {
            expenseCategories.push({ id: cat.id, name: cat.name, kind: cat.kind });
            if (cat.subcategories) {
              cat.subcategories.forEach((sub: any) => {
                expenseCategories.push({ id: sub.id, name: `${cat.name} > ${sub.name}`, kind: sub.kind || "EXPENSE" });
              });
            }
          }
        });
        setCategories(expenseCategories);
        if (expenseCategories.length > 0 && !financialCategoryId) {
          const defaultCat = expenseCategories.find((cat) => cat.name.toLowerCase().includes("revenda") || cat.name.toLowerCase().includes("snack")) || expenseCategories[0];
          setFinancialCategoryId(defaultCat.id);
        }
      }
      setModalDataLoaded(true);
    } catch (e) {
      console.error("Erro ao carregar dados do modal:", e);
    } finally {
      setLoadingModalData(false);
    }
  }, [modalDataLoaded, loadingModalData, financialAccountId, financialCategoryId]);

  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterProductId) params.set("productId", filterProductId);
      if (filterReason) params.set("reason", filterReason);
      if (filterMachineId) params.set("machineId", filterMachineId);

      const res = await fetch(`/api/stock-movements?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao buscar histórico de movimentações");
      const data = await res.json();
      setMovements(data.movements || []);
      setExpiringBatches(data.expiringBatches || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterProductId, filterReason, filterMachineId]);

  // Carrega opções de filtro apenas uma vez na montagem
  useEffect(() => {
    loadInitialFilters();
  }, [loadInitialFilters]);

  // Carrega movimentações sempre que os filtros mudarem
  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Carrega dados do modal sob demanda apenas quando ele for aberto
  useEffect(() => {
    if (isModalOpen && !modalDataLoaded) {
      loadModalData();
    }
  }, [isModalOpen, modalDataLoaded, loadModalData]);

  // Produto selecionado no formulário
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Efeito ao trocar produto: atualiza fornecedor padrão e categoria financeira padrão
  useEffect(() => {
    if (selectedProduct) {
      if (selectedProduct.supplierId) {
        setSelectedSupplierId(selectedProduct.supplierId);
      }
      if (selectedProduct.costPrice > 0) {
        setUnitCostInput(selectedProduct.costPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
      if (selectedProduct.categoryId) {
        setFinancialCategoryId(selectedProduct.categoryId);
      }
    }
  }, [selectedProductId]);

  // Parsing e cálculos da modal
  const parseNumber = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Cálculo da quantidade final em unidades
  const rawQty = parseInt(inputQuantity, 10) || 0;
  const packSize = selectedProduct?.unitPerPack || 1;
  const effectiveUnits = entryUnitType === "PACKS" ? rawQty * packSize : rawQty;

  // Cálculo do custo unitário efetivo
  const rawCostVal = parseNumber(unitCostInput);
  const effectiveUnitCost =
    costInputMode === "PER_PACK" && packSize > 0
      ? Math.round((rawCostVal / packSize) * 100) / 100
      : rawCostVal;

  const totalExpenseValue = Math.round(effectiveUnits * effectiveUnitCost * 100) / 100;

  const handleOpenMovementModal = (mode: "PURCHASE" | "REFILL" | "LOSS" | "ADJUST") => {
    setMovementMode(mode);
    setModalError(null);
    setInputQuantity("1");
    setEntryUnitType("UNITS");
    setCostInputMode("PER_UNIT");
    setExpirationDate("");
    setMovementNotes("");
    setCreateFinancial(mode === "PURCHASE");
    setFinancialDate(formatDateToInput(new Date()));
    setFinancialDueDate("");
    setFinancialPaymentStatus("PAID");

    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
    setIsModalOpen(true);
  };

  const handleCreateFastMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachineName.trim()) return;

    try {
      const res = await fetch("/api/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newMachineName.trim(), location: newMachineLocation.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar máquina");

      // Adiciona na lista e seleciona
      setMachines((prev) => [...prev, data.machine]);
      setSelectedMachineId(data.machine.id);
      setIsNewMachineModalOpen(false);
      setNewMachineName("");
      setNewMachineLocation("");
    } catch (err: any) {
      alert(err.message || "Erro ao cadastrar máquina.");
    }
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!selectedProductId) {
      setModalError("Selecione um produto.");
      return;
    }

    if (effectiveUnits <= 0) {
      setModalError("A quantidade movimentada deve ser maior que zero.");
      return;
    }

    let type: "IN" | "OUT" | "ADJUST" = "IN";
    let reason: any = "PURCHASE";

    if (movementMode === "PURCHASE") {
      type = "IN";
      reason = "PURCHASE";
    } else if (movementMode === "REFILL") {
      type = "OUT";
      reason = "MACHINE_REFILL";
      if (!selectedMachineId) {
        setModalError("Selecione a máquina de destino do abastecimento.");
        return;
      }
      if (selectedProduct && selectedProduct.currentStock < effectiveUnits) {
        const uSym = getUnitSymbol(selectedProduct.unit);
        setModalError(
          `Saldo insuficiente no depósito! Saldo disponível: ${selectedProduct.currentStock} ${uSym}, Quantidade solicitada: ${effectiveUnits} ${uSym}.`
        );
        return;
      }
    } else if (movementMode === "LOSS") {
      type = "OUT";
      reason = lossReason;
      if (selectedProduct && selectedProduct.currentStock < effectiveUnits) {
        const uSym = getUnitSymbol(selectedProduct.unit);
        setModalError(
          `Saldo insuficiente para baixa de perda! Saldo disponível: ${selectedProduct.currentStock} ${uSym}.`
        );
        return;
      }
    } else if (movementMode === "ADJUST") {
      type = "ADJUST";
      reason = "INVENTORY_ADJUSTMENT";
    }

    if (createFinancial && movementMode === "PURCHASE") {
      if (effectiveUnitCost <= 0) {
        setModalError("Para gerar lançamento financeiro, o custo unitário deve ser maior que zero.");
        return;
      }
      if (!financialAccountId) {
        setModalError("Selecione a conta bancária/caixa para debitar a despesa.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        productId: selectedProductId,
        type,
        reason,
        quantity: effectiveUnits,
        unitCost: movementMode === "PURCHASE" ? effectiveUnitCost : null,
        expirationDate: expirationDate || null,
        machineId: movementMode === "REFILL" ? selectedMachineId : null,
        supplierId: movementMode === "PURCHASE" ? selectedSupplierId || null : null,
        notes: movementNotes.trim() || null,
        createFinancialTransaction: movementMode === "PURCHASE" ? createFinancial : false,
        accountId: createFinancial ? financialAccountId : null,
        categoryId: createFinancial ? financialCategoryId : null,
        paymentStatus: financialPaymentStatus,
        paymentDate: financialDate || null,
        dueDate: financialDueDate || null,
      };

      const res = await fetch("/api/stock-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao registrar movimentação.");
      }

      setIsModalOpen(false);
      // Atualiza movimentações e lista de produtos para refletir novo saldo
      fetchMovements();
      loadInitialFilters();
    } catch (err: any) {
      setModalError(err.message || "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  // Itens abaixo do estoque mínimo
  const lowStockProducts = products.filter((p) => p.currentStock <= p.minStock);

  const canOperate = currentUser?.role !== "VIEWER";

  return (
    <>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header Superior */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Boxes className="w-7 h-7 text-amber-500" />
              Controle de Estoque & Depósito
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerencie as entradas de atacadistas, abastecimento de máquinas e rastreamento de lotes (Kardex).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/produtos"
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Package className="w-4 h-4 text-orange-500" />
              <span>Ver Catálogo</span>
            </Link>

            {canOperate && (
              <>
                <button
                  onClick={() => handleOpenMovementModal("PURCHASE")}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>+ Entrada (Compra)</span>
                </button>

                <button
                  onClick={() => handleOpenMovementModal("REFILL")}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <TrendingDown className="w-4 h-4" />
                  <span>- Abastecer Máquina</span>
                </button>

                <button
                  onClick={() => handleOpenMovementModal("LOSS")}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Baixa / Perda</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Abas Superiores de Navegação Rápida */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab("kardex")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "kardex"
                ? "border-amber-500 text-amber-700 bg-amber-50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Histórico de Movimentações (Kardex)</span>
            <span className="bg-slate-100 text-slate-600 border border-slate-200 text-xs px-2 py-0.5 rounded-full font-mono">
              {movements.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("low_stock")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "low_stock"
                ? "border-rose-500 text-rose-700 bg-rose-50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>Abaixo do Estoque Mínimo</span>
            {lowStockProducts.length > 0 && (
              <span className="bg-rose-100 text-rose-700 border border-rose-200 text-xs px-2 py-0.5 rounded-full font-bold">
                {lowStockProducts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("expiring")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "expiring"
                ? "border-orange-500 text-orange-700 bg-orange-50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock className="w-4 h-4 text-orange-500" />
            <span>Lotes Próximos ao Vencimento</span>
            {expiringBatches.length > 0 && (
              <span className="bg-orange-100 text-orange-700 border border-orange-200 text-xs px-2 py-0.5 rounded-full font-mono font-bold">
                {expiringBatches.length}
              </span>
            )}
          </button>
        </div>

        {/* Conteúdo da Aba 1: KARDEX */}
        {activeTab === "kardex" && (
          <div className="space-y-4">
            {/* Barra de Filtros */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filtros:
              </span>

              {/* Produto */}
              <select
                value={filterProductId}
                onChange={(e) => setFilterProductId(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">Todos os Produtos</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>

              {/* Motivo */}
              <select
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">Todos os Motivos</option>
                <option value="PURCHASE">Compras (Entradas)</option>
                <option value="MACHINE_REFILL">Abastecimento de Máquina</option>
                <option value="LOSS_EXPIRED">Perda por Vencimento</option>
                <option value="LOSS_DAMAGE">Perda por Avaria</option>
                <option value="INVENTORY_ADJUSTMENT">Ajustes Manuais</option>
              </select>

              {/* Máquina */}
              <select
                value={filterMachineId}
                onChange={(e) => setFilterMachineId(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">Todas as Máquinas</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tabela Kardex */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  <div className="inline-block animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mb-2"></div>
                  <p className="text-sm">Carregando movimentações de estoque...</p>
                </div>
              ) : movements.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Boxes className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-semibold text-slate-700">Nenhuma movimentação registrada</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Utilize os botões acima para registrar entradas de compras ou abastecimento de máquinas.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 border-b border-slate-200 font-bold tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Data / Hora</th>
                        <th className="py-3 px-4">Produto</th>
                        <th className="py-3 px-4 text-center">Tipo / Operação</th>
                        <th className="py-3 px-4 text-right">Quantidade</th>
                        <th className="py-3 px-4 text-center">Saldo Físico</th>
                        <th className="py-3 px-4">Destino / Detalhes</th>
                        <th className="py-3 px-4 text-center">Vínculo Financeiro</th>
                        <th className="py-3 px-4 text-right">Usuário</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {movements.map((m) => {
                        const isEntry = m.type === "IN";
                        const isAdjustment = m.type === "ADJUST";

                        const getReasonBadge = (reason: string) => {
                          switch (reason) {
                            case "PURCHASE":
                              return (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] px-2 py-0.5 rounded-full font-bold">
                                  Compra Atacado
                                </span>
                              );
                            case "MACHINE_REFILL":
                              return (
                                <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] px-2 py-0.5 rounded-full font-bold">
                                  Abastecimento
                                </span>
                              );
                            case "LOSS_EXPIRED":
                              return (
                                <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[11px] px-2 py-0.5 rounded-full font-bold">
                                  Vencido
                                </span>
                              );
                            case "LOSS_DAMAGE":
                              return (
                                <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[11px] px-2 py-0.5 rounded-full font-bold">
                                  Avaria / Perda
                                </span>
                              );
                            case "INVENTORY_ADJUSTMENT":
                              return (
                                <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[11px] px-2 py-0.5 rounded-full font-bold">
                                  Ajuste Contagem
                                </span>
                              );
                            default:
                              return <span>{reason}</span>;
                          }
                        };

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                            {/* Data / Hora */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                              <div className="font-semibold text-slate-800">
                                {formatDateToBR(m.createdAt)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </td>

                            {/* Produto */}
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 leading-tight">
                                {m.product?.name || "Produto excluído"}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">
                                SKU: {m.product?.sku || "—"}
                              </div>
                            </td>

                            {/* Tipo / Operação */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {getReasonBadge(m.reason)}
                            </td>

                            {/* Quantidade */}
                            <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                              <span
                                className={`text-sm ${
                                  isEntry
                                    ? "text-emerald-600"
                                    : isAdjustment
                                    ? "text-purple-600"
                                    : "text-rose-600"
                                }`}
                              >
                                {isEntry ? `+${m.quantity}` : isAdjustment ? `=${m.quantity}` : `-${m.quantity}`} {getUnitSymbol(m.product?.unit)}
                              </span>
                              {m.unitCost && m.unitCost > 0 && (
                                <div className="text-[10px] text-slate-500 font-normal">
                                  Custo: {formatCentsToBRL(Math.round(m.unitCost * 100))}
                                </div>
                              )}
                            </td>

                            {/* Saldo Físico Anterior -> Final */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono text-xs">
                              <span className="text-slate-500">{m.previousStock}</span>
                              <span className="text-slate-400 mx-1.5">→</span>
                              <strong className="text-slate-900 text-sm">{m.newStock}</strong> {getUnitSymbol(m.product?.unit)}
                            </td>

                            {/* Destino / Detalhes */}
                            <td className="py-3.5 px-4 text-xs">
                              {m.machine && (
                                <div className="text-blue-700 font-medium flex items-center gap-1">
                                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{m.machine.name}</span>
                                </div>
                              )}
                              {m.supplier && (
                                <div className="text-slate-700 flex items-center gap-1">
                                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{m.supplier.name}</span>
                                </div>
                              )}
                              {m.expirationDate && (
                                <div className="text-[11px] text-amber-700 flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3 text-amber-500" />
                                  <span>Val: {formatDateToBR(m.expirationDate)}</span>
                                </div>
                              )}
                              {m.notes && (
                                <div className="text-[11px] text-slate-500 italic mt-0.5">
                                  "{m.notes}"
                                </div>
                              )}
                            </td>

                            {/* Vínculo Financeiro */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {m.transaction ? (
                                <Link
                                  href={`/lancamentos?search=${encodeURIComponent(m.product?.name || "")}`}
                                  className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] px-2 py-1 rounded-lg transition-colors font-semibold"
                                  title="Ver lançamento no financeiro"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>{formatCentsToBRL(m.transaction.amountCents)}</span>
                                </Link>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>

                            {/* Usuário */}
                            <td className="py-3.5 px-4 text-right text-xs text-slate-500 whitespace-nowrap">
                              {m.user?.name || "Sistema"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo da Aba 2: ABAIXO DO MÍNIMO */}
        {activeTab === "low_stock" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  Lista de Compras Recomendada (Itens com Saldo Crítico)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Itens cujo saldo no depósito está menor ou igual ao estoque mínimo configurado.
                </p>
              </div>
              <span className="text-xs font-mono bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-xl font-bold">
                {lowStockProducts.length} itens precisam de reposição
              </span>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
                <p className="font-semibold text-slate-800">Estoque 100% abastecido!</p>
                <p className="text-xs text-slate-500">Nenhum produto está abaixo do limite de segurança no momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStockProducts.map((p) => {
                  const shortage = Math.max(0, p.minStock - p.currentStock);
                  const suggestedPacks = Math.ceil(shortage / (p.unitPerPack || 1));

                  return (
                    <div
                      key={p.id}
                      className="bg-rose-50/30 border border-rose-200 rounded-2xl p-4 flex flex-col justify-between hover:border-rose-300 transition-colors"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                          <span className="font-mono text-[11px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                            {p.sku}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                          <div className="bg-white border border-rose-100 p-2 rounded-xl">
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Saldo Atual</span>
                            <span className="font-mono font-bold text-rose-600 text-base">{p.currentStock} {getUnitSymbol(p.unit)}</span>
                          </div>
                          <div className="bg-white border border-slate-200 p-2 rounded-xl">
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Estoque Mínimo</span>
                            <span className="font-mono font-bold text-slate-800 text-base">{p.minStock} {getUnitSymbol(p.unit)}</span>
                          </div>
                        </div>

                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                          💡 <strong>Sugestão de compra:</strong> Pelo menos <strong>{shortage} {getUnitSymbol(p.unit)}</strong>.
                        </div>
                      </div>

                      {canOperate && (
                        <div className="pt-3 mt-3 border-t border-rose-200/60 flex justify-end">
                          <button
                            onClick={() => {
                              setSelectedProductId(p.id);
                              handleOpenMovementModal("PURCHASE");
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Registrar Compra</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Conteúdo da Aba 3: LOTES PRÓXIMOS AO VENCIMENTO */}
        {activeTab === "expiring" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  Rastreamento de Lotes (FEFO - First Expired, First Out)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lotes que vencem nos próximos 30 dias para priorizar no abastecimento das máquinas.
                </p>
              </div>
            </div>

            {expiringBatches.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <ShieldCheck className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
                <p className="font-semibold text-slate-800">Nenhum lote crítico vencendo nos próximos 30 dias!</p>
                <p className="text-xs text-slate-500">Seus produtos estão com validade adequada no depósito.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {expiringBatches.map((b) => {
                  const exp = new Date(b.expirationDate);
                  const today = new Date();
                  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  const isExpired = diffDays < 0;

                  return (
                    <div
                      key={b.id}
                      className={`border rounded-2xl p-4 flex flex-col justify-between ${
                        isExpired
                          ? "border-rose-300 bg-rose-50/50"
                          : "border-amber-300 bg-amber-50/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <h4 className="font-bold text-slate-900 text-sm">{b.product?.name}</h4>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono ${
                              isExpired
                                ? "bg-rose-100 text-rose-700 border border-rose-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {isExpired ? "Vencido" : `${diffDays} dias`}
                          </span>
                        </div>

                        <div className="my-3 space-y-1 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>Lote entrou em:</span>
                            <span className="font-mono text-slate-800 font-medium">{formatDateToBR(b.createdAt)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Data de Validade:</span>
                            <span className="font-mono font-bold text-amber-800">
                              {formatDateToBR(b.expirationDate)}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Quantidade do lote:</span>
                            <span className="font-mono text-slate-900 font-bold">{b.quantity} un</span>
                          </div>
                        </div>
                      </div>

                      {canOperate && (
                        <div className="pt-3 mt-3 border-t border-slate-200 flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedProductId(b.productId);
                              handleOpenMovementModal("REFILL");
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <TrendingDown className="w-3.5 h-3.5" />
                            <span>Abastecer Máquina</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal de Movimentação de Estoque */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <Boxes className="w-5 h-5 text-amber-500" />
                  <h2 className="text-lg font-bold text-slate-800">Nova Movimentação de Estoque</h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Seletor de Tipo de Movimentação em Destaque */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementMode("PURCHASE")}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    movementMode === "PURCHASE"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-500"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Entrada (Compra)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementMode("REFILL")}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    movementMode === "REFILL"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-500"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  <span>Abastecer Máquina</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementMode("LOSS")}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    movementMode === "LOSS"
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-1 ring-rose-500"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Perda / Avaria</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementMode("ADJUST")}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    movementMode === "ADJUST"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-500"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Ajuste Inventário</span>
                </button>
              </div>

              {/* Formulário Principal */}
              <form onSubmit={handleMovementSubmit} className="p-6 space-y-4">
                {modalError && (
                  <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* Seleção do Produto */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Produto *
                  </label>
                  <select
                    required
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="">Selecione o produto...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (SKU: {p.sku}) — Saldo Atual: {p.currentStock} {getUnitSymbol(p.unit)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bloco de Quantidade com Alternância Unidades vs Fardo */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Quantidade a Movimentar *
                    </label>

                    {movementMode === "PURCHASE" && (
                      <div className="flex bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                        <button
                          type="button"
                          onClick={() => setEntryUnitType("UNITS")}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                            entryUnitType === "UNITS"
                              ? "bg-amber-500 text-white shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Unidades Base
                        </button>
                        <button
                          type="button"
                          onClick={() => setEntryUnitType("PACKS")}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                            entryUnitType === "PACKS"
                              ? "bg-amber-500 text-white shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Fardos / Caixas ({packSize} un/cx)
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      required
                      value={inputQuantity}
                      onChange={(e) => setInputQuantity(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-base font-bold font-mono text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <div className="bg-white px-4 py-2.5 border border-slate-300 rounded-xl text-center whitespace-nowrap shadow-sm">
                      <span className="text-[11px] text-slate-500 block uppercase font-bold">Total Físico</span>
                      <strong className="text-amber-600 font-mono text-sm">{effectiveUnits} unidades</strong>
                    </div>
                  </div>
                </div>

                {/* CONDICIONAL: SE FOR ENTRADA DE COMPRA */}
                {movementMode === "PURCHASE" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Preço de Custo */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Custo Pago (R$) *
                          </label>
                          <div className="flex gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setCostInputMode("PER_UNIT")}
                              className={`px-1.5 py-0.5 rounded cursor-pointer ${costInputMode === "PER_UNIT" ? "bg-amber-100 text-amber-800 font-bold border border-amber-200" : "text-slate-500 hover:text-slate-700"}`}
                            >
                              Por Unidade
                            </button>
                            <button
                              type="button"
                              onClick={() => setCostInputMode("PER_PACK")}
                              className={`px-1.5 py-0.5 rounded cursor-pointer ${costInputMode === "PER_PACK" ? "bg-amber-100 text-amber-800 font-bold border border-amber-200" : "text-slate-500 hover:text-slate-700"}`}
                            >
                              Por Fardo ({packSize} un)
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={unitCostInput}
                          onChange={(e) => setUnitCostInput(e.target.value)}
                          placeholder="0,00"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Custo unitário calculado: <strong className="text-slate-800">{formatCentsToBRL(Math.round(effectiveUnitCost * 100))}</strong>
                        </span>
                      </div>

                      {/* Fornecedor */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                          Fornecedor da Compra
                        </label>
                        <select
                          value={selectedSupplierId}
                          onChange={(e) => setSelectedSupplierId(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                          <option value="">Selecione o fornecedor...</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Validade do Lote */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                          Data de Validade do Lote (FEFO)
                        </label>
                        <input
                          type="date"
                          value={expirationDate}
                          onChange={(e) => setExpirationDate(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* SEÇÃO DE INTEGRAÇÃO FINANCEIRA OPCIONAL */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createFinancial}
                            onChange={(e) => setCreateFinancial(e.target.checked)}
                            className="w-4 h-4 rounded text-amber-500 border-slate-300 focus:ring-amber-500"
                          />
                          <span className="text-sm font-bold text-slate-800">
                            Lançar despesa automaticamente no Financeiro
                          </span>
                        </label>
                        <span className="text-xs font-mono font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                          Total: {formatCentsToBRL(Math.round(totalExpenseValue * 100))}
                        </span>
                      </div>

                      {createFinancial && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                          {/* Conta Bancária */}
                          <div>
                            <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                              Conta de Pagamento *
                            </label>
                            <select
                              value={financialAccountId}
                              onChange={(e) => setFinancialAccountId(e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            >
                              {accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name} ({a.type})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Categoria Financeira */}
                          <div>
                            <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                              Categoria Financeira *
                            </label>
                            <select
                              value={financialCategoryId}
                              onChange={(e) => setFinancialCategoryId(e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            >
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Status */}
                          <div>
                            <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                              Status do Lançamento
                            </label>
                            <select
                              value={financialPaymentStatus}
                              onChange={(e) => setFinancialPaymentStatus(e.target.value as any)}
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            >
                              <option value="PAID">Pago (Debitar saldo hoje)</option>
                              <option value="PENDING">A Pagar (Pendente / Boleto)</option>
                            </select>
                          </div>

                          {/* Data de Vencimento (se Pendente) ou Pagamento */}
                          <div>
                            <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                              {financialPaymentStatus === "PAID" ? "Data do Pagamento" : "Data de Vencimento"}
                            </label>
                            <input
                              type="date"
                              value={financialPaymentStatus === "PAID" ? financialDate : financialDueDate}
                              onChange={(e) =>
                                financialPaymentStatus === "PAID"
                                  ? setFinancialDate(e.target.value)
                                  : setFinancialDueDate(e.target.value)
                              }
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CONDICIONAL: SE FOR ABASTECIMENTO DE MÁQUINA */}
                {movementMode === "REFILL" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Máquina de Destino *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsNewMachineModalOpen(true)}
                        className="text-xs text-amber-600 hover:text-amber-700 font-semibold cursor-pointer"
                      >
                        + Cadastrar Nova Máquina
                      </button>
                    </div>

                    <select
                      required
                      value={selectedMachineId}
                      onChange={(e) => setSelectedMachineId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    >
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.location ? `(${m.location})` : ""}
                        </option>
                      ))}
                    </select>

                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-700">
                      ℹ️ Essa operação retirará <strong>{effectiveUnits} unidades</strong> do Depósito Central e registrará a transferência para o estoque da máquina.
                    </div>
                  </div>
                )}

                {/* CONDICIONAL: SE FOR PERDA / AVARIA */}
                {movementMode === "LOSS" && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Motivo da Baixa / Perda *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setLossReason("LOSS_EXPIRED")}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          lossReason === "LOSS_EXPIRED"
                            ? "bg-rose-600 text-white border-rose-500 shadow-md"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        Produto Vencido
                      </button>
                      <button
                        type="button"
                        onClick={() => setLossReason("LOSS_DAMAGE")}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          lossReason === "LOSS_DAMAGE"
                            ? "bg-rose-600 text-white border-rose-500 shadow-md"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        Avaria / Danificado
                      </button>
                    </div>
                  </div>
                )}

                {/* CONDICIONAL: SE FOR AJUSTE DE INVENTÁRIO */}
                {movementMode === "ADJUST" && (
                  <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-xs text-purple-700">
                    ℹ️ <strong>Ajuste de Inventário:</strong> Digite a quantidade física contada na contagem real. O sistema ajustará o saldo final do produto exatamente para este valor.
                  </div>
                )}

                {/* Observações */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Observações / Justificativa (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={movementNotes}
                    onChange={(e) => setMovementNotes(e.target.value)}
                    placeholder="Número da nota fiscal, motivo do ajuste, etc..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
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
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-bold shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {submitting && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                    <span>Confirmar Movimentação</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Rápida: Nova Máquina */}
        {isNewMachineModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                Cadastrar Nova Máquina
              </h3>
              <form onSubmit={handleCreateFastMachine} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Nome da Máquina *
                  </label>
                  <input
                    type="text"
                    required
                    value={newMachineName}
                    onChange={(e) => setNewMachineName(e.target.value)}
                    placeholder="Ex: Máquina 02 - Academia Smart"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Localização / Endereço (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newMachineLocation}
                    onChange={(e) => setNewMachineLocation(e.target.value)}
                    placeholder="Ex: Hall de entrada, Bloco B"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewMachineModalOpen(false)}
                    className="px-3.5 py-2 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-xl border border-slate-300 cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    Salvar Máquina
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

