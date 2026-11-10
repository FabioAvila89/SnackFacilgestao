"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Menu,
  X,
  LayoutDashboard,
  Receipt,
  ArrowUpDown,
  PieChart,
  FileSpreadsheet,
  Landmark,
  Tags,
  Truck,
  FileUp,
  LogOut,
  Plus,
  Users,
  UserCircle,
  Package,
  Boxes,
} from "lucide-react";

interface MobileHeaderProps {
  onOpenNewTransaction: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function MobileHeader({ onOpenNewTransaction }: MobileHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user: currentUser, loading, logout: handleLogout } = useAuth();
  const pathname = usePathname();

  const navSections: NavSection[] = [
    {
      title: "Operação",
      items: [
        { href: "/", label: "Início (Dashboard)", icon: LayoutDashboard },
        { href: "/lancamentos", label: "Lançamentos", icon: Receipt },
        { href: "/produtos", label: "Produtos", icon: Package },
        { href: "/estoque", label: "Estoque", icon: Boxes },
      ],
    },
    {
      title: "Relatórios & DRE",
      items: [
        { href: "/relatorios/fluxo", label: "Entradas × Saídas", icon: ArrowUpDown },
        { href: "/relatorios/categorias", label: "Gastos por Categoria", icon: PieChart },
        { href: "/relatorios/dre", label: "DRE", icon: FileSpreadsheet },
      ],
    },
    {
      title: "Cadastros",
      items: [
        { href: "/contas", label: "Contas", icon: Landmark },
        { href: "/fornecedores", label: "Fornecedores", icon: Truck },
        { href: "/categorias", label: "Categorias", icon: Tags },
      ],
    },
    {
      title: "Sistema",
      items: [
        { href: "/importar-exportar", label: "Importar / Exportar", icon: FileUp },
        ...(currentUser?.role === "ADMIN"
          ? [{ href: "/gestao-acesso", label: "Gestão de Acesso", icon: Users }]
          : []),
        { href: "/minha-conta", label: "Minha Conta", icon: UserCircle },
      ],
    },
  ];

  return (
    <>
      <header className="md:hidden sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
            aria-label="Abrir menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center font-bold text-white text-sm">
              SF
            </div>
            <span className="font-bold text-white text-base">Snack Fácil</span>
          </div>
        </div>

        {/* Botão rápido + Novo no topo do celular (apenas para quem tem permissão) */}
        {currentUser?.role !== "VIEWER" && (
          <button
            onClick={onOpenNewTransaction}
            className="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>Lançamento</span>
          </button>
        )}
      </header>

      {/* Drawer Mobile */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-slate-900 flex flex-col h-full border-r border-slate-800 p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center font-bold text-white text-sm">
                  SF
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Snack Fácil</div>
                  <div className="text-[11px] text-orange-400">
                    {loading ? "Carregando..." : (currentUser?.name || "Controle Financeiro")}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 py-3 space-y-4 overflow-y-auto">
              {navSections.map((section) => (
                <div key={section.title} className="space-y-1">
                  <div className="px-3 pt-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    {section.title}
                  </div>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm ${
                          isActive
                            ? "bg-orange-500 text-white font-semibold"
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-rose-400 hover:bg-rose-500/10 rounded-xl text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair do Sistema</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
