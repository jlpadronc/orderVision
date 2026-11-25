"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Eye,
  FileCheck2,
  FileText,
  Layers,
  MessageCircle,
  Palette,
  Ruler,
  Scissors,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function LandingPageView() {
  const [activeTab, setActiveTab] = useState<"import" | "tailoring" | "tracking">("import");

  return (
    <div className="w-full text-slate-100 selection:bg-rose-500 selection:text-white">
      {/* 1. BARRA DE NAVEGACIÓN DE LA LANDING */}
      <header className="sticky top-0 z-40 -mx-3 -mt-4 sm:-mx-6 sm:-mt-6 mb-8 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-purple-600 font-black text-white text-sm shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
              OV
            </div>
            <div>
              <span className="text-base font-extrabold text-white tracking-tight leading-none block">
                OrderVision
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Gestión de Pedidos & Lotes
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#casos-de-uso" className="hover:text-white transition-colors">
              Casos de Uso
            </a>
            <a href="#caracteristicas" className="hover:text-white transition-colors">
              Características
            </a>
            <a href="#como-funciona" className="hover:text-white transition-colors">
              Cómo Funciona
            </a>
            <a href="#comparativa" className="hover:text-white transition-colors">
              Por qué OrderVision
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle compact />
            <Link
              href="/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl btn-brand-gradient px-4 text-xs font-bold shadow-md hover:brightness-110 transition-all"
            >
              <span>Acceder</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* 2. HERO PRINCIPAL */}
      <section className="relative pt-6 pb-16 md:pt-12 md:pb-24 text-center max-w-4xl mx-auto space-y-6">
        {/* Glow de fondo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 h-80 sm:h-96 bg-gradient-to-tr from-rose-500/20 to-purple-600/20 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Badge de anuncio */}
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1 text-xs font-bold text-rose-300">
          <Sparkles className="h-3.5 w-3.5 text-rose-400" />
          <span>OrderVision 2.0 • Plataforma Multi-Tenant para Negocios y Talleres</span>
        </div>

        {/* Título de alto impacto */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight">
          La plataforma definitiva para gestionar tus{" "}
          <span className="bg-gradient-to-r from-rose-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent">
            pedidos, lotes y confección
          </span>
        </h1>

        {/* Subtítulo descriptivo */}
        <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Diseñada para <strong>tiendas de encargos por lotes</strong> y <strong>ateliers de costura</strong>. Controla seña del 50%, cotizaciones instantáneas en PNG, fichas de medidas corporales, multi-moneda (USD, COP, VES) y seguimiento en tiempo real con la marca propia de tu negocio.
        </p>

        {/* Botones de acción principal */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-12 items-center gap-2 rounded-2xl btn-brand-gradient px-6 text-sm font-bold shadow-lg shadow-rose-500/25 hover:scale-102 transition-transform"
          >
            <span>Ingresar a la Plataforma</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <a
            href="#casos-de-uso"
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Eye className="h-4 w-4 text-slate-400" />
            <span>Explorar Casos de Uso</span>
          </a>
        </div>

        {/* Trust Badges */}
        <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left border-t border-slate-800/80">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
            <span className="text-lg font-black text-white block">80% Menos</span>
            <span className="text-xs text-slate-400">Mensajes de "¿cuándo llega mi pedido?"</span>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
            <span className="text-lg font-black text-rose-400 block">100% Tu Marca</span>
            <span className="text-xs text-slate-400">Logo, paleta de colores y tema propio</span>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
            <span className="text-lg font-black text-emerald-400 block">USD • COP • VES</span>
            <span className="text-xs text-slate-400">Multi-moneda con tasas en tiempo real</span>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
            <span className="text-lg font-black text-purple-400 block">0 a 100% Seña</span>
            <span className="text-xs text-slate-400">Cierre de abono inicial garantizado</span>
          </div>
        </div>
      </section>

      {/* 3. VISTA PREVIA INTERACTIVA (MOCKUP EN VIVO) */}
      <section className="mb-20 rounded-3xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 border-b border-slate-800 pb-4">
          <div>
            <span className="text-[11px] uppercase font-bold text-rose-400 tracking-wider block">
              Demostración Interactiva
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-white">
              Visualiza cómo funciona OrderVision en el día a día
            </h2>
          </div>

          {/* Selector de pestañas interactivas */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("import")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === "import"
                  ? "btn-brand-gradient text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📦 Gestión por Lotes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tailoring")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === "tailoring"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ✂️ Atelier & Medidas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tracking")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === "tracking"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📱 Tracking del Cliente
            </button>
          </div>
        </div>

        {/* Contenido según pestaña */}
        {activeTab === "import" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <span className="text-xs text-slate-400">Lote Activo de Octubre</span>
                <p className="text-lg font-black text-white mt-1">LOTE-OCT-24 (Cierre: 15 Oct)</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>24 Pedidos agrupados</span>
                  <span className="text-emerald-400 font-bold">$1,850.00 USD</span>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <span className="text-xs text-emerald-300 font-semibold">Señas Iniciales Cobradas</span>
                <p className="text-lg font-black text-emerald-300 mt-1">$925.00 USD</p>
                <span className="text-[11px] text-emerald-400/80 mt-1 block">50% asegurado antes de comprar</span>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <span className="text-xs text-amber-300 font-semibold">Cotejo Físico de Almacén</span>
                <p className="text-lg font-black text-amber-300 mt-1">18 / 24 Verificados</p>
                <span className="text-[11px] text-slate-400 mt-1 block">Checklist prenda por prenda</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center font-bold">
                  01
                </div>
                <div>
                  <strong className="text-white block text-sm">Creación de Pedido con Cotización PNG</strong>
                  <span className="text-slate-400">Descarga inmediata en imagen con estética profesional para WhatsApp</span>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-3 py-1 font-bold text-[11px] border border-emerald-500/30">
                1-Clic WhatsApp Directo
              </span>
            </div>
          </div>
        )}

        {activeTab === "tailoring" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-500/20 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-300">Ficha Anatómica Digital</span>
                  <h3 className="text-base font-black text-white">Vestido de Gala Silueta Sirena</h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-lg bg-purple-900/60 border border-purple-500/40 px-2.5 py-1 text-purple-200">
                    Fitting: 28 Oct 2026
                  </span>
                </div>
              </div>

              {/* Medidas y Opciones */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 text-xs">
                <div className="rounded-xl bg-slate-950/80 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Talle / Busto</span>
                  <strong className="text-slate-100 font-mono">42 cm / 94 cm</strong>
                </div>
                <div className="rounded-xl bg-slate-950/80 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Cintura / Cadera</span>
                  <strong className="text-slate-100 font-mono">68 cm / 102 cm</strong>
                </div>
                <div className="rounded-xl bg-slate-950/80 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Espalda</span>
                  <strong className="text-fuchsia-300">Espalda de Pico</strong>
                </div>
                <div className="rounded-xl bg-slate-950/80 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Cola & Gafetes</span>
                  <strong className="text-amber-300">Levanta Cola • DG</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "tracking" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center font-black text-white text-base">
                  AT
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Atelier Bella Moda</h3>
                  <span className="text-[11px] text-emerald-400 font-semibold">● Seguimiento en Vivo para el Cliente</span>
                </div>
              </div>
              <span className="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs font-mono text-slate-300">
                #ORD-8942
              </span>
            </div>

            {/* Pasos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5">
                <span className="text-[10px] text-emerald-400 font-bold block">Paso 1 ✓</span>
                <strong className="text-white">Seña Abonada</strong>
              </div>
              <div className="rounded-xl border border-rose-500/60 bg-rose-500/15 p-2.5 ring-1 ring-rose-500/30">
                <span className="text-[10px] text-rose-300 font-bold block animate-pulse">Paso 2 (En Curso)</span>
                <strong className="text-white">En Producción</strong>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-slate-400">
                <span className="text-[10px] block">Paso 3</span>
                <strong>Prueba (Fitting)</strong>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-slate-400">
                <span className="text-[10px] block">Paso 4</span>
                <strong>Listo para Entrega</strong>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 4. CASOS DE USO CONCRETOS (EL FIN U OBJETIVO DE LA PLATAFORMA) */}
      <section id="casos-de-uso" className="mb-20 space-y-10 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs uppercase font-bold text-rose-400 tracking-wider">
            Adaptabilidad para tu Modelo de Negocio
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            Tres Casos de Uso Reales Donde OrderVision Brilla
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            OrderVision resuelve los dolores de cabeza más comunes de tiendas y talleres sin importar su flujo de trabajo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CASO 1 */}
          <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-xl flex flex-col justify-between space-y-4 hover:border-rose-500/40 transition-all">
            <div className="space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <Boxes className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                1. Tiendas de Encargos e Importación por Lotes
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Ideal para tiendas que traen productos de <strong>Amazon, Shein, AliExpress</strong> o proveedores internacionales por fechas de corte.
              </p>
              <ul className="space-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Agrupación por Lotes:</strong> Cierra pedidos por fechas límite de envío y llegada.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Cotejo en Almacén:</strong> Checklist físico para marcar qué artículo ya arribó.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Cobro de Seña del 50%:</strong> Nadie compra mercancía sin abono confirmado.</span>
                </li>
              </ul>
            </div>
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-rose-300 block">
                Resultado: Menos desorden, 0 pedidos olvidados y flujo de caja seguro.
              </span>
            </div>
          </div>

          {/* CASO 2 */}
          <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-xl flex flex-col justify-between space-y-4 hover:border-purple-500/40 transition-all">
            <div className="space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                <Scissors className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                2. Talleres de Confección, Moda y Alta Costura
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Diseñado para <strong>modistas, sastres y ateliers</strong> que crean fajas, vestidos y ropa a medida anatómica.
              </p>
              <ul className="space-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                  <span><strong>Ficha de Medidas:</strong> Talle, busto, cintura, cadera, contorno y largo de pierna.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                  <span><strong>Opciones de Corte:</strong> Espalda baja/pico, cola levanta cola, gafetes GF/DG.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                  <span><strong>Agenda de Pruebas:</strong> Fecha de fitting programada y notificada al cliente.</span>
                </li>
              </ul>
            </div>
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-purple-300 block">
                Resultado: Adiós a cuadernos de medidas perdidos y errores en costura.
              </span>
            </div>
          </div>

          {/* CASO 3 */}
          <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-xl flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-all">
            <div className="space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Coins className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                3. Negocios Multi-Moneda en Latinoamérica
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Para negocios en <strong>Colombia, Venezuela y fronteras</strong> que cobran en múltiples divisas con tasas cambiantes.
              </p>
              <ul className="space-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Multi-Divisa Automática:</strong> Base USD con cotizaciones en COP ($) y VES (Bs.).</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Efectivo Simplificado:</strong> Pagos en efectivo USD y COP sin comprobantes forzados.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Pagos Digitales:</strong> Pago Móvil, Zelle y Binance USDT con hash y captura adjunta.</span>
                </li>
              </ul>
            </div>
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-emerald-300 block">
                Resultado: Cuadres de caja exactos sin perder dinero por diferencias cambiarias.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CADA DETALLE DE LA PLATAFORMA (CARACTERÍSTICAS TÉCNICAS Y FUNCIONALES) */}
      <section id="caracteristicas" className="mb-20 space-y-10 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs uppercase font-bold text-rose-400 tracking-wider">
            Arquitectura Completa
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            Diseñada con Cada Detalle que tu Negocio Necesita
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Una suite modular que une administración, operaciones y experiencia del cliente.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2.5">
            <Palette className="h-6 w-6 text-rose-400" />
            <h4 className="text-sm font-bold text-white">Personalización Total de Marca (White-Label)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Define tu logo y tu paleta de colores (primario, secundario y acento). Toda la interfaz adopta los colores de tu negocio para que tus clientes solo vean tu identidad.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2.5">
            <Smartphone className="h-6 w-6 text-purple-400" />
            <h4 className="text-sm font-bold text-white">Tema Inteligente del Dispositivo (Modo Claro & Oscuro)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Detecta automáticamente si el cliente o el operador navega en modo oscuro o claro, adaptando contrastes y tipografías en tiempo real sin recargar la página.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2.5">
            <FileText className="h-6 w-6 text-amber-400" />
            <h4 className="text-sm font-bold text-white">Exportador de Cotizaciones en Imagen PNG</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Con un solo clic exporta la cotización del pedido como una imagen limpia con el logo de tu tienda, lista para enviar por WhatsApp o Instagram Stories.
            </p>
          </div>

          {/* Card 4 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2.5">
            <MessageCircle className="h-6 w-6 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">Integración Nativa con WhatsApp</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Abre el chat directamente en el número del cliente con el texto de cotización, status y enlace de seguimiento preescrito. Personaliza los mensajes desde tus ajustes.
            </p>
          </div>

          {/* Card 5 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2.5">
            <Zap className="h-6 w-6 text-cyan-400" />
            <h4 className="text-sm font-bold text-white">IA con Visión OCR (Gemini 2.5)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sube capturas de pantalla de carritos o recibos y deja que la inteligencia artificial extraiga automáticamente los productos, precios y cantidades.
            </p>
          </div>

          {/* Card 6 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2.5">
            <Building2 className="h-6 w-6 text-blue-400" />
            <h4 className="text-sm font-bold text-white">Multi-Tenant SaaS con Roles Seguros</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              SuperAdmin para gestionar tiendas afiliadas, Administrador de Tienda para configurar cuentas bancarias y Operadores de tienda para registro rápido diario.
            </p>
          </div>
        </div>
      </section>

      {/* 6. COMPARATIVA: ANTES VS CON ORDERVISION */}
      <section id="comparativa" className="mb-20 space-y-8 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs uppercase font-bold text-rose-400 tracking-wider">
            Transformación Operativa
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            ¿Cómo cambia tu negocio con OrderVision?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6 space-y-3">
            <h3 className="text-base font-bold text-red-300 flex items-center gap-2">
              <span>✕</span> Sin OrderVision (Gestión Tradicional)
            </h3>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>• Decenas de clientes preguntando a diario por WhatsApp el estatus de su encargo.</li>
              <li>• Medidas corporales anotadas en hojas sueltas que se extravían en el taller.</li>
              <li>• Pérdidas de dinero por aceptar pedidos sin cobrar la seña por adelantado.</li>
              <li>• Confusión al cotejar si llegaron todos los artículos que se mandaron a pedir.</li>
              <li>• Errores al convertir monedas manualmente en una calculadora con tasas desactualizadas.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-3">
            <h3 className="text-base font-bold text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Con OrderVision (Digital y Profesional)
            </h3>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>• <strong>Portal en Vivo:</strong> El cliente consulta el progreso de su pedido cuando quiera.</li>
              <li>• <strong>Ficha Digital:</strong> Medidas y especificaciones guardadas de por vida en la nube.</li>
              <li>• <strong>Seña Obligatoria:</strong> 50% cobrado y registrado antes de mandar a confeccionar o comprar.</li>
              <li>• <strong>Cotejo en Almacén:</strong> Checklist físico de llegada para evitar reclamos.</li>
              <li>• <strong>Tasas del Día:</strong> Conversión instantánea a COP y VES sin errores humanos.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 7. BANNER FINAL CTA */}
      <section className="mb-16 rounded-3xl border border-slate-700 bg-gradient-to-br from-rose-950/60 via-slate-900 to-purple-950/60 p-8 md:p-12 text-center relative overflow-hidden shadow-2xl">
        <div className="max-w-2xl mx-auto space-y-5">
          <span className="inline-block rounded-full bg-rose-500/20 border border-rose-500/40 px-3 py-1 text-xs font-bold text-rose-300">
            Comienza Hoy Mismo
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            Eleva el nivel de tu tienda o taller con OrderVision
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
            Únete a la nueva generación de gestión de pedidos sin enredos. Tus clientes apreciarán la transparencia y tu equipo trabajará con total control.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-12 items-center gap-2 rounded-2xl btn-brand-gradient px-7 text-sm font-bold shadow-xl shadow-rose-500/25 hover:scale-102 transition-transform"
            >
              <span>Acceder a Mi Negocio</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 8. PIE DE PÁGINA COMPLETO */}
      <footer className="border-t border-slate-800/80 pt-8 pb-12 text-xs text-slate-400">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-purple-600 text-xs font-black text-white shadow-xs">
              OV
            </div>
            <div>
              <strong className="text-white">OrderVision Platform</strong>
              <p className="text-[11px] text-slate-400">
                Plataforma de Gestión de Pedidos, Lotes de Importación y Confección
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Next.js 15 App Router</span>
            <span>•</span>
            <span>PostgreSQL & SQLite</span>
            <span>•</span>
            <span>Tailwind CSS v4</span>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} OrderVision. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
