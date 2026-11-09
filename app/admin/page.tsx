import React from "react";
import { requireSuperAdminSession } from "@/lib/tenantContext";
import { listTenants, listUsers } from "@/lib/repositories/multiTenantRepository";
import { SuperAdminPanel } from "@/components/admin/SuperAdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireSuperAdminSession();
  const [tenants, users] = await Promise.all([listTenants(true), listUsers()]);

  return <SuperAdminPanel initialTenants={tenants} initialUsers={users} />;
}
