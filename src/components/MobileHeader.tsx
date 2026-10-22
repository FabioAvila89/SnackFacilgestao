"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  FileUp,
  LogOut,
  Plus,
  Users,
  UserCircle,
} from "lucide-react";

interface MobileHeaderProps {
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

export function MobileHeader({ onOpenNewTransaction }: MobileHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do usuário no header mobile:", err);
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

  if (currentUser?.role === "ADMIN") {
    navItems.push({
      href: "/gestao-acesso",
      label: "Gestão de Acesso",
      icon: Users,
    });
  }

  navItems.push({
    href: "/minha-conta",
    label: "Minha Conta",
    icon: UserCircle,
  });

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
                    {currentUser?.name || "Controle Financeiro"}
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

            <nav className="flex-1 py-4 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${
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
