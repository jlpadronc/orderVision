import type { Metadata, Viewport } from "next";
import "./globals.css";
import { resolveActiveTenant } from "@/lib/tenantContext";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { BottomNavDock } from "@/components/layout/BottomNavDock";

export const metadata: Metadata = {
  title: "OrderVision • Gestión Multi-Tenant de Pedidos e Importación",
  description:
    "Plataforma minimalista y adaptable (Desktop y Mobile) para tiendas de encargos con lotes por fecha, exportación de cotizaciones y cotejo de almacén.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090d16",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { activeTenant, sessionUser } = await resolveActiveTenant();

  return (
    <html lang="es">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased pb-20 md:pb-10">
        <MobileHeader
          activeTenant={activeTenant}
          sessionUser={sessionUser}
        />
        <main className="mx-auto max-w-6xl px-3 pt-4 pb-20 sm:px-6 md:pt-6">
          {children}
        </main>
        <BottomNavDock sessionUser={sessionUser} />
      </body>
    </html>
  );
}
