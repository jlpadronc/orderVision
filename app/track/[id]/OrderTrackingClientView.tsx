"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  HeartHandshake,
  Layers,
  MessageCircle,
  Ruler,
  Scissors,
  Sparkles,
  Truck,
} from "lucide-react";
import type { PublicOrderTrackRecord } from "@/lib/repositories/multiTenantRepository";
import { formatMoney } from "@/lib/utils/currency";
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import type { OrderStatusType } from "@/lib/validations/schemas";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface OrderTrackingClientViewProps {
  order: PublicOrderTrackRecord;
}

interface TimelineStep {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  isCompleted: boolean;
  isCurrent: boolean;
}

export function OrderTrackingClientView({ order }: OrderTrackingClientViewProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const isTailoring = order.businessType === "TAILORING";
  const primaryColor = order.tenant.theme?.primaryColor || "#e11d48";
  const secondaryColor = order.tenant.theme?.secondaryColor || "#9333ea";

  // Enlace del pedido para mensajes
  const currentUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://ordervision.app/track/${order.id}`;

  // Pasos secuenciales de la línea de tiempo según el tipo de negocio
  const steps: TimelineStep[] = useMemo(() => {
    if (isTailoring) {
      const tailoringOrder: OrderStatusType[] = [
        "DRAFT",
        "CONFIRMED_DEPOSIT_PAID",
        "MEASUREMENTS_TAKEN",
        "IN_PRODUCTION",
        "READY_FOR_FITTING",
        "FINAL_ADJUSTMENTS",
        "READY_FOR_DELIVERY",
        "COMPLETED",
      ];
      const currentIndex = tailoringOrder.indexOf(order.status);
      const effectiveIndex = currentIndex === -1 ? 0 : currentIndex;

      const labels: Record<
        string,
        { label: string; desc: string; icon: React.ReactNode }
      > = {
        DRAFT: {
          label: "Presupuesto",
          desc: "Toma de medidas inicial",
          icon: <Ruler className="h-4 w-4" />,
        },
        CONFIRMED_DEPOSIT_PAID: {
          label: "Seña Abonada",
          desc: "Materiales y apartado",
          icon: <CheckCircle2 className="h-4 w-4" />,
        },
        MEASUREMENTS_TAKEN: {
          label: "Patronaje y Corte",
          desc: "Corte de telas y forros",
          icon: <Scissors className="h-4 w-4" />,
        },
        IN_PRODUCTION: {
          label: "En Confección",
          desc: "Costura activa en taller",
          icon: <Layers className="h-4 w-4" />,
        },
        READY_FOR_FITTING: {
          label: "Prueba (Fitting)",
          desc: "Ajuste sobre tu figura",
          icon: <HeartHandshake className="h-4 w-4" />,
        },
        FINAL_ADJUSTMENTS: {
          label: "Ajustes Finales",
          desc: "Detalles y bastillas",
          icon: <Sparkles className="h-4 w-4" />,
        },
        READY_FOR_DELIVERY: {
          label: "Listo para Retiro",
          desc: "Planchado y empacado",
          icon: <Truck className="h-4 w-4" />,
        },
        COMPLETED: {
          label: "Entregado",
          desc: "100% Liquidado",
          icon: <CheckCircle2 className="h-4 w-4" />,
        },
      };

      return tailoringOrder.map((st, idx) => ({
        key: st,
        label: labels[st].label,
        description: labels[st].desc,
        icon: labels[st].icon,
        isCompleted: idx < effectiveIndex || order.status === "COMPLETED",
        isCurrent: idx === effectiveIndex && order.status !== "COMPLETED",
      }));
    }

    // Modo Importación / General
    const importOrder: OrderStatusType[] = [
      "DRAFT",
      "CONFIRMED_DEPOSIT_PAID",
      "PURCHASED_AT_ORIGIN",
      "IN_TRANSIT",
      "RECEIVED_IN_WAREHOUSE",
      "READY_FOR_DELIVERY",
      "COMPLETED",
    ];
    const currentIndex = importOrder.indexOf(order.status);
    const effectiveIndex = currentIndex === -1 ? 0 : currentIndex;

    const labels: Record<
      string,
      { label: string; desc: string; icon: React.ReactNode }
    > = {
      DRAFT: {
        label: "Cotización",
        desc: "Armado de pedido",
        icon: <Clock className="h-4 w-4" />,
      },
      CONFIRMED_DEPOSIT_PAID: {
        label: "Seña Abonada",
        desc: "50% pagado",
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      PURCHASED_AT_ORIGIN: {
        label: "Comprado",
        desc: "En tienda origen",
        icon: <Layers className="h-4 w-4" />,
      },
      IN_TRANSIT: {
        label: "En Tránsito",
        desc: "Viajando a destino",
        icon: <Truck className="h-4 w-4" />,
      },
      RECEIVED_IN_WAREHOUSE: {
        label: "En Almacén",
        desc: "Cotejo de paquetes",
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      READY_FOR_DELIVERY: {
        label: "Listo Entrega",
        desc: "Disponible para retiro",
        icon: <Truck className="h-4 w-4" />,
      },
      COMPLETED: {
        label: "Entregado",
        desc: "Liquidado 100%",
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
    };

    return importOrder.map((st, idx) => ({
      key: st,
      label: labels[st].label,
      description: labels[st].desc,
      icon: labels[st].icon,
      isCompleted: idx < effectiveIndex || order.status === "COMPLETED",
      isCurrent: idx === effectiveIndex && order.status !== "COMPLETED",
    }));
  }, [order.status, isTailoring]);

  const waConfig = order.tenant.whatsappConfig ?? {
    enabled: true,
    phoneNumber: order.tenant.phone,
    buttonText: "Contactar por WhatsApp",
    customMessage: "Hola {negocio}, quisiera consultar información sobre mi pedido #{pedido}. Enlace de seguimiento: {link}",
  };

  const targetWaPhone = waConfig.phoneNumber || order.tenant.phone;
  const rawMsg =
    waConfig.customMessage ||
    "Hola {negocio}, quisiera consultar información sobre mi pedido #{pedido}. Enlace de seguimiento: {link}";
  const waMessage = rawMsg
    .replace(/{negocio}/gi, order.tenant.name)
    .replace(/{pedido}/gi, order.id)
    .replace(/{cliente}/gi, order.customer.displayName)
    .replace(/{link}/gi, currentUrl);

  const whatsappInquiryUrl = buildWhatsAppUrl(
    targetWaPhone || undefined,
    waMessage
  );

  return (
    <div
      className="max-w-4xl mx-auto w-full space-y-6 pb-12"
      style={{
        ["--brand-primary" as string]: primaryColor,
        ["--brand-secondary" as string]: secondaryColor,
        ["--brand-gradient" as string]: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
      }}
    >
      {/* Cabecera / Título de Marca del Tenant (Tienda) que resalta la identidad del negocio */}
      <header className="pt-2 pb-4 border-b border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {order.tenant.logoUrl ? (
              <img
                src={order.tenant.logoUrl}
                alt={order.tenant.name}
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-contain border border-slate-700/80 bg-white/10 p-2 shadow-lg ring-1 ring-white/10 shrink-0"
              />
            ) : (
              <div
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl flex items-center justify-center font-black text-white text-2xl sm:text-3xl shadow-xl border border-white/20 shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                }}
              >
                {order.tenant.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <span
                className="inline-block text-[11px] font-bold uppercase tracking-wider mb-0.5"
                style={{ color: primaryColor }}
              >
                {isTailoring ? "Atelier de Costura y Confección" : "Tienda Oficial"}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                {order.tenant.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Portal Oficial de Seguimiento y Estado de Pedidos
              </p>
            </div>
          </div>

          {/* Acciones de interfaz (WhatsApp y Tema) */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            {waConfig.enabled && (
              <a
                href={whatsappInquiryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition-all shadow-xs"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{waConfig.buttonText || "WhatsApp"}</span>
              </a>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Contenido Principal de Seguimiento */}
      <div className="space-y-6">
        {/* Banner de Saludo e Identificador de Pedido */}
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 p-5 md:p-6 shadow-xl relative overflow-hidden">
          <div
            className="absolute top-0 right-0 -mr-12 -mt-12 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-20"
            style={{ backgroundColor: primaryColor }}
          />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border"
                style={{
                  backgroundColor: `${primaryColor}15`,
                  borderColor: `${primaryColor}40`,
                  color: primaryColor,
                }}
              >
                <Sparkles className="h-3 w-3" />
                Seguimiento en Tiempo Real
              </div>

              <h2 className="mt-2 text-xl md:text-2xl font-black text-white">
                ¡Hola, {order.customer.displayName}!
              </h2>
              {order.customer.documentId && (
                <span className="inline-block mt-0.5 rounded-md bg-slate-800/90 px-2 py-0.5 text-xs font-mono text-slate-300 border border-slate-700">
                  C.I / Cédula: {order.customer.documentId}
                </span>
              )}
              <p className="text-xs md:text-sm text-slate-300 mt-1">
                Aquí puedes verificar en vivo el progreso, las medidas y los
                pagos de tu orden.
              </p>
            </div>

            <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-3 self-start sm:self-auto text-left sm:text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Orden Nº
              </span>
              <span
                className="font-mono text-base md:text-lg font-black"
                style={{ color: primaryColor }}
              >
                #{order.id}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {order.orderDate.slice(0, 10)}
              </span>
            </div>
          </div>

          {/* Tarjetas de Fechas Clave (Fitting y Entrega) */}
          {(order.fittingDate || order.estimatedDeliveryDate) && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-800/80">
              {order.fittingDate && (
                <div className="flex items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-purple-300 block">
                      Fecha de Prueba (Fitting)
                    </span>
                    <strong className="text-sm font-extrabold text-white">
                      {order.fittingDate.slice(0, 10)}
                    </strong>
                  </div>
                </div>
              )}

              {order.estimatedDeliveryDate && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-300 block">
                      Fecha Estimada de Entrega
                    </span>
                    <strong className="text-sm font-extrabold text-white">
                      {order.estimatedDeliveryDate.slice(0, 10)}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Resumen Financiero y Abonos */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <span className="text-xs text-slate-400 block font-medium">
              Total del Pedido
            </span>
            <p className="mt-1 text-xl font-extrabold text-white">
              {formatMoney(order.subtotal, order.currency)}
            </p>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Moneda: {order.currency}
            </span>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-300 font-semibold">
                Abono / Seña Pagada
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-emerald-300">
              {formatMoney(order.depositAmountPaid, order.currency)}
            </p>
            <span className="text-[10px] text-emerald-400/80 block mt-0.5 font-medium">
              Registrado y validado
            </span>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              order.balanceDue <= 0
                ? "border-teal-500/30 bg-teal-500/10"
                : "border-amber-500/30 bg-amber-500/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold ${
                  order.balanceDue <= 0 ? "text-teal-300" : "text-amber-300"
                }`}
              >
                {order.balanceDue <= 0 ? "Estado Financiero" : "Saldo Pendiente"}
              </span>
              {order.balanceDue <= 0 ? (
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
              ) : (
                <Clock className="h-4 w-4 text-amber-400" />
              )}
            </div>
            <p
              className={`mt-1 text-xl font-extrabold ${
                order.balanceDue <= 0 ? "text-teal-300" : "text-amber-300"
              }`}
            >
              {order.balanceDue <= 0
                ? "100% Liquidado"
                : formatMoney(order.balanceDue, order.currency)}
            </p>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {order.balanceDue <= 0
                ? "No hay saldo por pagar"
                : "A liquidar al recibir tu pedido"}
            </span>
          </div>
        </section>

        {/* Línea de Tiempo Visual del Pedido */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 md:p-6 shadow-md">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-extrabold text-white">
                Progreso de tu Pedido
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Etapas del proceso desde la confección hasta la entrega
              </p>
            </div>
            <span
              className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-bold"
              style={{ color: primaryColor }}
            >
              {steps.filter((s) => s.isCompleted || s.isCurrent).length} de{" "}
              {steps.length} etapas
            </span>
          </div>

          <div className="relative">
            {/* Lista vertical en móviles, horizontal en pantallas medianas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {steps.map((st, i) => (
                <div
                  key={st.key}
                  className={`rounded-2xl border p-3.5 transition-all flex flex-col justify-between ${
                    st.isCurrent
                      ? "ring-2"
                      : st.isCompleted
                      ? "border-emerald-500/30 bg-emerald-500/5 text-slate-200"
                      : "border-slate-800/80 bg-slate-950/60 text-slate-400 opacity-60"
                  }`}
                  style={
                    st.isCurrent
                      ? {
                          borderColor: `${primaryColor}99`,
                          backgroundColor: `${primaryColor}15`,
                          boxShadow: `0 0 16px ${primaryColor}22`,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                        st.isCurrent
                          ? "text-white shadow-sm"
                          : st.isCompleted
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}
                      style={
                        st.isCurrent
                          ? {
                              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                            }
                          : undefined
                      }
                    >
                      {st.isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        i + 1
                      )}
                    </span>

                    {st.isCurrent && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold animate-pulse border"
                        style={{
                          backgroundColor: `${primaryColor}20`,
                          borderColor: `${primaryColor}50`,
                          color: primaryColor,
                        }}
                      >
                        En curso
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <h4 className="text-xs font-bold text-white leading-snug">
                      {st.label}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      {st.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Prendas del Pedido (Solo foto, nombre y cantidad) */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 md:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white">
                {isTailoring ? "Prendas del Pedido" : "Artículos del Pedido"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Resumen de artículos incluidos
              </p>
            </div>
            <span className="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300">
              {order.items.reduce((acc, i) => acc + i.quantity, 0)}{" "}
              {order.items.reduce((acc, i) => acc + i.quantity, 0) === 1 ? "artículo" : "artículos"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3.5 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3"
              >
                {item.sourceImageUrl ? (
                  <img
                    src={item.sourceImageUrl}
                    alt={item.title}
                    className="h-14 w-14 rounded-xl object-cover border border-slate-700 bg-slate-800 shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-xl border border-slate-700 bg-slate-800/60 flex items-center justify-center shrink-0 text-slate-400">
                    {isTailoring ? (
                      <Scissors className="h-5 w-5" style={{ color: primaryColor }} />
                    ) : (
                      <Layers className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">
                    {item.title}
                  </h4>
                  <span className="inline-block mt-0.5 rounded-md bg-slate-800/80 border border-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300">
                    Cantidad: {item.quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bitácora de Avances y Notificaciones (Desplegable) */}
        {order.statusHistory && order.statusHistory.length > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/90 shadow-md overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className="w-full p-5 md:p-6 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${primaryColor}20`,
                    color: primaryColor,
                  }}
                >
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Bitácora de Avances y Notificaciones
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {order.statusHistory.length} actualización{order.statusHistory.length === 1 ? "" : "es"} registrada{order.statusHistory.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${
                  historyOpen ? "rotate-180 text-white" : ""
                }`}
              />
            </button>

            {historyOpen && (
              <div className="px-5 pb-5 md:px-6 md:pb-6 pt-1 border-t border-slate-800/80 space-y-2.5">
                {order.statusHistory.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 flex items-start gap-3"
                  >
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        backgroundColor: `${primaryColor}20`,
                        color: primaryColor,
                      }}
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <strong className="text-xs font-bold text-white">
                          {ev.label}
                        </strong>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ev.createdAt.slice(0, 16).replace("T", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {ev.note}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Mini-Navbar / Barra Inferior OrderVision */}
      <footer className="mt-12 pt-6 pb-6 border-t border-slate-800/80">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-purple-600 text-[10px] font-black text-white shadow-xs">
              OV
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-white text-xs tracking-tight">
                OrderVision
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-[11px] text-slate-400">
                Plataforma de Gestión y Seguimiento de Pedidos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Seguimiento en vivo para {order.tenant.name}</span>
            <span className="text-slate-600">•</span>
            <span className="font-mono text-slate-400">v2.4</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
