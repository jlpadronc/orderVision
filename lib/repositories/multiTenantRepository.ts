import crypto from "node:crypto";
import { ensureDatabaseSchema, prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/utils/currency";
import {
  DEFAULT_FEATURES,
  type AssignOrderBatchSchema,
  type BatchStatusType,
  type CreateBatchSchema,
  type CreateCustomerSchema,
  type CreateOrderSchema,
  type CreateTenantByAdminSchema,
  type CreateUserSchema,
  type CurrencyType,
  type OrderStatusType,
  type PaymentMethodType,
  type RoleType,
  type SettleFinalPaymentSchema,
  type TenantFeatures,
  type TenantSettingsSchema,
  type UpdateBatchStatusSchema,
  type UpdateTenantAdminControlsSchema,
  type VerifyOrderItemSchema,
} from "@/lib/validations/schemas";
import type { z } from "zod";

export interface TenantSettingsPayload {
  logoUrl?: string | null;
  features?: TenantFeatures;
  exchangeRates: {
    USD: number;
    VES: number;
    COP: number;
  };
  paymentAccounts: Record<
    string,
    {
      enabled: boolean;
      label: string;
      holder: string;
      identifier: string;
    }
  >;
}

export interface TenantRecord {
  id: string;
  slug: string;
  name: string;
  currency: string;
  defaultDepositPct: number;
  active: boolean;
  settings: TenantSettingsPayload;
  stats?: {
    usersCount: number;
    customersCount: number;
    batchesCount: number;
    ordersCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord {
  id: string;
  tenantId: string | null;
  tenantName?: string;
  tenantSlug?: string;
  email: string;
  name: string;
  role: RoleType;
  createdAt: string;
}

export interface CustomerRecord {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string;
  instagram: string | null;
  notes: string | null;
  createdAt: string;
}

export interface OrderItemRecord {
  id: string;
  tenantId: string;
  orderId: string;
  title: string;
  originalPrice: number | null;
  finalPrice: number;
  quantity: number;
  size: string | null;
  color: string | null;
  modelVariant: string | null;
  verificationNotes: string | null;
  sourceImageUrl: string | null;
  isPhysicallyVerified: boolean;
  createdAt: string;
}

export interface OrderBatchSummary {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  purchaseDate: string;
  status: BatchStatusType;
  trackingRef: string | null;
  notes: string | null;
}

export interface OrderRecord {
  id: string;
  tenantId: string;
  batchId: string | null;
  batch?: OrderBatchSummary | null;
  customerId: string;
  customer?: CustomerRecord;
  status: OrderStatusType;
  currency: CurrencyType;
  orderDate: string;
  subtotal: number;
  depositRequired: number;
  depositPaid: boolean;
  depositAmountPaid: number;
  balanceDue: number;
  finalPaymentPaid: boolean;
  paymentMethod: PaymentMethodType | null;
  paymentReference: string | null;
  receiptImageUrl: string | null;
  finalPaymentMethod: PaymentMethodType | null;
  finalPaymentRef: string | null;
  finalReceiptUrl: string | null;
  generalNotes: string | null;
  items: OrderItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderBatchRecord extends OrderBatchSummary {
  orders: OrderRecord[];
  metrics: {
    clientsCount: number;
    ordersCount: number;
    productsCount: number;
    verifiedProductsCount: number;
    subtotalUsd: number;
    depositPaidUsd: number;
    balanceDueUsd: number;
    subtotalCop: number;
    depositPaidCop: number;
    balanceDueCop: number;
    pendingPurchaseOrdersCount: number;
    inProgressOrdersCount: number;
    completedOrdersCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export { DEFAULT_FEATURES };

export const DEFAULT_TENANT_SETTINGS: TenantSettingsPayload = {
  logoUrl: null,
  features: DEFAULT_FEATURES,
  exchangeRates: {
    USD: 1,
    VES: 46.8,
    COP: 4180,
  },
  paymentAccounts: {
    BINANCE_USDT: {
      enabled: true,
      label: "Binance (USDT)",
      holder: "",
      identifier: "",
    },
    PAGO_MOVIL_VES: {
      enabled: true,
      label: "Bolívares / Pago Móvil",
      holder: "",
      identifier: "",
    },
    BANCOLOMBIA: {
      enabled: false,
      label: "Bancolombia",
      holder: "",
      identifier: "",
    },
    NEQUI: {
      enabled: false,
      label: "Nequi",
      holder: "",
      identifier: "",
    },
    CASH_USD: {
      enabled: true,
      label: "Efectivo USD",
      holder: "",
      identifier: "",
    },
  },
};

function normalizeTenantSettings(raw: unknown): TenantSettingsPayload {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<TenantSettingsPayload>;
  return {
    logoUrl: obj.logoUrl ?? null,
    features: {
      ...DEFAULT_FEATURES,
      ...(obj.features || {}),
    },
    exchangeRates: {
      USD: obj.exchangeRates?.USD ?? 1,
      VES: obj.exchangeRates?.VES ?? 46.8,
      COP: obj.exchangeRates?.COP ?? 4180,
    },
    paymentAccounts: obj.paymentAccounts ?? DEFAULT_TENANT_SETTINGS.paymentAccounts,
  };
}

function mapPrismaOrderToRecord(o: {
  id: string;
  tenantId: string;
  batchId: string | null;
  batch?: {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    purchaseDate: Date;
    status: BatchStatusType;
    trackingRef: string | null;
    notes: string | null;
  } | null;
  customerId: string;
  customer: {
    id: string;
    tenantId: string;
    fullName: string;
    phone: string;
    instagram: string | null;
    notes: string | null;
    createdAt: Date;
  };
  status: OrderStatusType;
  currency?: string | null;
  orderDate: Date;
  subtotal: unknown;
  depositRequired: unknown;
  depositPaid: boolean;
  depositAmountPaid: unknown;
  balanceDue: unknown;
  finalPaymentPaid: boolean;
  paymentMethod: PaymentMethodType | null;
  paymentReference: string | null;
  receiptImageUrl: string | null;
  finalPaymentMethod: PaymentMethodType | null;
  finalPaymentRef: string | null;
  finalReceiptUrl: string | null;
  generalNotes: string | null;
  items: {
    id: string;
    tenantId: string;
    orderId: string;
    title: string;
    originalPrice: unknown;
    finalPrice: unknown;
    quantity: number;
    size: string | null;
    color: string | null;
    modelVariant: string | null;
    verificationNotes: string | null;
    sourceImageUrl: string | null;
    isPhysicallyVerified: boolean;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}): OrderRecord {
  return {
    id: o.id,
    tenantId: o.tenantId,
    batchId: o.batchId,
    batch: o.batch
      ? {
          id: o.batch.id,
          tenantId: o.batch.tenantId,
          code: o.batch.code,
          name: o.batch.name,
          purchaseDate: o.batch.purchaseDate.toISOString(),
          status: o.batch.status,
          trackingRef: o.batch.trackingRef,
          notes: o.batch.notes,
        }
      : null,
    customerId: o.customerId,
    customer: {
      id: o.customer.id,
      tenantId: o.customer.tenantId,
      fullName: o.customer.fullName,
      phone: o.customer.phone,
      instagram: o.customer.instagram,
      notes: o.customer.notes,
      createdAt: o.customer.createdAt.toISOString(),
    },
    status: o.status,
    currency: ((o.currency || "USD").toUpperCase() as CurrencyType) || "USD",
    orderDate: o.orderDate.toISOString(),
    subtotal: Number(o.subtotal),
    depositRequired: Number(o.depositRequired),
    depositPaid: o.depositPaid,
    depositAmountPaid: Number(o.depositAmountPaid),
    balanceDue: Number(o.balanceDue),
    finalPaymentPaid: o.finalPaymentPaid,
    paymentMethod: o.paymentMethod,
    paymentReference: o.paymentReference,
    receiptImageUrl: o.receiptImageUrl,
    finalPaymentMethod: o.finalPaymentMethod,
    finalPaymentRef: o.finalPaymentRef,
    finalReceiptUrl: o.finalReceiptUrl,
    generalNotes: o.generalNotes,
    items: o.items.map((item) => ({
      id: item.id,
      tenantId: item.tenantId,
      orderId: item.orderId,
      title: item.title,
      originalPrice: item.originalPrice !== null ? Number(item.originalPrice) : null,
      finalPrice: Number(item.finalPrice),
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      modelVariant: item.modelVariant,
      verificationNotes: item.verificationNotes,
      sourceImageUrl: item.sourceImageUrl,
      isPhysicallyVerified: item.isPhysicallyVerified,
      createdAt: item.createdAt.toISOString(),
    })),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

/**
 * Obtiene todos los tenants (para selector o SuperAdmin).
 */
export async function listTenants(includeInactive = false): Promise<TenantRecord[]> {
  await ensureDatabaseSchema();
  const rows = await prisma.tenant.findMany({
    where: includeInactive ? {} : { active: true },
    include: {
      _count: {
        select: {
          users: true,
          customers: true,
          batches: true,
          orders: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    currency: r.currency,
    defaultDepositPct: Number(r.defaultDepositPct),
    active: r.active,
    settings: normalizeTenantSettings(r.settings),
    stats: {
      usersCount: r._count.users,
      customersCount: r._count.customers,
      batchesCount: r._count.batches,
      ordersCount: r._count.orders,
    },
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/**
 * Garantiza que exista el usuario SuperAdmin base en SQLite.
 */
export async function ensureSuperAdminExists(): Promise<void> {
  await ensureDatabaseSchema();
  const existing = await prisma.user.findFirst({
    where: { role: "SUPERADMIN" },
  });
  if (!existing) {
    await prisma.user.create({
      data: {
        id: "usr-superadmin-01",
        tenantId: null,
        email: "superadmin@ordervision.app",
        passwordHash: "admin123",
        name: "Super Administrador",
        role: "SUPERADMIN",
      },
    });
  }
}

/**
 * Obtiene un Tenant por ID o Slug (devuelve null si no existe).
 */
export async function getTenantByIdOrSlug(
  idOrSlug?: string | null
): Promise<TenantRecord | null> {
  if (!idOrSlug) return null;
  const tenants = await listTenants(true);
  return tenants.find((t) => t.id === idOrSlug || t.slug === idOrSlug) ?? null;
}

/**
 * Crea un nuevo negocio (Tenant) desde el panel SuperAdmin, junto con su usuario administrador opcional.
 */
export async function createTenantByAdmin(
  input: z.infer<typeof CreateTenantByAdminSchema>
): Promise<TenantRecord> {
  const created = await prisma.tenant.create({
    data: {
      name: input.name,
      slug: input.slug.toLowerCase(),
      currency: input.currency,
      defaultDepositPct: input.defaultDepositPct,
      active: true,
      settings: {
        ...DEFAULT_TENANT_SETTINGS,
        paymentAccounts: {
          ...DEFAULT_TENANT_SETTINGS.paymentAccounts,
          BINANCE_USDT: {
            enabled: true,
            label: "Binance (USDT)",
            holder: input.name,
            identifier: `pagos@${input.slug.toLowerCase()}.com`,
          },
          PAGO_MOVIL_VES: {
            enabled: true,
            label: "Bolívares / Pago Móvil",
            holder: input.name,
            identifier: "",
          },
        },
      },
    },
  });

  if (input.adminEmail && input.adminEmail.trim() !== "") {
    await prisma.user.create({
      data: {
        tenantId: created.id,
        name: input.adminName?.trim() || `Admin ${input.name}`,
        email: input.adminEmail.trim().toLowerCase(),
        passwordHash: input.adminPassword?.trim() || "123456",
        role: "TENANT_ADMIN",
      },
    });
  }

  const tenant = await getTenantByIdOrSlug(created.id);
  if (!tenant) {
    throw new Error("Error al recuperar el negocio recién creado.");
  }
  return tenant;
}

/**
 * Activa/desactiva un Tenant completo o sus funciones individuales desde el panel SuperAdmin.
 */
export async function updateTenantAdminControls(
  input: z.infer<typeof UpdateTenantAdminControlsSchema>
): Promise<TenantRecord> {
  const current = await getTenantByIdOrSlug(input.tenantId);
  if (!current) {
    throw new Error("El negocio especificado no existe.");
  }

  const nextSettings: TenantSettingsPayload = {
    ...current.settings,
    features: {
      ...(current.settings.features ?? DEFAULT_FEATURES),
      ...(input.features ?? {}),
    },
  };

  await prisma.tenant.update({
    where: { id: input.tenantId },
    data: {
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.name ? { name: input.name } : {}),
      settings: nextSettings as unknown as object,
    },
  });

  const updated = await getTenantByIdOrSlug(input.tenantId);
  if (!updated) {
    throw new Error("Error al actualizar el negocio.");
  }
  return updated;
}

/**
 * Actualiza los parámetros de configuración de un Tenant (aislado por tenantId).
 */
export async function updateTenantSettings(
  input: z.infer<typeof TenantSettingsSchema>
): Promise<TenantRecord> {
  const current = await getTenantByIdOrSlug(input.tenantId);
  if (!current) {
    throw new Error("El negocio especificado no existe.");
  }
  const mergedSettings: TenantSettingsPayload = {
    ...current.settings,
    ...input.settings,
    features: input.settings.features ?? current.settings.features ?? DEFAULT_FEATURES,
  };

  await prisma.tenant.update({
    where: { id: input.tenantId },
    data: {
      name: input.name,
      currency: input.currency,
      defaultDepositPct: input.defaultDepositPct,
      settings: mergedSettings as unknown as object,
    },
  });
  const updated = await getTenantByIdOrSlug(input.tenantId);
  if (!updated) {
    throw new Error("Error al actualizar la configuración del negocio.");
  }
  return updated;
}

/**
 * Gestión de Usuarios para SuperAdmin y Tenant Admin.
 */
export async function listUsers(tenantId?: string | null): Promise<UserRecord[]> {
  await ensureSuperAdminExists();
  const rows = await prisma.user.findMany({
    where: tenantId ? { tenantId } : {},
    include: {
      tenant: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((u) => ({
    id: u.id,
    tenantId: u.tenantId,
    tenantName: u.tenant?.name ?? "Plataforma SaaS",
    tenantSlug: u.tenant?.slug ?? "superadmin",
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  await ensureSuperAdminExists();
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });
  if (!u) return null;
  return {
    id: u.id,
    tenantId: u.tenantId,
    tenantName: u.tenant?.name ?? "Plataforma SaaS",
    tenantSlug: u.tenant?.slug ?? "superadmin",
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function createUserRecord(
  input: z.infer<typeof CreateUserSchema>
): Promise<UserRecord> {
  const created = await prisma.user.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: input.password,
      role: input.role,
    },
    include: {
      tenant: true,
    },
  });

  return {
    id: created.id,
    tenantId: created.tenantId,
    tenantName: created.tenant?.name ?? "Plataforma SaaS",
    tenantSlug: created.tenant?.slug ?? "superadmin",
    email: created.email,
    name: created.name,
    role: created.role,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function deleteUserRecord(userId: string): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (target?.role === "SUPERADMIN") {
    throw new Error("No se puede eliminar la cuenta principal de SuperAdmin.");
  }
  await prisma.user.delete({
    where: { id: userId },
  });
}

/**
 * Autentica un usuario por email y contraseña contra SQLite.
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ user: UserRecord; tenant: TenantRecord | null }> {
  await ensureSuperAdminExists();
  const row = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { tenant: true },
  });

  if (!row || row.passwordHash !== password) {
    throw new Error("Credenciales inválidas. Verifica tu correo y contraseña.");
  }

  if (row.role !== "SUPERADMIN") {
    if (!row.tenantId || !row.tenant) {
      throw new Error("Este usuario no tiene un negocio asignado.");
    }
    if (!row.tenant.active) {
      throw new Error(
        `El servicio para el negocio "${row.tenant.name}" se encuentra desactivado temporalmente por el administrador.`
      );
    }
  }

  const tenant = row.tenantId ? await getTenantByIdOrSlug(row.tenantId) : null;
  return {
    user: {
      id: row.id,
      tenantId: row.tenantId,
      tenantName: row.tenant?.name ?? "Plataforma SaaS",
      tenantSlug: row.tenant?.slug ?? "superadmin",
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
    },
    tenant,
  };
}

/**
 * Lista clientes pertenecientes exclusivamente al `tenantId` solicitado.
 */
export async function listCustomersByTenant(
  tenantId: string,
  searchQuery?: string
): Promise<CustomerRecord[]> {
  const q = searchQuery?.trim().toLowerCase() || "";
  const rows = await prisma.customer.findMany({
    where: {
      tenantId,
      ...(q
        ? {
            OR: [{ fullName: { contains: q } }, { phone: { contains: q } }],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    fullName: r.fullName,
    phone: r.phone,
    instagram: r.instagram,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Registra un nuevo cliente bajo aislamiento estricto de `tenantId`.
 */
export async function createCustomerForTenant(
  input: z.infer<typeof CreateCustomerSchema>
): Promise<CustomerRecord> {
  const created = await prisma.customer.create({
    data: {
      tenantId: input.tenantId,
      fullName: input.fullName,
      phone: input.phone,
      instagram: input.instagram ?? null,
      notes: input.notes ?? null,
    },
  });
  return {
    id: created.id,
    tenantId: created.tenantId,
    fullName: created.fullName,
    phone: created.phone,
    instagram: created.instagram,
    notes: created.notes,
    createdAt: created.createdAt.toISOString(),
  };
}

/**
 * Lista todos los Lotes de Pedidos Consolidados (`OrderBatch`) de un Tenant.
 */
export async function listBatchesByTenant(tenantId: string): Promise<OrderBatchRecord[]> {
  await ensureDatabaseSchema();
  const [tenant, rows] = await Promise.all([
    getTenantByIdOrSlug(tenantId),
    prisma.orderBatch.findMany({
      where: { tenantId },
      include: {
        orders: {
          include: {
            customer: true,
            batch: true,
            items: {
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { purchaseDate: "asc" },
    }),
  ]);

  const rates = tenant?.settings?.exchangeRates;

  return rows.map((b) => {
    const mappedOrders = b.orders.map(mapPrismaOrderToRecord);
    const uniqueCustomers = new Set(mappedOrders.map((o) => o.customerId));
    const productsCount = mappedOrders.reduce(
      (acc, o) => acc + o.items.reduce((sum, i) => sum + (i.quantity || 1), 0),
      0
    );
    const verifiedProductsCount = mappedOrders.reduce(
      (acc, o) =>
        acc +
        o.items.reduce(
          (sum, i) => sum + (i.isPhysicallyVerified ? i.quantity || 1 : 0),
          0
        ),
      0
    );

    const subtotalUsd = Number(
      mappedOrders
        .reduce((acc, o) => acc + convertCurrency(o.subtotal, o.currency, "USD", rates), 0)
        .toFixed(2)
    );
    const depositPaidUsd = Number(
      mappedOrders
        .reduce(
          (acc, o) => acc + convertCurrency(o.depositAmountPaid, o.currency, "USD", rates),
          0
        )
        .toFixed(2)
    );
    const balanceDueUsd = Number(
      mappedOrders
        .reduce(
          (acc, o) =>
            acc +
            (o.finalPaymentPaid ? 0 : convertCurrency(o.balanceDue, o.currency, "USD", rates)),
          0
        )
        .toFixed(2)
    );

    const subtotalCop = Math.round(
      mappedOrders.reduce(
        (acc, o) => acc + convertCurrency(o.subtotal, o.currency, "COP", rates),
        0
      )
    );
    const depositPaidCop = Math.round(
      mappedOrders.reduce(
        (acc, o) => acc + convertCurrency(o.depositAmountPaid, o.currency, "COP", rates),
        0
      )
    );
    const balanceDueCop = Math.round(
      mappedOrders.reduce(
        (acc, o) =>
          acc +
          (o.finalPaymentPaid ? 0 : convertCurrency(o.balanceDue, o.currency, "COP", rates)),
        0
      )
    );

    const pendingPurchaseOrdersCount = mappedOrders.filter(
      (o) => o.status === "DRAFT" || o.status === "CONFIRMED_DEPOSIT_PAID"
    ).length;
    const completedOrdersCount = mappedOrders.filter(
      (o) => o.status === "COMPLETED"
    ).length;
    const inProgressOrdersCount = mappedOrders.filter(
      (o) =>
        o.status !== "DRAFT" &&
        o.status !== "CONFIRMED_DEPOSIT_PAID" &&
        o.status !== "COMPLETED" &&
        o.status !== "CANCELLED"
    ).length;

    return {
      id: b.id,
      tenantId: b.tenantId,
      code: b.code,
      name: b.name,
      purchaseDate: b.purchaseDate.toISOString(),
      status: b.status,
      trackingRef: b.trackingRef,
      notes: b.notes,
      orders: mappedOrders,
      metrics: {
        clientsCount: uniqueCustomers.size,
        ordersCount: mappedOrders.length,
        productsCount,
        verifiedProductsCount,
        subtotalUsd,
        depositPaidUsd,
        balanceDueUsd,
        subtotalCop,
        depositPaidCop,
        balanceDueCop,
        pendingPurchaseOrdersCount,
        inProgressOrdersCount,
        completedOrdersCount,
      },
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  });
}

/**
 * Crea un nuevo Lote de Pedido Consolidado (`OrderBatch`).
 */
export async function createBatchForTenant(
  input: z.infer<typeof CreateBatchSchema>
): Promise<OrderBatchRecord> {
  const parsedDate = new Date(input.purchaseDate);
  const validDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  const created = await prisma.orderBatch.create({
    data: {
      tenantId: input.tenantId,
      code: input.code.toUpperCase(),
      name: input.name,
      purchaseDate: validDate,
      status: input.status ?? "OPEN_FOR_ORDERS",
      trackingRef: input.trackingRef ?? null,
      notes: input.notes ?? null,
    },
  });

  const allBatches = await listBatchesByTenant(input.tenantId);
  return allBatches.find((b) => b.id === created.id)!;
}

/**
 * Actualiza el estado o fecha de salida de un Lote de Pedido Consolidado.
 */
export async function updateBatchForTenant(
  input: z.infer<typeof UpdateBatchStatusSchema>
): Promise<OrderBatchRecord> {
  const dataToUpdate: Record<string, unknown> = {};
  if (input.status) dataToUpdate.status = input.status;
  if (input.name) dataToUpdate.name = input.name;
  if (input.trackingRef !== undefined) dataToUpdate.trackingRef = input.trackingRef;
  if (input.notes !== undefined) dataToUpdate.notes = input.notes;
  if (input.purchaseDate) {
    const d = new Date(input.purchaseDate);
    if (!Number.isNaN(d.getTime())) dataToUpdate.purchaseDate = d;
  }

  await prisma.orderBatch.updateMany({
    where: {
      id: input.batchId,
      tenantId: input.tenantId,
    },
    data: dataToUpdate,
  });

  const batches = await listBatchesByTenant(input.tenantId);
  const found = batches.find((b) => b.id === input.batchId);
  if (!found) {
    throw new Error("Lote no encontrado para este Tenant.");
  }
  return found;
}

/**
 * Reasigna el lote o cambia el estado de una orden (por ejemplo marcar como comprada en origen o completada).
 */
export async function assignOrderToBatchForTenant(
  input: z.infer<typeof AssignOrderBatchSchema>
): Promise<OrderRecord> {
  const dataToUpdate: Record<string, unknown> = {};
  if (input.batchId !== undefined) dataToUpdate.batchId = input.batchId;
  if (input.status !== undefined) dataToUpdate.status = input.status;

  await prisma.order.updateMany({
    where: {
      id: input.orderId,
      tenantId: input.tenantId,
    },
    data: dataToUpdate,
  });

  const updated = await getOrderByTenantAndId(input.tenantId, input.orderId);
  if (!updated) {
    throw new Error("Pedido no encontrado tras actualizar.");
  }
  return updated;
}

/**
 * Lista órdenes filtradas estrictamente por `tenantId`.
 */
export async function listOrdersByTenant(
  tenantId: string,
  batchId?: string | null
): Promise<OrderRecord[]> {
  const rows = await prisma.order.findMany({
    where: {
      tenantId,
      ...(batchId ? { batchId } : {}),
    },
    include: {
      customer: true,
      batch: true,
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map(mapPrismaOrderToRecord);
}

/**
 * Obtiene un pedido por `id` validando que pertenezca al `tenantId` activo.
 */
export async function getOrderByTenantAndId(
  tenantId: string,
  orderId: string
): Promise<OrderRecord | null> {
  const row = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      customer: true,
      batch: true,
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!row) return null;
  return mapPrismaOrderToRecord(row);
}

/**
 * Crea un nuevo pedido vinculado al Lote de Salida (`batchId`) seleccionado.
 */
export async function createOrderForTenant(
  input: z.infer<typeof CreateOrderSchema>
): Promise<OrderRecord> {
  const tenant = await getTenantByIdOrSlug(input.tenantId);
  if (!tenant) {
    throw new Error("El negocio especificado no existe.");
  }
  const depositPct = (tenant.defaultDepositPct || 50) / 100;

  const subtotal = Number(
    input.items
      .reduce((acc, item) => acc + Number(item.finalPrice) * Number(item.quantity || 1), 0)
      .toFixed(2)
  );
  const depositRequired = Number((subtotal * depositPct).toFixed(2));
  const depositAmountPaid = input.depositPaid ? depositRequired : 0;
  const balanceDue = Number((subtotal - depositAmountPaid).toFixed(2));
  const status: OrderStatusType = input.depositPaid ? "CONFIRMED_DEPOSIT_PAID" : "DRAFT";

  let resolvedBatchId = input.batchId ?? null;
  if (!resolvedBatchId) {
    const openBatch = await prisma.orderBatch.findFirst({
      where: { tenantId: input.tenantId },
      orderBy: { purchaseDate: "desc" },
    });
    resolvedBatchId = openBatch?.id ?? null;
  }

  const orderId = `ord-${crypto.randomUUID().slice(0, 8)}`;
  const orderCurrency: CurrencyType =
    input.currency || ((tenant.currency?.toUpperCase() as CurrencyType) ?? "USD");

  const created = await prisma.order.create({
    data: {
      id: orderId,
      tenantId: input.tenantId,
      batchId: resolvedBatchId,
      customerId: input.customerId,
      status,
      currency: orderCurrency,
      orderDate: new Date(),
      subtotal,
      depositRequired,
      depositPaid: input.depositPaid,
      depositAmountPaid,
      balanceDue,
      finalPaymentPaid: false,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference,
      receiptImageUrl: input.receiptImageUrl ?? null,
      generalNotes: input.generalNotes ?? null,
      items: {
        create: input.items.map((item) => ({
          tenantId: input.tenantId,
          title: item.title,
          originalPrice: item.originalPrice ?? null,
          finalPrice: item.finalPrice,
          quantity: item.quantity || 1,
          size: item.size ?? null,
          color: item.color ?? null,
          modelVariant: item.modelVariant ?? null,
          verificationNotes: item.verificationNotes ?? null,
          sourceImageUrl: item.sourceImageUrl ?? null,
          isPhysicallyVerified: false,
        })),
      },
    },
  });

  return (await getOrderByTenantAndId(input.tenantId, created.id))!;
}

/**
 * Actualiza la verificación física de un ítem en almacén.
 */
export async function verifyOrderItemForTenant(
  input: z.infer<typeof VerifyOrderItemSchema>
): Promise<OrderRecord> {
  await prisma.orderItem.updateMany({
    where: {
      id: input.itemId,
      orderId: input.orderId,
      tenantId: input.tenantId,
    },
    data: {
      isPhysicallyVerified: input.isPhysicallyVerified,
      ...(input.verificationNotes !== undefined
        ? { verificationNotes: input.verificationNotes }
        : {}),
    },
  });

  const allItems = await prisma.orderItem.findMany({
    where: { orderId: input.orderId, tenantId: input.tenantId },
  });
  const allVerified = allItems.length > 0 && allItems.every((i) => i.isPhysicallyVerified);

  const currentOrder = await prisma.order.findFirst({
    where: { id: input.orderId, tenantId: input.tenantId },
  });

  if (currentOrder && currentOrder.status !== "COMPLETED") {
    await prisma.order.update({
      where: { id: input.orderId },
      data: {
        status: allVerified ? "READY_FOR_DELIVERY" : "RECEIVED_IN_WAREHOUSE",
      },
    });
  }

  const updated = await getOrderByTenantAndId(input.tenantId, input.orderId);
  if (!updated) {
    throw new Error("Orden no encontrada en este Tenant.");
  }
  return updated;
}

/**
 * Registra el cobro del 50% restante (liquidación final) y marca el pedido como `COMPLETED`.
 */
export async function settleFinalPaymentForTenant(
  input: z.infer<typeof SettleFinalPaymentSchema>
): Promise<OrderRecord> {
  await prisma.order.updateMany({
    where: {
      id: input.orderId,
      tenantId: input.tenantId,
    },
    data: {
      finalPaymentPaid: true,
      balanceDue: 0,
      finalPaymentMethod: input.finalPaymentMethod,
      finalPaymentRef: input.finalPaymentRef,
      finalReceiptUrl: input.finalReceiptUrl ?? null,
      status: input.markCompleted ? "COMPLETED" : "READY_FOR_DELIVERY",
    },
  });
  const updated = await getOrderByTenantAndId(input.tenantId, input.orderId);
  if (!updated) {
    throw new Error("Orden no encontrada en este Tenant.");
  }
  return updated;
}
