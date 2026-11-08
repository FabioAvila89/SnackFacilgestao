"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
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
  PlusCircle,
  Users,
  UserCircle,
  Package,
  Boxes,
} from "lucide-react";

interface SidebarProps {
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

export function Sidebar({ onOpenNewTransaction }: SidebarProps) {
  const pathname = usePathname();
  const { user: currentUser, loading, logout: handleLogout } = useAuth();

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

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "ADMIN":
        return <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] px-1.5 py-0.2 rounded font-semibold">Admin</span>;
      case "EDITOR":
        return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] px-1.5 py-0.2 rounded font-semibold">Operador</span>;
      case "VIEWER":
        return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0.2 rounded font-semibold">Consulta</span>;
      default:
        return null;
    }
  };

  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-slate-200 min-h-screen fixed inset-y-0 left-0 z-30">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/80">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center font-black text-white text-lg shadow-md shadow-orange-500/20">
          SF
        </div>
        <div>
          <h1 className="font-bold text-white leading-tight">Snack Fácil</h1>
          <p className="text-xs text-orange-400 font-medium">Controle Financeiro & Estoque</p>
        </div>
      </div>

      {/* Botão Atalho Novo Lançamento (visível para quem pode criar) */}
      {currentUser?.role !== "VIEWER" && (
        <div className="px-4 pt-5 pb-2">
          <button
            onClick={onOpenNewTransaction}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 transition-all cursor-pointer active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      )}

      {/* Navegação Principal Agrupada por Seções */}
      <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
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
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-all ${
                    isActive
                      ? "bg-orange-500/15 text-orange-400 border border-orange-500/30 font-semibold"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-orange-400" : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-xs overflow-hidden">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-slate-400 text-[11px]">Usuário ativo</span>
              {getRoleBadge(currentUser?.role)}
            </div>
            <Link
              href={currentUser ? "/minha-conta" : "/login"}
              className="font-semibold text-slate-200 truncate block hover:text-orange-400 transition-colors"
              title="Acessar Minha Conta"
            >
              {loading ? "Carregando..." : (currentUser?.name || "Entrar")}
            </Link>
          </div>
          <button
            onClick={handleLogout}
            title="Sair do sistema"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[10px] text-slate-500 text-center font-mono">
          Operação: Multiusuário • V2.0
        </div>
      </div>
    </aside>
  );
}
