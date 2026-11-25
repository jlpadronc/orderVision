"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  MessageCircle,
  Plus,
  QrCode,
  Send,
  X,
} from "lucide-react";
import type {
  OrderRecord,
  OrderStatusEvent,
  TenantRecord,
} from "@/lib/repositories/multiTenantRepository";
import { generateQrDataUrl, generateQrMatrix } from "@/lib/utils/qrCode";
import {
  buildOrderTrackingWhatsAppMessage,
  buildWhatsAppUrl,
} from "@/lib/utils/whatsapp";
import type { OrderStatusType } from "@/lib/validations/schemas";
import { formatMoney } from "@/lib/utils/currency";

interface OrderQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderRecord;
  tenant: TenantRecord;
  onOrderUpdated?: (updatedOrder: OrderRecord) => void;
}

export function OrderQrModal({
  isOpen,
  onClose,
  order,
  tenant,
  onOrderUpdated,
}: OrderQrModalProps) {
  const isTailoring =
    order.businessType === "TAILORING" ||
    tenant.settings?.businessType === "TAILORING";

  const [copiedLink, setCopiedLink] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatusType>(order.status);
  const [statusNote, setStatusNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Generar URL absoluta de seguimiento público
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://ordervision.app";
  const trackingUrl = `${origin}/track/${order.id}`;

  const qrDataUrl = useMemo(() => {
    return generateQrDataUrl(trackingUrl, {
      size: 260,
      fgColor: "#0f172a",
      bgColor: "#ffffff",
      quietZone: 3,
    });
  }, [trackingUrl]);

  if (!isOpen) return null;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  }

  function handleDownloadQrPng() {
    const matrix = generateQrMatrix(trackingUrl);
    const quietZone = 3;
    const moduleSize = 12; // 12px per module for high-res PNG
    const totalSize = (matrix.length + quietZone * 2) * moduleSize;

    const canvas = document.createElement("canvas");
    canvas.width = totalSize;
    canvas.height = totalSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fondo blanco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalSize, totalSize);

    // Módulos oscuros
    ctx.fillStyle = "#0f172a";
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix.length; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(
            (c + quietZone) * moduleSize,
            (r + quietZone) * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }

    const pngUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = `QR-Pedido-${order.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Mensaje para enviar por WhatsApp
  const whatsappMessage = buildOrderTrackingWhatsAppMessage({
    tenantName: tenant.name,
    customerName: order.customer?.fullName || "Cliente",
    customerDocumentId: order.customer?.documentId,
    orderId: order.id,
    statusLabel: getStatusLabelBadge(order.status, isTailoring),
    businessType: isTailoring ? "TAILORING" : "IMPORT",
    trackingUrl,
    subtotal: order.subtotal,
    depositAmountPaid: order.depositAmountPaid,
    balanceDue: order.balanceDue,
    currency: order.currency,
    fittingDate: order.fittingDate,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    itemsDescription: order.items.map((i) => i.title).join(", "),
    customTemplate: tenant.settings?.whatsappConfig?.customMessage,
  });

  const whatsappHref = buildWhatsAppUrl(
    order.customer?.phone,
    whatsappMessage
  );

  async function handleAddStatusNote(e: React.FormEvent) {
    e.preventDefault();
    if (!statusNote.trim()) return;

    setSubmittingNote(true);
    setNoteError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          note: statusNote.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setNoteError(json.error || "No se pudo agregar la actualización.");
        return;
      }
      setStatusNote("");
      if (onOrderUpdated && json.order) {
        onOrderUpdated(json.order);
      }
    } catch (err) {
      setNoteError(
        err instanceof Error ? err.message : "Error al conectar con el servidor"
      );
    } finally {
      setSubmittingNote(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl p-5 md:p-6 my-6 max-h-[90vh] overflow-y-auto">
        {/* Encabezado del Modal */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            {tenant.settings?.logoUrl ? (
              <img
                src={tenant.settings.logoUrl}
                alt={tenant.name}
                className="h-10 w-10 rounded-xl object-contain bg-white/10 p-1 border border-slate-700 shrink-0 shadow-sm"
              />
            ) : (
              <div
                className="h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0 border border-white/20 shadow-sm font-bold text-xs"
                style={{
                  background: `linear-gradient(135deg, ${tenant.settings?.theme?.primaryColor || "#e11d48"}, ${tenant.settings?.theme?.secondaryColor || "#9333ea"})`,
                }}
              >
                {tenant.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-rose-300">
                  {tenant.name}
                </span>
              </div>
              <h2 className="text-base font-extrabold text-white">
                Código QR y Seguimiento en Vivo
              </h2>
              <p className="text-xs text-slate-400">
                Orden #{order.id} • {order.customer?.fullName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo Principal */}
        <div className="mt-4 space-y-5">
          {/* Fila del Código QR y Acciones de Compartir */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/70 rounded-2xl border border-slate-800 p-4">
            <div className="bg-white p-2.5 rounded-xl shrink-0 shadow-md flex flex-col items-center">
              <img
                src={qrDataUrl}
                alt={`QR de orden ${order.id}`}
                className="h-32 w-32 rounded"
              />
              <span className="text-[9px] font-mono font-bold text-slate-800 mt-1 uppercase">
                #{order.id}
              </span>
            </div>

            <div className="flex-1 space-y-2.5 text-center sm:text-left">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Enlace público para el cliente
                </span>
                <p className="text-xs text-slate-300 break-all font-mono bg-slate-900 p-1.5 rounded-lg border border-slate-800 mt-1">
                  {trackingUrl}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  <Copy className="h-3.5 w-3.5 text-slate-300" />
                  {copiedLink ? "¡Copiado!" : "Copiar Enlace"}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQrPng}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5 text-rose-400" />
                  Descargar PNG
                </button>

                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-sky-400" />
                  Ver Página
                </a>
              </div>
            </div>
          </div>

          {/* Botón Destacado: Compartir por WhatsApp con Mensaje Pre-llenado */}
          <div>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-2.5 px-4 shadow-lg transition-all"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar Estado y QR al Cliente por WhatsApp
            </a>
            <p className="text-[11px] text-slate-400 text-center mt-1.5">
              Envía un mensaje con el estatus actual, resumen de abonos y el
              enlace directo para que el cliente no tenga que preguntar a la
              tienda.
            </p>
          </div>

          {/* Sección de Agregar Avance / Bitácora de Confección */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-rose-400" />
                Publicar Actualización de Estado / Avance
              </h3>
            </div>

            {noteError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                {noteError}
              </p>
            )}

            <form onSubmit={handleAddStatusNote} className="space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="sm:w-1/2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Cambiar Estado a:
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) =>
                      setNewStatus(e.target.value as OrderStatusType)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  >
                    {isTailoring ? (
                      <>
                        <option value="DRAFT">Presupuesto / En Toma de Medidas</option>
                        <option value="CONFIRMED_DEPOSIT_PAID">
                          Seña Abonada / En Espera de Materiales
                        </option>
                        <option value="MEASUREMENTS_TAKEN">
                          Medidas Listas / Patronaje y Corte
                        </option>
                        <option value="IN_PRODUCTION">
                          En Confección / Costura Activa
                        </option>
                        <option value="READY_FOR_FITTING">
                          Listo para Prueba (Fitting)
                        </option>
                        <option value="FINAL_ADJUSTMENTS">En Ajustes Finales</option>
                        <option value="READY_FOR_DELIVERY">
                          Listo para Entrega / Retiro
                        </option>
                        <option value="COMPLETED">
                          Entregado y Liquidado (100%)
                        </option>
                        <option value="CANCELLED">Cancelado</option>
                      </>
                    ) : (
                      <>
                        <option value="CONFIRMED_DEPOSIT_PAID">
                          ⏳ Por Confirmar (50% Abonado)
                        </option>
                        <option value="PURCHASED_AT_ORIGIN">
                          🛒 Comprado en Origen
                        </option>
                        <option value="IN_TRANSIT">✈️ En Tránsito Internacional</option>
                        <option value="RECEIVED_IN_WAREHOUSE">
                          📦 En Almacén (Cotejo)
                        </option>
                        <option value="READY_FOR_DELIVERY">
                          ✅ Listo para Entregar
                        </option>
                        <option value="COMPLETED">
                          🎉 Culminado (Entregado 100%)
                        </option>
                        <option value="CANCELLED">Cancelado</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="sm:w-1/2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Nota o Mensaje de Avance:
                  </label>
                  <input
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder={
                      isTailoring
                        ? "ej: Corte de telas completado, listo para prueba"
                        : "ej: Paquete recibido y cotejado en almacén"
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingNote || !statusNote.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs py-1.5 px-3.5 shadow-sm transition-all"
                >
                  <Send className="h-3 w-3" />
                  {submittingNote ? "Guardando..." : "Publicar en Bitácora"}
                </button>
              </div>
            </form>

            {/* Historial Reciente de la Bitácora */}
            {order.statusHistory && order.statusHistory.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                  Bitácora registrada ({order.statusHistory.length} entradas):
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {order.statusHistory.map((ev) => (
                    <div
                      key={ev.id}
                      className="text-xs bg-slate-900 p-2 rounded-xl border border-slate-800/80 flex items-start justify-between gap-2"
                    >
                      <div>
                        <strong className="text-white text-[11px] block">
                          {ev.label}
                        </strong>
                        <p className="text-slate-300 text-[11px] mt-0.5">
                          {ev.note}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {ev.createdAt.slice(0, 10)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusLabelBadge(
  status: OrderStatusType,
  isTailoring: boolean
): string {
  if (isTailoring) {
    switch (status) {
      case "DRAFT":
        return "Presupuesto / En Toma de Medidas";
      case "CONFIRMED_DEPOSIT_PAID":
        return "Seña Abonada / En Espera de Materiales";
      case "MEASUREMENTS_TAKEN":
        return "Medidas Listas / Patronaje y Corte";
      case "IN_PRODUCTION":
        return "En Confección / Costura Activa";
      case "READY_FOR_FITTING":
        return "Listo para Prueba (Fitting)";
      case "FINAL_ADJUSTMENTS":
        return "En Ajustes Finales";
      case "READY_FOR_DELIVERY":
        return "Listo para Entrega / Retiro";
      case "COMPLETED":
        return "Entregado y Liquidado (100%)";
      case "CANCELLED":
        return "Cancelado";
      default:
        return status;
    }
  }

  switch (status) {
    case "DRAFT":
      return "Borrador";
    case "CONFIRMED_DEPOSIT_PAID":
      return "Por Confirmar (50% Abonado)";
    case "PURCHASED_AT_ORIGIN":
      return "Comprado en Origen";
    case "IN_TRANSIT":
      return "En Tránsito";
    case "RECEIVED_IN_WAREHOUSE":
      return "En Almacén";
    case "READY_FOR_DELIVERY":
      return "Listo para Entregar";
    case "COMPLETED":
      return "Culminado / Entregado";
    case "CANCELLED":
      return "Cancelado";
    default:
      return status;
  }
}
