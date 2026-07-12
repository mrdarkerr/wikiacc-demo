import type {
  AddAdminDeliveryItemsRequest,
  AdminDeliveryItem,
  AdminDeliveryPool,
  AdminOrder,
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
  CreateAdminTicketMessageRequest,
  CreateOrderRequest,
  CreateTicketRequest,
  LoginRequest,
  LoginResponse,
  Order,
  Product,
  ProductCategory,
  RegisterRequest,
  RefundAdminOrderRequest,
  SetAdminProductActiveRequest,
  Ticket,
  TicketMessage,
  UpdateAdminOrderStatusRequest,
  UpdateAdminCategoryRequest,
  UpdateAdminProductRequest,
  UpdateAdminTicketStatusRequest,
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
};

export class ApiError extends Error {
  status: number;
  payload?: ApiErrorResponse;

  constructor(status: number, message: string, payload?: ApiErrorResponse) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

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
  return text ? (JSON.parse(text) as T) : undefined;
}

export async function apiFetchWithMeta<T>(
  path: string,
  { body, headers, query, ...init }: ApiFetchOptions = {},
): Promise<ApiResponse<T>> {
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  const jsonBody = isJsonBody(body);
  if (jsonBody && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(normalizeUrl(path, query), {
    cache: "no-store",
    credentials: "include",
    ...init,
    body: jsonBody ? JSON.stringify(body) : body,
    headers: requestHeaders,
  });

  const payload = await readJson<ApiResponse<T> | ApiErrorResponse>(response);

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | undefined;
    throw new ApiError(
      response.status,
      errorPayload?.error?.message ?? "خطا در ارتباط با سرور",
      errorPayload,
    );
  }

  return payload as ApiResponse<T>;
}

export async function apiFetch<T>(
  path: string,
  { body, headers, query, ...init }: ApiFetchOptions = {},
): Promise<T> {
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  const jsonBody = isJsonBody(body);
  if (jsonBody && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(normalizeUrl(path, query), {
    cache: "no-store",
    credentials: "include",
    ...init,
    body: jsonBody ? JSON.stringify(body) : body,
    headers: requestHeaders,
  });

  const payload = await readJson<ApiResponse<T> | ApiErrorResponse>(response);

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | undefined;
    throw new ApiError(
      response.status,
      errorPayload?.error?.message ?? "خطا در ارتباط با سرور",
      errorPayload,
    );
  }

  if (payload && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

export const api = {
  auth: {
    login: (body: LoginRequest) =>
      apiFetch<LoginResponse>("/auth/login", { body, method: "POST" }),
    register: (body: RegisterRequest) =>
      apiFetch<LoginResponse>("/auth/register", { body, method: "POST" }),
    logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
    me: () => apiFetch<{ user: User }>("/auth/me"),
  },
  catalog: {
    categories: () => apiFetch<{ categories: ProductCategory[] }>("/categories"),
    products: (query?: { category?: string }) =>
      apiFetch<{ products: Product[] }>("/products", { query }),
  },
  orders: {
    create: (body: CreateOrderRequest) =>
      apiFetch<{ order: Order }>("/orders", { body, method: "POST" }),
    list: () =>
      apiFetch<{ orders: Order[] }>("/orders/my", {
        query: { page: 1, perPage: 50 },
      }),
    listPage: (query?: { page?: number; perPage?: number }) =>
      apiFetchWithMeta<{ orders: Order[] }>("/orders/my", { query }),
    get: (id: string) => apiFetch<{ order: Order }>(`/orders/${id}`),
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
      list: () => apiFetch<{ products: Product[] }>("/admin/products"),
      create: (body: CreateAdminProductRequest) =>
        apiFetch<{ product: Product }>("/admin/products", {
          body,
          method: "POST",
        }),
      update: (id: string, body: UpdateAdminProductRequest) =>
        apiFetch<{ product: Product }>(`/admin/products/${id}`, {
          body,
          method: "PATCH",
        }),
      setActive: (id: string, body: SetAdminProductActiveRequest) =>
        apiFetch<{ product: Product }>(`/admin/products/${id}/active`, {
          body,
          method: "PATCH",
        }),
      remove: (id: string) =>
        apiFetch<
          | { action: "ARCHIVED"; product: Product }
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
