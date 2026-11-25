"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  CheckCircle2,
  Coins,
  Eye,
  Image,
  Loader2,
  MessageCircle,
  Palette,
  Phone,
  Save,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type {
  TenantRecord,
  UserRecord,
} from "@/lib/repositories/multiTenantRepository";
import { DEFAULT_FEATURES, DEFAULT_WHATSAPP_CONFIG, type RoleType } from "@/lib/validations/schemas";

interface TenantSettingsFormProps {
  tenant: TenantRecord;
  initialUsers: UserRecord[];
}

const PALETTE_PRESETS = [
  {
    id: "ROSE",
    name: "Rosa Chic",
    subtitle: "Boutique & Lencería",
    primary: "#e11d48",
    secondary: "#db2777",
  },
  {
    id: "PURPLE",
    name: "Atelier Púrpura",
    subtitle: "Alta Costura & Sastrería",
    primary: "#7c3aed",
    secondary: "#9333ea",
  },
  {
    id: "EMERALD",
    name: "Esmeralda & Oro",
    subtitle: "Elegancia & Prestigio",
    primary: "#059669",
    secondary: "#d97706",
  },
  {
    id: "OCEAN",
    name: "Zafiro & Océano",
    subtitle: "Deportivo & Moderno",
    primary: "#2563eb",
    secondary: "#0284c7",
  },
  {
    id: "AMBER",
    name: "Ámbar & Terracota",
    subtitle: "Cálido & Artesanal",
    primary: "#d97706",
    secondary: "#ea580c",
  },
  {
    id: "DARK",
    name: "Carbón & Plata",
    subtitle: "Minimalismo & Sobriedad",
    primary: "#0f172a",
    secondary: "#475569",
  },
];

