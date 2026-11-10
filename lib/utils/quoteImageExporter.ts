import {
  formatEquivalentSummary,
  formatMoney,
} from "@/lib/utils/currency";
import type { CurrencyType } from "@/lib/validations/schemas";

export interface QuoteExportItem {
  title: string;
  size?: string | null;
  color?: string | null;
  quantity: number;
  finalPrice: number;
}

export interface QuoteExportOptions {
  tenantName: string;
  customerName: string;
  customerPhone?: string | null;
  orderId?: string;
  batchLabel?: string | null;
  dateLabel?: string;
  currency?: CurrencyType | string;
  items: QuoteExportItem[];
  subtotalUsd: number;
  depositPct: number;
  depositUsd: number;
  vesRate?: number;
  copRate?: number;
  paymentSummary?: string;
}

/**
 * Genera y descarga una imagen PNG nítida con la cotización formal para el cliente
 * utilizando HTML5 Canvas nativo, soportando múltiples monedas (COP, USD, VES).
 */
export async function exportQuoteAsPng(opts: QuoteExportOptions): Promise<void> {
  const currency = (opts.currency || "USD").toUpperCase();
  const rates = {
    USD: 1,
    COP: opts.copRate || 4200,
    VES: opts.vesRate || 46.8,
  };

  const width = 760;
  const itemRowHeight = 56;
  const maxItemsShown = Math.min(opts.items.length, 15);
  const height = 400 + maxItemsShown * itemRowHeight + 165;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Fondo general oscuro elegante
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, width, height);

  // Tarjeta interior
  ctx.fillStyle = "#111827";
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(28, 28, width - 56, height - 56, 20);
  ctx.fill();
  ctx.stroke();

  // Banda superior de acento
  const grad = ctx.createLinearGradient(28, 28, width - 28, 28);
  grad.addColorStop(0, "#f43f5e");
  grad.addColorStop(1, "#8b5cf6");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(28, 28, width - 56, 10, [20, 20, 0, 0]);
  ctx.fill();

  // Encabezado de Tienda
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
  ctx.fillText(opts.tenantName.toUpperCase(), 56, 82);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 14px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    opts.orderId
      ? `COTIZACIÓN / PEDIDO #${opts.orderId} (${currency}) ${opts.batchLabel ? `• ${opts.batchLabel}` : ""}`
      : `COTIZACIÓN DE ENCARGO (${currency}) ${opts.batchLabel ? `• ${opts.batchLabel}` : ""}`,
    56,
    108
  );

  const dateText =
    opts.dateLabel ||
    new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date());

  ctx.textAlign = "right";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "600 14px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Fecha: ${dateText}`, width - 56, 82);

  // Caja de datos del cliente
  ctx.textAlign = "left";
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.roundRect(56, 128, width - 112, 66, 12);
  ctx.fill();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 12px system-ui, -apple-system, sans-serif";
  ctx.fillText("CLIENTE", 74, 150);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 17px system-ui, -apple-system, sans-serif";
  ctx.fillText(opts.customerName || "Cliente por confirmar", 74, 174);

  if (opts.customerPhone) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#34d399";
    ctx.font = "600 14px system-ui, -apple-system, sans-serif";
    ctx.fillText(`WhatsApp: ${opts.customerPhone}`, width - 74, 166);
  }

  // Cabecera de tabla de productos
  let y = 224;
  ctx.textAlign = "left";
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
  ctx.fillText("PRODUCTO / ESPECIFICACIONES", 56, y);
  ctx.textAlign = "center";
  ctx.fillText("CANT.", width - 185, y);
  ctx.textAlign = "right";
  ctx.fillText(`SUBTOTAL (${currency})`, width - 56, y);

  y += 14;
  ctx.strokeStyle = "#1e293b";
  ctx.beginPath();
  ctx.moveTo(56, y);
  ctx.lineTo(width - 56, y);
  ctx.stroke();

  // Filas de productos
  y += 28;
  for (let i = 0; i < maxItemsShown; i++) {
    const item = opts.items[i];
    const lineTotal = (Number(item.finalPrice) || 0) * (Number(item.quantity) || 1);
    const titleShort =
      item.title.length > 50 ? `${item.title.slice(0, 47)}...` : item.title;

    ctx.textAlign = "left";
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "600 14px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${i + 1}. ${titleShort}`, 56, y);

    const specs = [
      item.size ? `Talla: ${item.size}` : null,
      item.color ? `Color: ${item.color}` : null,
      `${formatMoney(Number(item.finalPrice), currency)} c/u`,
    ]
      .filter(Boolean)
      .join("  •  ");

    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 12px system-ui, -apple-system, sans-serif";
    ctx.fillText(specs, 74, y + 18);

    ctx.textAlign = "center";
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
    ctx.fillText(`x${item.quantity || 1}`, width - 185, y + 6);

    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
    ctx.fillText(formatMoney(lineTotal, currency), width - 56, y + 6);

    y += itemRowHeight;
  }

  // Resumen Financiero
  y += 10;
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = "#334155";
  ctx.beginPath();
  ctx.roundRect(56, y, width - 112, 136, 14);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "600 15px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `Subtotal (${opts.items.reduce((a, b) => a + (b.quantity || 1), 0)} prendas):`,
    78,
    y + 32
  );

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
  ctx.fillText(formatMoney(opts.subtotalUsd, currency), width - 78, y + 32);

  // Seña requerida
  ctx.textAlign = "left";
  ctx.fillStyle = "#34d399";
  ctx.font = "bold 17px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `Inicial / Seña para encargar (${opts.depositPct}%):`,
    78,
    y + 66
  );

  ctx.textAlign = "right";
  ctx.fillStyle = "#34d399";
  ctx.font = "bold 21px system-ui, -apple-system, sans-serif";
  ctx.fillText(formatMoney(opts.depositUsd, currency), width - 78, y + 66);

  // Equivalencia multimoneda para facilitar el pago
  const eqSummary = formatEquivalentSummary(opts.depositUsd, currency, rates);
  ctx.textAlign = "right";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 12px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Equivalente seña: ${eqSummary}`, width - 78, y + 88);

  // Restante
  const balance = Math.max(0, opts.subtotalUsd - opts.depositUsd);
  ctx.textAlign = "left";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 13px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `Restante al recibir mercancía: ${formatMoney(balance, currency)}`,
    78,
    y + 116
  );

  if (opts.paymentSummary) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "500 12px system-ui, -apple-system, sans-serif";
    ctx.fillText(opts.paymentSummary.slice(0, 48), width - 78, y + 116);
  }

  // Descargar PNG
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  const safeName = (opts.customerName || "cliente")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  link.download = `cotizacion-${safeName}-${Date.now().toString().slice(-4)}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
