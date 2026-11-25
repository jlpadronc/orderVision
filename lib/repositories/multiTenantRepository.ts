import crypto from "node:crypto";
import { ensureDatabaseSchema, prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/utils/currency";
import {
  DEFAULT_FEATURES,
  DEFAULT_TENANT_THEME,
  DEFAULT_WHATSAPP_CONFIG,
  type AddOrderStatusEventSchema,
  type AssignOrderBatchSchema,
  type BatchStatusType,
  type BusinessType,
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
  type TenantTheme,
  type TenantWhatsAppConfig,
  type UpdateBatchStatusSchema,
  type UpdateCustomerSchema,
  type UpdateOrderSchema,
  type UpdateTenantAdminControlsSchema,
  type VerifyOrderItemSchema,
} from "@/lib/validations/schemas";
import type { z } from "zod";

export interface OrderStatusEvent {
  id: string;
  status: OrderStatusType;
  label: string;
  note: string;
  createdAt: string;
  authorName?: string;
}

export interface TenantSettingsPayload {
  businessType?: BusinessType;
  logoUrl?: string | null;
  theme?: TenantTheme;
  features?: TenantFeatures;
  whatsappConfig?: TenantWhatsAppConfig;
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
  documentId?: string | null;
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
  serviceType?: string | null;
  fabricDetails?: string | null;
  measurements?: Record<string, string | number> | null;
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
  businessType?: BusinessType;
  fittingDate?: string | null;
  estimatedDeliveryDate?: string | null;
  measurements?: Record<string, string | number> | null;
  statusHistory?: OrderStatusEvent[] | null;
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
  theme: DEFAULT_TENANT_THEME,
  features: DEFAULT_FEATURES,
  whatsappConfig: DEFAULT_WHATSAPP_CONFIG,
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
    CASH_COP: {
      enabled: true,
      label: "Efectivo COP",
      holder: "",
      identifier: "",
    },
  },
};

