import type {
  AddAdminDeliveryItemsRequest,
  AdminDeliveryItem,
  AdminDeliveryPool,
  AdminOrder,
  AdminProduct,
  PricingInput,
  PricingQuote,
  PricingSettings,
  PricingStatus,
  UpdatePricingSettings,
  AdminShareBoxSettings,
  AdminTelegramSettings,
  UpdateAdminTelegramSettings,
  AdminTelegramJobs,
  AdminSmsSender,
  AdminSmsSettings,
  AdminTicket,
  AdminUser,
  AdminWalletAdjustmentRequest,
  AdminWalletSummary,
  AdminWalletTransaction,
  ApiErrorResponse,
  ApiResponse,
  CreateAdminCategoryRequest,
  CreateAdminDeliveryPoolRequest,
  CreateAdminProductRequest,
  CreateAdminSmsSenderRequest,
  CreateAdminTicketMessageRequest,
  CreateOrderRequest,
  CreateOrderResponse,
  CreateTicketRequest,
  DirectPaymentResult,
  LoginRequest,
  LoginResponse,
  OtpChallenge,
  OtpRequest,
  OtpVerifyRequest,
  Order,
  Product,
  ProductCategory,
  RefundAdminOrderRequest,
  SetPasswordRequest,
  SetAdminProductActiveRequest,
  ShareBoxCategory,
  AdminSiteContentState,
  PublicSiteContent,
  SaveAdminSiteContentRequest,
  VersionedAdminSiteContentRequest,
  Ticket,
  TicketMessage,
  UpdateAdminOrderStatusRequest,
  UpdateAdminShareBoxSettingsRequest,
  UpdateAdminCategoryRequest,
  UpdateAdminProductRequest,
  UpdateAdminSmsSettingsRequest,
  UpdateAdminTicketStatusRequest,
  UpdateProfileRequest,
  User,
  Wallet,
  WalletSummary,
  WalletTransaction,
} from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001/api/v1";

type QueryValue = string | number | boolean | null | undefined;

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
  query?: Record<string, QueryValue>;
  timeoutMs?: number;
};

import { ApiError } from "./api-error";
import { pricingQuoteResponse, pricingSettingsResponse, pricingStatusResponse } from "./pricing-response";
import { publicProductResponse, publicProductsResponse } from "./catalog-response";
export { ApiError } from "./api-error";

function normalizeUrl(path: string, query?: Record<string, QueryValue>) {
  const isAbsolute = /^https?:\/\//i.test(path);
  const base = API_BASE_URL.replace(/\/$/, "");
  const pathname = path.startsWith("/") ? path : `/${path}`;
  const url = isAbsolute ? path : `${base}${pathname}`;
  const params = new URLSearchParams();

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

function isJsonBody(body: ApiFetchOptions["body"]): body is Record<string, unknown> {
  return Boolean(
    body &&
      typeof body === "object" &&
      !(body instanceof FormData) &&
      !(body instanceof Blob) &&
      !(body instanceof ArrayBuffer) &&
      !(body instanceof URLSearchParams),
  );
}

async function readJson<T>(response: Response): Promise<T | undefined> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(response.ok ? 502 : response.status, "پاسخ سرور قابل خواندن نیست؛ دوباره تلاش کنید.", {
      error: { code: "API_INVALID_RESPONSE", message: "پاسخ سرور قابل خواندن نیست." },
    });
  }
}

async function request<T>(
  path: string,
  { body, headers, query, timeoutMs = 30000, ...init }: ApiFetchOptions = {},
): Promise<ApiResponse<T> | undefined> {
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("Accept")) requestHeaders.set("Accept", "application/json");
  const jsonBody = isJsonBody(body);
  if (jsonBody && !requestHeaders.has("Content-Type")) requestHeaders.set("Content-Type", "application/json");
  if (init.signal?.aborted) throw init.signal.reason ?? new DOMException("Aborted", "AbortError");

  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const timeoutError = () => new ApiError(0, "پاسخ سرور در مهلت مقرر نرسید؛ وضعیت عملیات را پیش از تلاش مجدد بررسی کنید.", {
    error: { code: "API_TIMEOUT", message: "مهلت دریافت پاسخ سرور تمام شد." },
  });
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      controller.abort(init.signal?.reason);
      reject(init.signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    init.signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(timeoutError());
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(normalizeUrl(path, query), {
          ...init, cache: "no-store", credentials: "include", signal: controller.signal,
          body: jsonBody ? JSON.stringify(body) : body, headers: requestHeaders,
        });
        if (response.status === 204) return undefined;
        const payload = await readJson<ApiResponse<T> | ApiErrorResponse>(response);
        if (!response.ok) {
          const errorPayload = payload as ApiErrorResponse | undefined;
          throw new ApiError(response.status, errorPayload?.error?.message ?? "خطا در ارتباط با سرور", errorPayload);
        }
        if (!payload || typeof payload !== "object" || !("data" in payload)) {
          throw new ApiError(502, "ساختار پاسخ سرور معتبر نیست.", {
            error: { code: "API_INVALID_RESPONSE", message: "ساختار پاسخ سرور معتبر نیست." },
          });
        }
        return payload as ApiResponse<T>;
      })(), cancelled,
    ]);
  } catch (error) {
    if (init.signal?.aborted) throw init.signal.reason ?? error;
    if (timedOut) throw timeoutError();
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "ارتباط با سرور قطع شد؛ وضعیت عملیات را پیش از تلاش مجدد بررسی کنید.", {
      error: { code: "API_NETWORK_ERROR", message: "ارتباط با سرور برقرار نشد." },
    });
  } finally {
    clearTimeout(timer);
    if (onAbort) init.signal?.removeEventListener("abort", onAbort);
  }
}

