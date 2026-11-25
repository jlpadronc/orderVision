import type { Metadata, Viewport } from "next";
import "./globals.css";
import { resolveActiveTenant } from "@/lib/tenantContext";
import { DEFAULT_TENANT_THEME } from "@/lib/validations/schemas";
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
  const theme = activeTenant?.settings?.theme ?? DEFAULT_TENANT_THEME;
  const primaryColor = theme.primaryColor || "#e11d48";
  const secondaryColor = theme.secondaryColor || "#9333ea";
  const accentColor = theme.accentColor || primaryColor;

  return (
    <html lang="es">
      <head>
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var pref = localStorage.getItem('ordervision_theme_preference');
                  if (pref === 'dark' || pref === 'light') {
                    document.documentElement.setAttribute('data-theme', pref);
                  } else {
                    document.documentElement.removeAttribute('data-theme');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <style
          id="tenant-theme-variables"
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --brand-primary: ${primaryColor};
                --brand-secondary: ${secondaryColor};
                --brand-accent: ${accentColor};
                --brand-gradient: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased pb-20 md:pb-10 transition-colors duration-200">
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
