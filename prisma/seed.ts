import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Limpiando datos previos de la base de datos SQLite...");
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.orderBatch.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  console.log("🔐 Creando únicamente el usuario SuperAdmin de la plataforma...");
  const superAdmin = await prisma.user.create({
    data: {
      id: "usr-superadmin-01",
      tenantId: null,
      email: "superadmin@ordervision.app",
      passwordHash: "admin123",
      name: "Super Administrador",
      role: Role.SUPERADMIN,
    },
  });

  console.log("✅ Base de datos SQLite inicializada sin datos demo.");
  console.log(`   • Usuario SuperAdmin: ${superAdmin.email} (Password: admin123)`);
}

main()
  .catch((e) => {
    console.error("❌ Error inicializando la base de datos SQLite:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
