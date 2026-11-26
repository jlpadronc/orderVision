import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveActiveTenant } from "@/lib/tenantContext";
import { LandingPageView } from "@/components/landing/LandingPageView";

export const metadata: Metadata = {
  title: "OrderVision • Plataforma de Gestión de Pedidos, Lotes y Confección",
  description:
    "Controla pedidos por lotes de importación, cotizaciones en segundos con exportación PNG, fichas de medidas para ateliers, pagos multi-moneda (USD/COP/VES) y seguimiento en vivo con tu marca propia.",
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { sessionUser } = await resolveActiveTenant();

  // Si el usuario ya está autenticado, redirigir a su dashboard correspondiente
  if (sessionUser) {
    if (sessionUser.role === "SUPERADMIN") {
      redirect("/admin");
    }
    redirect("/");
  }

  // Únicamente visible cuando el usuario NO está logueado
  return <LandingPageView />;
}

