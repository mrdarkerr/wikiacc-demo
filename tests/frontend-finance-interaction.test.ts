// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FinanceDashboard } from "../components/admin/finance-dashboard";
import AdminDashboardPage from "../app/admin/page";
import { financeApi } from "../lib/finance-api";
import { api } from "../lib/api";
import { history, forecast } from "../backend/src/modules/finance/service.js";
import { zGetFinanceHistoryResponse, zGetFinanceForecastResponse } from "../lib/generated/finance/zod.gen";
vi.mock("../lib/finance-api", () => ({ financeApi: { history: vi.fn(), forecast: vi.fn() } }));
vi.mock("../lib/api", async (importOriginal) => ({ ...await importOriginal<typeof import("../lib/api")>(), api: { admin: {
  users: { list: vi.fn() }, orders: { list: vi.fn() }, tickets: { list: vi.fn() }, products: { list: vi.fn() },
} } }));
vi.mock("../components/admin/exchange-rate-card", () => ({ ExchangeRateCard: () => null }));
const emptyDb = { order: { findFirst: async () => null, findMany: async () => [] } };
const daily = zGetFinanceHistoryResponse.parse({ data: await history(emptyDb) }).data;
const weekly = zGetFinanceHistoryResponse.parse({ data: await history(emptyDb, { interval: "weekly" }) }).data;
const prediction = zGetFinanceForecastResponse.parse({ data: await forecast(emptyDb) }).data;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { resolve, promise }; }
beforeEach(() => {
  vi.mocked(financeApi.history).mockReset().mockResolvedValue(daily);
  vi.mocked(financeApi.forecast).mockReset().mockResolvedValue(prediction);
  vi.mocked(api.admin.users.list).mockReset().mockResolvedValue({ users: [] });
  vi.mocked(api.admin.orders.list).mockReset().mockResolvedValue({ orders: [] });
  vi.mocked(api.admin.tickets.list).mockReset().mockResolvedValue({ tickets: [] });
  vi.mocked(api.admin.products.list).mockReset().mockResolvedValue({ products: [] });
});
afterEach(cleanup);
describe("financial dashboard request isolation", () => {
  it("loads finance without waiting for a stuck legacy products-list request", async () => {
    vi.mocked(api.admin.products.list).mockReturnValue(new Promise(() => {}));
    render(createElement(AdminDashboardPage));
    await waitFor(() => expect(financeApi.history).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("گردش مالی این بازه")).toBeTruthy();
  });
  it("keeps finance accessible when a legacy products-list request fails", async () => {
    vi.mocked(api.admin.products.list).mockRejectedValue(new Error("legacy API failed"));
    render(createElement(AdminDashboardPage));
    expect(await screen.findByText("خطا در دریافت اطلاعات")).toBeTruthy();
    expect(await screen.findByText("گردش مالی این بازه")).toBeTruthy();
    expect(screen.getByText("پیش‌بینی درآمد مالی")).toBeTruthy();
  });
  it("invalidates an old request during the click, before passive-effect cleanup", async () => {
    const old = deferred<typeof daily>(); const next = deferred<typeof weekly>();
    vi.mocked(financeApi.history).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    render(createElement(FinanceDashboard));
    const oldSignal = vi.mocked(financeApi.history).mock.calls[0][1]!.signal!;
    let abortedDuringClick = false;
    const observer = () => { abortedDuringClick = oldSignal.aborted; };
    document.addEventListener("click", observer);
    fireEvent.click(screen.getByRole("button", { name: "هفتگی" }));
    document.removeEventListener("click", observer);
    expect(abortedDuringClick).toBe(true);
    await act(async () => old.resolve(daily));
    expect(screen.queryByText("گردش مالی این بازه")).toBeNull();
    await act(async () => next.resolve(weekly));
    expect(screen.getAllByRole("img")).toHaveLength(8);
    expect(screen.getByRole("button", { name: "هفتگی" }).getAttribute("aria-pressed")).toBe("true");
  });
});
