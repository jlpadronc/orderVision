import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function loadDotEnvIfPresent() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;
    const raw = fs.readFileSync(fullPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined || process.env[key] === "") {
        process.env[key] = val;
      }
    }
  }
}

loadDotEnvIfPresent();

function isPostgresUrl(url) {
  return (
    typeof url === "string" &&
    (url.startsWith("postgres://") ||
      url.startsWith("postgresql://") ||
      url.startsWith("prisma+postgres://") ||
      url.startsWith("prisma://"))
  );
}

const candidates = [
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.POSTGRES_PRISMA_URL,
  process.env.PRISMA_DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.DATABASE_URL,
];

const validPostgresUrl = candidates.find((u) => isPostgresUrl(u));
const usePostgres = Boolean(process.env.VERCEL || validPostgresUrl);

if (usePostgres) {
  if (validPostgresUrl) {
    process.env.DATABASE_URL = validPostgresUrl.trim();
  } else if (!isPostgresUrl(process.env.DATABASE_URL)) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/ordervision?schema=public";
  }

  console.log("🔧 [Build] Generando Prisma Client para PostgreSQL (prisma/schema.prisma)...");
  execSync("npx prisma generate --schema=prisma/schema.prisma", {
    stdio: "inherit",
    env: process.env,
  });

  const isRemotePostgres =
    Boolean(validPostgresUrl) &&
    !validPostgresUrl.includes("localhost") &&
    !validPostgresUrl.includes("127.0.0.1");

  if (process.env.VERCEL || isRemotePostgres) {
    try {
      console.log("🚀 [Vercel Build] Sincronizando esquema con la instancia PostgreSQL en Vercel...");
      execSync("npx prisma db push --schema=prisma/schema.prisma --accept-data-loss", {
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
} else {
  const sqliteFilePath = path
    .resolve(process.cwd(), "prisma", "dev.db")
    .replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${sqliteFilePath}`;

  console.log("🔧 [Local Build] Generando Prisma Client para SQLite Local (prisma/schema.sqlite.prisma)...");
  execSync("npx prisma generate --schema=prisma/schema.sqlite.prisma", {
    stdio: "inherit",
    env: process.env,
  });
  execSync("npx prisma db push --schema=prisma/schema.sqlite.prisma --skip-generate", {
    stdio: "inherit",
    env: process.env,
  });
  execSync("npx tsx prisma/seed.ts", {
    stdio: "inherit",
    env: process.env,
  });
}

console.log("🏗️ [Build] Compilando aplicación Next.js...");
execSync("npx next build", { stdio: "inherit", env: process.env });
