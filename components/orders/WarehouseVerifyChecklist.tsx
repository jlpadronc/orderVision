"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  Loader2,
  MessageCircle,
  PackageCheck,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type {
  OrderRecord,
  TenantRecord,
} from "@/lib/repositories/multiTenantRepository";
import { PAYMENT_METHOD_OPTIONS } from "@/components/orders/DepositPaymentDrawer";
import { formatShortDate } from "@/components/orders/BatchesDashboardClient";
import {
  DEFAULT_FEATURES,
  type PaymentMethodType,
} from "@/lib/validations/schemas";
import { buildOrderWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { exportQuoteAsPng } from "@/lib/utils/quoteImageExporter";
import {
  formatEquivalentSummary,
  formatMoney,
  resolveExchangeRates,
} from "@/lib/utils/currency";

interface WarehouseVerifyChecklistProps {
  tenant: TenantRecord;
  initialOrder: OrderRecord;
  siblingBatchOrders?: OrderRecord[];
}

export function WarehouseVerifyChecklist({
  tenant,
  initialOrder,
  siblingBatchOrders = [],
}: WarehouseVerifyChecklistProps) {
  const features = tenant.settings?.features ?? DEFAULT_FEATURES;
  const [order, setOrder] = useState<OrderRecord>(initialOrder);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of initialOrder.items) {
      map[item.id] = item.verificationNotes ?? "";
    }
    return map;
  });

  useEffect(() => {
    setOrder(initialOrder);
    const map: Record<string, string> = {};
    for (const item of initialOrder.items) {
      map[item.id] = item.verificationNotes ?? "";
    }
    setNotesDraft(map);
  }, [initialOrder]);

  const settleDialogRef = useRef<HTMLDialogElement | null>(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [finalPaymentMethod, setFinalPaymentMethod] =
    useState<PaymentMethodType>("PAGO_MOVIL_VES");
  const [finalPaymentRef, setFinalPaymentRef] = useState("");
  const [finalReceiptUrl, setFinalReceiptUrl] = useState<string | null>(null);
  const [finalReceiptName, setFinalReceiptName] = useState<string | null>(null);
  const [uploadingFinalReceipt, setUploadingFinalReceipt] = useState(false);
  const [settlingOrder, setSettlingOrder] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = settleDialogRef.current;
    if (!dialog) return;
    if (showSettleModal && !dialog.open) {
      dialog.showModal();
    } else if (!showSettleModal && dialog.open) {
      dialog.close();
    }
  }, [showSettleModal]);

  const verifiedCount = useMemo(
    () => order.items.filter((i) => i.isPhysicallyVerified).length,
    [order.items]
  );
  const totalItems = order.items.length;
  const allVerified = totalItems > 0 && verifiedCount === totalItems;

  const vesRate = tenant.settings?.exchangeRates?.VES ?? 46.8;
  const copRate = tenant.settings?.exchangeRates?.COP ?? 4180;
  const rates = useMemo(
    () => resolveExchangeRates(tenant.settings?.exchangeRates),
    [tenant.settings?.exchangeRates]
  );
  const orderCurrency = order.currency ?? tenant.currency ?? "USD";
  const remainingAmount = order.finalPaymentPaid
    ? 0
    : Number((order.subtotal - order.depositAmountPaid).toFixed(2));

  async function handleToggleItemVerified(itemId: string, nextValue: boolean) {
    setUpdatingItemId(itemId);
    try {
      const res = await fetch(`/api/orders/${order.id}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          itemId,
          isPhysicallyVerified: nextValue,
          verificationNotes: notesDraft[itemId] ?? "",
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setOrder(json.order);
      }
    } finally {
      setUpdatingItemId(null);
    }
  }

  async function handleSaveNoteOnBlur(itemId: string, isVerified: boolean) {
    await fetch(`/api/orders/${order.id}/verify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        itemId,
        isPhysicallyVerified: isVerified,
        verificationNotes: notesDraft[itemId] ?? "",
      }),
    });
  }

  async function handleFinalReceiptUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFinalReceipt(true);
    setSettleError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "receipts");
      formData.append("tenantId", tenant.id);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setFinalReceiptUrl(json.asset.url);
        setFinalReceiptName(file.name);
      }
    } finally {
      setUploadingFinalReceipt(false);
    }
  }

  async function handleSettleRemainingBalance(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setSettleError(null);
    if (finalPaymentRef.trim().length < 2) {
      setSettleError("Ingresa la referencia del pago del 50% restante.");
      return;
    }

    setSettlingOrder(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          finalPaymentMethod,
          finalPaymentRef: finalPaymentRef.trim(),
          finalReceiptUrl,
          markCompleted: true,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setOrder(json.order);
        setShowSettleModal(false);
      }
    } finally {
      setSettlingOrder(false);
    }
  }

  async function handleExportQuote() {
    await exportQuoteAsPng({
      tenantName: tenant.name,
      customerName: order.customer?.fullName ?? "Cliente",
      customerPhone: order.customer?.phone,
      orderId: order.id,
      batchLabel: order.batch
        ? `${order.batch.code} (${formatShortDate(order.batch.purchaseDate)})`
        : null,
      dateLabel: formatShortDate(order.orderDate),
      items: order.items.map((i) => ({
        title: i.title,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        finalPrice: i.finalPrice,
      })),
      currency: orderCurrency,
      subtotalUsd: order.subtotal,
      depositPct: tenant.defaultDepositPct,
      depositUsd: order.depositRequired,
      vesRate,
      copRate,
    });
  }

  const whatsappUrl = buildWhatsAppUrl(
    order.customer?.phone,
    buildOrderWhatsAppMessage({
      tenantName: tenant.name,
      customerName: order.customer?.fullName ?? "Cliente",
      orderId: order.id,
      batchCode: order.batch?.code,
      currency: orderCurrency,
      subtotalUsd: order.subtotal,
      depositRequiredUsd: order.depositRequired,
      balanceDueUsd: remainingAmount,
      vesRate,
      copRate,
      itemsCount: totalItems,
    })
  );

  return (
    <div className="space-y-4">
      {/* Cabecera Compacta con acciones directas */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al Inicio
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {features.whatsappButton && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Ir a WhatsApp
            </a>
          )}

          {features.quoteExport && (
            <button
              type="button"
              onClick={handleExportQuote}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5 text-rose-400" />
              Cotización PNG
            </button>
          )}

          <span className="rounded-lg border border-purple-500/40 bg-purple-500/15 px-2.5 py-1 text-xs font-bold text-purple-200">
            {order.status}
          </span>
        </div>
      </div>

      {/* Selector de Clientes del mismo Lote */}
      {order.batch && siblingBatchOrders.length > 1 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 font-mono font-bold text-amber-300">
              <Boxes className="h-3 w-3" />
              {order.batch.code}
            </span>
            <span className="text-slate-400">
              Salida {formatShortDate(order.batch.purchaseDate)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {siblingBatchOrders.map((sib, idx) => {
              const isCurrent = sib.id === order.id;
              const sibVerified = sib.items.filter(
                (i) => i.isPhysicallyVerified
              ).length;
              return (
                <Link
                  key={sib.id}
                  href={`/orders/${sib.id}/verify`}
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs transition-all ${
                    isCurrent
                      ? "border-rose-500 bg-rose-500/20 font-bold text-white"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  #{idx + 1} {sib.customer?.fullName.split(" ")[0]} (
                  {sibVerified}/{sib.items.length})
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Resumen Compacto del Cliente + Liquidación 50% Restante */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/85 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-extrabold text-white">
              {order.customer?.fullName} •{" "}
              <span className="font-mono text-xs text-slate-400">#{order.id}</span>
            </h1>
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
              Moneda: {orderCurrency}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            WhatsApp: {order.customer?.phone} • Total:{" "}
            <strong className="text-white">
              {formatMoney(order.subtotal, orderCurrency)}
            </strong>{" "}
            • Seña 50%:{" "}
            <strong className="text-emerald-400">
              {formatMoney(order.depositAmountPaid, orderCurrency)} ✓
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-300">
              Cotejo: {verifiedCount}/{totalItems} prendas
            </p>
            <p className="text-[11px] text-amber-300">
              Resta: {formatMoney(remainingAmount, orderCurrency)}
            </p>
            <p className="text-[10px] text-slate-400">
              {formatEquivalentSummary(remainingAmount, orderCurrency, rates)}
            </p>
          </div>

          {!order.finalPaymentPaid ? (
            <button
              type="button"
              onClick={() => setShowSettleModal(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
            >
              <Wallet className="h-3.5 w-3.5" />
              Cobrar Restante ({formatMoney(remainingAmount, orderCurrency)})
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300">
              <PackageCheck className="h-4 w-4" />
              100% Liquidado y Entregado
            </span>
          )}
        </div>
      </section>

      {/* Grid Adaptable (1 col en móvil, 2 cols en Desktop) para Cotejo Rápido */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {order.items.map((item, idx) => {
          const isChecked = item.isPhysicallyVerified;
          const isLoading = updatingItemId === item.id;

          return (
            <article
              key={item.id}
              className={`rounded-2xl border p-3.5 transition-all ${
                isChecked
                  ? "border-emerald-500/40 bg-emerald-950/15"
                  : "border-slate-800 bg-slate-900/85"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                  {item.sourceImageUrl && (
                    <img
                      src={item.sourceImageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute left-1 top-1 rounded bg-slate-950/90 px-1 text-[9px] font-bold text-white">
                    #{idx + 1}
                  </span>
                </div>

                <div className="flex-1 space-y-1.5">
                  <h3 className="text-xs font-bold text-white line-clamp-2">
                    {item.title}
                  </h3>

                  <div className="flex flex-wrap gap-1 text-[11px]">
                    <span className="rounded bg-rose-500/15 px-2 py-0.5 font-bold text-rose-200">
                      Talla: {item.size || "-"}
                    </span>
                    <span className="rounded bg-sky-500/15 px-2 py-0.5 font-bold text-sky-200">
                      Color: {item.color || "-"}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono font-bold text-emerald-300">
                      {formatMoney(item.finalPrice, orderCurrency)} x{item.quantity}
                    </span>
                  </div>

                  <label
                    htmlFor={`verify-check-${item.id}`}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                      isChecked
                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-200"
                        : "border-slate-700 bg-slate-950 text-slate-300"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ClipboardCheck className="h-3.5 w-3.5" />
                      )}
                      Recibido Conforme
                    </span>
                    <input
                      id={`verify-check-${item.id}`}
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLoading}
                      onChange={(e) =>
                        handleToggleItemVerified(item.id, e.target.checked)
                      }
                      className="h-4 w-4 accent-emerald-500"
                    />
                  </label>
                </div>
              </div>

              <input
                type="text"
                placeholder="Nota de revisión en almacén..."
                value={notesDraft[item.id] ?? ""}
                onChange={(e) =>
                  setNotesDraft((prev) => ({
                    ...prev,
                    [item.id]: e.target.value,
                  }))
                }
                onBlur={() => handleSaveNoteOnBlur(item.id, isChecked)}
                style={{ minHeight: "32px", fontSize: "0.75rem" }}
                className="mt-2.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs text-slate-300"
              />
            </article>
          );
        })}
      </section>

      {/* Modal Cobro 50% Restante */}
      <dialog
        ref={settleDialogRef}
        aria-labelledby="final-settle-dialog-title"
        onClose={() => setShowSettleModal(false)}
        className="m-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 id="final-settle-dialog-title" className="text-sm font-bold text-white">
            Liquidar 50% Restante ({formatMoney(remainingAmount, orderCurrency)})
          </h3>
          <button
            type="button"
            onClick={() => setShowSettleModal(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSettleRemainingBalance}
          method="POST"
          className="space-y-3 p-4"
        >
          <fieldset className="grid grid-cols-2 gap-1.5">
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold ${
                  finalPaymentMethod === option.value
                    ? "border-emerald-500 bg-emerald-500/15 text-white"
                    : "border-slate-800 bg-slate-950 text-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="finalPaymentMethod"
                  value={option.value}
                  checked={finalPaymentMethod === option.value}
                  onChange={() => setFinalPaymentMethod(option.value)}
                  className="accent-emerald-500"
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <div>
            <label className="mb-1 block text-xs text-slate-300">
              Referencia de Pago Final *
            </label>
            <input
              type="text"
              required
              value={finalPaymentRef}
              onChange={(e) => setFinalPaymentRef(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
            {uploadingFinalReceipt ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : finalReceiptUrl ? (
              <FileCheck2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <Upload className="h-4 w-4 text-slate-400" />
            )}
            <span>
              {finalReceiptName || "Adjuntar comprobante (Opcional)"}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFinalReceiptUpload}
              className="visually-hidden"
            />
          </label>

          {settleError && (
            <p className="text-xs text-rose-300">{settleError}</p>
          )}

          <button
            type="submit"
            disabled={settlingOrder}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-xs font-extrabold text-slate-950"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirmar y Marcar Culminado
          </button>
        </form>
      </dialog>
    </div>
  );
}
