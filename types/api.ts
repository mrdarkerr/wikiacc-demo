export type ApiMeta = {
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
};

export type ApiResponse<T> = {
  data: T;
  meta?: ApiMeta;
};

export type ApiErrorResponse = {
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type UserRole = "USER" | "ADMIN";

export type User = {
  id: string;
  email: string;
  phone?: string | null;
  name: string;
  role: UserRole;
  wallet?: { balance: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = LoginRequest & {
  name: string;
  phone?: string;
};

export type LoginResponse = {
  user: User;
};

export type ProductType = "CUSTOM_FORM" | "INSTANT_DELIVERY";
export type FieldType = "TEXT" | "EMAIL" | "PHONE" | "TEXTAREA" | "SELECT";

export type ProductField = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  optionsJson?: string | null;
  sortOrder: number;
};

export type ProductCategory = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type DeliveryPoolSummary = {
  id: string;
  slug: string;
  title: string;
  _count?: {
    items?: number;
  };
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  type: ProductType;
  price: number;
  isActive: boolean;
  sortOrder: number;
  category?: ProductCategory | null;
  deliveryPool?: DeliveryPoolSummary | null;
  fields: ProductField[];
};

export type OrderStatus =
  | "DRAFT"
  | "PENDING_INFO"
  | "AWAITING_ADMIN"
  | "READY"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus = "UNPAID" | "PAID" | "REFUNDED";

export type OrderFieldValue = {
  id: string;
  keySnapshot: string;
  labelSnapshot: string;
  value: string;
  createdAt: string;
};

export type OrderDelivery = {
  id: string;
  contentSnapshot: string;
  deliveredAt: string;
};

export type OrderItem = {
  id: string;
  titleSnapshot: string;
  priceSnapshot: number;
  productTypeSnapshot: ProductType;
  quantity: number;
  fieldValues: OrderFieldValue[];
  deliveries: OrderDelivery[];
};

export type Order = {
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type TicketStatus = "OPEN" | "ANSWERED" | "CLOSED";
export type TicketPriority = "LOW" | "NORMAL" | "HIGH";

export type TicketMessage = {
  id: string;
  body: string;
  isAdmin: boolean;
  createdAt: string;
  sender?: Pick<User, "id" | "name" | "role"> | null;
};

export type Ticket = {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  orderId?: string | null;
  messages: TicketMessage[];
};

export type CreateTicketRequest = {
  subject: string;
  body: string;
  priority?: TicketPriority;
  orderId?: string;
};

export type CreateOrderRequest = {
  productId: string;
  quantity?: number;
  fieldValues?: Record<string, string>;
  note?: string;
};

export type Wallet = {
  id: string;
  userId: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
};

export type TransactionType =
  | "ADMIN_CREDIT"
  | "ADMIN_DEBIT"
  | "ORDER_PAYMENT"
  | "ORDER_REFUND"
  | "GATEWAY_TOPUP";

export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";

export type WalletTransaction = {
  id: string;
  userId?: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  createdAt: string;
};

export type WalletSummary = {
  wallet: Wallet;
  transactions: WalletTransaction[];
};

export type AdminWalletSummary = {
  averageBalance: number;
  maxBalance: number;
  recentTransactionCount: number;
  totalBalance: number;
  totalUsers: number;
  transactionCount: number;
  usersWithBalance: number;
};

export type AdminWalletTransaction = WalletTransaction & {
  user: Pick<User, "id" | "email" | "name" | "phone">;
  createdByAdmin?: Pick<User, "id" | "email" | "name" | "role"> | null;
  createdByAdminId?: string | null;
};

export type DashboardSummary = {
  activeOrders: number;
  openTickets: number;
  walletBalance: number;
  deliveredOrders: number;
  recentOrders: Order[];
  recentTickets: Ticket[];
};

export type AdminUser = User & {
  wallet?: Wallet | null;
};

export type AdminOrder = Order & {
  user?: Pick<User, "id" | "email" | "name" | "phone"> | null;
  items: Array<
    OrderItem & {
      product?: Product | null;
    }
  >;
};

export type DeliveryItemStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "DELIVERED"
  | "DISABLED";

export type AdminDeliveryPool = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    items?: number;
    products?: number;
  };
};

export type AdminDeliveryItem = {
  id: string;
  poolId: string;
  content: string;
  status: DeliveryItemStatus;
  deliveredToOrderItemId?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminTicketMessage = TicketMessage & {
  sender?: Pick<User, "id" | "name" | "role"> | null;
};

export type AdminTicket = Omit<Ticket, "messages"> & {
  user?: Pick<User, "id" | "email" | "name"> | null;
  order?: Pick<Order, "id" | "status" | "totalAmount"> | null;
  messages: AdminTicketMessage[];
};

export type CreateAdminCategoryRequest = {
  slug: string;
  title: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
};

export type CreateAdminProductFieldRequest = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  optionsJson?: string;
  sortOrder?: number;
};

export type CreateAdminProductRequest = {
  slug: string;
  title: string;
  description?: string;
  type: ProductType;
  price: number;
  categoryId?: string;
  deliveryPoolId?: string;
  isActive?: boolean;
  sortOrder?: number;
  fields?: CreateAdminProductFieldRequest[];
};

export type UpdateAdminProductRequest = Partial<CreateAdminProductRequest>;

export type SetAdminProductActiveRequest = {
  isActive: boolean;
};

export type CreateAdminDeliveryPoolRequest = {
  slug: string;
  title: string;
  description?: string;
};

export type AddAdminDeliveryItemsRequest = {
  content?: string;
  items?: string[];
};

export type AdminWalletAdjustmentRequest = {
  amount: number;
  note?: string;
};

export type UpdateAdminOrderStatusRequest = {
  status: OrderStatus;
  note?: string;
};

export type RefundAdminOrderRequest = {
  note?: string;
};

export type CreateAdminTicketMessageRequest = {
  body: string;
};

export type UpdateAdminTicketStatusRequest = {
  status: TicketStatus;
};
