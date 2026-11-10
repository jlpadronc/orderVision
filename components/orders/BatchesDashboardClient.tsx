"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FolderPlus,
  ListFilter,
  MessageCircle,
  Package,
  Search,
  ShieldOff,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import type {
  OrderBatchRecord,
  OrderRecord,
  TenantRecord,
} from "@/lib/repositories/multiTenantRepository";
import {
  DEFAULT_FEATURES,
  type BatchStatusType,
  type CurrencyType,
  type OrderStatusType,
} from "@/lib/validations/schemas";
import {
  convertCurrency,
  formatEquivalentSummary,
  formatMoney,
  resolveExchangeRates,
} from "@/lib/utils/currency";
import { buildOrderWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { exportQuoteAsPng } from "@/lib/utils/quoteImageExporter";

export function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

type OrderPhaseFilter = "ALL" | "PENDING_PURCHASE" | "IN_PROGRESS" | "COMPLETED";

export function getOrderPhase(status: OrderStatusType): OrderPhaseFilter {
  if (status === "DRAFT" || status === "CONFIRMED_DEPOSIT_PAID") {
    return "PENDING_PURCHASE";
  }
  if (status === "COMPLETED") {
    return "COMPLETED";
  }
  return "IN_PROGRESS";
}

const ORDER_STATUS_META: Record<
  OrderStatusType,
  { label: string; badgeClass: string }
> = {
  DRAFT: {
    label: "Por Comprar (Borrador)",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  },
  CONFIRMED_DEPOSIT_PAID: {
    label: "Por Comprar (50% Pagado)",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  },
  PURCHASED_AT_ORIGIN: {
    label: "En Curso • Comprado",
    badgeClass: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  },
  IN_TRANSIT: {
    label: "En Curso • En Tránsito",
    badgeClass: "border-indigo-500/40 bg-indigo-500/15 text-indigo-300",
  },
  RECEIVED_IN_WAREHOUSE: {
    label: "En Curso • En Almacén",
    badgeClass: "border-purple-500/40 bg-purple-500/15 text-purple-200",
  },
  READY_FOR_DELIVERY: {
    label: "En Curso • Listo Entregar",
    badgeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
  COMPLETED: {
    label: "Culminado (Entregado)",
    badgeClass: "border-teal-500/40 bg-teal-500/15 text-teal-200",
  },
  CANCELLED: {
    label: "Cancelado",
    badgeClass: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  },
};

interface BatchesDashboardClientProps {
  tenant: TenantRecord;
  initialBatches: OrderBatchRecord[];
  unassignedOrders: OrderRecord[];
}

export function BatchesDashboardClient({
  tenant,
  initialBatches,
  unassignedOrders,
}: BatchesDashboardClientProps) {
  const router = useRouter();
  const [batches, setBatches] = useState<OrderBatchRecord[]>(initialBatches);
  const [mainTab, setMainTab] = useState<"STATS" | "ORDERS">("STATS");
  const [phaseFilter, setPhaseFilter] = useState<OrderPhaseFilter>("ALL");
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal para crear nuevo Lote por Fecha de Compra/Salida
  const newBatchDialogRef = useRef<HTMLDialogElement | null>(null);
  const [newBatchCode, setNewBatchCode] = useState(
    `PEDIDO-0${initialBatches.length + 1}`
  );
  const [newBatchName, setNewBatchName] = useState(
    `Pedido Consolidado #${initialBatches.length + 1}`
  );
  const [newBatchDate, setNewBatchDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newBatchNotes, setNewBatchNotes] = useState("");
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    setBatches(initialBatches);
  }, [initialBatches]);

  const features = tenant.settings?.features ?? DEFAULT_FEATURES;
  const vesRate = tenant.settings?.exchangeRates?.VES ?? 46.8;
  const copRate = tenant.settings?.exchangeRates?.COP ?? 4180;
  const rates = useMemo(
    () => resolveExchangeRates(tenant.settings?.exchangeRates),
    [tenant.settings?.exchangeRates]
  );
  const tenantCurrency: CurrencyType =
    tenant.currency === "COP" || tenant.currency === "VES"
      ? tenant.currency
      : "USD";

  // Todas las órdenes aplanadas (con su lote asociado)
  const allOrders = useMemo(() => {
    const fromBatches = batches.flatMap((b) =>
      b.orders.map((o) => ({
        ...o,
        batch: {
          id: b.id,
          tenantId: b.tenantId,
          code: b.code,
          name: b.name,
          purchaseDate: b.purchaseDate,
          status: b.status,
          trackingRef: b.trackingRef,
          notes: b.notes,
        },
      }))
    );
    return [...fromBatches, ...unassignedOrders];
  }, [batches, unassignedOrders]);

  // Estadísticas consolidadas
  const stats = useMemo(() => {
    const pendingPurchase = allOrders.filter(
      (o) => getOrderPhase(o.status) === "PENDING_PURCHASE"
    );
    const inProgress = allOrders.filter(
      (o) => getOrderPhase(o.status) === "IN_PROGRESS"
    );
    const completed = allOrders.filter(
      (o) => getOrderPhase(o.status) === "COMPLETED"
    );

    const totalProducts = allOrders.reduce(
      (acc, o) => acc + o.items.reduce((s, i) => s + (i.quantity || 1), 0),
      0
    );
    const totalInTenantCurrency = allOrders.reduce(
      (acc, o) =>
        acc + convertCurrency(o.subtotal, o.currency, tenantCurrency, rates),
      0
    );
    const collectedInTenantCurrency = allOrders.reduce(
      (acc, o) =>
        acc +
        convertCurrency(
          o.finalPaymentPaid ? o.subtotal : o.depositAmountPaid,
          o.currency,
          tenantCurrency,
          rates
        ),
      0
    );
    const pendingInTenantCurrency = allOrders.reduce(
      (acc, o) =>
        acc +
        (o.finalPaymentPaid
          ? 0
          : convertCurrency(o.balanceDue, o.currency, tenantCurrency, rates)),
      0
    );
    const pendingPurchaseInTenantCurrency = pendingPurchase.reduce(
      (acc, o) =>
        acc + convertCurrency(o.subtotal, o.currency, tenantCurrency, rates),
      0
    );

    return {
      totalOrders: allOrders.length,
      totalBatches: batches.length,
      totalProducts,
      pendingPurchaseCount: pendingPurchase.length,
      pendingPurchaseInTenantCurrency,
      inProgressCount: inProgress.length,
      completedCount: completed.length,
      totalInTenantCurrency,
      collectedInTenantCurrency,
      pendingInTenantCurrency,
    };
  }, [allOrders, batches, tenantCurrency, rates]);

  // Filtrado de pedidos en la pestaña "Todos los Pedidos"
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allOrders.filter((o) => {
      if (
        selectedBatchFilter !== "ALL" &&
        o.batchId !== selectedBatchFilter
      ) {
        return false;
      }
      if (phaseFilter !== "ALL" && getOrderPhase(o.status) !== phaseFilter) {
        return false;
      }
      if (!q) return true;
      return (
        o.customer?.fullName.toLowerCase().includes(q) ||
        o.customer?.phone.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.batch?.code && o.batch.code.toLowerCase().includes(q)) ||
        o.items.some((i) => i.title.toLowerCase().includes(q))
      );
    });
  }, [allOrders, selectedBatchFilter, phaseFilter, searchQuery]);

  async function handleCreateBatch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreatingBatch(true);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          code: newBatchCode,
          name: newBatchName,
          purchaseDate: new Date(`${newBatchDate}T14:00:00.000Z`).toISOString(),
          status: "OPEN_FOR_ORDERS",
          notes: newBatchNotes || null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setBatches((prev) => [...prev, json.batch]);
        newBatchDialogRef.current?.close();
        router.refresh();
      }
    } finally {
      setCreatingBatch(false);
    }
  }

  async function handleQuickOrderUpdate(
    orderId: string,
    payload: { batchId?: string; status?: OrderStatusType }
  ) {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch("/api/batches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          orderId,
          ...payload,
        }),
      });
      if (res.ok) {
        const listRes = await fetch(`/api/batches?tenantId=${tenant.id}`);
        const listJson = await listRes.json();
        if (listJson.ok) {
          setBatches(listJson.batches);
        }
        router.refresh();
      }
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function handleExportOrderQuote(order: OrderRecord) {
    await exportQuoteAsPng({
      tenantName: tenant.name,
      customerName: order.customer?.fullName ?? "Cliente",
      customerPhone: order.customer?.phone,
      orderId: order.id,
      batchLabel: order.batch
        ? `${order.batch.code} (${formatShortDate(order.batch.purchaseDate)})`
        : null,
      dateLabel: formatShortDate(order.orderDate),
      currency: order.currency || tenantCurrency,
      items: order.items.map((i) => ({
        title: i.title,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        finalPrice: i.finalPrice,
      })),
      subtotalUsd: order.subtotal,
      depositPct: tenant.defaultDepositPct,
      depositUsd: order.depositRequired,
      vesRate,
      copRate,
      paymentSummary: order.paymentMethod
        ? `Método: ${order.paymentMethod}`
        : undefined,
    });
  }

  // Si el dueño de la app desactivó el servicio para este Tenant
  if (!tenant.active) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/40 bg-slate-900 p-6 text-center space-y-3 my-8">
        <ShieldOff className="mx-auto h-10 w-10 text-rose-400" />
        <h1 className="text-lg font-bold text-white">
          Servicio Suspendido para {tenant.name}
        </h1>
        <p className="text-xs text-slate-400">
          El administrador de la plataforma ha desactivado temporalmente el
          acceso o las funciones de este negocio.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Link
            href="/login"
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
          >
            Cambiar de Cuenta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Barra Superior Minimalista: Pestañas (Estadísticas vs Todos los Pedidos) + Acciones Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-3">
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setMainTab("STATS")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${
              mainTab === "STATS"
                ? "bg-rose-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Resumen y Estadísticas
          </button>

          <button
            type="button"
            onClick={() => setMainTab("ORDERS")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${
              mainTab === "ORDERS"
                ? "bg-rose-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            Todos los Pedidos ({allOrders.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNewBatchCode(`PEDIDO-0${batches.length + 1}`);
              setNewBatchName(`Pedido Consolidado #${batches.length + 1}`);
              newBatchDialogRef.current?.showModal();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            <FolderPlus className="h-3.5 w-3.5 text-amber-400" />
            + Nuevo Lote
          </button>

          <Link
            href="/orders/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 text-xs font-bold text-white hover:bg-rose-600"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            + Nuevo Pedido
          </Link>
        </div>
      </div>

      {/* =====================================================================
          PESTAÑA 1: RESUMEN Y ESTADÍSTICAS DE PEDIDOS Y LOTES
         ===================================================================== */}
      {mainTab === "STATS" && (
        <div className="space-y-5">
          {/* 4 Tarjetas KPI Compactas */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {/* 1. Pendientes por Comprar del lado del Tenant */}
            <button
              type="button"
              onClick={() => {
                setPhaseFilter("PENDING_PURCHASE");
                setMainTab("ORDERS");
              }}
              className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-3.5 text-left transition-colors hover:border-amber-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-amber-300">
                  Por Comprar (Tenant)
                </span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-white">
                {stats.pendingPurchaseCount}{" "}
                <span className="text-xs font-normal text-slate-400">
                  pedidos
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-amber-200/80">
                {formatMoney(stats.pendingPurchaseInTenantCurrency, tenantCurrency)} por comprar →
              </p>
            </button>

            {/* 2. Pedidos en Curso / Almacén */}
            <button
              type="button"
              onClick={() => {
                setPhaseFilter("IN_PROGRESS");
                setMainTab("ORDERS");
              }}
              className="rounded-2xl border border-sky-500/30 bg-slate-900/90 p-3.5 text-left transition-colors hover:border-sky-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-sky-300">
                  En Curso / Almacén
                </span>
                <Package className="h-4 w-4 text-sky-400" />
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-white">
                {stats.inProgressCount}{" "}
                <span className="text-xs font-normal text-slate-400">
                  pedidos
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-sky-200/80">
                Comprados, viajando o en cotejo →
              </p>
            </button>

            {/* 3. Pedidos Culminados */}
            <button
              type="button"
              onClick={() => {
                setPhaseFilter("COMPLETED");
                setMainTab("ORDERS");
              }}
              className="rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-3.5 text-left transition-colors hover:border-emerald-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-emerald-300">
                  Culminados
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-white">
                {stats.completedCount}{" "}
                <span className="text-xs font-normal text-slate-400">
                  entregados
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-200/80">
                100% pagados y verificados →
              </p>
            </button>

            {/* 4. Resumen Financiero */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Volumen Total ({stats.totalProducts} prod.)
                </span>
                <ShoppingBag className="h-4 w-4 text-rose-400" />
              </div>
              <p className="mt-1.5 text-xl font-extrabold text-white">
                {formatMoney(stats.totalInTenantCurrency, tenantCurrency)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Cobrado:{" "}
                <strong className="text-emerald-400">
                  {formatMoney(stats.collectedInTenantCurrency, tenantCurrency, false)}
                </strong>{" "}
                • Resta:{" "}
                <strong className="text-amber-300">
                  {formatMoney(stats.pendingInTenantCurrency, tenantCurrency, false)}
                </strong>
              </p>
            </div>
          </div>

          {/* Resumen de Lotes por Fecha de Salida / Compra */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Lotes de Salida / Compra ({batches.length})
              </h2>
              <span className="text-[11px] text-slate-400">
                Haz clic en un lote para gestionar sus clientes y productos
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {batches.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:border-slate-700 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-xs font-bold text-rose-300">
                        <Boxes className="h-3 w-3" />
                        {b.code}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                        <Calendar className="h-3 w-3" />
                        {formatShortDate(b.purchaseDate)}
                      </span>
                    </div>

                    <h3 className="mt-2 text-sm font-bold text-white">
                      {b.name}
                    </h3>

                    <div className="mt-2.5 flex items-center gap-3 text-xs text-slate-300">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-rose-400" />
                        <strong>{b.metrics.clientsCount}</strong> clientes
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="h-3.5 w-3.5 text-purple-400" />
                        <strong>{b.metrics.productsCount}</strong> prod.
                      </span>
                      <span>•</span>
                      <strong className="text-emerald-400">
                        {tenantCurrency === "COP"
                          ? formatMoney(b.metrics.subtotalCop, "COP")
                          : formatMoney(b.metrics.subtotalUsd, "USD")}
                      </strong>
                    </div>

                    {/* Mini semáforo de estados dentro del Lote */}
                    <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">
                      <div className="rounded-lg bg-amber-500/10 py-1 text-amber-300 border border-amber-500/20">
                        <strong>{b.metrics.pendingPurchaseOrdersCount}</strong>{" "}
                        Por comprar
                      </div>
                      <div className="rounded-lg bg-sky-500/10 py-1 text-sky-300 border border-sky-500/20">
                        <strong>{b.metrics.inProgressOrdersCount}</strong> En
                        curso
                      </div>
                      <div className="rounded-lg bg-emerald-500/10 py-1 text-emerald-300 border border-emerald-500/20">
                        <strong>{b.metrics.completedOrdersCount}</strong>{" "}
                        Culminados
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                    <Link
                      href={`/orders/new?batchId=${b.id}`}
                      className="text-xs font-semibold text-rose-400 hover:underline"
                    >
                      + Agregar cliente
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBatchFilter(b.id);
                        setPhaseFilter("ALL");
                        setMainTab("ORDERS");
                      }}
                      className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-white hover:bg-slate-700"
                    >
                      Ver {b.orders.length} pedidos →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 2: TODOS LOS PEDIDOS (SEPARADOS POR ETAPA Y LOTE)
         ===================================================================== */}
      {mainTab === "ORDERS" && (
        <div className="space-y-4">
          {/* Barra de Filtros: Por Etapa (Por Comprar / En Curso / Culminados) + Lote + Búsqueda */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-800 bg-slate-900/75 p-3 md:flex-row md:items-center md:justify-between">
            {/* Filtro de Etapa del Pedido */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  id: "ALL" as const,
                  label: `Todos (${allOrders.length})`,
                },
                {
                  id: "PENDING_PURCHASE" as const,
                  label: `Por Comprar (${stats.pendingPurchaseCount})`,
                },
                {
                  id: "IN_PROGRESS" as const,
                  label: `En Curso (${stats.inProgressCount})`,
                },
                {
                  id: "COMPLETED" as const,
                  label: `Culminados (${stats.completedCount})`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPhaseFilter(tab.id)}
                  className={`h-8 rounded-lg px-2.5 text-xs font-bold transition-colors ${
                    phaseFilter === tab.id
                      ? "bg-rose-500 text-white"
                      : "bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selector de Lote + Buscador */}
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="batch-select-filter" className="visually-hidden">
                Filtrar por Lote
              </label>
              <select
                id="batch-select-filter"
                value={selectedBatchFilter}
                onChange={(e) => setSelectedBatchFilter(e.target.value)}
                style={{ minHeight: "34px", fontSize: "0.75rem" }}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-slate-200"
              >
                <option value="ALL">Todos los Lotes</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} • {formatShortDate(b.purchaseDate)} ({b.orders.length})
                  </option>
                ))}
              </select>

              <div className="relative flex-1 sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="search"
                  placeholder="Buscar cliente o prenda..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ minHeight: "34px", fontSize: "0.75rem" }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1 text-xs text-white placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Grid Adaptable (1 col en móvil, 2 cols en Desktop) con Tarjetas Compactas */}
          {filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
              No hay pedidos que coincidan con el filtro seleccionado.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filteredOrders.map((order) => {
                const statusMeta =
                  ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.DRAFT;
                const totalUnits = order.items.reduce(
                  (s, i) => s + (i.quantity || 1),
                  0
                );
                const verifiedUnits = order.items.filter(
                  (i) => i.isPhysicallyVerified
                ).length;

                const orderCurr = order.currency || tenantCurrency;

                const whatsappHref = buildWhatsAppUrl(
                  order.customer?.phone,
                  buildOrderWhatsAppMessage({
                    tenantName: tenant.name,
                    customerName: order.customer?.fullName ?? "Cliente",
                    orderId: order.id,
                    batchCode: order.batch?.code,
                    currency: orderCurr,
                    subtotalUsd: order.subtotal,
                    depositRequiredUsd: order.depositRequired,
                    balanceDueUsd: order.balanceDue,
                    vesRate,
                    copRate,
                    itemsCount: totalUnits,
                  })
                );

                return (
                  <article
                    key={order.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/85 p-3.5 hover:border-slate-700 transition-all"
                  >
                    <div>
                      {/* Fila 1: Lote + ID + Moneda + Badge de Estado */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {order.batch && (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300 border border-amber-500/30">
                              {order.batch.code} •{" "}
                              {formatShortDate(order.batch.purchaseDate)}
                            </span>
                          )}
                          <span className="font-mono text-[11px] text-slate-400">
                            #{order.id}
                          </span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                            {orderCurr}
                          </span>
                        </div>

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      {/* Fila 2: Cliente y Montos Multimoneda */}
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            {order.customer?.fullName ?? "Cliente"}
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            {order.customer?.phone} •{" "}
                            <strong className="text-slate-200">
                              {totalUnits} prod.
                            </strong>{" "}
                            (Cotejo: {verifiedUnits}/{order.items.length})
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-extrabold text-white">
                            {formatMoney(order.subtotal, orderCurr)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatEquivalentSummary(order.subtotal, orderCurr, rates)}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Seña:{" "}
                            <span className="text-emerald-400 font-semibold">
                              {formatMoney(order.depositAmountPaid, orderCurr, false)}
                            </span>{" "}
                            • Resta:{" "}
                            <span className="text-amber-300 font-semibold">
                              {formatMoney(order.balanceDue, orderCurr, false)}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Fila 3: Mini lista compacta de prendas */}
                      <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px]"
                          >
                            {item.sourceImageUrl && (
                              <img
                                src={item.sourceImageUrl}
                                alt=""
                                className="h-6 w-6 rounded object-cover"
                              />
                            )}
                            <span className="max-w-[110px] truncate text-slate-200">
                              {item.title}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({item.size || "-"})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Fila 4: Controles Rápidos (Estado, Lote, WhatsApp, Cotización PNG, Cotejo) */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
                      <div className="flex items-center gap-1.5">
                        {/* Cambiar estado rápido (Por comprar -> Comprado -> En Almacén -> Culminado) */}
                        <label
                          htmlFor={`status-${order.id}`}
                          className="visually-hidden"
                        >
                          Estado del pedido
                        </label>
                        <select
                          id={`status-${order.id}`}
                          disabled={updatingOrderId === order.id}
                          value={order.status}
                          onChange={(e) =>
                            handleQuickOrderUpdate(order.id, {
                              status: e.target.value as OrderStatusType,
                            })
                          }
                          style={{ minHeight: "30px", fontSize: "0.7rem" }}
                          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-semibold text-slate-200"
                        >
                          <option value="CONFIRMED_DEPOSIT_PAID">
                            ⏳ Por Comprar (50% Pagado)
                          </option>
                          <option value="PURCHASED_AT_ORIGIN">
                            🛒 Comprado en Origen
                          </option>
                          <option value="IN_TRANSIT">✈️ En Tránsito</option>
                          <option value="RECEIVED_IN_WAREHOUSE">
                            📦 En Almacén (Cotejo)
                          </option>
                          <option value="READY_FOR_DELIVERY">
                            ✅ Listo para Entregar
                          </option>
                          <option value="COMPLETED">
                            🎉 Culminado (Entregado)
                          </option>
                        </select>

                        {/* Cambiar Lote */}
                        <label
                          htmlFor={`batch-${order.id}`}
                          className="visually-hidden"
                        >
                          Lote del pedido
                        </label>
                        <select
                          id={`batch-${order.id}`}
                          disabled={updatingOrderId === order.id}
                          value={order.batchId ?? ""}
                          onChange={(e) =>
                            handleQuickOrderUpdate(order.id, {
                              batchId: e.target.value,
                            })
                          }
                          style={{ minHeight: "30px", fontSize: "0.7rem" }}
                          className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-300"
                        >
                          {batches.map((bOpt) => (
                            <option key={bOpt.id} value={bOpt.id}>
                              {bOpt.code}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Botones de Acción: WhatsApp, Cotización PNG y Cotejo */}
                      <div className="flex items-center gap-1.5">
                        {features.whatsappButton && (
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Hablar con el cliente por WhatsApp"
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </a>
                        )}

                        {features.quoteExport && (
                          <button
                            type="button"
                            onClick={() => handleExportOrderQuote(order)}
                            title="Exportar cotización en imagen PNG"
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                          >
                            <Download className="h-3.5 w-3.5 text-rose-400" />
                            Cotización
                          </button>
                        )}

                        {features.warehouseVerify && (
                          <Link
                            href={`/orders/${order.id}/verify`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-800 px-2.5 text-[11px] font-bold text-white hover:bg-slate-700"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5 text-purple-400" />
                            Cotejo
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Nativo <dialog> para Crear un Nuevo Lote por Fecha de Salida/Compra */}
      <dialog
        ref={newBatchDialogRef}
        aria-labelledby="new-batch-dialog-title"
        className="m-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 id="new-batch-dialog-title" className="text-sm font-bold text-white">
            Nuevo Lote de Pedido por Fecha de Salida
          </h3>
          <button
            type="button"
            onClick={() => newBatchDialogRef.current?.close()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreateBatch} method="POST" className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="batch-code-input"
                className="mb-1 block text-xs font-semibold text-slate-300"
              >
                Código de Lote *
              </label>
              <input
                id="batch-code-input"
                type="text"
                required
                value={newBatchCode}
                onChange={(e) => setNewBatchCode(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs font-bold text-white"
              />
            </div>

            <div>
              <label
                htmlFor="batch-date-input"
                className="mb-1 block text-xs font-semibold text-amber-300"
              >
                Fecha de Salida / Compra *
              </label>
              <input
                id="batch-date-input"
                type="date"
                required
                value={newBatchDate}
                onChange={(e) => setNewBatchDate(e.target.value)}
                className="w-full rounded-xl border border-amber-500/40 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="batch-name-input"
              className="mb-1 block text-xs font-semibold text-slate-300"
            >
              Nombre del Lote *
            </label>
            <input
              id="batch-name-input"
              type="text"
              required
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label
              htmlFor="batch-notes-input"
              className="mb-1 block text-xs font-semibold text-slate-300"
            >
              Notas (Opcional)
            </label>
            <input
              id="batch-notes-input"
              type="text"
              placeholder="Ej. Sale 2 días después del lote anterior"
              value={newBatchNotes}
              onChange={(e) => setNewBatchNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => newBatchDialogRef.current?.close()}
              className="h-9 rounded-xl border border-slate-700 px-3.5 text-xs text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creatingBatch}
              className="h-9 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-slate-950"
            >
              {creatingBatch ? "Guardando..." : "Guardar Lote"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
