import React from "react";
import { requireTenantSession } from "@/lib/tenantContext";
import {
  listBatchesByTenant,
  listCustomersByTenant,
} from "@/lib/repositories/multiTenantRepository";
import { SmartCartBuilder } from "@/components/orders/SmartCartBuilder";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string }>;
}) {
  const { batchId } = await searchParams;
  const { activeTenant } = await requireTenantSession();
  const [customers, batches] = await Promise.all([
    listCustomersByTenant(activeTenant.id),
    listBatchesByTenant(activeTenant.id),
  ]);

  return (
    <SmartCartBuilder
      tenant={activeTenant}
      initialCustomers={customers}
      initialBatches={batches}
      preselectedBatchId={batchId ?? null}
    />
  );
}
