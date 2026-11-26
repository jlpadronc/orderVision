import React from "react";
import { redirect } from "next/navigation";
import { resolveActiveTenant } from "@/lib/tenantContext";
import {
  listBatchesByTenant,
  listCustomersByTenant,
  listOrdersByTenant,
} from "@/lib/repositories/multiTenantRepository";
import { BatchesDashboardClient } from "@/components/orders/BatchesDashboardClient";
import { LandingPageView } from "@/components/landing/LandingPageView";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { activeTenant, sessionUser } = await resolveActiveTenant();

  // Si el usuario ya está autenticado, NUNCA debe ver la landing page
  if (sessionUser) {
    if (sessionUser.role === "SUPERADMIN") {
      redirect("/admin");
    }

    if (activeTenant) {
      const [batches, allOrders, customers] = await Promise.all([
        listBatchesByTenant(activeTenant.id),
        listOrdersByTenant(activeTenant.id),
        listCustomersByTenant(activeTenant.id),
      ]);

      const unassignedOrders = allOrders.filter((o) => !o.batchId);

      return (
        <BatchesDashboardClient
          tenant={activeTenant}
          initialBatches={batches}
          unassignedOrders={unassignedOrders}
          initialCustomers={customers}
          userRole={sessionUser.role}
        />
      );
    }

    // Sesión huérfana o sin tenant válido
    redirect("/login");
  }

  // Si es un visitante público o usuario no autenticado, mostrar la Landing Page de OrderVision
  return <LandingPageView />;
}
