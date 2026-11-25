import path from "node:path";
import * as nodeModule from "node:module";
import { PrismaClient } from "@prisma/client";

export type DatabaseProvider = "postgresql" | "sqlite";

function isPostgresUrl(url?: string | null): url is string {
  return (
    typeof url === "string" &&
    (url.startsWith("postgres://") ||
      url.startsWith("postgresql://") ||
      url.startsWith("prisma+postgres://") ||
      url.startsWith("prisma://"))
  );
}

/**
 * Detecta automáticamente si la app está corriendo en Vercel / PostgreSQL
 * o en entorno de desarrollo local con SQLite (`prisma/dev.db`).
 */
export function getActiveDatabaseProvider(): DatabaseProvider {
  const candidates = [
    process.env.POSTGRES_PRISMA_URL,
    process.env.PRISMA_DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL,
  ];

  if (process.env.VERCEL || candidates.some((u) => isPostgresUrl(u))) {
    return "postgresql";
  }

  return "sqlite";
}

/**
 * Resuelve la URL de conexión según el entorno activo:
 * - Vercel / Repo con PostgreSQL: toma POSTGRES_PRISMA_URL / DATABASE_URL / POSTGRES_URL.
 * - Desarrollo local sin URL PostgreSQL: usa SQLite en `prisma/dev.db`.
 */
export function resolveDatabaseUrl(): string {
  const provider = getActiveDatabaseProvider();

  if (provider === "postgresql") {
    const candidates = [
      process.env.POSTGRES_PRISMA_URL,
      process.env.DATABASE_URL,
      process.env.PRISMA_DATABASE_URL,
      process.env.POSTGRES_URL,
      process.env.POSTGRES_URL_NON_POOLING,
    ];

    const validPostgresUrl = candidates.find((u) => isPostgresUrl(u));
    if (validPostgresUrl) {
      process.env.DATABASE_URL = validPostgresUrl.trim();
      return process.env.DATABASE_URL;
    }

    const fallbackPg =
      "postgresql://postgres:postgres@localhost:5432/ordervision?schema=public";
    process.env.DATABASE_URL = fallbackPg;
    return fallbackPg;
  }

  // Modo desarrollo local con SQLite
  const rawLocal = process.env.DATABASE_URL?.trim();
  const defaultSqlitePath = path
    .resolve(process.cwd(), "prisma", "dev.db")
    .replace(/\\/g, "/");

  if (
    !rawLocal ||
    rawLocal === "file:./dev.db" ||
    rawLocal === "file:dev.db" ||
    rawLocal === "file:./prisma/dev.db"
  ) {
    process.env.DATABASE_URL = `file:${defaultSqlitePath}`;
    return process.env.DATABASE_URL;
  }

  if (rawLocal.startsWith("file:")) {
    return rawLocal;
  }

  process.env.DATABASE_URL = `file:${defaultSqlitePath}`;
  return process.env.DATABASE_URL;
}

export const resolvePostgresDatabaseUrl = resolveDatabaseUrl;

const activeProvider = getActiveDatabaseProvider();
const resolvedUrl = resolveDatabaseUrl();

