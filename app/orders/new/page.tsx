import React from "react";
import { requireTenantSession } from "@/lib/tenantContext";
import {
  listBatchesByTenant,
  listCustomersByTenant,
  listOrdersByTenant,
} from "@/lib/repositories/multiTenantRepository";
import { SmartCartBuilder } from "@/components/orders/SmartCartBuilder";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string }>;
}) {
  const { batchId } = await searchParams;
  const { activeTenant, sessionUser } = await requireTenantSession();
  const [customers, batches, orders] = await Promise.all([
    listCustomersByTenant(activeTenant.id),
    listBatchesByTenant(activeTenant.id),
    listOrdersByTenant(activeTenant.id),
  ]);

  return (
    <SmartCartBuilder
      tenant={activeTenant}
      initialCustomers={customers}
      initialBatches={batches}
      existingOrderIds={orders.map((o) => o.id)}
      preselectedBatchId={batchId ?? null}
      userRole={sessionUser.role}
    />
  );
}
