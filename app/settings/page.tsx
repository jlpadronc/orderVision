import React from "react";
import { requireTenantSession } from "@/lib/tenantContext";
import { listUsers } from "@/lib/repositories/multiTenantRepository";
import { TenantSettingsForm } from "@/components/settings/TenantSettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { activeTenant } = await requireTenantSession();
  const users = await listUsers(activeTenant.id);

  return <TenantSettingsForm tenant={activeTenant} initialUsers={users} />;
}
