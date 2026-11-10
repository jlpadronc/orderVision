import { PrismaClient } from "@prisma/client";

/**
 * Resuelve automáticamente la URL de conexión PostgreSQL inyectada por Vercel
 * (soporta Vercel Postgres, Neon, Supabase, Prisma Postgres o DATABASE_URL estándar).
 */
export function resolvePostgresDatabaseUrl(): string {
  const candidates = [
    process.env.POSTGRES_PRISMA_URL,
    process.env.DATABASE_URL,
    process.env.PRISMA_DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];

  const validPostgresUrl = candidates.find(
    (u) =>
      typeof u === "string" &&
      (u.startsWith("postgres://") ||
        u.startsWith("postgresql://") ||
        u.startsWith("prisma+postgres://") ||
        u.startsWith("prisma://"))
  );

  if (validPostgresUrl) {
    process.env.DATABASE_URL = validPostgresUrl.trim();
    return process.env.DATABASE_URL;
  }

  return (
    process.env.DATABASE_URL?.trim() ||
    "postgresql://postgres:postgres@localhost:5432/ordervision?schema=public"
  );
}

const resolvedUrl = resolvePostgresDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  schemaReadyPromise: Promise<void> | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolvedUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const POSTGRES_BOOTSTRAP_STATEMENTS = [
  `DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'TENANT_ADMIN', 'TENANT_OPERATOR');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;`,
  `DO $$ BEGIN
    CREATE TYPE "BatchStatus" AS ENUM ('OPEN_FOR_ORDERS', 'PURCHASED_AT_ORIGIN', 'IN_TRANSIT', 'RECEIVED_IN_WAREHOUSE', 'COMPLETED');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;`,
  `DO $$ BEGIN
    CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED_DEPOSIT_PAID', 'PURCHASED_AT_ORIGIN', 'IN_TRANSIT', 'RECEIVED_IN_WAREHOUSE', 'READY_FOR_DELIVERY', 'COMPLETED', 'CANCELLED');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;`,
  `DO $$ BEGIN
    CREATE TYPE "PaymentMethod" AS ENUM ('BINANCE_USDT', 'BANCOLOMBIA', 'NEQUI', 'CASH_USD', 'PAGO_MOVIL_VES', 'ZINLI', 'OTHER');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;`,
  `CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "defaultDepositPct" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TENANT_OPERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "instagram" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "OrderBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'OPEN_FOR_ORDERS',
    "trackingRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderBatch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT,
    "customerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "depositRequired" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "depositAmountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "balanceDue" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "finalPaymentPaid" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" "PaymentMethod",
    "paymentReference" TEXT,
    "receiptImageUrl" TEXT,
    "finalPaymentMethod" "PaymentMethod",
    "finalPaymentRef" TEXT,
    "finalReceiptUrl" TEXT,
    "generalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OrderBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';`,
  `ALTER TABLE "Order" ALTER COLUMN "subtotal" TYPE DECIMAL(14,2);`,
  `ALTER TABLE "Order" ALTER COLUMN "depositRequired" TYPE DECIMAL(14,2);`,
  `ALTER TABLE "Order" ALTER COLUMN "depositAmountPaid" TYPE DECIMAL(14,2);`,
  `ALTER TABLE "Order" ALTER COLUMN "balanceDue" TYPE DECIMAL(14,2);`,
  `CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalPrice" DECIMAL(14,2),
    "finalPrice" DECIMAL(14,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "size" TEXT,
    "color" TEXT,
    "modelVariant" TEXT,
    "verificationNotes" TEXT,
    "sourceImageUrl" TEXT,
    "isPhysicallyVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `ALTER TABLE "OrderItem" ALTER COLUMN "originalPrice" TYPE DECIMAL(14,2);`,
  `ALTER TABLE "OrderItem" ALTER COLUMN "finalPrice" TYPE DECIMAL(14,2);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant"("slug");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");`,
  `CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId");`,
  `CREATE INDEX IF NOT EXISTS "Customer_tenantId_phone_idx" ON "Customer"("tenantId", "phone");`,
  `CREATE INDEX IF NOT EXISTS "OrderBatch_tenantId_purchaseDate_idx" ON "OrderBatch"("tenantId", "purchaseDate");`,
  `CREATE INDEX IF NOT EXISTS "OrderBatch_tenantId_status_idx" ON "OrderBatch"("tenantId", "status");`,
  `CREATE INDEX IF NOT EXISTS "Order_tenantId_batchId_idx" ON "Order"("tenantId", "batchId");`,
  `CREATE INDEX IF NOT EXISTS "Order_tenantId_status_idx" ON "Order"("tenantId", "status");`,
  `CREATE INDEX IF NOT EXISTS "Order_tenantId_customerId_idx" ON "Order"("tenantId", "customerId");`,
  `CREATE INDEX IF NOT EXISTS "OrderItem_tenantId_orderId_idx" ON "OrderItem"("tenantId", "orderId");`,
];

/**
 * Inicializa de forma idempotente los tipos ENUM, tablas e índices en PostgreSQL
 * si la instancia creada en Vercel aún está vacía.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (!globalForPrisma.schemaReadyPromise) {
    globalForPrisma.schemaReadyPromise = (async () => {
      for (const stmt of POSTGRES_BOOTSTRAP_STATEMENTS) {
        await prisma.$executeRawUnsafe(stmt);
      }
    })().catch((err) => {
      globalForPrisma.schemaReadyPromise = undefined;
      throw err;
    });
  }
  return globalForPrisma.schemaReadyPromise;
}