function normalizeTenantSettings(raw: unknown): TenantSettingsPayload {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<TenantSettingsPayload>;
  const rawTheme = (obj.theme && typeof obj.theme === "object" ? obj.theme : {}) as Record<string, string | undefined>;
  const rawWa = (obj.whatsappConfig && typeof obj.whatsappConfig === "object" ? obj.whatsappConfig : {}) as Record<string, any>;
  const waConfig: TenantWhatsAppConfig = {
    enabled: typeof rawWa.enabled === "boolean" ? rawWa.enabled : (obj.features?.whatsappButton ?? DEFAULT_WHATSAPP_CONFIG.enabled),
    phoneNumber: typeof rawWa.phoneNumber === "string" ? rawWa.phoneNumber : "",
    buttonText: typeof rawWa.buttonText === "string" && rawWa.buttonText.trim() ? rawWa.buttonText.trim() : DEFAULT_WHATSAPP_CONFIG.buttonText,
    customMessage: typeof rawWa.customMessage === "string" && rawWa.customMessage.trim() ? rawWa.customMessage.trim() : DEFAULT_WHATSAPP_CONFIG.customMessage,
  };
  return {
    businessType: obj.businessType ?? "IMPORT",
    logoUrl: obj.logoUrl ?? null,
    theme: {
      primaryColor: rawTheme.primaryColor || DEFAULT_TENANT_THEME.primaryColor,
      secondaryColor: rawTheme.secondaryColor || DEFAULT_TENANT_THEME.secondaryColor,
      accentColor: rawTheme.accentColor || DEFAULT_TENANT_THEME.accentColor,
      preset: rawTheme.preset || DEFAULT_TENANT_THEME.preset,
    },
    whatsappConfig: waConfig,
    features: {
      ...DEFAULT_FEATURES,
      ...(obj.features || {}),
      whatsappButton: waConfig.enabled,
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
    documentId?: string | null;
    instagram: string | null;
    notes: string | null;
    createdAt: Date;
  };
  status: OrderStatusType;
  currency?: string | null;
  orderDate: Date;
  businessType?: string | null;
  fittingDate?: Date | null;
  estimatedDeliveryDate?: Date | null;
  measurements?: unknown;
  statusHistory?: unknown;
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
    serviceType?: string | null;
    fabricDetails?: string | null;
    measurements?: unknown;
    sourceImageUrl: string | null;
    isPhysicallyVerified: boolean;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}): OrderRecord {
  let parsedMeasurements: Record<string, string | number> | null = null;
  if (o.measurements) {
    if (typeof o.measurements === "string") {
      try {
        parsedMeasurements = JSON.parse(o.measurements);
      } catch {
        parsedMeasurements = null;
      }
    } else if (typeof o.measurements === "object") {
      parsedMeasurements = o.measurements as Record<string, string | number>;
    }
  }

  let parsedStatusHistory: OrderStatusEvent[] = [];
  if (o.statusHistory) {
    if (typeof o.statusHistory === "string") {
      try {
        parsedStatusHistory = JSON.parse(o.statusHistory);
      } catch {
        parsedStatusHistory = [];
      }
    } else if (Array.isArray(o.statusHistory)) {
      parsedStatusHistory = o.statusHistory as OrderStatusEvent[];
    }
  }

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
      documentId: (o.customer as any).documentId ?? null,
      instagram: o.customer.instagram,
      notes: o.customer.notes,
      createdAt: o.customer.createdAt.toISOString(),
    },
    status: o.status,
    currency: ((o.currency || "USD").toUpperCase() as CurrencyType) || "USD",
    orderDate: o.orderDate.toISOString(),
    businessType: (o.businessType as BusinessType) || "IMPORT",
    fittingDate: o.fittingDate ? o.fittingDate.toISOString() : null,
    estimatedDeliveryDate: o.estimatedDeliveryDate
      ? o.estimatedDeliveryDate.toISOString()
      : null,
    measurements: parsedMeasurements,
    statusHistory: parsedStatusHistory,
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
    items: o.items.map((item) => {
      let itemMeasurements: Record<string, string | number> | null = null;
      if (item.measurements) {
        if (typeof item.measurements === "string") {
          try {
            itemMeasurements = JSON.parse(item.measurements);
          } catch {
            itemMeasurements = null;
          }
        } else if (typeof item.measurements === "object") {
          itemMeasurements = item.measurements as Record<string, string | number>;
        }
      }

      return {
        id: item.id,
        tenantId: item.tenantId,
        orderId: item.orderId,
        title: item.title,
        originalPrice:
          item.originalPrice !== null ? Number(item.originalPrice) : null,
        finalPrice: Number(item.finalPrice),
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        modelVariant: item.modelVariant,
        verificationNotes: item.verificationNotes,
        serviceType: item.serviceType ?? null,
        fabricDetails: item.fabricDetails ?? null,
        measurements: itemMeasurements,
        sourceImageUrl: item.sourceImageUrl,
        isPhysicallyVerified: item.isPhysicallyVerified,
        createdAt: item.createdAt.toISOString(),
      };
    }),
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
        logoUrl: input.logoUrl?.trim() || null,
        theme: {
          primaryColor: input.primaryColor || DEFAULT_TENANT_THEME.primaryColor,
          secondaryColor: input.secondaryColor || DEFAULT_TENANT_THEME.secondaryColor,
          accentColor: input.primaryColor || DEFAULT_TENANT_THEME.accentColor,
          preset: input.preset || DEFAULT_TENANT_THEME.preset,
        },
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
 * Normaliza un número telefónico para comparar duplicados (conserva dígitos o texto limpio).
 */
export function normalizePhoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? digits : phone.trim().toLowerCase();
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
            OR: [
              { fullName: { contains: q } },
              { phone: { contains: q } },
              { documentId: { contains: q } },
            ],
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
    documentId: r.documentId ?? null,
    instagram: r.instagram,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Registra un nuevo cliente bajo aislamiento estricto de `tenantId`,
 * validando que no exista otro cliente con el mismo número de contacto.
 */
