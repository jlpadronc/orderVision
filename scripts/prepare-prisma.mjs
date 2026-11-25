import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

/**
 * Carga variables de entorno desde .env si aún no existen en process.env
 * (mismo comportamiento base de Next.js / Prisma CLI).
 */
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

const args = process.argv.slice(2);
const shouldPush = args.includes("--push");
const shouldSeed = args.includes("--seed");
const targetArg = args.find((a) => a.startsWith("--target="))?.split("=")[1];

function isPostgresUrl(url) {
  return (
    typeof url === "string" &&
    (url.startsWith("postgres://") ||
      url.startsWith("postgresql://") ||
      url.startsWith("prisma+postgres://") ||
      url.startsWith("prisma://"))
  );
}

const postgresCandidates = [
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.POSTGRES_PRISMA_URL,
  process.env.PRISMA_DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.DATABASE_URL,
];

const validPostgresUrl = postgresCandidates.find((u) => isPostgresUrl(u));

let mode = "sqlite";
if (targetArg === "postgres") {
  mode = "postgres";
} else if (targetArg === "sqlite") {
  mode = "sqlite";
} else if (process.env.VERCEL || validPostgresUrl) {
  mode = "postgres";
}

if (mode === "postgres") {
  if (validPostgresUrl) {
    process.env.DATABASE_URL = validPostgresUrl.trim();
  } else if (!isPostgresUrl(process.env.DATABASE_URL)) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/ordervision?schema=public";
  }

  console.log("🐘 [DB] Modo PostgreSQL (Vercel / Repo) -> prisma/schema.prisma");
  execSync("npx prisma generate --schema=prisma/schema.prisma", {
    stdio: "inherit",
    env: process.env,
  });

  if (shouldPush) {
    execSync("npx prisma db push --schema=prisma/schema.prisma --accept-data-loss", {
      stdio: "inherit",
      env: process.env,
    });
  }
} else {
  const sqliteFilePath = path
    .resolve(process.cwd(), "prisma", "dev.db")
    .replace(/\\/g, "/");
  process.env.DATABASE_URL =
    process.env.DATABASE_URL?.startsWith("file:") &&
    process.env.DATABASE_URL !== "file:./dev.db"
      ? process.env.DATABASE_URL
      : `file:${sqliteFilePath}`;

  console.log(
    `🗄️ [DB] Modo Desarrollo Local SQLite (${sqliteFilePath}) -> prisma/schema.sqlite.prisma`
  );
  const sqliteClientDir = path.resolve(
    process.cwd(),
    "node_modules",
    ".prisma",
    "sqlite-client",
    "index.js"
  );
  if (!fs.existsSync(sqliteClientDir) || targetArg === "sqlite") {
    execSync("npx prisma generate --schema=prisma/schema.sqlite.prisma", {
      stdio: "inherit",
      env: process.env,
    });
  }

  if (shouldPush) {
    execSync(
      "npx prisma db push --schema=prisma/schema.sqlite.prisma --skip-generate",
      {
        stdio: "inherit",
        env: process.env,
      }
    );
  }
}

if (shouldSeed) {
  execSync("npx tsx prisma/seed.ts", {
    stdio: "inherit",
    env: process.env,
  });
}

