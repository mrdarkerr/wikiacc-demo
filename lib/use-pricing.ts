"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { draftPricing, pricingError } from "./pricing";
import type { PricingInput, PricingQuote, PricingStatus } from "../types/api";

export function usePricingPreview(form: { priceCurrency: PricingInput["priceCurrency"]; basePrice: string; profit: string }) {
  const draft = draftPricing(form);
  const key = draft.input ? JSON.stringify(draft.input) : "";
  const [epoch, setEpoch] = useState(0);
  const [state, setState] = useState<{ key: string; epoch: number; pricing: PricingQuote | null; error: string }>({ key: "", epoch: -1, pricing: null, error: "" });
  const refresh = useCallback(() => setEpoch((value) => value + 1), []);
  useEffect(() => {
    if (!key) return;
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.admin.pricing.preview(JSON.parse(key) as PricingInput, controller.signal);
        if (active) setState({ key, epoch, pricing: result.pricing, error: "" });
      } catch (reason) {
        if (active && !controller.signal.aborted) setState({ key, epoch, pricing: null, error: pricingError(reason) });
      }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [key, epoch]);
  useEffect(() => {
    const visibleRefresh = () => { if (!document.hidden) refresh(); };
    const timer = window.setInterval(visibleRefresh, 30000);
    window.addEventListener("focus", visibleRefresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", visibleRefresh); };
  }, [refresh]);
  const current = Boolean(key && state.key === key && state.epoch === epoch);
  return { pricing: current ? state.pricing : null, pending: Boolean(key && !current), error: draft.error || (current ? state.error : ""), refresh, input: draft.input };
}

export function usePricingStatus(dashboard = false) {
  const [data, setData] = useState<PricingStatus | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const current = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setRefreshing(true);
    try {
      const result = await (dashboard ? api.admin.dashboard(controller.signal) : api.admin.pricing.status(controller.signal));
      if (!controller.signal.aborted) { setData(result); setError(""); }
    } catch (reason) {
      if (!controller.signal.aborted) setError(pricingError(reason));
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
    }
  }, [dashboard]);
  useEffect(() => {
    const first = window.setTimeout(() => { void refresh(); }, 0);
    const visibleRefresh = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(visibleRefresh, 30000);
    window.addEventListener("focus", visibleRefresh);
    return () => { window.clearTimeout(first); window.clearInterval(timer); window.removeEventListener("focus", visibleRefresh); current.current?.abort(); };
  }, [refresh]);
  return { data, error, refreshing, refresh };
}