export function TenantSettingsForm({
  tenant,
  initialUsers,
}: TenantSettingsFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<"CONFIG" | "USERS">("CONFIG");
  const [name, setName] = useState(tenant.name);
  const [businessType, setBusinessType] = useState<"IMPORT" | "TAILORING" | "HYBRID">(
    tenant.settings?.businessType || "IMPORT"
  );
  const [logoUrl, setLogoUrl] = useState(tenant.settings?.logoUrl || "");
  const [primaryColor, setPrimaryColor] = useState(
    tenant.settings?.theme?.primaryColor || "#e11d48"
  );
  const [secondaryColor, setSecondaryColor] = useState(
    tenant.settings?.theme?.secondaryColor || "#9333ea"
  );
  const [palettePreset, setPalettePreset] = useState(
    tenant.settings?.theme?.preset || "ROSE"
  );
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [currency, setCurrency] = useState<"USD" | "VES" | "COP">(
    (tenant.currency as "USD" | "VES" | "COP") || "USD"
  );
  const [defaultDepositPct, setDefaultDepositPct] = useState<number | string>(
    tenant.defaultDepositPct ?? 50
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
  // Configuración del Canal y Botón de WhatsApp
  const [waEnabled, setWaEnabled] = useState<boolean>(
    tenant.settings?.whatsappConfig?.enabled ??
      (tenant.settings?.features?.whatsappButton ?? true)
  );
  const [waPhone, setWaPhone] = useState<string>(
    tenant.settings?.whatsappConfig?.phoneNumber ?? ""
  );
  const [waButtonText, setWaButtonText] = useState<string>(
    tenant.settings?.whatsappConfig?.buttonText || "Contactar por WhatsApp"
  );
  const [waMessage, setWaMessage] = useState<string>(
    tenant.settings?.whatsappConfig?.customMessage ||
      "Hola {negocio}, quisiera consultar información sobre mi pedido #{pedido}. Enlace de seguimiento: {link}"
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
    setBusinessType(tenant.settings?.businessType || "IMPORT");
    setLogoUrl(tenant.settings?.logoUrl || "");
    setPrimaryColor(tenant.settings?.theme?.primaryColor || "#e11d48");
    setSecondaryColor(tenant.settings?.theme?.secondaryColor || "#9333ea");
    setPalettePreset(tenant.settings?.theme?.preset || "ROSE");
    setCurrency((tenant.currency as "USD" | "VES" | "COP") || "USD");
    setDefaultDepositPct(tenant.defaultDepositPct ?? 50);
    setVesRate(tenant.settings?.exchangeRates?.VES ?? 46.8);
    setCopRate(tenant.settings?.exchangeRates?.COP ?? 4180);
    setAccounts(tenant.settings?.paymentAccounts ?? {});
    setWaEnabled(
      tenant.settings?.whatsappConfig?.enabled ??
        (tenant.settings?.features?.whatsappButton ?? true)
    );
    setWaPhone(tenant.settings?.whatsappConfig?.phoneNumber ?? "");
    setWaButtonText(
      tenant.settings?.whatsappConfig?.buttonText || "Contactar por WhatsApp"
    );
    setWaMessage(
      tenant.settings?.whatsappConfig?.customMessage ||
        "Hola {negocio}, quisiera consultar información sobre mi pedido #{pedido}. Enlace de seguimiento: {link}"
    );
    setUsers(initialUsers);
  }, [tenant, initialUsers]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "logos");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.ok && data.asset?.url) {
        setLogoUrl(data.asset.url);
      } else {
        window.alert(data.error || "Error al subir la imagen del logo.");
      }
    } catch {
      window.alert("Error de conexión al subir el logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  function handleSelectPreset(p: (typeof PALETTE_PRESETS)[0]) {
    setPalettePreset(p.id);
    setPrimaryColor(p.primary);
    setSecondaryColor(p.secondary);
  }

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
          defaultDepositPct: Number.isNaN(Number(defaultDepositPct))
            ? 50
            : Number(defaultDepositPct),
          settings: {
            businessType,
            logoUrl: logoUrl.trim() || null,
            theme: {
              primaryColor,
              secondaryColor,
              accentColor: primaryColor,
              preset: palettePreset,
            },
            features: {
              ...(tenant.settings?.features || DEFAULT_FEATURES),
              whatsappButton: waEnabled,
            },
            whatsappConfig: {
              enabled: waEnabled,
              phoneNumber: waPhone.trim() || null,
              buttonText: waButtonText.trim() || "Contactar por WhatsApp",
              customMessage: waMessage.trim() || null,
            },
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
    { key: "CASH_COP", defaultLabel: "Efectivo COP" },
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
                Identidad, Modelo de Negocio y Tasas
              </div>

              <div>
                <label className="mb-1 block text-xs text-fuchsia-300 font-semibold">
                  Modelo o Giro de Negocio
                </label>
                <select
                  value={businessType}
                  onChange={(e) =>
                    setBusinessType(
                      e.target.value as "IMPORT" | "TAILORING" | "HYBRID"
                    )
                  }
                  className="w-full rounded-xl border border-fuchsia-500/40 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                >
                  <option value="IMPORT">
                    📦 Tienda de Importación / E-Commerce (Shein, compras internacionales y lotes)
                  </option>
                  <option value="TAILORING">
                    ✂️ Taller de Costura y Ropa a Medida (Fittings, pruebas, avances y confección)
                  </option>
                  <option value="HYBRID">
                    ✨ Boutique Híbrida (Importación de ropa y taller de confección)
                  </option>
                </select>
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-emerald-300">
                      % Seña Inicial
                    </label>
                    <span className="text-[10px] font-bold text-emerald-400">
                      {defaultDepositPct}%
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={defaultDepositPct}
                    onChange={(e) => setDefaultDepositPct(e.target.value)}
                    placeholder="50"
                    className="w-full rounded-xl border border-emerald-500/40 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-emerald-300 focus:border-emerald-400"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {[30, 50, 59, 70, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDefaultDepositPct(pct)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                          Number(defaultDepositPct) === pct
                            ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50"
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
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

            {/* SECCIÓN COMPLETA DE IDENTIDAD VISUAL: LOGO Y PALETA DE COLORES */}
            <section className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-white"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                    }}
                  >
                    <Palette className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Identidad Visual y Personalización de Marca
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Configura el logo y la paleta de colores para que tus clientes vean tu propia marca en el rastreo, QR y cotizaciones.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Gestión del Logo */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Image className="h-3.5 w-3.5 text-rose-400" />
                    Logo del Negocio
                  </span>

                  <div className="flex items-start gap-3.5 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                    {logoUrl ? (
                      <div className="relative group shrink-0">
                        <img
                          src={logoUrl}
                          alt="Logo del negocio"
                          className="h-16 w-16 rounded-xl object-contain bg-white/10 p-1.5 border border-slate-700 shadow-md"
                        />
                        <button
                          type="button"
                          onClick={() => setLogoUrl("")}
                          title="Quitar logo"
                          className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-1 shadow"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="h-16 w-16 rounded-xl shrink-0 flex items-center justify-center font-black text-xl text-white shadow-md border border-white/20"
                        style={{
                          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                        }}
                      >
                        {name ? name.slice(0, 2).toUpperCase() : "OV"}
                      </div>
                    )}

                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingLogo}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
                        >
                          {uploadingLogo ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-400" />
                          ) : (
                            <Upload className="h-3.5 w-3.5 text-rose-400" />
                          )}
                          {uploadingLogo ? "Subiendo..." : "Subir Archivo de Logo"}
                        </button>

                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setLogoUrl("")}
                            className="text-[11px] text-slate-400 hover:text-rose-400 underline"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        PNG, JPG, SVG o WebP (fondo transparente recomendado).
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                      O pega una URL directa de la imagen:
                    </label>
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/mi-logo.png"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                {/* 2. Paleta de Colores */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    Paleta de Colores de la Marca
                  </span>

                  {/* Presets de Color */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {PALETTE_PRESETS.map((p) => {
                      const isSelected =
                        palettePreset === p.id ||
                        (primaryColor.toLowerCase() === p.primary.toLowerCase() &&
                          secondaryColor.toLowerCase() === p.secondary.toLowerCase());

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPreset(p)}
                          className={`rounded-xl border p-2 text-left transition-all flex items-center justify-between gap-1.5 ${
                            isSelected
                              ? "border-rose-500 bg-rose-500/15 ring-1 ring-rose-500"
                              : "border-slate-800 bg-slate-950 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex items-center -space-x-1 shrink-0">
                              <span
                                className="h-4 w-4 rounded-full border border-black/40 shadow-sm"
                                style={{ backgroundColor: p.primary }}
                              />
                              <span
                                className="h-4 w-4 rounded-full border border-black/40 shadow-sm"
                                style={{ backgroundColor: p.secondary }}
                              />
                            </div>
                            <div className="truncate">
                              <p className="text-[11px] font-bold text-white truncate leading-tight">
                                {p.name}
                              </p>
                              <p className="text-[9px] text-slate-400 truncate">
                                {p.subtitle}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="h-3 w-3 text-rose-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selectores de Color Manuales */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 flex items-center justify-between gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold">
                          Color Primario (Botones / Acentos):
                        </label>
                        <span className="font-mono text-xs text-white uppercase font-bold">
                          {primaryColor}
                        </span>
                      </div>
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => {
                          setPrimaryColor(e.target.value);
                          setPalettePreset("CUSTOM");
                        }}
                        className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent"
                      />
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 flex items-center justify-between gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold">
                          Color Secundario (Gradientes):
                        </label>
                        <span className="font-mono text-xs text-white uppercase font-bold">
                          {secondaryColor}
                        </span>
                      </div>
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => {
                          setSecondaryColor(e.target.value);
                          setPalettePreset("CUSTOM");
                        }}
                        className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Previsualización en Vivo de la Experiencia del Cliente */}
              <div className="border-t border-slate-800/80 pt-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-sky-400" />
                  Previsualización de Marca para tus Clientes:
                </span>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo vista previa"
                        className="h-10 w-10 rounded-xl object-contain bg-white/10 p-1 border border-slate-700 shadow"
                      />
                    ) : (
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm text-white shadow border border-white/20"
                        style={{
                          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                        }}
                      >
                        {name ? name.slice(0, 2).toUpperCase() : "OV"}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-extrabold text-white">
                        {name || "Nombre de tu Tienda"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {businessType === "TAILORING"
                          ? "Atelier de Costura y Confección"
                          : "Tienda y Envíos"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="px-2.5 py-1 rounded-lg text-xs font-bold border"
                      style={{
                        backgroundColor: `${primaryColor}20`,
                        borderColor: `${primaryColor}50`,
                        color: primaryColor,
                      }}
                    >
                      En Confección
                    </span>

                    {waEnabled ? (
                      <button
                        type="button"
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-md transition-transform flex items-center gap-1.5"
                        style={{
                          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                        }}
                      >
                        <MessageCircle className="h-3 w-3" />
                        {waButtonText || "Consultar por WhatsApp"}
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500 italic px-2 py-1 rounded bg-slate-900 border border-slate-800">
                        (WhatsApp desactivado)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* SECCIÓN DE MENSAJES DE WHATSAPP A CLIENTES (STATUS Y COTIZACIÓN) */}
            <section className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Mensajes de WhatsApp a Clientes
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Status y Cotización
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Al pulsar el botón de WhatsApp en pedidos o lotes, se abre el chat directo con el número del cliente y se pega este mensaje pre-escrito con su status, cotización y enlace.
                    </p>
                  </div>
                </div>

                {/* Switch de Activación */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-xs font-semibold text-slate-300">
                    {waEnabled ? "Botón Activo" : "Botón Desactivado"}
                  </span>
                  <input
                    type="checkbox"
                    checked={waEnabled}
                    onChange={(e) => setWaEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 relative"></div>
                </label>
              </div>

              {waEnabled && (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Texto del Botón */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-300">
                        Etiqueta / Texto del Botón
                      </label>
                      <input
                        type="text"
                        value={waButtonText}
                        onChange={(e) => setWaButtonText(e.target.value)}
                        placeholder="Ej. Enviar WhatsApp al Cliente, Notificar por WhatsApp"
                        maxLength={80}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-emerald-500"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        Texto visible para el operador en el botón de WhatsApp del pedido.
                      </p>
                    </div>

                    {/* Teléfono de Soporte Opcional de la Tienda */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-300">
                        Teléfono Oficial del Negocio (Opcional)
                      </label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-emerald-400" />
                        <input
                          type="text"
                          value={waPhone}
                          onChange={(e) => setWaPhone(e.target.value)}
                          placeholder="+58 412 1234567 o +57 300 1234567"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-emerald-500"
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Número al que el cliente puede responder desde la página de seguimiento.
                      </p>
                    </div>
                  </div>

                  {/* Plantilla del Mensaje Pre-escrito */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        Plantilla del Mensaje Pre-escrito (Status + Cotización)
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {waMessage.length}/1000 caracteres
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={waMessage}
                      onChange={(e) => setWaMessage(e.target.value)}
                      maxLength={1000}
                      placeholder="¡Hola *{cliente}*! Te saludamos de *{negocio}*..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-white placeholder:text-slate-600 focus:border-emerald-500"
                    />

                    {/* Botones para Insertar Variables */}
                    <div className="mt-2 space-y-1.5">
                      <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-between">
                        <span>Haz clic para insertar variables dinámicas en el mensaje:</span>
                        <button
                          type="button"
                          onClick={() => setWaMessage(DEFAULT_WHATSAPP_CONFIG.customMessage || "")}
                          className="text-[10px] text-rose-400 hover:underline"
                        >
                          Restaurar Plantilla Estándar
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {[
                          { tag: "{cliente}", desc: "Nombre cliente" },
                          { tag: "{negocio}", desc: "Tu tienda" },
                          { tag: "{pedido}", desc: "# Pedido" },
                          { tag: "{estado}", desc: "Estado actual" },
                          { tag: "{moneda}", desc: "COP/USD" },
                          { tag: "{total}", desc: "Total cotizado" },
                          { tag: "{abono}", desc: "Abono / Seña" },
                          { tag: "{saldo}", desc: "Saldo pendiente" },
                          { tag: "{link}", desc: "Enlace web de seguimiento" },
                        ].map((v) => (
                          <button
                            key={v.tag}
                            type="button"
                            onClick={() => setWaMessage((prev) => prev + " " + v.tag)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2 py-1 text-emerald-300 border border-slate-700 transition-colors"
                          >
                            <span className="font-mono font-bold">{v.tag}</span>
                            <span className="text-slate-400 text-[9px]">({v.desc})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Simulación en Vivo del Chat de WhatsApp con el Cliente */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">
                          WA
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">
                            Vista Previa: Chat con Cliente (+58 412 1234567)
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Así se verá el mensaje pre-llenado listo para enviar al cliente:
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        WhatsApp Web / Móvil
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#0b141a] p-3.5 border border-slate-800/80">
                      <div className="max-w-md rounded-2xl bg-[#005c4b] p-3 text-white text-xs leading-relaxed shadow-md space-y-1">
                        <div className="whitespace-pre-wrap font-sans text-[11px] text-slate-100">
                          {waMessage
                            .replace(/{cliente}/gi, "María Fernanda Pérez")
                            .replace(/{negocio}/gi, name || "Tu Tienda")
                            .replace(/{pedido}/gi, "ORD-104")
                            .replace(/{estado}/gi, "Por Confirmar (50% Abonado)")
                            .replace(/{moneda}/gi, currency)
                            .replace(/{total}/gi, currency === "COP" ? "$180.000 COP" : "$45.00 USD")
                            .replace(/{abono}|{seña}/gi, currency === "COP" ? "$90.000 COP" : "$22.50 USD")
                            .replace(/{saldo}|{restante}/gi, currency === "COP" ? "$90.000 COP" : "$22.50 USD")
                            .replace(/{link}|{url}|{seguimiento}/gi, "https://tudominio.com/track/ORD-104")}
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[9px] text-slate-300 pt-1">
                          <span>12:00 PM</span>
                          <span className="text-sky-300 font-bold">✓✓</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Botón Principal para Guardar Toda la Configuración */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white shadow-xl transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              }}
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              Guardar Marca, WhatsApp y Configuración
            </button>
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
