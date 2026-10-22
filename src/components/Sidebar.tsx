"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  ArrowUpDown,
  PieChart,
  FileSpreadsheet,
  Landmark,
  Tags,
  FileUp,
  LogOut,
  PlusCircle,
  Users,
  UserCircle,
} from "lucide-react";

interface SidebarProps {
  onOpenNewTransaction: () => void;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR" | "VIEWER";
}

const baseNavItems = [
  { href: "/", label: "Início (Dashboard)", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançamentos", icon: Receipt },
  { href: "/relatorios/fluxo", label: "Entradas × Saídas", icon: ArrowUpDown },
  { href: "/relatorios/categorias", label: "Gastos por Categoria", icon: PieChart },
  { href: "/relatorios/dre", label: "DRE", icon: FileSpreadsheet },
  { href: "/contas", label: "Contas", icon: Landmark },
  { href: "/categorias", label: "Categorias", icon: Tags },
  { href: "/importar-exportar", label: "Importar / Exportar", icon: FileUp },
];

export function Sidebar({ onOpenNewTransaction }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do usuário na sidebar:", err);
      }
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const navItems = [...baseNavItems];

  // Gestão de Acesso disponível exclusivamente para ADMIN
  if (currentUser?.role === "ADMIN") {
    navItems.push({
      href: "/gestao-acesso",
      label: "Gestão de Acesso",
      icon: Users,
    });
  }

  // Minha Conta disponível para todos os usuários logados
  navItems.push({
    href: "/minha-conta",
    label: "Minha Conta",
    icon: UserCircle,
  });

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
          <p className="text-xs text-orange-400 font-medium">Controle Financeiro</p>
        </div>
      </div>

      {/* Botão Atalho Novo Lançamento (visível para quem pode criar) */}
      {currentUser?.role !== "VIEWER" && (
        <div className="px-4 pt-5 pb-3">
          <button
            onClick={onOpenNewTransaction}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 transition-all cursor-pointer active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      )}

      {/* Navegação Principal */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all ${
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
              href="/minha-conta"
              className="font-semibold text-slate-200 truncate block hover:text-orange-400 transition-colors"
              title="Acessar Minha Conta"
            >
              {currentUser?.name || "Carregando..."}
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
