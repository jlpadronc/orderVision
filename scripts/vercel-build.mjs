import { execSync } from "node:child_process";

const candidates = [
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.POSTGRES_PRISMA_URL,
  process.env.DATABASE_URL,
  process.env.PRISMA_DATABASE_URL,
  process.env.POSTGRES_URL,
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
} else if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@localhost:5432/ordervision?schema=public";
}

console.log("🔧 [Vercel Build] Generando Prisma Client para PostgreSQL...");
execSync("npx prisma generate", { stdio: "inherit", env: process.env });

const isRemotePostgres =
  Boolean(validPostgresUrl) &&
  !validPostgresUrl.includes("localhost") &&
  !validPostgresUrl.includes("127.0.0.1");

if (process.env.VERCEL || isRemotePostgres) {
  try {
    console.log("🚀 [Vercel Build] Sincronizando esquema con la instancia PostgreSQL en Vercel...");
    execSync("npx prisma db push --accept-data-loss", {
      stdio: "inherit",
      env: process.env,
    });
    console.log("🔐 [Vercel Build] Asegurando usuario SuperAdmin en PostgreSQL...");
    execSync("npx tsx prisma/seed.ts", {
      stdio: "inherit",
      env: process.env,
    });
  } catch (err) {
    console.warn(
      "⚠️ [Vercel Build] Aviso al sincronizar durante build (se completará automáticamente en runtime):",
      err?.message || err
    );
  }
}

console.log("🏗️ [Vercel Build] Compilando aplicación Next.js...");
execSync("npx next build", { stdio: "inherit", env: process.env });

