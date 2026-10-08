"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Product } from "../types/api";

export function usePublicProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const current = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    try {
      const result = await api.catalog.products(undefined, controller.signal);
      if (!controller.signal.aborted) { setProducts(result.products); setError(""); }
    } catch {
      if (!controller.signal.aborted) setError("دریافت قیمت به‌روز محصولات انجام نشد؛ دوباره تلاش کنید.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const first = window.setTimeout(() => { void refresh(); }, 0);
    const visibleRefresh = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(visibleRefresh, 30000);
    window.addEventListener("focus", visibleRefresh);
    window.addEventListener("online", visibleRefresh);
    return () => { window.clearTimeout(first); window.clearInterval(timer); window.removeEventListener("focus", visibleRefresh); window.removeEventListener("online", visibleRefresh); current.current?.abort(); };
  }, [refresh]);
  const replaceProduct = useCallback((product: Product) => {
    // A checkout quote is newer than a catalog request already in flight.
    // Fence its response before replacing the visible unit price.
    current.current?.abort();
    setProducts((items) => items.map((item) => item.id === product.id ? product : item));
  }, []);
  return { products, loading, error, refresh, replaceProduct };
}
