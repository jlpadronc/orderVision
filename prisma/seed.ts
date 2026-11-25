import {
  ensureDatabaseSchema,
  getActiveDatabaseProvider,
  prisma,
} from "../lib/prisma";

async function main() {
  const provider = getActiveDatabaseProvider();
  const label =
    provider === "postgresql"
      ? "PostgreSQL (Vercel)"
      : "SQLite Local (prisma/dev.db)";
  console.log(`🔌 Conectando a ${label} y verificando esquema...`);
  await ensureDatabaseSchema();

  console.log("🔐 Verificando/creando usuario SuperAdmin de la plataforma...");
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@ordervision.app" },
    update: {
      role: "SUPERADMIN",
    },
    create: {
      id: "usr-superadmin-01",
      tenantId: null,
      email: "superadmin@ordervision.app",
      passwordHash: "admin123",
      name: "Super Administrador",
      role: "SUPERADMIN",
    },
  });

  console.log(`✅ Base de datos ${label} lista.`);
  console.log(`   • Usuario SuperAdmin: ${superAdmin.email} (Password: admin123)`);
}

main()
  .catch((e) => {
    console.error("❌ Error inicializando base de datos:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
