"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Plus,
  Power,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type {
  TenantRecord,
  UserRecord,
} from "@/lib/repositories/multiTenantRepository";
import {
  DEFAULT_FEATURES,
  type RoleType,
  type TenantFeatures,
} from "@/lib/validations/schemas";

interface SuperAdminPanelProps {
  initialTenants: TenantRecord[];
  initialUsers: UserRecord[];
}

export function SuperAdminPanel({
  initialTenants,
  initialUsers,
}: SuperAdminPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"TENANTS" | "USERS">("TENANTS");
  const [tenants, setTenants] = useState<TenantRecord[]>(initialTenants);
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string>("ALL");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Modal Crear Negocio (Tenant)
  const newTenantDialogRef = useRef<HTMLDialogElement | null>(null);
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantCurrency, setTenantCurrency] = useState<"USD" | "VES" | "COP">("USD");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("123456");
  const [creatingTenant, setCreatingTenant] = useState(false);

  // Modal Crear Usuario para un Tenant
  const newUserDialogRef = useRef<HTMLDialogElement | null>(null);
  const [userTenantId, setUserTenantId] = useState<string>(
    initialTenants[0]?.id ?? ""
  );
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("123456");
  const [userRole, setUserRole] = useState<RoleType>("TENANT_OPERATOR");
  const [creatingUser, setCreatingUser] = useState(false);

  async function handleToggleTenantService(tenant: TenantRecord) {
    const nextActive = !tenant.active;
    const res = await fetch("/api/admin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        active: nextActive,
      }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      setTenants((prev) =>
        prev.map((t) => (t.id === tenant.id ? json.tenant : t))
      );
      setStatusMessage(
        `Servicio de "${tenant.name}" ${
          nextActive ? "ACTIVADO" : "SUSPENDIDO"
        } correctamente.`
      );
      router.refresh();
    }
  }

  async function handleToggleFeature(
    tenant: TenantRecord,
    featureKey: keyof TenantFeatures
  ) {
    const currentFeatures = tenant.settings?.features ?? DEFAULT_FEATURES;
    const nextValue = !currentFeatures[featureKey];

    const res = await fetch("/api/admin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        features: {
          [featureKey]: nextValue,
        },
      }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      setTenants((prev) =>
        prev.map((t) => (t.id === tenant.id ? json.tenant : t))
      );
      router.refresh();
    }
  }

  async function handleCreateTenant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreatingTenant(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tenantName,
          slug: tenantSlug.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
          currency: tenantCurrency,
          defaultDepositPct: 50,
          adminName,
          adminEmail,
          adminPassword,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setTenants((prev) => [...prev, json.tenant]);
        if (!userTenantId) {
          setUserTenantId(json.tenant.id);
        }
        if (json.users) setUsers(json.users);
        setTenantName("");
        setTenantSlug("");
        setAdminName("");
        setAdminEmail("");
        newTenantDialogRef.current?.close();
        setStatusMessage(`Negocio "${json.tenant.name}" registrado con éxito.`);
        router.refresh();
      }
    } finally {
      setCreatingTenant(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: userTenantId,
          name: userName,
          email: userEmail,
          password: userPassword,
          role: userRole,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setUsers((prev) => [json.user, ...prev]);
        setUserName("");
        setUserEmail("");
        newUserDialogRef.current?.close();
        setStatusMessage(`Usuario "${json.user.email}" creado correctamente.`);
      }
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    const res = await fetch(`/api/users?id=${userId}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    }
  }

  async function handleInspectTenant(tenantId: string) {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    router.push("/");
    router.refresh();
  }

  const filteredUsers =
    selectedTenantFilter === "ALL"
      ? users
      : users.filter((u) => u.tenantId === selectedTenantFilter);

  return (
    <div className="space-y-5">
      {/* Cabecera minimalista del Dueño SaaS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-rose-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            Panel de Control SaaS • Dueño de la App
          </span>
          <h1 className="text-xl font-extrabold text-white">
            Administración de Negocios (Tenants) y Usuarios
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => newTenantDialogRef.current?.showModal()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 text-xs font-bold text-white hover:bg-rose-600"
          >
            <Plus className="h-4 w-4" />
            Registrar Negocio
          </button>
          <button
            type="button"
            onClick={() => newUserDialogRef.current?.showModal()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 text-xs font-bold text-slate-200 hover:bg-slate-800"
          >
            <UserPlus className="h-4 w-4 text-emerald-400" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-200"
        >
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {statusMessage}
          </span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Pestañas: Negocios vs Usuarios */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("TENANTS")}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition-colors ${
            activeTab === "TENANTS"
              ? "bg-rose-500 text-white"
              : "bg-slate-900 text-slate-400 hover:text-white"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          Negocios / Tenants ({tenants.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("USERS")}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition-colors ${
            activeTab === "USERS"
              ? "bg-rose-500 text-white"
              : "bg-slate-900 text-slate-400 hover:text-white"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Usuarios de Tiendas ({users.length})
        </button>
      </div>

      {/* TAB 1: Listado de Negocios y Activación de Módulos/Servicio */}
      {activeTab === "TENANTS" && (
        tenants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center space-y-3">
            <Building2 className="mx-auto h-9 w-9 text-slate-600" />
            <h2 className="text-base font-bold text-white">
              Aún no hay negocios (Tenants) registrados
            </h2>
            <p className="mx-auto max-w-md text-xs text-slate-400">
              Registra el primer negocio junto con su usuario administrador para que pueda iniciar sesión y gestionar sus pedidos de forma aislada.
            </p>
            <button
              type="button"
              onClick={() => newTenantDialogRef.current?.showModal()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-500 px-4 text-xs font-bold text-white hover:bg-rose-600"
            >
              <Plus className="h-4 w-4" />
              Registrar Primer Negocio
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tenants.map((tenant) => {
            const features = tenant.settings?.features ?? DEFAULT_FEATURES;

            return (
              <article
                key={tenant.id}
                className={`rounded-2xl border p-4 transition-all ${
                  tenant.active
                    ? "border-slate-800 bg-slate-900/85"
                    : "border-rose-500/40 bg-rose-950/15"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-white">
                        {tenant.name}
                      </h2>
                      <span className="font-mono text-xs text-slate-400">
                        /{tenant.slug}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          tenant.active
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {tenant.active ? "Servicio Activo" : "Suspendido"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {tenant.stats?.ordersCount ?? 0} pedidos •{" "}
                      {tenant.stats?.batchesCount ?? 0} lotes •{" "}
                      {tenant.stats?.customersCount ?? 0} clientes •{" "}
                      {tenant.stats?.usersCount ?? 0} usuarios
                    </p>
                  </div>

                  {/* Botón maestro para Activar / Suspender el servicio general del Tenant */}
                  <button
                    type="button"
                    onClick={() => handleToggleTenantService(tenant)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors ${
                      tenant.active
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                        : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {tenant.active ? "Suspender" : "Activar"}
                  </button>
                </div>

                {/* Interruptores de Funciones por Tenant */}
                <div className="mt-3.5 border-t border-slate-800/80 pt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Funciones Habilitadas para {tenant.name}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[
                      {
                        key: "whatsappButton" as const,
                        label: "Botón WhatsApp",
                      },
                      {
                        key: "quoteExport" as const,
                        label: "Cotización PNG",
                      },
                      {
                        key: "warehouseVerify" as const,
                        label: "Cotejo Almacén",
                      },
                    ].map((feat) => (
                      <label
                        key={feat.key}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 text-xs"
                      >
                        <span className="text-slate-200">{feat.label}</span>
                        <input
                          type="checkbox"
                          checked={features[feat.key]}
                          onChange={() => handleToggleFeature(tenant, feat.key)}
                          className="h-4 w-4 accent-emerald-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setUserTenantId(tenant.id);
                      newUserDialogRef.current?.showModal();
                    }}
                    className="text-xs font-semibold text-emerald-400 hover:underline"
                  >
                    + Agregar usuario a {tenant.name}
                  </button>

                  <span className="text-[11px] text-slate-500">
                    Acceso aislado vía credenciales de tienda
                  </span>
                </div>
              </article>
            );
          })}
        </div>
        )
      )}

      {/* TAB 2: Gestión de Usuarios por Tenant */}
      {activeTab === "USERS" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label
                htmlFor="filter-users-tenant"
                className="text-xs font-semibold text-slate-400"
              >
                Filtrar por Negocio:
              </label>
              <select
                id="filter-users-tenant"
                value={selectedTenantFilter}
                onChange={(e) => setSelectedTenantFilter(e.target.value)}
                style={{ minHeight: "34px", fontSize: "0.75rem" }}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
              >
                <option value="ALL">Todos los negocios</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{u.name}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                      {u.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {u.email} •{" "}
                    <strong className="text-slate-200">{u.tenantName}</strong>
                  </p>
                </div>

                {u.role !== "SUPERADMIN" && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u.id)}
                    aria-label={`Eliminar usuario ${u.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Registrar Nuevo Negocio (Tenant) */}
      <dialog
        ref={newTenantDialogRef}
        aria-labelledby="modal-new-tenant-title"
        className="m-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 id="modal-new-tenant-title" className="text-sm font-bold text-white">
            Registrar Nuevo Negocio (Tenant)
          </h3>
          <button
            type="button"
            onClick={() => newTenantDialogRef.current?.close()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreateTenant} method="POST" className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="new-tenant-name"
                className="mb-1 block text-xs font-semibold text-slate-300"
              >
                Nombre del Negocio *
              </label>
              <input
                id="new-tenant-name"
                type="text"
                required
                placeholder="Ej. Valencia Box"
                value={tenantName}
                onChange={(e) => {
                  setTenantName(e.target.value);
                  setTenantSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")
                  );
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label
                htmlFor="new-tenant-slug"
                className="mb-1 block text-xs font-semibold text-slate-300"
              >
                Identificador (Slug) *
              </label>
              <input
                id="new-tenant-slug"
                type="text"
                required
                placeholder="valencia-box"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <p className="mb-2 text-xs font-bold text-emerald-400">
              Usuario Administrador Inicial del Negocio
            </p>
            <div className="space-y-2.5">
              <div>
                <label
                  htmlFor="new-tenant-admin-name"
                  className="mb-1 block text-xs text-slate-300"
                >
                  Nombre del encargado
                </label>
                <input
                  id="new-tenant-admin-name"
                  type="text"
                  placeholder="Ej. Mariana Silva"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="new-tenant-admin-email"
                    className="mb-1 block text-xs text-slate-300"
                  >
                    Email de acceso
                  </label>
                  <input
                    id="new-tenant-admin-email"
                    type="email"
                    placeholder="admin@valenciabox.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-tenant-admin-pass"
                    className="mb-1 block text-xs text-slate-300"
                  >
                    Contraseña
                  </label>
                  <input
                    id="new-tenant-admin-pass"
                    type="text"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => newTenantDialogRef.current?.close()}
              className="h-9 rounded-xl border border-slate-700 px-3.5 text-xs text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creatingTenant}
              className="h-9 rounded-xl bg-rose-500 px-4 text-xs font-bold text-white"
            >
              {creatingTenant ? "Creando..." : "Crear Negocio"}
            </button>
          </div>
        </form>
      </dialog>

      {/* Modal: Crear Usuario para un Negocio */}
      <dialog
        ref={newUserDialogRef}
        aria-labelledby="modal-new-user-title"
        className="m-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 id="modal-new-user-title" className="text-sm font-bold text-white">
            Asignar Nuevo Usuario a Tienda
          </h3>
          <button
            type="button"
            onClick={() => newUserDialogRef.current?.close()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreateUser} method="POST" className="space-y-3 p-4">
          <div>
            <label
              htmlFor="modal-user-tenant"
              className="mb-1 block text-xs font-semibold text-slate-300"
            >
              Negocio (Tenant) *
            </label>
            <select
              id="modal-user-tenant"
              value={userTenantId}
              onChange={(e) => setUserTenantId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="modal-user-name"
                className="mb-1 block text-xs font-semibold text-slate-300"
              >
                Nombre *
              </label>
              <input
                id="modal-user-name"
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label
                htmlFor="modal-user-role"
                className="mb-1 block text-xs font-semibold text-slate-300"
              >
                Rol *
              </label>
              <select
                id="modal-user-role"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as RoleType)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="TENANT_ADMIN">Administrador Tienda</option>
                <option value="TENANT_OPERATOR">Operador / Vendedor</option>
                <option value="SUPERADMIN">SuperAdmin SaaS</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="modal-user-email"
                className="mb-1 block text-xs font-semibold text-slate-300"
              >
                Email *
              </label>
              <input
                id="modal-user-email"
                type="email"
                required
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label
                htmlFor="modal-user-password"
                className="mb-1 block text-xs font-semibold text-slate-300"
              >
                Contraseña *
              </label>
              <input
                id="modal-user-password"
                type="text"
                required
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => newUserDialogRef.current?.close()}
              className="h-9 rounded-xl border border-slate-700 px-3.5 text-xs text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creatingUser}
              className="h-9 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-slate-950"
            >
              {creatingUser ? "Guardando..." : "Guardar Usuario"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
