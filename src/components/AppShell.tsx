"use client";

import { usePathname } from "next/navigation";
import { AppLayout } from "./AppLayout";

const PUBLIC_PATHS = ["/login", "/trocar-senha-obrigatoria"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

  if (isPublic) {
    return <>{children}</>;
  }

  return <AppLayout>{children}</AppLayout>;
}