export async function createCustomerForTenant(
  input: z.infer<typeof CreateCustomerSchema>
): Promise<CustomerRecord> {
  const targetPhoneKey = normalizePhoneKey(input.phone);
  const existingCustomers = await prisma.customer.findMany({
    where: { tenantId: input.tenantId },
  });

  const duplicate = existingCustomers.find(
    (c) =>
      normalizePhoneKey(c.phone) === targetPhoneKey ||
      c.phone.trim().toLowerCase() === input.phone.trim().toLowerCase()
  );

  if (duplicate) {
    throw new Error(
      `Ya existe un cliente registrado con el número de contacto "${input.phone.trim()}" (${duplicate.fullName}).`
    );
  }

  const created = await prisma.customer.create({
    data: {
      tenantId: input.tenantId,
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      documentId: input.documentId?.trim() || null,
      instagram: input.instagram?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  return {
    id: created.id,
    tenantId: created.tenantId,
    fullName: created.fullName,
    phone: created.phone,
    documentId: created.documentId,
    instagram: created.instagram,
    notes: created.notes,
    createdAt: created.createdAt.toISOString(),
  };
}

/**
 * Actualiza los datos de un cliente (exclusivo para Admin del Tenant),
 * validando que el número de contacto no pertenezca a otro cliente del mismo negocio.
 */
export async function updateCustomerForTenant(
  input: z.infer<typeof UpdateCustomerSchema>
): Promise<CustomerRecord> {
  const current = await prisma.customer.findFirst({
    where: { id: input.customerId, tenantId: input.tenantId },
  });
  if (!current) {
    throw new Error("El cliente especificado no existe en este negocio.");
  }

  const targetPhoneKey = normalizePhoneKey(input.phone);
  const existingCustomers = await prisma.customer.findMany({
    where: {
      tenantId: input.tenantId,
      NOT: { id: input.customerId },
    },
  });

  const duplicate = existingCustomers.find(
    (c) =>
      normalizePhoneKey(c.phone) === targetPhoneKey ||
      c.phone.trim().toLowerCase() === input.phone.trim().toLowerCase()
  );

  if (duplicate) {
    throw new Error(
      `Ya existe otro cliente registrado con el número de contacto "${input.phone.trim()}" (${duplicate.fullName}).`
    );
  }

  const updated = await prisma.customer.update({
    where: { id: input.customerId },
    data: {
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      documentId: input.documentId?.trim() || null,
      instagram: input.instagram?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });

  return {
    id: updated.id,
    tenantId: updated.tenantId,
    fullName: updated.fullName,
    phone: updated.phone,
    documentId: updated.documentId,
    instagram: updated.instagram,
    notes: updated.notes,
    createdAt: updated.createdAt.toISOString(),
  };
}

/**
 * Elimina un cliente del negocio (exclusivo para Admin del Tenant).
 */
export async function deleteCustomerForTenant(
  tenantId: string,
  customerId: string
): Promise<void> {
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
  });
  if (!existing) {
    throw new Error("El cliente especificado no existe en este negocio.");
  }
  await prisma.customer.delete({
    where: { id: customerId },
  });
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
 * Crea un nuevo Lote de Pedido Consolidado (`OrderBatch`),
 * validando que no exista otro lote o pedido con el mismo identificador (`code`).
 */
export async function createBatchForTenant(
  input: z.infer<typeof CreateBatchSchema>
): Promise<OrderBatchRecord> {
  const cleanCode = input.code.trim().toUpperCase();

  const existingBatches = await prisma.orderBatch.findMany({
    where: { tenantId: input.tenantId },
    select: { id: true, code: true, name: true },
  });

  const duplicateBatch = existingBatches.find(
    (b) => b.code.trim().toUpperCase() === cleanCode
  );
  if (duplicateBatch) {
    throw new Error(
      `Ya existe un lote de pedido con el identificador "${cleanCode}" (${duplicateBatch.name}).`
    );
  }

  const parsedDate = new Date(input.purchaseDate);
  const validDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  const created = await prisma.orderBatch.create({
    data: {
      tenantId: input.tenantId,
      code: cleanCode,
      name: input.name.trim(),
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
 * Actualiza el código, estado, nombre o fecha de salida de un Lote de Pedido Consolidado,
 * validando que el identificador (`code`) no se duplique.
 */
export async function updateBatchForTenant(
  input: z.infer<typeof UpdateBatchStatusSchema>
): Promise<OrderBatchRecord> {
  const dataToUpdate: Record<string, unknown> = {};

  if (input.code) {
    const cleanCode = input.code.trim().toUpperCase();
    const existingBatches = await prisma.orderBatch.findMany({
      where: {
        tenantId: input.tenantId,
        NOT: { id: input.batchId },
      },
      select: { id: true, code: true, name: true },
    });
    const duplicateBatch = existingBatches.find(
      (b) => b.code.trim().toUpperCase() === cleanCode
    );
    if (duplicateBatch) {
      throw new Error(
        `Ya existe otro lote de pedido con el identificador "${cleanCode}" (${duplicateBatch.name}).`
      );
    }
    dataToUpdate.code = cleanCode;
  }

  if (input.status) dataToUpdate.status = input.status;
  if (input.name) dataToUpdate.name = input.name.trim();
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
 * Elimina un Lote de Pedido Consolidado (exclusivo para Admin del Tenant).
 * Los pedidos asociados quedan sin lote asignado (`batchId: null`).
 */
export async function deleteBatchForTenant(
  tenantId: string,
  batchId: string
): Promise<void> {
  const existing = await prisma.orderBatch.findFirst({
    where: { id: batchId, tenantId },
  });
  if (!existing) {
    throw new Error("El lote especificado no existe en este negocio.");
  }
  await prisma.$transaction([
    prisma.order.updateMany({
      where: { tenantId, batchId },
      data: { batchId: null },
    }),
    prisma.orderBatch.delete({
      where: { id: batchId },
    }),
  ]);
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
 * Crea un nuevo pedido vinculado al Lote de Salida (`batchId`) seleccionado,
 * validando que no exista otro pedido con el mismo identificador.
 */
export async function createOrderForTenant(
  input: z.infer<typeof CreateOrderSchema>
): Promise<OrderRecord> {
  const tenant = await getTenantByIdOrSlug(input.tenantId);
  if (!tenant) {
    throw new Error("El negocio especificado no existe.");
  }
  const depositPct = (tenant.defaultDepositPct || 50) / 100;
  const orderCurrency: CurrencyType =
    input.currency || ((tenant.currency?.toUpperCase() as CurrencyType) ?? "USD");

  const rawSubtotal = input.items.reduce(
    (acc, item) => acc + Number(item.finalPrice) * Number(item.quantity || 1),
    0
  );
  const subtotal =
    orderCurrency === "COP"
      ? Math.round(rawSubtotal)
      : Number(rawSubtotal.toFixed(2));
  const depositRequired =
    orderCurrency === "COP"
      ? Math.round(subtotal * depositPct)
      : Number((subtotal * depositPct).toFixed(2));
  const depositAmountPaid = input.depositPaid ? depositRequired : 0;
  const balanceDue =
    orderCurrency === "COP"
      ? Math.round(subtotal - depositAmountPaid)
      : Number((subtotal - depositAmountPaid).toFixed(2));
  const status: OrderStatusType = input.depositPaid ? "CONFIRMED_DEPOSIT_PAID" : "DRAFT";

  let resolvedBatchId = input.batchId ?? null;
  if (!resolvedBatchId) {
    const openBatch = await prisma.orderBatch.findFirst({
      where: { tenantId: input.tenantId },
      orderBy: { purchaseDate: "desc" },
    });
    resolvedBatchId = openBatch?.id ?? null;
  }

  let orderId = input.customOrderId?.trim() || "";
  if (orderId) {
    const existingOrders = await prisma.order.findMany({
      where: { tenantId: input.tenantId },
      select: { id: true },
    });
    const duplicateByTenant = existingOrders.find(
      (o) => o.id.trim().toLowerCase() === orderId.toLowerCase()
    );
    const duplicateGlobal = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (duplicateByTenant || duplicateGlobal) {
      throw new Error(
        `Ya existe un pedido registrado con el identificador "${orderId}". Por favor usa un identificador distinto.`
      );
    }
  } else {
    orderId = `ord-${crypto.randomUUID().slice(0, 8)}`;
    while (await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } })) {
      orderId = `ord-${crypto.randomUUID().slice(0, 8)}`;
    }
  }

  const initialEvent: OrderStatusEvent = {
    id: `ev-${crypto.randomUUID().slice(0, 8)}`,
    status,
    label:
      status === "CONFIRMED_DEPOSIT_PAID"
        ? (input.businessType === "TAILORING" ? "Seña Abonada / Pedido Confirmado" : "50% Pagado • Confirmado")
        : (input.businessType === "TAILORING" ? "Presupuesto / En Toma de Medidas" : "Borrador de Pedido"),
    note:
      status === "CONFIRMED_DEPOSIT_PAID"
        ? `Seña registrada con método ${input.paymentMethod}. Pedido ingresado a producción.`
        : "Pedido registrado en el sistema.",
    createdAt: new Date().toISOString(),
    authorName: "Taller / Tienda",
  };

  const created = await prisma.order.create({
    data: {
      id: orderId,
      tenantId: input.tenantId,
      batchId: resolvedBatchId,
      customerId: input.customerId,
      status,
      currency: orderCurrency,
      businessType: input.businessType || "IMPORT",
      fittingDate: input.fittingDate ? new Date(input.fittingDate) : null,
      estimatedDeliveryDate: input.estimatedDeliveryDate ? new Date(input.estimatedDeliveryDate) : null,
      measurements: input.measurements
        ? typeof input.measurements === "string"
          ? input.measurements
          : JSON.stringify(input.measurements)
        : undefined,
      statusHistory: JSON.stringify([initialEvent]),
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
          serviceType: item.serviceType ?? null,
          fabricDetails: item.fabricDetails ?? null,
          measurements: item.measurements
            ? typeof item.measurements === "string"
              ? item.measurements
              : JSON.stringify(item.measurements)
            : undefined,
          sourceImageUrl: item.sourceImageUrl ?? null,
          isPhysicallyVerified: false,
        })),
      },
    } as any,
  });

  return (await getOrderByTenantAndId(input.tenantId, created.id))!;
}

/**
 * Actualiza un pedido completo y sus productos (exclusivo para Admin del Tenant),
 * recalculando subtotales, seña y saldo pendiente en la moneda del pedido.
 */
export async function updateOrderForTenant(
  input: z.infer<typeof UpdateOrderSchema>
): Promise<OrderRecord> {
  const existing = await prisma.order.findFirst({
    where: { id: input.orderId, tenantId: input.tenantId },
    include: { items: true },
  });
  if (!existing) {
    throw new Error("El pedido especificado no existe en este negocio.");
  }

  const tenant = await getTenantByIdOrSlug(input.tenantId);
  const depositPct = ((tenant?.defaultDepositPct ?? 50) || 50) / 100;
  const nextCurrency: CurrencyType =
    input.currency ||
    ((existing.currency?.toUpperCase() as CurrencyType) ?? "USD");

  const nextStatus = input.status ?? existing.status;
  const isCompleted = nextStatus === "COMPLETED" || existing.finalPaymentPaid;

  await prisma.$transaction(async (tx) => {
    let subtotal = Number(existing.subtotal);
    let depositRequired = Number(existing.depositRequired);
    let depositAmountPaid = Number(existing.depositAmountPaid);
    let balanceDue = Number(existing.balanceDue);

    if (input.items && input.items.length > 0) {
      const rawSubtotal = input.items.reduce(
        (acc, item) =>
          acc + Number(item.finalPrice) * Number(item.quantity || 1),
        0
      );
      subtotal =
        nextCurrency === "COP"
          ? Math.round(rawSubtotal)
          : Number(rawSubtotal.toFixed(2));
      depositRequired =
        nextCurrency === "COP"
          ? Math.round(subtotal * depositPct)
          : Number((subtotal * depositPct).toFixed(2));
      depositAmountPaid = existing.depositPaid ? depositRequired : 0;
      balanceDue = isCompleted
        ? 0
        : nextCurrency === "COP"
        ? Math.round(subtotal - depositAmountPaid)
        : Number((subtotal - depositAmountPaid).toFixed(2));

      // Preservar estado de verificación física si el ítem ya existía
      const verifiedById = new Map<string, boolean>(
        existing.items.map((it) => [it.id, it.isPhysicallyVerified])
      );

      await tx.orderItem.deleteMany({
        where: { orderId: input.orderId, tenantId: input.tenantId },
      });

      await tx.orderItem.createMany({
        data: input.items.map((item) => ({
          tenantId: input.tenantId,
          orderId: input.orderId,
          title: item.title.trim(),
          originalPrice: item.originalPrice ?? null,
          finalPrice: item.finalPrice,
          quantity: item.quantity || 1,
          size: item.size?.trim() || null,
          color: item.color?.trim() || null,
          modelVariant: item.modelVariant?.trim() || null,
          verificationNotes: item.verificationNotes?.trim() || null,
          sourceImageUrl: item.sourceImageUrl ?? null,
          serviceType: item.serviceType ?? null,
          fabricDetails: item.fabricDetails ?? null,
          measurements: item.measurements
            ? typeof item.measurements === "string"
              ? item.measurements
              : JSON.stringify(item.measurements)
            : undefined,
          isPhysicallyVerified: item.id
            ? (verifiedById.get(item.id) ?? false)
            : false,
        })) as any,
      });
    } else if (isCompleted) {
      balanceDue = 0;
    }

    await tx.order.update({
      where: { id: input.orderId },
      data: {
        ...(input.batchId !== undefined ? { batchId: input.batchId } : {}),
        ...(input.customerId ? { customerId: input.customerId } : {}),
        status: nextStatus,
        currency: nextCurrency,
        ...(input.businessType !== undefined ? { businessType: input.businessType } : {}),
        ...(input.fittingDate !== undefined
          ? { fittingDate: input.fittingDate ? new Date(input.fittingDate) : null }
          : {}),
        ...(input.estimatedDeliveryDate !== undefined
          ? { estimatedDeliveryDate: input.estimatedDeliveryDate ? new Date(input.estimatedDeliveryDate) : null }
          : {}),
        ...(input.measurements !== undefined
          ? {
              measurements: input.measurements
                ? typeof input.measurements === "string"
                  ? input.measurements
                  : JSON.stringify(input.measurements)
                : undefined,
            }
          : {}),
        subtotal,
        depositRequired,
        depositAmountPaid,
        balanceDue,
        finalPaymentPaid: isCompleted,
        ...(input.paymentMethod !== undefined
          ? { paymentMethod: input.paymentMethod }
          : {}),
        ...(input.paymentReference !== undefined
          ? { paymentReference: input.paymentReference }
          : {}),
        ...(input.generalNotes !== undefined
          ? { generalNotes: input.generalNotes }
          : {}),
      } as any,
    });
  });

  const updated = await getOrderByTenantAndId(input.tenantId, input.orderId);
  if (!updated) {
    throw new Error("Error al recuperar el pedido actualizado.");
  }
  return updated;
}

/**
 * Elimina un pedido y sus productos asociados (exclusivo para Admin del Tenant).
 */
export async function deleteOrderForTenant(
  tenantId: string,
  orderId: string
): Promise<void> {
  const existing = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
  });
  if (!existing) {
    throw new Error("El pedido especificado no existe en este negocio.");
  }
  await prisma.order.delete({
    where: { id: orderId },
  });
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

export interface PublicOrderTrackRecord {
  id: string;
  orderDate: string;
  status: OrderStatusType;
  businessType: BusinessType;
  currency: CurrencyType;
  fittingDate: string | null;
  estimatedDeliveryDate: string | null;
  generalNotes: string | null;
  measurements: Record<string, string | number> | null;
  statusHistory: OrderStatusEvent[];
  subtotal: number;
  depositRequired: number;
  depositAmountPaid: number;
  balanceDue: number;
  finalPaymentPaid: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    theme?: TenantTheme;
    currency: string;
    phone?: string | null;
    whatsappConfig?: TenantWhatsAppConfig;
  };
  customer: {
    displayName: string;
    documentId?: string | null;
    phone?: string | null;
  };
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    finalPrice: number;
    size: string | null;
    color: string | null;
    serviceType: string | null;
    fabricDetails: string | null;
    measurements: Record<string, string | number> | null;
    sourceImageUrl: string | null;
    isPhysicallyVerified: boolean;
  }>;
}

