import React from "react";
import { requireTenantSession } from "@/lib/tenantContext";
import {
  listBatchesByTenant,
  listOrdersByTenant,
} from "@/lib/repositories/multiTenantRepository";
import { BatchesDashboardClient } from "@/components/orders/BatchesDashboardClient";

export const dynamic = "force-dynamic";

export default async function HomeOrdersDashboard() {
  const { activeTenant } = await requireTenantSession();
  const [batches, allOrders] = await Promise.all([
    listBatchesByTenant(activeTenant.id),
    listOrdersByTenant(activeTenant.id),
  ]);

  const unassignedOrders = allOrders.filter((o) => !o.batchId);

  return (
    <BatchesDashboardClient
      tenant={activeTenant}
      initialBatches={batches}
      unassignedOrders={unassignedOrders}
    />
  );
}
