"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Armazenamento em memória no nível de módulo (persiste enquanto a aba do navegador estiver aberta)
const memoryCache = new Map<string, CacheEntry<any>>();

// Deduplicação de requisições concorrentes em voo para a mesma URL
const inFlightRequests = new Map<string, Promise<any>>();

// Listeners registrados para invalidação seletiva de componentes ativos
type CacheListener = (invalidatedKey?: string) => void;
const cacheListeners = new Set<CacheListener>();

/**
 * Obtém dados do cache em memória se existirem e estiverem dentro do TTL
 */
export function getCachedData<T = any>(key: string, ttlMs = 5 * 60 * 1000): T | undefined {
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > ttlMs) {
    memoryCache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

/**
 * Define ou atualiza dados no cache em memória
 */
export function setCachedData<T = any>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Invalida entradas de cache que correspondam a um predicado, string ou padrão.
 * Se nenhum argumento for passado, limpa todo o cache.
 */
export function invalidateCache(filter?: string | RegExp | ((key: string) => boolean)): void {
  if (!filter) {
    memoryCache.clear();
  } else if (typeof filter === "string") {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.includes(filter)) {
        memoryCache.delete(key);
      }
    }
  } else if (filter instanceof RegExp) {
    for (const key of Array.from(memoryCache.keys())) {
      if (filter.test(key)) {
        memoryCache.delete(key);
      }
    }
  } else if (typeof filter === "function") {
    for (const key of Array.from(memoryCache.keys())) {
      if (filter(key)) {
        memoryCache.delete(key);
      }
    }
  }

  // Notifica componentes inscritos sobre a invalidação
  const filterDesc = typeof filter === "string" ? filter : undefined;
  cacheListeners.forEach((listener) => {
    try {
      listener(filterDesc);
    } catch (e) {
      console.error("Erro no listener de cache:", e);
    }
  });
}

// Invalidação global automática por eventos de negócio
if (typeof window !== "undefined") {
  window.addEventListener("snack:transaction-updated", () => {
    // Invalida relatórios, lançamentos e contas quando transações são alteradas
    invalidateCache((key) =>
      key.includes("/api/reports") ||
      key.includes("/api/transactions") ||
      key.includes("/api/accounts")
    );
  });

  window.addEventListener("snack:stock-updated", () => {
    // Invalida movimentações de estoque e catálogo de produtos
    invalidateCache((key) =>
      key.includes("/api/stock-movements") ||
      key.includes("/api/products")
    );
  });
}

/**
 * Função utilitária para requisições deduplicadas com cache
 */
export async function fetchWithDedupe<T = any>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method ? init.method.toUpperCase() : "GET";
  if (method !== "GET") {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  }

  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url) as Promise<T>;
  }

  const promise = (async () => {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setCachedData(url, data);
      return data;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, promise);
  return promise;
}

export interface UseCachedFetchOptions<T> {
  ttlMs?: number;
  initialData?: T;
  revalidateOnMount?: boolean;
}

export interface UseCachedFetchResult<T> {
  data: T | null;
  loading: boolean;
  isValidating: boolean;
  error: Error | null;
  refetch: (forceLoading?: boolean) => Promise<T | null>;
  mutate: (newData: T | ((curr: T | null) => T), shouldRevalidate?: boolean) => void;
}

/**
 * Hook de Stale-While-Revalidate em memória.
 * - Se os dados já existirem em cache, retorna imediatamente (loading = false em 0ms).
 * - Realiza busca de atualização em background sem flicker.
 * - Invalida e revalida automaticamente sob mutações e eventos globais.
 */
export function useCachedFetch<T = any>(
  url: string | null,
  options: UseCachedFetchOptions<T> = {}
): UseCachedFetchResult<T> {
  const { ttlMs = 5 * 60 * 1000, initialData = null, revalidateOnMount = true } = options;

  const cached = url ? getCachedData<T>(url, ttlMs) : undefined;

  const [data, setData] = useState<T | null>(() => {
    if (cached !== undefined) return cached;
    return initialData;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (!url) return false;
    return cached === undefined && initialData === null;
  });

  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const urlRef = useRef(url);
  urlRef.current = url;

  const executeFetch = useCallback(
    async (targetUrl: string, showLoadingState: boolean): Promise<T | null> => {
      if (showLoadingState) {
        setLoading(true);
      }
      setIsValidating(true);
      setError(null);

      try {
        const result = await fetchWithDedupe<T>(targetUrl);
        if (urlRef.current === targetUrl) {
          setData(result);
          setError(null);
        }
        return result;
      } catch (err: any) {
        if (urlRef.current === targetUrl) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
        return null;
      } finally {
        if (urlRef.current === targetUrl) {
          setLoading(false);
          setIsValidating(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!url) {
      setLoading(false);
      setIsValidating(false);
      return;
    }

    const currentCached = getCachedData<T>(url, ttlMs);
    if (currentCached !== undefined) {
      setData(currentCached);
      setLoading(false);
      if (revalidateOnMount) {
        executeFetch(url, false);
      }
    } else {
      executeFetch(url, true);
    }
  }, [url, ttlMs, revalidateOnMount, executeFetch]);

  // Listener para invalidação externa
  useEffect(() => {
    const handleInvalidation = (filter?: string) => {
      if (!url) return;
      if (!filter || url.includes(filter)) {
        // Se a chave atual foi invalidada, revalida em background
        executeFetch(url, false);
      }
    };

    cacheListeners.add(handleInvalidation);
    return () => {
      cacheListeners.delete(handleInvalidation);
    };
  }, [url, executeFetch]);

  const refetch = useCallback(
    async (forceLoading = false): Promise<T | null> => {
      if (!url) return null;
      return executeFetch(url, forceLoading);
    },
    [url, executeFetch]
  );

  const mutate = useCallback(
    (newData: T | ((curr: T | null) => T), shouldRevalidate = false) => {
      setData((prev) => {
        const resolved = typeof newData === "function" ? (newData as any)(prev) : newData;
        if (url) {
          setCachedData(url, resolved);
        }
        return resolved;
      });

      if (shouldRevalidate && url) {
        executeFetch(url, false);
      }
    },
    [url, executeFetch]
  );

  return {
    data,
    loading,
    isValidating,
    error,
    refetch,
    mutate,
  };
}

