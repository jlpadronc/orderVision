import React from "react";
import type { Metadata } from "next";
import { LandingPageView } from "@/components/landing/LandingPageView";

export const metadata: Metadata = {
  title: "OrderVision • Plataforma de Gestión de Pedidos, Lotes y Confección",
  description:
    "Controla pedidos por lotes de importación, cotizaciones en segundos con exportación PNG, fichas de medidas para ateliers, pagos multi-moneda (USD/COP/VES) y seguimiento en vivo con tu marca propia.",
};

export default function LandingPage() {
  return <LandingPageView />;
}
