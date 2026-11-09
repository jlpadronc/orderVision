import { PrismaClient, Role } from "@prisma/client";
import { ensureDatabaseSchema, resolvePostgresDatabaseUrl } from "../lib/prisma";

resolvePostgresDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  console.log("🔌 Conectando a PostgreSQL y verificando esquema...");
  await ensureDatabaseSchema();

  console.log("🔐 Verificando/creando usuario SuperAdmin de la plataforma...");
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@ordervision.app" },
    update: {
      role: Role.SUPERADMIN,
    },
    create: {
      id: "usr-superadmin-01",
      tenantId: null,
      email: "superadmin@ordervision.app",
      passwordHash: "admin123",
      name: "Super Administrador",
      role: Role.SUPERADMIN,
    },
  });

  console.log("✅ Base de datos PostgreSQL lista.");
  console.log(`   • Usuario SuperAdmin: ${superAdmin.email} (Password: admin123)`);
}

main()
  .catch((e) => {
    console.error("❌ Error inicializando PostgreSQL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
