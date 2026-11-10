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
}): string {
  const currency = (params.currency || "USD").toUpperCase();
  const rates = {
    USD: 1,
    COP: params.copRate || 4200,
    VES: params.vesRate || 46.8,
  };

  const eqDeposit = formatEquivalentSummary(
    params.depositRequiredUsd,
    currency,
    rates
  );

  return [
    `Hola *${params.customerName}*, te escribimos de *${params.tenantName}* ✨`,
    params.orderId
      ? `Resumen de tu pedido *#${params.orderId}*${params.batchCode ? ` (${params.batchCode})` : ""}:`
      : `Resumen de tu cotización (${params.itemsCount} productos):`,
    `• Total (${currency}): *${formatMoney(params.subtotalUsd, currency)}*`,
    `• Seña inicial: *${formatMoney(params.depositRequiredUsd, currency)}* (${eqDeposit})`,
    `• Restante al recibir: *${formatMoney(params.balanceDueUsd, currency)}*`,
  ].join("\n");
}