export async function apiFetchWithMeta<T>(path: string, options: ApiFetchOptions = {}): Promise<ApiResponse<T>> {
  return await request<T>(path, options) as ApiResponse<T>;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  return (await request<T>(path, options))?.data as T;
}

export const api = {
  auth: {
    login: (body: LoginRequest) =>
      apiFetch<LoginResponse>("/auth/login", { body, method: "POST" }),
    requestOtp: (body: OtpRequest) =>
      apiFetch<{ challenge: OtpChallenge }>("/auth/otp/request", {
        body,
        method: "POST",
      }),
    verifyOtp: (body: OtpVerifyRequest) =>
      apiFetch<LoginResponse>("/auth/otp/verify", { body, method: "POST" }),
    logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
    me: () => apiFetch<{ user: User }>("/auth/me"),
    updateProfile: (body: UpdateProfileRequest) =>
      apiFetch<LoginResponse>("/auth/profile", { body, method: "PATCH" }),
    setPassword: (body: SetPasswordRequest) =>
      apiFetch<LoginResponse>("/auth/password", { body, method: "PATCH" }),
  },
  catalog: {
    categories: () => apiFetch<{ categories: ProductCategory[] }>("/categories"),
    product: (slug: string, signal?: AbortSignal) => apiFetch<{ product: Product }>(`/products/${encodeURIComponent(slug)}`, { signal }).then(publicProductResponse),
    products: (query?: { category?: string }, signal?: AbortSignal) =>
      apiFetch<{ products: Product[] }>("/products", { query, signal }).then(publicProductsResponse),
  },
  orders: {
    create: (body: CreateOrderRequest) =>
      apiFetch<CreateOrderResponse>("/orders", { body, method: "POST" }),
    list: () =>
      apiFetch<{ orders: Order[] }>("/orders/my", {
        query: { page: 1, perPage: 50 },
      }),
    listPage: (query?: { page?: number; perPage?: number }) =>
      apiFetchWithMeta<{ orders: Order[] }>("/orders/my", { query }),
    get: (id: string) => apiFetch<{ order: Order }>(`/orders/${id}`),
  },
  payments: {
    verifyJibitOrder: (orderId: string) =>
      apiFetch<{ payment: DirectPaymentResult }>(
        `/payments/jibit/orders/${orderId}/verify`,
        { method: "POST" },
      ),
  },
  siteContent: {
    get: () => apiFetch<PublicSiteContent>("/site-content"),
  },
  tickets: {
    list: () =>
      apiFetch<{ tickets: Ticket[] }>("/tickets/my", {
        query: { page: 1, perPage: 50 },
      }),
    listPage: (query?: {
      page?: number;
      perPage?: number;
      search?: string;
      status?: Ticket["status"];
    }) => apiFetchWithMeta<{ tickets: Ticket[] }>("/tickets/my", { query }),
    get: (id: string) => apiFetch<{ ticket: Ticket }>(`/tickets/${id}`),
    messages: (id: string, query?: { page?: number; perPage?: number }) =>
      apiFetchWithMeta<{ messages: TicketMessage[] }>(
        `/tickets/${id}/messages`,
        { query },
      ),
    create: (body: CreateTicketRequest) =>
      apiFetch<{ ticket: Ticket }>("/tickets", { body, method: "POST" }),
    addMessage: (id: string, body: CreateAdminTicketMessageRequest) =>
      apiFetch<{ ticket: Ticket }>(`/tickets/${id}/messages`, {
        body,
        method: "POST",
      }),
    close: (id: string) =>
      apiFetch<{ ticket: Ticket }>(`/tickets/${id}/close`, {
        method: "PATCH",
      }),
  },
  wallet: {
    summary: () => apiFetch<WalletSummary>("/wallet/me"),
    transactionsPage: (query?: { page?: number; perPage?: number }) =>
      apiFetchWithMeta<{ transactions: WalletTransaction[] }>(
        "/wallet/transactions",
        { query },
      ),
  },
  admin: {
    dashboard: (signal?: AbortSignal) => apiFetch<PricingStatus>("/admin/dashboard", { signal }).then(pricingStatusResponse),
    pricing: {
      getSettings: (signal?: AbortSignal) => apiFetch<{ settings: PricingSettings }>("/admin/pricing/settings", { signal }).then(pricingSettingsResponse),
      updateSettings: (body: UpdatePricingSettings) => apiFetch<{ settings: PricingSettings }>("/admin/pricing/settings", { method: "PATCH", body }).then(pricingSettingsResponse),
      status: (signal?: AbortSignal) => apiFetch<PricingStatus>("/admin/pricing/status", { signal }).then(pricingStatusResponse),
      preview: (body: PricingInput, signal?: AbortSignal) => apiFetch<{ pricing: PricingQuote }>("/admin/pricing/preview", { method: "POST", body, signal }).then(pricingQuoteResponse),
    },
    siteContent: {
      get: () => apiFetch<AdminSiteContentState>("/admin/site-content"),
      saveDraft: (body: SaveAdminSiteContentRequest) =>
        apiFetch<AdminSiteContentState>("/admin/site-content/draft", {
          body,
          method: "PUT",
        }),
      publish: (body: VersionedAdminSiteContentRequest) =>
        apiFetch<AdminSiteContentState>("/admin/site-content/publish", {
          body,
          method: "POST",
        }),
      resetDraft: (body: VersionedAdminSiteContentRequest) =>
        apiFetch<AdminSiteContentState>("/admin/site-content/reset-draft", {
          body,
          method: "POST",
        }),
    },
    users: {
      list: () => apiFetch<{ users: AdminUser[] }>("/admin/users"),
    },
    orders: {
      list: () => apiFetch<{ orders: AdminOrder[] }>("/admin/orders"),
      get: (id: string) => apiFetch<{ order: AdminOrder }>(`/admin/orders/${id}`),
      updateStatus: (id: string, body: UpdateAdminOrderStatusRequest) =>
        apiFetch<{ order: AdminOrder }>(`/admin/orders/${id}/status`, {
          body,
          method: "PATCH",
        }),
      refund: (id: string, body: RefundAdminOrderRequest = {}) =>
        apiFetch<{
          order: AdminOrder;
          wallet: Wallet;
          transaction: WalletTransaction;
        }>(`/admin/orders/${id}/refund`, { body, method: "POST" }),
      retryShareBox: (id: string) =>
        apiFetch<{ queued: number }>(`/admin/orders/${id}/sharebox/retry`, {
          method: "POST",
        }),
    },
    categories: {
      list: () => apiFetch<{ categories: ProductCategory[] }>("/admin/categories"),
      create: (body: CreateAdminCategoryRequest) =>
        apiFetch<{ category: ProductCategory }>("/admin/categories", {
          body,
          method: "POST",
        }),
      update: (id: string, body: UpdateAdminCategoryRequest) =>
        apiFetch<{ category: ProductCategory }>(`/admin/categories/${id}`, {
          body,
          method: "PATCH",
        }),
      remove: (id: string) =>
        apiFetch<{ categoryId: string }>(`/admin/categories/${id}`, {
          method: "DELETE",
        }),
    },
    products: {
      list: () => apiFetch<{ products: AdminProduct[] }>("/admin/products"),
      create: (body: CreateAdminProductRequest) =>
        apiFetch<{ product: AdminProduct }>("/admin/products", {
          body,
          method: "POST",
        }),
      update: (id: string, body: UpdateAdminProductRequest) =>
        apiFetch<{ product: AdminProduct }>(`/admin/products/${id}`, {
          body,
          method: "PATCH",
        }),
      setActive: (id: string, body: SetAdminProductActiveRequest) =>
        apiFetch<{ product: AdminProduct }>(`/admin/products/${id}/active`, {
          body,
          method: "PATCH",
        }),
      remove: (id: string) =>
        apiFetch<
          | { action: "ARCHIVED"; product: AdminProduct }
          | { action: "DELETED"; productId: string }
        >(`/admin/products/${id}`, { method: "DELETE" }),
    },
    deliveryPools: {
      list: () =>
        apiFetch<{ pools: AdminDeliveryPool[] }>("/admin/delivery-pools"),
      create: (body: CreateAdminDeliveryPoolRequest) =>
        apiFetch<{ pool: AdminDeliveryPool }>("/admin/delivery-pools", {
          body,
          method: "POST",
        }),
      items: (id: string) =>
        apiFetch<{ items: AdminDeliveryItem[] }>(
          `/admin/delivery-pools/${id}/items`,
        ),
      addItems: (id: string, body: AddAdminDeliveryItemsRequest) =>
        apiFetch<{ pool: AdminDeliveryPool }>(
          `/admin/delivery-pools/${id}/items`,
          {
            body,
            method: "POST",
          },
        ),
      removeItem: (poolId: string, itemId: string) =>
        apiFetch<{ itemId: string }>(
          `/admin/delivery-pools/${poolId}/items/${itemId}`,
          { method: "DELETE" },
        ),
    },
    sms: {
      getSettings: () =>
        apiFetch<{ settings: AdminSmsSettings }>("/admin/sms/settings"),
      updateSettings: (body: UpdateAdminSmsSettingsRequest) =>
        apiFetch<{ settings: AdminSmsSettings }>("/admin/sms/settings", {
          body,
          method: "PATCH",
        }),
      createSender: (body: CreateAdminSmsSenderRequest) =>
        apiFetch<{ sender: AdminSmsSender }>("/admin/sms/senders", {
          body,
          method: "POST",
        }),
      removeSender: (id: string) =>
        apiFetch<{ senderId: string }>(`/admin/sms/senders/${id}`, {
          method: "DELETE",
        }),
    },
    telegram: {
      getSettings: () => apiFetch<{ settings: AdminTelegramSettings }>("/admin/telegram/settings"),
      updateSettings: (body: UpdateAdminTelegramSettings) =>
        apiFetch<{ settings: AdminTelegramSettings }>("/admin/telegram/settings", { body, method: "PATCH" }),
      test: (mode: "connection" | "message") =>
        apiFetch<{ connected?: boolean; messageId?: string }>("/admin/telegram/test", { body: { mode }, method: "POST" }),
      jobs: () => apiFetch<AdminTelegramJobs>("/admin/telegram/jobs"),
      retry: (id: string) => apiFetch<{ queued: boolean }>(`/admin/telegram/jobs/${id}/retry`, {
        body: { useCurrentConfiguration: true }, method: "POST",
      }),
    },
    sharebox: {
      getSettings: () =>
        apiFetch<{ settings: AdminShareBoxSettings }>(
          "/admin/sharebox/settings",
        ),
      updateSettings: (body: UpdateAdminShareBoxSettingsRequest) =>
        apiFetch<{ settings: AdminShareBoxSettings }>(
          "/admin/sharebox/settings",
          { body, method: "PATCH" },
        ),
      categories: (query?: { page?: number; perPage?: number }) =>
        apiFetchWithMeta<{ categories: ShareBoxCategory[] }>(
          "/admin/sharebox/categories",
          { query },
        ),
    },
    wallet: {
      summary: () =>
        apiFetch<{ summary: AdminWalletSummary }>("/admin/wallet/summary"),
      transactions: () =>
        apiFetch<{ transactions: AdminWalletTransaction[] }>(
          "/admin/wallet/transactions",
        ),
      credit: (userId: string, body: AdminWalletAdjustmentRequest) =>
        apiFetch<{ wallet: Wallet; transaction: WalletTransaction }>(
          `/admin/wallet/users/${userId}/credit`,
          { body, method: "POST" },
        ),
      debit: (userId: string, body: AdminWalletAdjustmentRequest) =>
        apiFetch<{ wallet: Wallet; transaction: WalletTransaction }>(
          `/admin/wallet/users/${userId}/debit`,
          { body, method: "POST" },
        ),
    },
    tickets: {
      list: () => apiFetch<{ tickets: AdminTicket[] }>("/admin/tickets"),
      get: (id: string) => apiFetch<{ ticket: AdminTicket }>(`/admin/tickets/${id}`),
      addMessage: (id: string, body: CreateAdminTicketMessageRequest) =>
        apiFetch<{ ticket: AdminTicket }>(`/admin/tickets/${id}/messages`, {
          body,
          method: "POST",
        }),
      updateStatus: (id: string, body: UpdateAdminTicketStatusRequest) =>
        apiFetch<{ ticket: AdminTicket }>(`/admin/tickets/${id}/status`, {
          body,
          method: "PATCH",
        }),
    },
  },
};
