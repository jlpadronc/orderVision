import {
  formatEquivalentSummary,
  formatMoney,
} from "@/lib/utils/currency";
import type { CurrencyType } from "@/lib/validations/schemas";

/**
 * Limpia un número telefónico y genera un enlace directo a WhatsApp (wa.me)
 * con mensaje pre-llenado opcional.
 */
export function buildWhatsAppUrl(phone: string | null | undefined, message?: string): string {
  const digits = (phone || "").replace(/[^\d]/g, "");
  if (!digits) {
    if (!message) return "https://wa.me";
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
  const cleanPhone = digits.length >= 10 ? digits : `58${digits}`;
  const baseUrl = `https://wa.me/${cleanPhone}`;
  if (!message) return baseUrl;
  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}

/**
 * Genera el texto de resumen de cotización o estado de pedido para enviar por WhatsApp,
 * soportando múltiples monedas (COP, USD, VES) y sus conversiones.
 */
export function buildOrderWhatsAppMessage(params: {
  tenantName: string;
  customerName: string;
  orderId?: string;
  batchCode?: string | null;
  currency?: CurrencyType | string;
  subtotalUsd: number;
  depositRequiredUsd: number;
  balanceDueUsd: number;
  vesRate?: number;
  copRate?: number;
  itemsCount: number;
  statusLabel?: string;
  trackingUrl?: string;
  customTemplate?: string | null;
}): string {
  const currency = (params.currency || "USD").toUpperCase();
  const rates = {
    USD: 1,
    COP: params.copRate || 4200,
    VES: params.vesRate || 46.8,
  };

  const formattedTotal = formatMoney(params.subtotalUsd, currency);
  const formattedDeposit = formatMoney(params.depositRequiredUsd, currency);
  const formattedBalance = formatMoney(params.balanceDueUsd, currency);
  const eqDeposit = formatEquivalentSummary(
    params.depositRequiredUsd,
    currency,
    rates
  );

  if (params.customTemplate && params.customTemplate.trim()) {
    return params.customTemplate
      .replace(/{cliente}/gi, params.customerName)
      .replace(/{negocio}/gi, params.tenantName)
      .replace(/{pedido}/gi, params.orderId || "COTIZACION")
      .replace(/{estado}/gi, params.statusLabel || "Por Confirmar (50% Abonado)")
      .replace(/{moneda}/gi, currency)
      .replace(/{total}/gi, formattedTotal)
      .replace(/{abono}|{seña}/gi, `${formattedDeposit} (${eqDeposit})`)
      .replace(/{saldo}|{restante}/gi, formattedBalance)
      .replace(/{link}|{url}|{seguimiento}/gi, params.trackingUrl || "");
  }

  const lines = [
    `¡Hola *${params.customerName}*! Te escribimos de *${params.tenantName}* ✨`,
    params.orderId
      ? `📋 *Resumen de Estado y Cotización del Pedido #${params.orderId}*${params.batchCode ? ` (${params.batchCode})` : ""}:`
      : `📋 *Resumen de Cotización (${params.itemsCount} producto${params.itemsCount === 1 ? "" : "s"})*:`,
    `👉 *Estado:* ${params.statusLabel || "Por Confirmar (50% Abonado)"}`,
    `• *Total (${currency}):* ${formattedTotal}`,
    `• *Seña requerida:* ${formattedDeposit} (${eqDeposit})`,
    `• *Saldo restante al recibir:* ${formattedBalance}`,
  ];

  if (params.trackingUrl) {
    lines.push(
      "",
      "🔍 *Consulta tu pedido y seguimiento en vivo aquí:*",
      params.trackingUrl
    );
  }

  lines.push("", "¡Gracias por tu preferencia!");
  return lines.join("\n");
}

/**
 * Genera el mensaje personalizado de seguimiento en tiempo real con enlace y QR
 * para que el cliente consulte el estado de su confección o compra directamente.
 */
export function buildOrderTrackingWhatsAppMessage(params: {
  tenantName: string;
  customerName: string;
  customerDocumentId?: string | null;
  orderId: string;
  statusLabel: string;
  businessType?: "IMPORT" | "TAILORING" | "HYBRID";
  trackingUrl: string;
  subtotal: number;
  depositAmountPaid: number;
  balanceDue: number;
  currency: CurrencyType | string;
  fittingDate?: string | null;
  estimatedDeliveryDate?: string | null;
  itemsDescription?: string;
  customTemplate?: string | null;
}): string {
  const currency = (params.currency || "USD").toUpperCase();
  const formattedTotal = formatMoney(params.subtotal, currency);
  const formattedAbono = formatMoney(params.depositAmountPaid, currency);
  const formattedSaldo = formatMoney(params.balanceDue, currency);

  if (params.customTemplate && params.customTemplate.trim()) {
    return params.customTemplate
      .replace(/{cliente}/gi, params.customerName)
      .replace(/{negocio}/gi, params.tenantName)
      .replace(/{pedido}/gi, params.orderId)
      .replace(/{estado}/gi, params.statusLabel)
      .replace(/{moneda}/gi, currency)
      .replace(/{total}/gi, formattedTotal)
      .replace(/{abono}|{seña}/gi, formattedAbono)
      .replace(/{saldo}|{restante}/gi, formattedSaldo)
      .replace(/{link}|{url}|{seguimiento}/gi, params.trackingUrl);
  }

  const isTailoring = params.businessType === "TAILORING";

  const lines: string[] = [
    `¡Hola *${params.customerName}*! Te saludamos de *${params.tenantName}* ✨`,
    isTailoring
      ? `👗 Tu orden de confección *#${params.orderId}* se encuentra actualmente en estado:`
      : `📦 Tu pedido *#${params.orderId}* se encuentra en estado:`,
    `👉 *${params.statusLabel}*`,
  ];

  if (params.customerDocumentId) {
    lines.push(`🪪 *C.I / Cédula:* ${params.customerDocumentId}`);
  }

  if (params.itemsDescription) {
    lines.push(`• Detalle: ${params.itemsDescription}`);
  }

  if (isTailoring && params.fittingDate) {
    lines.push(`📅 *Fecha de Prueba / Fitting:* ${params.fittingDate.slice(0, 10)}`);
  }

  if (params.estimatedDeliveryDate) {
    lines.push(`🚚 *Fecha Estimada de Entrega:* ${params.estimatedDeliveryDate.slice(0, 10)}`);
  }

  lines.push(
    `💰 *Total (${currency}):* ${formattedTotal}`,
    `💵 *Abono registrado:* ${formattedAbono}`,
    `⏳ *Saldo pendiente:* ${formattedSaldo}`,
    "",
    "🔍 *Puedes consultar el avance en tiempo real en cualquier momento aquí:*",
    params.trackingUrl,
    "",
    "¡Gracias por tu confianza!"
  );

  return lines.join("\n");
}