export function getStatusLabelSpanish(
  status: OrderStatusType,
  businessType: BusinessType = "IMPORT"
): string {
  if (businessType === "TAILORING") {
    switch (status) {
      case "DRAFT":
        return "Presupuesto / En Toma de Medidas";
      case "CONFIRMED_DEPOSIT_PAID":
        return "Seña Abonada / En Espera de Materiales";
      case "MEASUREMENTS_TAKEN":
        return "Medidas Listas / Patronaje y Corte";
      case "IN_PRODUCTION":
        return "En Confección / Costura Activa";
      case "READY_FOR_FITTING":
        return "Listo para Prueba (Fitting)";
      case "FINAL_ADJUSTMENTS":
        return "En Ajustes Finales";
      case "READY_FOR_DELIVERY":
        return "Listo para Entrega / Retiro";
      case "COMPLETED":
        return "Entregado y Liquidado (100%)";
      case "CANCELLED":
        return "Cancelado";
      default:
        return status;
    }
  }

  switch (status) {
    case "DRAFT":
      return "Borrador";
    case "CONFIRMED_DEPOSIT_PAID":
      return "Por Comprar (50% Pagado)";
    case "PURCHASED_AT_ORIGIN":
      return "Comprado en Origen";
    case "IN_TRANSIT":
      return "En Tránsito Internacional";
    case "RECEIVED_IN_WAREHOUSE":
      return "En Almacén / Cotejo";
    case "MEASUREMENTS_TAKEN":
      return "Patronaje y Corte";
    case "IN_PRODUCTION":
      return "En Confección";
    case "READY_FOR_FITTING":
      return "Listo para Prueba";
    case "FINAL_ADJUSTMENTS":
      return "En Ajustes Finales";
    case "READY_FOR_DELIVERY":
      return "Listo para Entregar";
    case "COMPLETED":
      return "Culminado / Entregado";
    case "CANCELLED":
      return "Cancelado";
    default:
      return status;
  }
}

