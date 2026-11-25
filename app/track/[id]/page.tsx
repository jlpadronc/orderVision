import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicOrderTrackRecord } from "@/lib/repositories/multiTenantRepository";
import { OrderTrackingClientView } from "./OrderTrackingClientView";

interface TrackPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: TrackPageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await getPublicOrderTrackRecord(id);
  if (!order) {
    return {
      title: "Seguimiento de Pedido • OrderVision",
    };
  }
  return {
    title: `Estado de Pedido #${order.id} • ${order.tenant.name}`,
    description: `Consulta el avance y estado de tu pedido en ${order.tenant.name}`,
  };
}

export default async function TrackOrderPage({ params }: TrackPageProps) {
  const { id } = await params;
  const order = await getPublicOrderTrackRecord(id);

  if (!order) {
    notFound();
  }

  return <OrderTrackingClientView order={order} />;
}
