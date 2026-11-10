"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Settings,
  ShieldAlert,
} from "lucide-react";
import type {
  TenantRecord,
  UserRecord,
} from "@/lib/repositories/multiTenantRepository";

interface MobileHeaderProps {
  activeTenant: TenantRecord | null;
  sessionUser: UserRecord | null;
}

export function MobileHeader({
  activeTenant,
  sessionUser,
}: MobileHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  // Vista sin sesión (pantalla de /login)
  if (!sessionUser) {
    return (
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-purple-600 text-xs font-extrabold text-white">
              OV
            </div>
            <div>
              <span className="text-sm font-bold text-white">OrderVision</span>
              <p className="text-[11px] text-slate-400">
                Plataforma Multi-Tenant de Gestión de Pedidos
              </p>
            </div>
          </div>
        </div>
      </header>
    );
  }

  const isSuperAdmin = sessionUser.role === "SUPERADMIN";
  const vesRate = activeTenant?.settings?.exchangeRates?.VES ?? 46.8;
  const copRate = activeTenant?.settings?.exchangeRates?.COP ?? 4180;
  const baseCurrency = activeTenant?.currency ?? "USD";

  const tenantDesktopLinks = [
    { href: "/", label: "Inicio", icon: LayoutDashboard },
    { href: "/orders/new", label: "Nuevo Pedido", icon: PlusCircle },
    { href: "/settings", label: "Mi Negocio", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:px-6">
        {/* Identidad del Negocio Autenticado o SuperAdmin */}
        <div className="flex items-center gap-2.5">
          <Link
            href={isSuperAdmin ? "/admin" : "/"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-purple-600 text-xs font-extrabold text-white"
          >
            {isSuperAdmin
              ? "SA"
              : (activeTenant?.name.slice(0, 2).toUpperCase() ?? "OV")}
          </Link>

          <div>
            <div className="flex items-center gap-1.5">
              {isSuperAdmin ? (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                  <span className="text-sm font-bold text-white">
                    Panel SuperAdmin SaaS
                  </span>
                </>
              ) : (
                <>
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-sm font-bold text-white">
                    {activeTenant?.name ?? "Negocio"}
                  </span>
                </>
              )}
              {activeTenant && !activeTenant.active && (
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">
                  Inactivo
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {isSuperAdmin
                ? "Administración global de negocios y accesos"
                : `${sessionUser.name} • Base: ${baseCurrency} • 1 USD = $${copRate.toLocaleString("es-CO")} COP / Bs.${vesRate}`}
            </p>
          </div>
        </div>

        {/* Navegación Desktop */}
        {!isSuperAdmin && (
          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-1"
          >
            {tenantDesktopLinks.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Usuario autenticado + Cerrar Sesión */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-200 leading-none">
              {sessionUser.name}
            </span>
            <span className="text-[10px] text-slate-400">
              {sessionUser.role === "SUPERADMIN"
                ? "SuperAdmin"
                : sessionUser.role === "TENANT_ADMIN"
                ? "Admin Tienda"
                : "Operador"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Cerrar sesión"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-rose-500/40 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
