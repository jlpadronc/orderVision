"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
} from "lucide-react";
import type { UserRecord } from "@/lib/repositories/multiTenantRepository";

const TENANT_NAV_ITEMS = [
  {
    href: "/",
    label: "Inicio",
    icon: LayoutDashboard,
  },
  {
    href: "/orders/new",
    label: "Nuevo Pedido",
    icon: PlusCircle,
  },
  {
    href: "/settings",
    label: "Mi Negocio",
    icon: Settings,
  },
];

interface BottomNavDockProps {
  sessionUser: UserRecord | null;
}

export function BottomNavDock({ sessionUser }: BottomNavDockProps) {
  const pathname = usePathname();

  // Solo mostrar el dock inferior cuando hay un usuario de Tenant autenticado
  if (!sessionUser || sessionUser.role === "SUPERADMIN") {
    return null;
  }

  return (
    <nav
      aria-label="Navegación inferior móvil"
      className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-800/90 bg-slate-950/95 backdrop-blur-lg md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-3 px-2 py-1">
        {TENANT_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? "text-rose-400 bg-rose-500/10"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