/**
 * Agrega un nuevo evento a la bitácora pública de avances de un pedido
 * y opcionalmente actualiza su estado.
 */
export async function addOrderStatusEventForTenant(
  input: z.infer<typeof AddOrderStatusEventSchema>
): Promise<OrderRecord> {
  const existing = await prisma.order.findFirst({
    where: { id: input.orderId, tenantId: input.tenantId },
  });
  if (!existing) {
    throw new Error("El pedido especificado no existe en este negocio.");
  }

  let currentHistory: OrderStatusEvent[] = [];
  if (existing.statusHistory) {
    if (typeof existing.statusHistory === "string") {
      try {
        currentHistory = JSON.parse(existing.statusHistory);
      } catch {
        currentHistory = [];
      }
    } else if (Array.isArray(existing.statusHistory)) {
      currentHistory = existing.statusHistory as unknown as OrderStatusEvent[];
    }
  }

  const nextStatus = input.status || existing.status;
  const newEvent: OrderStatusEvent = {
    id: `ev-${crypto.randomUUID().slice(0, 8)}`,
    status: nextStatus,
    label: getStatusLabelSpanish(
      nextStatus,
      (existing.businessType as BusinessType) || "IMPORT"
    ),
    note: input.note.trim(),
    createdAt: new Date().toISOString(),
    authorName: input.authorName?.trim() || "Taller / Tienda",
  };

  const updatedHistory = [newEvent, ...currentHistory];

  await prisma.order.update({
    where: { id: input.orderId },
    data: {
      status: nextStatus,
      statusHistory: JSON.stringify(updatedHistory),
    },
  });

  const updated = await getOrderByTenantAndId(input.tenantId, input.orderId);
  if (!updated) {
    throw new Error("Error al recuperar el pedido tras agregar evento.");
  }
  return updated;
}

