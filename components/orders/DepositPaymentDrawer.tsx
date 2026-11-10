"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  CreditCard,
  FileCheck2,
  Loader2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import type { TenantRecord } from "@/lib/repositories/multiTenantRepository";
import {
  formatEquivalentSummary,
  formatMoney,
} from "@/lib/utils/currency";
import type { CurrencyType, PaymentMethodType } from "@/lib/validations/schemas";

export interface PaymentMethodOption {
  value: PaymentMethodType;
  label: string;
  badge: string;
  accentClass: string;
}

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    value: "BINANCE_USDT",
    label: "Binance (USDT)",
    badge: "USDT • Instantáneo",
    accentClass: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  {
    value: "BANCOLOMBIA",
    label: "Bancolombia",
    badge: "COP • Transferencia",
    accentClass: "border-yellow-500/40 bg-yellow-500/10 text-yellow-200",
  },
  {
    value: "NEQUI",
    label: "Nequi",
    badge: "COP • Móvil",
    accentClass: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
  },
  {
    value: "CASH_USD",
    label: "Efectivo USD",
    badge: "USD • Taquilla",
    accentClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  {
    value: "PAGO_MOVIL_VES",
    label: "Bolívares / Pago Móvil",
    badge: "VES • Tasa BCV",
    accentClass: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  },
];

interface DepositPaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  tenant: TenantRecord;
  customerName: string;
  currency?: CurrencyType;
  subtotal: number;
  depositRequired: number;
  isSubmitting: boolean;
  onConfirmOrder: (payload: {
    depositPaid: boolean;
    paymentMethod: PaymentMethodType;
    paymentReference: string;
    receiptImageUrl: string | null;
    generalNotes: string;
  }) => Promise<void>;
}