function createActivePrismaClient(): PrismaClient {
  if (activeProvider === "sqlite") {
    const sqliteClientEntry = path.resolve(
      process.cwd(),
      "node_modules",
      ".prisma",
      "sqlite-client",
      "index.js"
    );
    // Carga en tiempo de ejecución únicamente en modo SQLite local (evita incluir el cliente SQLite en el bundle de Vercel)
    const makeRequire = nodeModule.createRequire;
    const runtimeRequire = makeRequire(
      path.resolve(process.cwd(), "package.json")
    );
    const sqliteModule = runtimeRequire(sqliteClientEntry) as {
      PrismaClient: typeof PrismaClient;
    };
    return new sqliteModule.PrismaClient({
      datasources: {
        db: {
          url: resolvedUrl,
        },
      },
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: resolvedUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  schemaReadyPromise: Promise<void> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createActivePrismaClient();

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
    CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED_DEPOSIT_PAID', 'PURCHASED_AT_ORIGIN', 'IN_TRANSIT', 'RECEIVED_IN_WAREHOUSE', 'MEASUREMENTS_TAKEN', 'IN_PRODUCTION', 'READY_FOR_FITTING', 'FINAL_ADJUSTMENTS', 'READY_FOR_DELIVERY', 'COMPLETED', 'CANCELLED');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;`,
  `DO $$ BEGIN
    ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'MEASUREMENTS_TAKEN';
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'IN_PRODUCTION';
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_FITTING';
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'FINAL_ADJUSTMENTS';
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    CREATE TYPE "PaymentMethod" AS ENUM ('BINANCE_USDT', 'BANCOLOMBIA', 'NEQUI', 'CASH_USD', 'CASH_COP', 'PAGO_MOVIL_VES', 'ZINLI', 'OTHER');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;`,
  `DO $$ BEGIN
    ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CASH_COP';
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
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
  `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "documentId" TEXT;`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "businessType" TEXT DEFAULT 'IMPORT';`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fittingDate" TIMESTAMP(3);`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "estimatedDeliveryDate" TIMESTAMP(3);`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "measurements" JSONB;`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "statusHistory" JSONB;`,
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
    "serviceType" TEXT,
    "fabricDetails" TEXT,
    "measurements" JSONB,
    "sourceImageUrl" TEXT,
    "isPhysicallyVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "serviceType" TEXT;`,
  `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "fabricDetails" TEXT;`,
  `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "measurements" JSONB;`,
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

const SQLITE_BOOTSTRAP_STATEMENTS = [
  `PRAGMA foreign_keys = ON;`,
  `CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "defaultDepositPct" DECIMAL NOT NULL DEFAULT 50.00,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "settings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TENANT_OPERATOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "instagram" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "OrderBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purchaseDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN_FOR_ORDERS',
    "trackingRef" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL NOT NULL DEFAULT 0.00,
    "depositRequired" DECIMAL NOT NULL DEFAULT 0.00,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "depositAmountPaid" DECIMAL NOT NULL DEFAULT 0.00,
    "balanceDue" DECIMAL NOT NULL DEFAULT 0.00,
    "finalPaymentPaid" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "receiptImageUrl" TEXT,
    "finalPaymentMethod" TEXT,
    "finalPaymentRef" TEXT,
    "finalReceiptUrl" TEXT,
    "generalNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OrderBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalPrice" DECIMAL,
    "finalPrice" DECIMAL NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "size" TEXT,
    "color" TEXT,
    "modelVariant" TEXT,
    "verificationNotes" TEXT,
    "sourceImageUrl" TEXT,
    "isPhysicallyVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
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
 * Inicializa de forma idempotente el esquema de base de datos activo:
 * - En Vercel / PostgreSQL crea tipos ENUM, tablas, columnas e índices.
 * - En Desarrollo Local con SQLite crea tablas e índices y agrega la columna `currency` si faltara.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (!globalForPrisma.schemaReadyPromise) {
    globalForPrisma.schemaReadyPromise = (async () => {
      if (activeProvider === "postgresql") {
        for (const stmt of POSTGRES_BOOTSTRAP_STATEMENTS) {
          await prisma.$executeRawUnsafe(stmt);
        }
      } else {
        for (const stmt of SQLITE_BOOTSTRAP_STATEMENTS) {
          await prisma.$executeRawUnsafe(stmt);
        }

        const customerCols = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
          `PRAGMA table_info("Customer");`
        );
        const customerColNames = new Set(customerCols.map((c) => c.name));
        if (!customerColNames.has("documentId")) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "Customer" ADD COLUMN "documentId" TEXT;`
          );
        }
        const orderCols = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
          `PRAGMA table_info("Order");`
        );
        const orderColNames = new Set(orderCols.map((c) => c.name));
        if (!orderColNames.has("currency")) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "Order" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';`
          );
        }
        if (!orderColNames.has("businessType")) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "Order" ADD COLUMN "businessType" TEXT DEFAULT 'IMPORT';`
          );
        }
        if (!orderColNames.has("fittingDate")) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "Order" ADD COLUMN "fittingDate" DATETIME;`
          );
        }
        if (!orderColNames.has("estimatedDeliveryDate")) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "Order" ADD COLUMN "estimatedDeliveryDate" DATETIME;`
          );
        }
        if (!orderColNames.has("measurements")) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "Order" ADD COLUMN "measurements" TEXT;`
          );
        }
        if (!orderColNames.has("statusHistory")) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "Order" ADD COLUMN "statusHistory" TEXT;`
          );
        }

        const itemCols = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
          `PRAGMA table_info("OrderItem");`
        );
        const itemColNames = new Set(itemCols.map((c) => c.name));
        if (!itemColNames.has("serviceType")) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "OrderItem" ADD COLUMN "serviceType" TEXT;`
          );
        }
        if (!itemColNames.has("fabricDetails")) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "OrderItem" ADD COLUMN "fabricDetails" TEXT;`
          );
        }
        if (!itemColNames.has("measurements")) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "OrderItem" ADD COLUMN "measurements" TEXT;`
          );
        }
      }
    })().catch((err) => {
      globalForPrisma.schemaReadyPromise = undefined;
      throw err;
    });
  }
  return globalForPrisma.schemaReadyPromise;
}