/**
 * Consulta pública de seguimiento de pedido por ID (sin requerir autenticación).
 * Protege datos bancarios privados mientras retorna línea de tiempo, estado de confección y balance.
 */
export async function getPublicOrderTrackRecord(
  orderId: string
): Promise<PublicOrderTrackRecord | null> {
  await ensureDatabaseSchema();
  const row = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      tenant: true,
      customer: true,
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!row || !row.tenant || !row.customer) {
    return null;
  }

  const tenantSettings = normalizeTenantSettings(row.tenant.settings);

  let parsedMeasurements: Record<string, string | number> | null = null;
  if (row.measurements) {
    if (typeof row.measurements === "string") {
      try {
        parsedMeasurements = JSON.parse(row.measurements);
      } catch {
        parsedMeasurements = null;
      }
    } else if (typeof row.measurements === "object") {
      parsedMeasurements = row.measurements as Record<string, string | number>;
    }
  }

  let parsedStatusHistory: OrderStatusEvent[] = [];
  if (row.statusHistory) {
    if (typeof row.statusHistory === "string") {
      try {
        parsedStatusHistory = JSON.parse(row.statusHistory);
      } catch {
        parsedStatusHistory = [];
      }
    } else if (Array.isArray(row.statusHistory)) {
      parsedStatusHistory = row.statusHistory as unknown as OrderStatusEvent[];
    }
  }

  // Nombre de cliente seguro para vista pública (Nombre de pila y primer apellido)
  const fullNameParts = row.customer.fullName.trim().split(/\s+/);
  const displayName =
    fullNameParts.length > 1
      ? `${fullNameParts[0]} ${fullNameParts[1]}`
      : fullNameParts[0] || "Cliente";

  return {
    id: row.id,
    orderDate: row.orderDate.toISOString(),
    status: row.status,
    businessType: (row.businessType as BusinessType) || "IMPORT",
    currency: ((row.currency || "USD").toUpperCase() as CurrencyType) || "USD",
    fittingDate: row.fittingDate ? row.fittingDate.toISOString() : null,
    estimatedDeliveryDate: row.estimatedDeliveryDate
      ? row.estimatedDeliveryDate.toISOString()
      : null,
    generalNotes: row.generalNotes,
    measurements: parsedMeasurements,
    statusHistory: parsedStatusHistory,
    subtotal: Number(row.subtotal),
    depositRequired: Number(row.depositRequired),
    depositAmountPaid: Number(row.depositAmountPaid),
    balanceDue: Number(row.balanceDue),
    finalPaymentPaid: row.finalPaymentPaid,
    tenant: {
      id: row.tenant.id,
      name: row.tenant.name,
      slug: row.tenant.slug,
      logoUrl: tenantSettings.logoUrl ?? null,
      theme: tenantSettings.theme ?? DEFAULT_TENANT_THEME,
      currency: row.tenant.currency,
      phone: tenantSettings.whatsappConfig?.phoneNumber || null,
      whatsappConfig: tenantSettings.whatsappConfig ?? DEFAULT_WHATSAPP_CONFIG,
    },
    customer: {
      displayName,
      documentId: row.customer.documentId || null,
      phone: row.customer.phone || null,
    },
    items: row.items.map((item) => {
      let itemMeasurements: Record<string, string | number> | null = null;
      if (item.measurements) {
        if (typeof item.measurements === "string") {
          try {
            itemMeasurements = JSON.parse(item.measurements);
          } catch {
            itemMeasurements = null;
          }
        } else if (typeof item.measurements === "object") {
          itemMeasurements = item.measurements as Record<
            string,
            string | number
          >;
        }
      }
      return {
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        finalPrice: Number(item.finalPrice),
        size: item.size,
        color: item.color,
        serviceType: item.serviceType ?? null,
        fabricDetails: item.fabricDetails ?? null,
        measurements: itemMeasurements,
        sourceImageUrl: item.sourceImageUrl,
        isPhysicallyVerified: item.isPhysicallyVerified,
      };
    }),
  };
}
