"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { MobileHeader } from "./MobileHeader";
import { TransactionModal } from "./TransactionModal";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTransactionSuccess = () => {
    // Força recarregamento suave dos dados nos componentes filhos
    setRefreshKey((k) => k + 1);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("snack:transaction-updated"));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar para desktop */}
      <Sidebar onOpenNewTransaction={() => setIsModalOpen(true)} />

      {/* Conteúdo Principal */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        {/* Topbar para celular */}
        <MobileHeader onOpenNewTransaction={() => setIsModalOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Modal global de novo lançamento */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleTransactionSuccess}
      />
    </div>
  );
}
