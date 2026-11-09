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
 * Genera el texto de resumen de cotización o estado de pedido para enviar por WhatsApp.
 */
export function buildOrderWhatsAppMessage(params: {
  tenantName: string;
  customerName: string;
  orderId?: string;
  batchCode?: string | null;
  subtotalUsd: number;
  depositRequiredUsd: number;
  balanceDueUsd: number;
  vesRate?: number;
  itemsCount: number;
}): string {
  const vesDeposit = params.vesRate
    ? ` (Bs. ${(params.depositRequiredUsd * params.vesRate).toFixed(2)})`
    : "";

  return [
    `Hola *${params.customerName}*, te escribimos de *${params.tenantName}* ✨`,
    params.orderId
      ? `Resumen de tu pedido *#${params.orderId}*${params.batchCode ? ` (${params.batchCode})` : ""}:`
      : `Resumen de tu cotización (${params.itemsCount} productos):`,
    `• Total: *$${params.subtotalUsd.toFixed(2)} USD*`,
    `• Seña 50%: *$${params.depositRequiredUsd.toFixed(2)} USD*${vesDeposit}`,
    `• Restante al recibir: *$${params.balanceDueUsd.toFixed(2)} USD*`,
  ].join("\n");
}

