import React from "react";
import Link from "next/link";
import { requireTenantSession } from "@/lib/tenantContext";
import {
  getOrderByTenantAndId,
  listOrdersByTenant,
} from "@/lib/repositories/multiTenantRepository";
import { WarehouseVerifyChecklist } from "@/components/orders/WarehouseVerifyChecklist";

export const dynamic = "force-dynamic";

export default async function VerifyOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { activeTenant } = await requireTenantSession();

  const order = await getOrderByTenantAndId(activeTenant.id, id);

  if (!order) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center space-y-3">
        <h1 className="text-lg font-bold text-white">
          Pedido no encontrado en {activeTenant.name}
        </h1>
        <p className="text-xs text-slate-400">
          El pedido solicitado no existe o pertenece a otro negocio.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white"
        >
          Volver a Pedidos
        </Link>
      </div>
    );
  }

  const siblingBatchOrders = order.batchId
    ? await listOrdersByTenant(activeTenant.id, order.batchId)
    : [order];

  return (
    <WarehouseVerifyChecklist
      tenant={activeTenant}
      initialOrder={order}
      siblingBatchOrders={siblingBatchOrders}
    />
  );
}
