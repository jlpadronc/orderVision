"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Coins,
  Loader2,
  Save,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type {
  TenantRecord,
  UserRecord,
} from "@/lib/repositories/multiTenantRepository";
import type { RoleType } from "@/lib/validations/schemas";

interface TenantSettingsFormProps {
  tenant: TenantRecord;
  initialUsers: UserRecord[];
}

export function TenantSettingsForm({
  tenant,
  initialUsers,
}: TenantSettingsFormProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"CONFIG" | "USERS">("CONFIG");
  const [name, setName] = useState(tenant.name);
  const [currency, setCurrency] = useState<"USD" | "VES" | "COP">(
    (tenant.currency as "USD" | "VES" | "COP") || "USD"
  );
  const [defaultDepositPct, setDefaultDepositPct] = useState<number>(
    tenant.defaultDepositPct || 50
  );
  const [vesRate, setVesRate] = useState<number>(
    tenant.settings?.exchangeRates?.VES ?? 46.8
  );
  const [copRate, setCopRate] = useState<number>(
    tenant.settings?.exchangeRates?.COP ?? 4180
  );
  const [accounts, setAccounts] = useState(
    tenant.settings?.paymentAccounts ?? {}
  );
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Gestión de usuarios propios del Tenant
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("123456");
  const [newUserRole, setNewUserRole] = useState<RoleType>("TENANT_OPERATOR");
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    setName(tenant.name);
    setCurrency((tenant.currency as "USD" | "VES" | "COP") || "USD");
    setDefaultDepositPct(tenant.defaultDepositPct || 50);
    setVesRate(tenant.settings?.exchangeRates?.VES ?? 46.8);
    setCopRate(tenant.settings?.exchangeRates?.COP ?? 4180);
    setAccounts(tenant.settings?.paymentAccounts ?? {});
    setUsers(initialUsers);
  }, [tenant, initialUsers]);

  function handleAccountChange(
    key: string,
    field: "enabled" | "label" | "holder" | "identifier",
    value: boolean | string
  ) {
    setAccounts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {
          enabled: true,
          label: key,
          holder: tenant.name,
          identifier: "",
        }),
        [field]: value,
      },
    }));
  }

  async function handleSubmitConfig(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSavedToast(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          name,
          currency,
          defaultDepositPct: Number(defaultDepositPct),
          settings: {
            logoUrl: tenant.settings?.logoUrl ?? "/icons/ekita-logo.svg",
            features: tenant.settings?.features,
            exchangeRates: {
              USD: 1,
              VES: Number(vesRate),
              COP: Number(copRate),
            },
            paymentAccounts: accounts,
          },
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setSavedToast("Configuración guardada correctamente.");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTenantUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setUsers((prev) => [json.user, ...prev]);
        setNewUserName("");
        setNewUserEmail("");
        setSavedToast(`Usuario ${json.user.email} agregado a ${tenant.name}.`);
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

  const accountKeys = [
    { key: "BINANCE_USDT", defaultLabel: "Binance (USDT)" },
    { key: "PAGO_MOVIL_VES", defaultLabel: "Bolívares / Pago Móvil" },
    { key: "BANCOLOMBIA", defaultLabel: "Bancolombia" },
    { key: "NEQUI", defaultLabel: "Nequi Colombia" },
    { key: "CASH_USD", defaultLabel: "Efectivo USD" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h1 className="text-lg font-extrabold text-white">
            Ajustes del Negocio • {tenant.name}
          </h1>
          <p className="text-xs text-slate-400">
            Configura tasas de cambio, cuentas de cobro y operadores de tu tienda.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setTab("CONFIG")}
            className={`h-8 rounded-lg px-3 text-xs font-bold ${
              tab === "CONFIG"
                ? "bg-rose-500 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Tasas y Cuentas
          </button>
          <button
            type="button"
            onClick={() => setTab("USERS")}
            className={`h-8 rounded-lg px-3 text-xs font-bold ${
              tab === "USERS"
                ? "bg-rose-500 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Usuarios ({users.length})
          </button>
        </div>
      </div>

      {savedToast && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {savedToast}
        </div>
      )}

      {tab === "CONFIG" && (
        <form onSubmit={handleSubmitConfig} method="POST" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Tienda y Tasas */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-300">
                <Coins className="h-3.5 w-3.5" />
                Identidad, % de Seña y Tasas
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    Nombre Comercial
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-amber-300 font-semibold">
                    Moneda Principal del Negocio
                  </label>
                  <select
                    value={currency}
                    onChange={(e) =>
                      setCurrency(e.target.value as "USD" | "VES" | "COP")
                    }
                    className="w-full rounded-xl border border-amber-500/40 bg-slate-950 px-3 py-2 text-xs font-bold text-amber-200"
                  >
                    <option value="COP">
                      COP ($ Pesos Colombianos - Catálogo Shein)
                    </option>
                    <option value="USD">
                      USD ($ Dólares Estadounidenses)
                    </option>
                    <option value="VES">VES (Bs. Bolívares)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-emerald-300">
                    % Seña Inicial
                  </label>
                  <input
                    type="number"
                    value={defaultDepositPct}
                    onChange={(e) =>
                      setDefaultDepositPct(Number(e.target.value) || 50)
                    }
                    className="w-full rounded-xl border border-emerald-500/40 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-emerald-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-300">
                    Tasa COP / 1 USD
                  </label>
                  <input
                    type="number"
                    value={copRate}
                    onChange={(e) => setCopRate(Number(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-300">
                    Tasa VES / 1 USD
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={vesRate}
                    onChange={(e) => setVesRate(Number(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-rose-500 text-xs font-bold text-white hover:bg-rose-600"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar Ajustes
              </button>
            </section>

            {/* Cuentas Bancarias Compactas */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-purple-300">
                <Wallet className="h-3.5 w-3.5" />
                Cuentas para Comprobantes
              </div>

              {accountKeys.map(({ key, defaultLabel }) => {
                const acc = accounts[key] ?? {
                  enabled: true,
                  label: defaultLabel,
                  holder: tenant.name,
                  identifier: "",
                };

                return (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-rose-300">
                        {defaultLabel}
                      </span>
                      <input
                        type="checkbox"
                        checked={acc.enabled}
                        onChange={(e) =>
                          handleAccountChange(key, "enabled", e.target.checked)
                        }
                        className="h-3.5 w-3.5 accent-emerald-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        placeholder="Titular"
                        value={acc.holder}
                        onChange={(e) =>
                          handleAccountChange(key, "holder", e.target.value)
                        }
                        style={{ minHeight: "30px", fontSize: "0.75rem" }}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="Datos / Teléfono / Wallet"
                        value={acc.identifier}
                        onChange={(e) =>
                          handleAccountChange(key, "identifier", e.target.value)
                        }
                        style={{ minHeight: "30px", fontSize: "0.75rem" }}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
                      />
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        </form>
      )}

      {tab === "USERS" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <form
            onSubmit={handleCreateTenantUser}
            className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3 md:col-span-5"
          >
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-400">
              <UserPlus className="h-3.5 w-3.5" />
              Crear Usuario para {tenant.name}
            </h2>

            <div>
              <label className="mb-1 block text-xs text-slate-300">
                Nombre *
              </label>
              <input
                type="text"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-300">
                Email de Login *
              </label>
              <input
                type="email"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  Contraseña *
                </label>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Rol</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as RoleType)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"
                >
                  <option value="TENANT_OPERATOR">Operador</option>
                  <option value="TENANT_ADMIN">Admin Tienda</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingUser}
              className="h-9 w-full rounded-xl bg-emerald-500 text-xs font-bold text-slate-950"
            >
              {creatingUser ? "Creando..." : "Agregar Usuario"}
            </button>
          </form>

          <div className="space-y-2 md:col-span-7">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400">
              <Users className="h-3.5 w-3.5" />
              Usuarios Activos en {tenant.name}
            </h2>
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5"
              >
                <div>
                  <p className="text-xs font-bold text-white">
                    {u.name}{" "}
                    <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-rose-300">
                      {u.role}
                    </span>
                  </p>
                  <p className="font-mono text-[11px] text-slate-400">
                    {u.email}
                  </p>
                </div>
                {u.role !== "SUPERADMIN" && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