export function DepositPaymentDrawer({
  open,
  onClose,
  tenant,
  customerName,
  currency = "USD",
  subtotal,
  depositRequired,
  isSubmitting,
  onConfirmOrder,
}: DepositPaymentDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [depositPaid, setDepositPaid] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("BINANCE_USDT");
  const [paymentReference, setPaymentReference] = useState("");
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [generalNotes, setGeneralNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const eqSummary = formatEquivalentSummary(
    depositRequired,
    currency,
    tenant.settings?.exchangeRates
  );

  const activeAccountInfo =
    tenant.settings?.paymentAccounts?.[paymentMethod] ?? null;

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    setErrorMsg(null);
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
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Error al adjuntar el comprobante");
      }
      setReceiptImageUrl(json.asset.url);
      setReceiptFileName(file.name);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "No se pudo subir la captura del recibo"
      );
    } finally {
      setUploadingReceipt(false);
    }
  }

  async function handleCopyAccount() {
    if (!activeAccountInfo) return;
    await navigator.clipboard.writeText(
      `${activeAccountInfo.label}: ${activeAccountInfo.identifier} (${activeAccountInfo.holder})`
    );
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);

    if (!depositPaid) {
      setErrorMsg("Debes activar el interruptor [✓ 50% de Seña Pagado] para confirmar el pedido.");
      return;
    }

    if (paymentReference.trim().length < 2) {
      setErrorMsg("Ingresa el número de referencia bancaria, Pago Móvil o Hash de Binance.");
      return;
    }

    await onConfirmOrder({
      depositPaid,
      paymentMethod,
      paymentReference: paymentReference.trim(),
      receiptImageUrl,
      generalNotes: generalNotes.trim(),
    });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="deposit-drawer-title"
      onClose={onClose}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-slate-700/80 bg-slate-900 p-0 text-slate-100 shadow-2xl sm:mx-auto"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur-md">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
            Cierre y Confirmación de Seña
          </span>
          <h2 id="deposit-drawer-title" className="text-lg font-bold text-white">
            Liquidación Inicial (50%)
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana de confirmación de pago"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} method="POST" className="space-y-5 p-5">
        {/* Resumen financiero */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cliente: {customerName}</span>
            <span>Subtotal: {formatMoney(subtotal, currency)}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-slate-800/80 pt-3">
            <div>
              <p className="text-xs font-medium text-slate-300">
                Seña Requerida ({tenant.defaultDepositPct}%)
              </p>
              <p className="text-[11px] text-slate-400">
                {eqSummary}
              </p>
            </div>
            <p className="text-2xl font-extrabold text-emerald-400">
              {formatMoney(depositRequired, currency)}
            </p>
          </div>
        </div>

        {/* Interruptor de Verificación [✓ 50% de Seña Pagado] */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <label
            htmlFor="deposit-paid-checkbox"
            className="flex cursor-pointer items-center justify-between gap-3"
          >
            <div>
              <span className="block text-sm font-bold text-emerald-200">
                [✓ 50% de Seña Pagado]
              </span>
              <span className="block text-xs text-emerald-300/80">
                Cambia el estado a CONFIRMED_DEPOSIT_PAID al guardar
              </span>
            </div>
            <input
              id="deposit-paid-checkbox"
              name="depositPaid"
              type="checkbox"
              checked={depositPaid}
              onChange={(e) => setDepositPaid(e.target.checked)}
              className="h-6 w-6 rounded accent-emerald-500"
            />
          </label>
        </div>

        {/* Selector de Métodos de Pago (5 opciones -> radio buttons visibles según modern-web-guidance) */}
        <fieldset className="space-y-2.5">
          <legend className="text-sm font-semibold text-slate-200">
            Método de Pago Recibido *
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PAYMENT_METHOD_OPTIONS.map((option) => {
              const selected = paymentMethod === option.value;
              return (
                <label
                  key={option.value}
                  htmlFor={`pm-${option.value}`}
                  className={`flex min-h-[52px] cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 transition-all ${
                    selected
                      ? "border-rose-500 bg-rose-500/15 ring-1 ring-rose-500"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      id={`pm-${option.value}`}
                      type="radio"
                      name="paymentMethod"
                      value={option.value}
                      checked={selected}
                      onChange={() => setPaymentMethod(option.value)}
                      className="h-4 w-4 accent-rose-500"
                    />
                    <span className="text-sm font-semibold text-slate-100">
                      {option.label}
                    </span>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${option.accentClass}`}
                  >
                    {option.badge}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Datos bancarios / cuenta del Tenant activo */}
        {activeAccountInfo && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs">
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-200">
                Cuenta {tenant.name}: {activeAccountInfo.label}
              </p>
              <p className="font-mono text-slate-300">{activeAccountInfo.identifier}</p>
              <p className="text-slate-400">Titular: {activeAccountInfo.holder}</p>
            </div>
            <button
              type="button"
              onClick={handleCopyAccount}
              className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedAccount ? "Copiado" : "Copiar"}
            </button>
          </div>
        )}

        {/* Número de Referencia o Hash */}
        <div>
          <label
            htmlFor="payment-reference-input"
            className="mb-1.5 block text-sm font-semibold text-slate-200"
          >
            Número de Referencia / Hash de Binance *
          </label>
          <input
            id="payment-reference-input"
            name="paymentReference"
            type="text"
            required
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="Ej. 00948219 o Order ID Binance USDT"
            value={paymentReference}
            onChange={(e) => {
              setPaymentReference(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-slate-100 placeholder:text-slate-500"
          />
        </div>

        {/* Subida de Comprobante Adjunto */}
        <div>
          <label
            htmlFor="receipt-upload-input"
            className="mb-1.5 block text-sm font-semibold text-slate-200"
          >
            Comprobante de Pago Adjunto (Captura / Recibo)
          </label>
          <label
            htmlFor="receipt-upload-input"
            className="flex min-h-[68px] cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-700 bg-slate-950/70 px-4 py-3 hover:border-rose-500/60"
          >
            <div className="flex items-center gap-3">
              {uploadingReceipt ? (
                <Loader2 className="h-5 w-5 animate-spin text-rose-400" />
              ) : receiptImageUrl ? (
                <FileCheck2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <Upload className="h-5 w-5 text-slate-400" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {receiptFileName
                    ? `Recibo cargado: ${receiptFileName}`
                    : "Toca para adjuntar captura del recibo o transferencia"}
                </p>
                <p className="text-xs text-slate-400">
                  Soporta PNG, JPG, WEBP desde WhatsApp o galería
                </p>
              </div>
            </div>
            {receiptImageUrl && (
              <img
                src={receiptImageUrl}
                alt="Miniatura del comprobante"
                className="h-12 w-12 rounded-lg object-cover border border-emerald-500/40"
              />
            )}
            <input
              id="receipt-upload-input"
              name="receiptFile"
              type="file"
              accept="image/*"
              onChange={handleReceiptUpload}
              className="visually-hidden"
            />
          </label>
        </div>

        {/* Notas generales opcionales */}
        <div>
          <label
            htmlFor="order-general-notes"
            className="mb-1.5 block text-sm font-semibold text-slate-200"
          >
            Notas de Entrega / Observaciones del Pedido
          </label>
          <textarea
            id="order-general-notes"
            name="generalNotes"
            rows={2}
            placeholder="Ej. Entregar en oficina Chacao o enviar por Zoom a Valencia..."
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500"
          />
        </div>

        {errorMsg && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-xs font-medium text-rose-200"
          >
            {errorMsg}
          </div>
        )}

        <div className="sticky bottom-0 pt-2 bg-slate-900">
          <button
            type="submit"
            disabled={isSubmitting || uploadingReceipt}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-600 px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-rose-500/25 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Registrando Pedido...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                Confirmar y Crear Pedido ({formatMoney(depositRequired, currency)})
              </>
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}

