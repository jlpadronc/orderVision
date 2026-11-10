"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Calendar,
  Coins,
  Download,
  FolderPlus,
  MessageCircle,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import type {
  CustomerRecord,
  OrderBatchRecord,
  TenantRecord,
} from "@/lib/repositories/multiTenantRepository";
import { DepositPaymentDrawer } from "@/components/orders/DepositPaymentDrawer";
import { formatShortDate } from "@/components/orders/BatchesDashboardClient";
import {
  DEFAULT_FEATURES,
  type CurrencyType,
  type PaymentMethodType,
} from "@/lib/validations/schemas";
import {
  convertCurrency,
  formatEquivalentSummary,
  formatMoney,
} from "@/lib/utils/currency";
import { exportQuoteAsPng } from "@/lib/utils/quoteImageExporter";
import { buildOrderWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp";

export interface CartProductItem {
  localId: string;
  title: string;
  originalPrice: number | null;
  finalPrice: number;
  quantity: number;
  size: string;
  color: string;
  modelVariant: string;
  verificationNotes: string;
  sourceImageUrl: string | null;
}

interface SmartCartBuilderProps {
  tenant: TenantRecord;
  initialCustomers: CustomerRecord[];
  initialBatches: OrderBatchRecord[];
  preselectedBatchId?: string | null;
}

export function SmartCartBuilder({
  tenant,
  initialCustomers,
  initialBatches,
  preselectedBatchId,
}: SmartCartBuilderProps) {
  const router = useRouter();
  const features = tenant.settings?.features ?? DEFAULT_FEATURES;
  const rates = tenant.settings?.exchangeRates;

  // Moneda principal del pedido (por defecto toma la moneda configurada en el Tenant: COP o USD)
  const [orderCurrency, setOrderCurrency] = useState<CurrencyType>(
    ((tenant.currency?.toUpperCase() as CurrencyType) || "COP")
  );

  // Moneda en la que el operador escribe el precio del producto individual
  const [draftCurrency, setDraftCurrency] = useState<CurrencyType>(
    ((tenant.currency?.toUpperCase() as CurrencyType) || "COP")
  );

  const [batches, setBatches] = useState<OrderBatchRecord[]>(initialBatches);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(() => {
    if (
      preselectedBatchId &&
      initialBatches.some((b) => b.id === preselectedBatchId)
    ) {
      return preselectedBatchId;
    }
    const openBatch = initialBatches.find((b) => b.status === "OPEN_FOR_ORDERS");
    return openBatch?.id ?? initialBatches[initialBatches.length - 1]?.id ?? "";
  });

  const [customers, setCustomers] = useState<CustomerRecord[]>(initialCustomers);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialCustomers[0]?.id ?? ""
  );

  // Modal de Alta Rápida de Lote
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
  const [creatingBatch, setCreatingBatch] = useState(false);

  // Modal de Alta Rápida de Cliente
  const newCustomerDialogRef = useRef<HTMLDialogElement | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("+58 ");
  const [newCustomerInstagram, setNewCustomerInstagram] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Formulario para agregar producto al carrito
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPrice, setDraftPrice] = useState("");
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [draftSize, setDraftSize] = useState("");
  const [draftColor, setDraftColor] = useState("");
  const [draftModel, setDraftModel] = useState("");

  // Carrito de productos
  const [items, setItems] = useState<CartProductItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  useEffect(() => {
    setCustomers(initialCustomers);
    if (!selectedCustomerId && initialCustomers.length > 0) {
      setSelectedCustomerId(initialCustomers[0].id);
    }
  }, [initialCustomers, selectedCustomerId]);

  useEffect(() => {
    setBatches(initialBatches);
  }, [initialBatches]);

  function handleChangeOrderCurrency(nextCurrency: CurrencyType) {
    if (nextCurrency === orderCurrency) return;
    // Convertir automáticamente los ítems que ya estén en el carrito a la nueva moneda del pedido
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        finalPrice: convertCurrency(
          item.finalPrice,
          orderCurrency,
          nextCurrency,
          rates
        ),
        originalPrice:
          item.originalPrice !== null
            ? convertCurrency(
                item.originalPrice,
                orderCurrency,
                nextCurrency,
                rates
              )
            : null,
      }))
    );
    setOrderCurrency(nextCurrency);
    setDraftCurrency(nextCurrency);
  }

  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === selectedBatchId) ?? null,
    [batches, selectedBatchId]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 15);
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const subtotal = useMemo(() => {
    const sum = items.reduce(
      (acc, item) =>
        acc +
        (Number.isFinite(item.finalPrice) ? item.finalPrice : 0) *
          (item.quantity || 1),
      0
    );
    return orderCurrency === "COP" ? Math.round(sum) : Number(sum.toFixed(2));
  }, [items, orderCurrency]);

  const depositPct = (tenant.defaultDepositPct || 50) / 100;
  const depositRequired = useMemo(() => {
    const raw = subtotal * depositPct;
    return orderCurrency === "COP" ? Math.round(raw) : Number(raw.toFixed(2));
  }, [subtotal, depositPct, orderCurrency]);

  const vesRate = rates?.VES ?? 46.8;
  const copRate = rates?.COP ?? 4200;

  async function handleCreateQuickBatch(e: React.FormEvent<HTMLFormElement>) {
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
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setBatches((prev) => [...prev, json.batch]);
        setSelectedBatchId(json.batch.id);
        newBatchDialogRef.current?.close();
      }
    } finally {
      setCreatingBatch(false);
    }
  }

  async function handleCreateQuickCustomer(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setCreatingCustomer(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          fullName: newCustomerName,
          phone: newCustomerPhone,
          instagram: newCustomerInstagram || null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setCustomers((prev) => [json.customer, ...prev]);
        setSelectedCustomerId(json.customer.id);
        setNewCustomerName("");
        setNewCustomerPhone("+58 ");
        setNewCustomerInstagram("");
        newCustomerDialogRef.current?.close();
      }
    } finally {
      setCreatingCustomer(false);
    }
  }

  function handleAddProductSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsedPrice = Number.parseFloat(draftPrice);
    if (!draftTitle.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return;
    }

    // Si el operador digitó el precio en otra moneda (ej. digitó en COP y el pedido está en USD, o viceversa), convertirlo a la moneda del pedido
    const normalizedPrice = convertCurrency(
      parsedPrice,
      draftCurrency,
      orderCurrency,
      rates
    );

    setItems((prev) => [
      ...prev,
      {
        localId: `item-${Date.now()}-${prev.length + 1}`,
        title: draftTitle.trim(),
        originalPrice: null,
        finalPrice: normalizedPrice,
        quantity: Math.max(1, Number(draftQuantity) || 1),
        size: draftSize.trim(),
        color: draftColor.trim(),
        modelVariant: draftModel.trim(),
        verificationNotes: "",
        sourceImageUrl: null,
      },
    ]);

    setDraftTitle("");
    setDraftPrice("");
    setDraftQuantity(1);
    setDraftSize("");
    setDraftColor("");
    setDraftModel("");
  }

  function handleUpdateItem<K extends keyof CartProductItem>(
    localId: string,
    field: K,
    value: CartProductItem[K]
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, [field]: value } : item
      )
    );
  }

  async function handleExportQuoteImage() {
    if (items.length === 0) return;
    await exportQuoteAsPng({
      tenantName: tenant.name,
      customerName: selectedCustomer?.fullName || "Cliente",
      customerPhone: selectedCustomer?.phone || "",
      batchLabel: selectedBatch
        ? `${selectedBatch.code} • ${selectedBatch.name} (${formatShortDate(selectedBatch.purchaseDate)})`
        : null,
      dateLabel: formatShortDate(new Date().toISOString()),
      currency: orderCurrency,
      vesRate,
      copRate,
      subtotalUsd: subtotal,
      depositPct: tenant.defaultDepositPct || 50,
      depositUsd: depositRequired,
      items: items.map((item) => ({
        title: item.title,
        size: item.size || null,
        color: item.color || null,
        quantity: item.quantity,
        finalPrice: item.finalPrice,
      })),
    });
  }

  const whatsappUrl = useMemo(() => {
    if (!selectedCustomer) return "#";
    const msg = buildOrderWhatsAppMessage({
      tenantName: tenant.name,
      customerName: selectedCustomer.fullName,
      batchCode: selectedBatch
        ? `${selectedBatch.code} (${selectedBatch.name})`
        : null,
      currency: orderCurrency,
      subtotalUsd: subtotal,
      depositRequiredUsd: depositRequired,
      balanceDueUsd: Math.max(0, subtotal - depositRequired),
      vesRate,
      copRate,
      itemsCount: items.reduce((acc, i) => acc + i.quantity, 0),
    });
    return buildWhatsAppUrl(selectedCustomer.phone, msg);
  }, [
    selectedCustomer,
    tenant.name,
    selectedBatch,
    orderCurrency,
    subtotal,
    depositRequired,
    vesRate,
    copRate,
    items,
  ]);

  async function handleConfirmDepositOrder(payload: {
    paymentMethod: PaymentMethodType;
    paymentReference: string;
    receiptImageUrl: string | null;
    generalNotes: string;
  }) {
    if (!selectedCustomerId || items.length === 0) return;
    setSubmittingOrder(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          batchId: selectedBatchId || null,
          customerId: selectedCustomerId,
          currency: orderCurrency,
          depositPaid: true,
          paymentMethod: payload.paymentMethod,
          paymentReference: payload.paymentReference,
          receiptImageUrl: payload.receiptImageUrl,
          generalNotes: payload.generalNotes,
          items: items.map((i) => ({
            title: i.title,
            originalPrice: i.originalPrice,
            finalPrice: Number(i.finalPrice),
            quantity: Number(i.quantity || 1),
            size: i.size || null,
            color: i.color || null,
            modelVariant: i.modelVariant || null,
            verificationNotes: i.verificationNotes || null,
            sourceImageUrl: i.sourceImageUrl,
          })),
        }),
      });
      const json = await response.json();
      if (response.ok && json.ok) {
        setDrawerOpen(false);
        router.push("/");
        router.refresh();
      }
    } finally {
      setSubmittingOrder(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado Minimalista + Selector de Moneda del Pedido */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h1 className="text-lg font-bold text-white">
            Nuevo Pedido de Cliente
          </h1>
          <p className="text-xs text-slate-400">
            Elige la moneda del pedido (COP para Shein o USD), selecciona el cliente y agrega sus productos.
          </p>
        </div>

        {/* Selector rápido de moneda del pedido (COP / USD) */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-1">
          <span className="inline-flex items-center gap-1 pl-2 text-[11px] font-semibold text-slate-400">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            Moneda del Pedido:
          </span>
          {(["COP", "USD"] as const).map((curr) => (
            <button
              key={curr}
              type="button"
              onClick={() => handleChangeOrderCurrency(curr)}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                orderCurrency === curr
                  ? "bg-rose-500 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {curr === "COP" ? "COP ($ Pesos)" : "USD ($ Dólares)"}
            </button>
          ))}
        </div>
      </div>

      {/* Layout Responsive: 2 Columnas en Desktop, 1 en Mobile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* COLUMNA IZQUIERDA (5 cols en Desktop): Lote + Cliente + Agregar Producto + Totales */}
        <div className="space-y-3 lg:col-span-5">
          {/* 1. Lote de Salida */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                <Boxes className="h-3.5 w-3.5 text-rose-400" />
                1. Lote de Salida (Fecha de Compra)
              </span>
              <button
                type="button"
                onClick={() => newBatchDialogRef.current?.showModal()}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2 py-1 text-[11px] font-bold text-rose-300 border border-rose-500/30"
              >
                <FolderPlus className="h-3 w-3" />
                + Lote
              </button>
            </div>

            {batches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-2.5 text-[11px] text-slate-400">
                Aún no hay lotes creados. Haz clic en <strong>+ Lote</strong> para agrupar por fecha de salida o deja el pedido sin lote.
              </p>
            ) : (
              <select
                aria-label="Seleccionar lote de salida"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
              >
                <option value="">Sin lote asignado</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name} (Salida: {formatShortDate(b.purchaseDate)})
                  </option>
                ))}
              </select>
            )}

            {selectedBatch && (
              <div className="flex items-center justify-between rounded-lg bg-slate-950 px-2.5 py-1.5 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1 text-rose-300 font-semibold">
                  <Calendar className="h-3 w-3" />
                  Salida: {formatShortDate(selectedBatch.purchaseDate)}
                </span>
                <span>
                  {selectedBatch.metrics.clientsCount} clientes •{" "}
                  {selectedBatch.metrics.productsCount} prendas
                </span>
              </div>
            )}
          </section>

          {/* 2. Cliente */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                2. Cliente (WhatsApp)
              </span>
              <div className="flex items-center gap-2">
                {features.whatsappButton && selectedCustomer && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                  >
                    <MessageCircle className="h-3 w-3" />
                    Ir a WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => newCustomerDialogRef.current?.showModal()}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2 py-1 text-[11px] font-bold text-rose-300 border border-rose-500/30"
                >
                  <UserPlus className="h-3 w-3" />
                  + Nuevo Cliente
                </button>
              </div>
            </div>

            {customers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-3 text-center">
                <p className="text-xs text-slate-400">
                  No hay clientes registrados en este negocio.
                </p>
                <button
                  type="button"
                  onClick={() => newCustomerDialogRef.current?.showModal()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Registrar Primer Cliente
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Buscar cliente por nombre o WhatsApp..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    style={{ minHeight: "36px", fontSize: "0.75rem" }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white"
                  />
                </div>

                <select
                  aria-label="Seleccionar cliente"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                >
                  {filteredCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} — {c.phone}
                    </option>
                  ))}
                </select>
              </>
            )}
          </section>

          {/* 3. Formulario Directo de Agregar Productos al Pedido (Multimoneda COP / USD) */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                <ShoppingBag className="h-3.5 w-3.5 text-rose-400" />
                3. Agregar Producto al Pedido
              </span>
              <div className="flex items-center gap-1 rounded-lg bg-slate-950 p-0.5 border border-slate-800">
                {(["COP", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraftCurrency(c)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors ${
                      draftCurrency === c
                        ? "bg-rose-500/25 text-rose-300 border border-rose-500/40"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Precio en {c}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddProductSubmit} className="space-y-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                  Nombre o Descripción del Producto
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Vestido midi satén / Blusa manga larga"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  style={{ minHeight: "36px", fontSize: "0.75rem" }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-rose-300">
                    Precio Unitario ({draftCurrency})
                  </label>
                  <input
                    type="number"
                    step={draftCurrency === "COP" ? "1" : "0.01"}
                    min="0.01"
                    required
                    placeholder={draftCurrency === "COP" ? "Ej. 65000" : "Ej. 19.50"}
                    value={draftPrice}
                    onChange={(e) => setDraftPrice(e.target.value)}
                    style={{ minHeight: "36px", fontSize: "0.75rem" }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white"
                  />
                  {draftPrice && Number(draftPrice) > 0 && (
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {draftCurrency !== orderCurrency
                        ? `Se agregará como ${formatMoney(
                            convertCurrency(
                              Number(draftPrice),
                              draftCurrency,
                              orderCurrency,
                              rates
                            ),
                            orderCurrency
                          )}`
                        : formatEquivalentSummary(
                            Number(draftPrice),
                            draftCurrency,
                            rates
                          )}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={draftQuantity}
                    onChange={(e) =>
                      setDraftQuantity(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
                    }
                    style={{ minHeight: "36px", fontSize: "0.75rem" }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                    Talla
                  </label>
                  <input
                    type="text"
                    placeholder="S, M, L, 38"
                    value={draftSize}
                    onChange={(e) => setDraftSize(e.target.value)}
                    style={{ minHeight: "34px", fontSize: "0.75rem" }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                    Color
                  </label>
                  <input
                    type="text"
                    placeholder="Negro, Azul..."
                    value={draftColor}
                    onChange={(e) => setDraftColor(e.target.value)}
                    style={{ minHeight: "34px", fontSize: "0.75rem" }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                    SKU / Código
                  </label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={draftModel}
                    onChange={(e) => setDraftModel(e.target.value)}
                    style={{ minHeight: "34px", fontSize: "0.75rem" }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 text-xs font-bold text-rose-300 hover:bg-rose-500/25"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar Producto al Carrito ({orderCurrency})
              </button>
            </form>
          </section>

          {/* 4. Resumen de Totales + Exportar Cotización PNG + WhatsApp + Confirmar 50% */}
          <section className="rounded-2xl border border-slate-700/90 bg-slate-900 p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <p className="text-xs text-slate-400">
                  Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} prendas)
                </p>
                <p className="text-lg font-bold text-white">
                  {formatMoney(subtotal, orderCurrency)}
                </p>
                <p className="text-[10px] text-slate-400">
                  {formatEquivalentSummary(subtotal, orderCurrency, rates)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-emerald-300">
                  Seña ({tenant.defaultDepositPct}%)
                </p>
                <p className="text-xl font-extrabold text-emerald-400">
                  {formatMoney(depositRequired, orderCurrency)}
                </p>
                <p className="text-[10px] text-slate-400">
                  {formatEquivalentSummary(depositRequired, orderCurrency, rates)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {features.quoteExport && (
                <button
                  type="button"
                  disabled={items.length === 0}
                  onClick={handleExportQuoteImage}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs font-bold text-slate-100 hover:bg-slate-700 disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5 text-rose-400" />
                  Cotización PNG
                </button>
              )}

              {features.whatsappButton && selectedCustomer && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Enviar WhatsApp
                </a>
              )}
            </div>

            <button
              type="button"
              disabled={items.length === 0 || !selectedCustomerId}
              onClick={() => setDrawerOpen(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 px-4 text-sm font-bold text-white shadow-lg shadow-rose-500/20 disabled:opacity-40"
            >
              Confirmar y Cobrar {tenant.defaultDepositPct}% ({formatMoney(depositRequired, orderCurrency)})
            </button>
          </section>
        </div>

        {/* COLUMNA DERECHA (7 cols en Desktop): Tarjetas Compactas de Productos */}
        <div className="space-y-2.5 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Productos en el Pedido ({items.length}) • Moneda: {orderCurrency}
            </h2>
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center space-y-2">
              <Package className="mx-auto h-8 w-8 text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">
                El carrito del pedido está vacío
              </p>
              <p className="text-xs text-slate-500">
                Usa el formulario de la izquierda para agregar los productos solicitados por el cliente en {orderCurrency === "COP" ? "Pesos Colombianos (COP)" : "Dólares (USD)"}.
              </p>
            </div>
          ) : (
            items.map((item, idx) => (
              <article
                key={item.localId}
                className="rounded-2xl border border-slate-800 bg-slate-900/85 p-3 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-xs font-bold text-rose-400">
                    #{idx + 1}
                  </div>

                  {/* Campos editables del producto */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        aria-label="Título del producto"
                        type="text"
                        value={item.title}
                        onChange={(e) =>
                          handleUpdateItem(item.localId, "title", e.target.value)
                        }
                        style={{ minHeight: "34px", fontSize: "0.8rem" }}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) =>
                            prev.filter((i) => i.localId !== item.localId)
                          )
                        }
                        aria-label="Eliminar prenda"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] text-rose-300 font-semibold">
                          Precio ({orderCurrency})
                        </label>
                        <input
                          type="number"
                          step={orderCurrency === "COP" ? "1" : "0.01"}
                          value={item.finalPrice}
                          onChange={(e) =>
                            handleUpdateItem(
                              item.localId,
                              "finalPrice",
                              Number.parseFloat(e.target.value) || 0
                            )
                          }
                          style={{ minHeight: "32px", fontSize: "0.75rem" }}
                          className="w-full rounded-lg border border-rose-500/40 bg-slate-950 px-2 py-1 text-xs font-bold text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400">
                          Cant.
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(
                              item.localId,
                              "quantity",
                              Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                            )
                          }
                          style={{ minHeight: "32px", fontSize: "0.75rem" }}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400">
                          Talla
                        </label>
                        <input
                          type="text"
                          placeholder="M"
                          value={item.size}
                          onChange={(e) =>
                            handleUpdateItem(item.localId, "size", e.target.value)
                          }
                          style={{ minHeight: "32px", fontSize: "0.75rem" }}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400">
                          Color
                        </label>
                        <input
                          type="text"
                          placeholder="Color"
                          value={item.color}
                          onChange={(e) =>
                            handleUpdateItem(item.localId, "color", e.target.value)
                          }
                          style={{ minHeight: "32px", fontSize: "0.75rem" }}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>
                        Subtotal línea:{" "}
                        <strong className="text-white">
                          {formatMoney(
                            item.finalPrice * (item.quantity || 1),
                            orderCurrency
                          )}
                        </strong>
                      </span>
                      <span>
                        {formatEquivalentSummary(
                          item.finalPrice * (item.quantity || 1),
                          orderCurrency,
                          rates
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {/* Modal Nativo <dialog> para Crear Lote */}
      <dialog
        ref={newBatchDialogRef}
        onClick={(e) => {
          if (e.target === newBatchDialogRef.current) {
            newBatchDialogRef.current.close();
          }
        }}
        className="m-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl backdrop:bg-slate-950/80"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">
            Nuevo Lote de Salida
          </h3>
          <button
            type="button"
            onClick={() => newBatchDialogRef.current?.close()}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreateQuickBatch} method="dialog" className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Código
              </label>
              <input
                required
                type="text"
                value={newBatchCode}
                onChange={(e) => setNewBatchCode(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Fecha de Compra
              </label>
              <input
                required
                type="date"
                value={newBatchDate}
                onChange={(e) => setNewBatchDate(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Nombre del Lote
            </label>
            <input
              required
              type="text"
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => newBatchDialogRef.current?.close()}
              className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creatingBatch}
              className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white"
            >
              {creatingBatch ? "Creando..." : "Guardar Lote"}
            </button>
          </div>
        </form>
      </dialog>

      {/* Modal Nativo <dialog> para Crear Cliente */}
      <dialog
        ref={newCustomerDialogRef}
        onClick={(e) => {
          if (e.target === newCustomerDialogRef.current) {
            newCustomerDialogRef.current.close();
          }
        }}
        className="m-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl backdrop:bg-slate-950/80"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Nuevo Cliente</h3>
          <button
            type="button"
            onClick={() => newCustomerDialogRef.current?.close()}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreateQuickCustomer} method="dialog" className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Nombre Completo
            </label>
            <input
              required
              type="text"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="Ej. María Fernanda Pérez"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              WhatsApp
            </label>
            <input
              required
              type="tel"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder="+58 414-0000000"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Instagram (Opcional)
            </label>
            <input
              type="text"
              value={newCustomerInstagram}
              onChange={(e) => setNewCustomerInstagram(e.target.value)}
              placeholder="@usuario"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => newCustomerDialogRef.current?.close()}
              className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creatingCustomer}
              className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white"
            >
              {creatingCustomer ? "Guardando..." : "Guardar Cliente"}
            </button>
          </div>
        </form>
      </dialog>

      {/* Bottom Sheet de Pago Inicial (50%) */}
      <DepositPaymentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tenant={tenant}
        customerName={selectedCustomer?.fullName || "Cliente"}
        currency={orderCurrency}
        subtotal={subtotal}
        depositRequired={depositRequired}
        isSubmitting={submittingOrder}
        onConfirmOrder={handleConfirmDepositOrder}
      />
    </div>
  );
}
