import { z } from "zod";

export const RoleEnum = z.enum(["SUPERADMIN", "TENANT_ADMIN", "TENANT_OPERATOR"]);

export const BatchStatusEnum = z.enum([
  "OPEN_FOR_ORDERS",
  "PURCHASED_AT_ORIGIN",
  "IN_TRANSIT",
  "RECEIVED_IN_WAREHOUSE",
  "COMPLETED",
]);

export const OrderStatusEnum = z.enum([
  "DRAFT",
  "CONFIRMED_DEPOSIT_PAID",
  "PURCHASED_AT_ORIGIN",
  "IN_TRANSIT",
  "RECEIVED_IN_WAREHOUSE",
  "READY_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
]);

export const PaymentMethodEnum = z.enum([
  "BINANCE_USDT",
  "BANCOLOMBIA",
  "NEQUI",
  "CASH_USD",
  "PAGO_MOVIL_VES",
  "ZINLI",
  "OTHER",
]);

export const CurrencyEnum = z.enum(["USD", "COP", "VES"]);

export type RoleType = z.infer<typeof RoleEnum>;
export type BatchStatusType = z.infer<typeof BatchStatusEnum>;
export type OrderStatusType = z.infer<typeof OrderStatusEnum>;
export type PaymentMethodType = z.infer<typeof PaymentMethodEnum>;
export type CurrencyType = z.infer<typeof CurrencyEnum>;

export const TenantFeaturesSchema = z.object({
  aiVision: z.boolean().default(false),
  whatsappButton: z.boolean().default(true),
  quoteExport: z.boolean().default(true),
  warehouseVerify: z.boolean().default(true),
});

export type TenantFeatures = z.infer<typeof TenantFeaturesSchema>;

export const DEFAULT_FEATURES: TenantFeatures = {
  aiVision: false,
  whatsappButton: true,
  quoteExport: true,
  warehouseVerify: true,
};

export const LoginSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export const CreateUserSchema = z.object({
  tenantId: z.string().min(1, "Selecciona el negocio (Tenant)"),
  name: z.string().trim().min(2, "El nombre es obligatorio").max(100),
  email: z.string().trim().email("Correo electrónico inválido"),
  password: z.string().min(4, "La contraseña debe tener al menos 4 caracteres"),
  role: RoleEnum.default("TENANT_OPERATOR"),
});

export const CreateTenantByAdminSchema = z.object({
  name: z.string().trim().min(2, "El nombre del negocio es obligatorio").max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "El slug solo puede contener minúsculas, números y guiones"),
  currency: z.enum(["USD", "VES", "COP"]).default("USD"),
  defaultDepositPct: z.number().min(10).max(100).default(50),
  adminName: z.string().trim().optional(),
  adminEmail: z.string().trim().email().optional().or(z.literal("")),
  adminPassword: z.string().optional(),
});

export const UpdateTenantAdminControlsSchema = z.object({
  tenantId: z.string().min(1, "tenantId es obligatorio"),
  active: z.boolean().optional(),
  name: z.string().trim().optional(),
  features: TenantFeaturesSchema.partial().optional(),
});

export const CreateCustomerSchema = z.object({
  tenantId: z.string().min(1, "tenantId es obligatorio"),
  fullName: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  phone: z
    .string()
    .trim()
    .min(6, "Ingresa un número de WhatsApp válido")
    .max(30),
  instagram: z.string().trim().max(60).optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
});

export const CreateBatchSchema = z.object({
  tenantId: z.string().min(1, "tenantId es obligatorio"),
  code: z.string().trim().min(2, "El código del lote es obligatorio").max(40),
  name: z.string().trim().min(2, "El nombre del lote de pedido es obligatorio").max(120),
  purchaseDate: z.string().min(4, "La fecha de salida o compra es obligatoria"),
  status: BatchStatusEnum.optional().default("OPEN_FOR_ORDERS"),
  trackingRef: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(400).optional().nullable(),
});

export const UpdateBatchStatusSchema = z.object({
  tenantId: z.string().min(1, "tenantId es obligatorio"),
  batchId: z.string().min(1, "batchId es obligatorio"),
  status: BatchStatusEnum.optional(),
  purchaseDate: z.string().optional(),
  name: z.string().trim().optional(),
  trackingRef: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const AssignOrderBatchSchema = z.object({
  tenantId: z.string().min(1, "tenantId es obligatorio"),
  orderId: z.string().min(1, "orderId es obligatorio"),
  batchId: z.string().nullable().optional(),
  status: OrderStatusEnum.optional(),
});

export const OrderItemInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "El título del producto es obligatorio"),
  originalPrice: z.number().nonnegative().nullable().optional(),
  finalPrice: z.number().positive("El precio de página debe ser mayor a 0"),
  quantity: z.number().int().min(1).max(999).default(1),
  size: z.string().trim().max(60).nullable().optional(),
  color: z.string().trim().max(80).nullable().optional(),
  modelVariant: z.string().trim().max(100).nullable().optional(),
  verificationNotes: z.string().trim().max(400).nullable().optional(),
  sourceImageUrl: z.string().nullable().optional(),
});

export const CreateOrderSchema = z.object({
  tenantId: z.string().min(1, "tenantId es obligatorio"),
  batchId: z.string().optional().nullable(),
  customerId: z.string().min(1, "Debes seleccionar o registrar un cliente"),
  currency: CurrencyEnum.optional().default("USD"),
  items: z.array(OrderItemInputSchema).min(1, "El pedido debe tener al menos un producto"),
  depositPaid: z.boolean().default(true),
  paymentMethod: PaymentMethodEnum,
  paymentReference: z.string().trim().min(2, "Ingresa el número de referencia o hash del pago"),
  receiptImageUrl: z.string().nullable().optional(),
  generalNotes: z.string().trim().max(500).nullable().optional(),
});

export const VerifyOrderItemSchema = z.object({
  tenantId: z.string().min(1, "tenantId es obligatorio"),
  orderId: z.string().min(1, "orderId es obligatorio"),
  itemId: z.string().min(1, "itemId es obligatorio"),
  isPhysicallyVerified: z.boolean(),
  verificationNotes: z.string().trim().max(400).nullable().optional(),
});

export const SettleFinalPaymentSchema = z.object({
  tenantId: z.string().min(1, "tenantId es obligatorio"),
  orderId: z.string().min(1, "orderId es obligatorio"),
  finalPaymentMethod: PaymentMethodEnum,
  finalPaymentRef: z.string().trim().min(2, "Ingresa la referencia del pago final"),
  finalReceiptUrl: z.string().nullable().optional(),
  markCompleted: z.boolean().default(true),
});

export const TenantSettingsSchema = z.object({
  tenantId: z.string().min(1, "tenantId es obligatorio"),
  name: z.string().trim().min(2, "Nombre de tienda obligatorio").max(100),
  currency: z.enum(["USD", "VES", "COP"]).default("USD"),
  defaultDepositPct: z.number().min(10).max(100).default(50),
  settings: z.object({
    logoUrl: z.string().optional().nullable(),
    features: TenantFeaturesSchema.optional(),
    exchangeRates: z.object({
      USD: z.number().positive().default(1),
      VES: z.number().positive().default(46.8),
      COP: z.number().positive().default(4180),
    }),
    paymentAccounts: z.record(
      z.string(),
      z.object({
        enabled: z.boolean(),
        label: z.string(),
        holder: z.string(),
        identifier: z.string(),
      })
    ),
  }),
});
