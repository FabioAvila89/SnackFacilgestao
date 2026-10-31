"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR" | "VIEWER";
  active?: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  logout: async () => {},
});

// Cache e promessa de deduplicação no escopo do módulo cliente
let cachedUser: UserInfo | null = null;
let userFetchPromise: Promise<UserInfo | null> | null = null;

export function invalidateClientUser() {
  cachedUser = null;
  userFetchPromise = null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(cachedUser);
  const [loading, setLoading] = useState<boolean>(cachedUser === null);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    // Deduplica chamadas concorrentes para /api/auth/me
    if (!userFetchPromise) {
      userFetchPromise = (async () => {
        try {
          const res = await fetch("/api/auth/me");
          if (res.ok) {
            const data = await res.json();
            cachedUser = data.user;
            return data.user as UserInfo;
          } else {
            cachedUser = null;
            return null;
          }
        } catch (err) {
          console.error("Erro ao carregar usuário autenticado:", err);
          cachedUser = null;
          return null;
        } finally {
          userFetchPromise = null;
        }
      })();
    }

    try {
      const u = await userFetchPromise;
      setUser(u);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Se ainda não temos o usuário em cache, busca imediatamente
    if (!cachedUser) {
      fetchUser();
    } else {
      // Revalida em background sem travar a interface
      fetchUser();
    }
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      invalidateClientUser();
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Erro ao realizar logout:", err);
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser: fetchUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
