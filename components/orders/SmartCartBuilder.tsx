"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Boxes,
  Calendar,
  CheckCircle2,
  Coins,
  Download,
  FolderPlus,
  Hash,
  Loader2,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  Ruler,
  Scissors,
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
import {
  formatShortDate,
  suggestNextBatchCode,
} from "@/components/orders/BatchesDashboardClient";
import {
  DEFAULT_FEATURES,
  type CurrencyType,
  type PaymentMethodType,
  type RoleType,
} from "@/lib/validations/schemas";
import {
  convertCurrency,
  formatEquivalentSummary,
  formatMoney,
  parseCurrencyInput,
} from "@/lib/utils/currency";
import {
  exportQuoteAsPng,
  generateQuoteBlob,
} from "@/lib/utils/quoteImageExporter";
import { buildOrderWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { MaskedPriceInput } from "@/components/ui/MaskedPriceInput";

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
  serviceType?: string;
  fabricDetails?: string;
  measurements?: Record<string, string | number>;
}

function suggestNextOrderId(existingIds: string[]): string {
  const lowerSet = new Set(existingIds.map((id) => id.trim().toLowerCase()));
  let num = existingIds.length + 1;
  let candidate = `ord-${String(num).padStart(3, "0")}`;
  while (lowerSet.has(candidate.toLowerCase())) {
    num += 1;
    candidate = `ord-${String(num).padStart(3, "0")}`;
  }
  return candidate;
}

interface SmartCartBuilderProps {
  tenant: TenantRecord;
  initialCustomers: CustomerRecord[];
  initialBatches: OrderBatchRecord[];
  existingOrderIds?: string[];
  preselectedBatchId?: string | null;
  userRole?: RoleType;
}

export function SmartCartBuilder({
  tenant,
  initialCustomers,
  initialBatches,
  existingOrderIds = [],
  preselectedBatchId,
  userRole = "TENANT_ADMIN",
}: SmartCartBuilderProps) {
  const router = useRouter();
  const isTenantAdmin =
    userRole === "TENANT_ADMIN" || userRole === "SUPERADMIN";
  const features = tenant.settings?.features ?? DEFAULT_FEATURES;
  const rates = tenant.settings?.exchangeRates;

  const [knownOrderIds, setKnownOrderIds] =
    useState<string[]>(existingOrderIds);
  const [customOrderId, setCustomOrderId] = useState<string>(() =>
    suggestNextOrderId(existingOrderIds)
  );
  const [orderError, setOrderError] = useState<string | null>(null);

  // Moneda operativa restringida estrictamente a la configuración del Tenant
  const orderCurrency: CurrencyType =
    (tenant.currency?.toUpperCase() as CurrencyType) || "USD";
  const draftCurrency: CurrencyType = orderCurrency;

  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsAppNotice, setWhatsAppNotice] = useState<string | null>(null);

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
    () => suggestNextBatchCode(initialBatches).code
  );
  const [newBatchName, setNewBatchName] = useState(
    () => suggestNextBatchCode(initialBatches).name
  );
  const [newBatchDate, setNewBatchDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [batchModalError, setBatchModalError] = useState<string | null>(null);

  // Modal de Alta / Edición Rápida de Cliente
  const newCustomerDialogRef = useRef<HTMLDialogElement | null>(null);
  const [customerModalMode, setCustomerModalMode] = useState<
    "CREATE" | "EDIT"
  >("CREATE");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("+58 ");
  const [newCustomerDocumentId, setNewCustomerDocumentId] = useState("");
  const [newCustomerInstagram, setNewCustomerInstagram] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerModalError, setCustomerModalError] = useState<string | null>(
    null
  );

  // Formulario para agregar producto al carrito
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPrice, setDraftPrice] = useState("");
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [draftSize, setDraftSize] = useState("");
  const [draftColor, setDraftColor] = useState("");
  const [draftModel, setDraftModel] = useState("");

  // Opciones de costura y confección personalizada (Fajas, Prendas de Control, Atelier)
  const [businessMode, setBusinessMode] = useState<"IMPORT" | "TAILORING">(
    tenant.settings?.businessType === "TAILORING" ? "TAILORING" : "IMPORT"
  );
  const [fittingDate, setFittingDate] = useState("");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState("");
  const [draftServiceType, setDraftServiceType] = useState("Confección a Medida");
  const [draftFabric, setDraftFabric] = useState("");

  // Medidas Anatómicas (Talle, Cintura, Bajo Busto, Cadera, Contorno pierna, Largo pierna)
  const [draftTalle, setDraftTalle] = useState("");
  const [draftWaist, setDraftWaist] = useState("");
  const [draftUnderbust, setDraftUnderbust] = useState("");
  const [draftHip, setDraftHip] = useState("");
  const [draftLegContour, setDraftLegContour] = useState("");
  const [draftLegLength, setDraftLegLength] = useState("");

  // Especificaciones de Diseño (Espalda, Cola, Gafetes)
  const [draftBackDesign, setDraftBackDesign] = useState("");
  const [draftCustomBackDesign, setDraftCustomBackDesign] = useState("");
  const [draftButtockDesign, setDraftButtockDesign] = useState("");
  const [draftHooks, setDraftHooks] = useState("");
  const [showMeasureFields, setShowMeasureFields] = useState(true);

  // Carrito de productos
  const [items, setItems] = useState<CartProductItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  useEffect(() => {
    if (initialCustomers.length > 0) {
      setCustomers((prev) => {
        const existingIds = new Set(initialCustomers.map((c) => c.id));
        const localCreated = prev.filter((c) => !existingIds.has(c.id));
        return [...localCreated, ...initialCustomers];
      });
      setSelectedCustomerId((current) => current || initialCustomers[0]?.id || "");
    }
  }, [initialCustomers]);

  useEffect(() => {
    if (initialBatches.length > 0) {
      setBatches((prev) => {
        const existingIds = new Set(initialBatches.map((b) => b.id));
        const localCreated = prev.filter((b) => !existingIds.has(b.id));
        return [...localCreated, ...initialBatches];
      });
      setSelectedBatchId((current) => current || initialBatches[0]?.id || "");
    }
  }, [initialBatches]);

  const totalUnits = useMemo(
    () => items.reduce((s, i) => s + (Number(i.quantity) || 1), 0),
    [items]
  );

  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === selectedBatchId) ?? null,
    [batches, selectedBatchId]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const list = !q
      ? customers
      : customers.filter(
          (c) =>
            c.fullName.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            (c.documentId && c.documentId.toLowerCase().includes(q))
        );

    // Asegurar que el cliente seleccionado siempre esté presente en la lista del selector
    if (selectedCustomerId && !list.some((c) => c.id === selectedCustomerId)) {
      const selected = customers.find((c) => c.id === selectedCustomerId);
      if (selected) {
        return [selected, ...list];
      }
    }
    return list;
  }, [customers, customerSearch, selectedCustomerId]);

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

  const isDuplicateOrderId = useMemo(() => {
    const clean = customOrderId.trim().toLowerCase();
    if (!clean) return false;
    return knownOrderIds.some((id) => id.trim().toLowerCase() === clean);
  }, [customOrderId, knownOrderIds]);

  async function handleCreateQuickBatch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreatingBatch(true);
    setBatchModalError(null);
    try {
      const cleanCode = newBatchCode.trim().toUpperCase();
      if (batches.some((b) => b.code.trim().toUpperCase() === cleanCode)) {
        setBatchModalError(
          `Ya existe un lote registrado con el identificador "${cleanCode}".`
        );
        return;
      }

      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          code: cleanCode,
          name: newBatchName,
          purchaseDate: new Date(`${newBatchDate}T14:00:00.000Z`).toISOString(),
          status: "OPEN_FOR_ORDERS",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setBatchModalError(
          json.error || "No se pudo crear el lote de salida."
        );
        return;
      }
      setBatches((prev) => [...prev, json.batch]);
      setSelectedBatchId(json.batch.id);
      newBatchDialogRef.current?.close();
    } finally {
      setCreatingBatch(false);
    }
  }

  function openNewCustomerDialog() {
    setCustomerModalMode("CREATE");
    setNewCustomerName("");
    setNewCustomerPhone("+58 ");
    setNewCustomerDocumentId("");
    setNewCustomerInstagram("");
    setCustomerModalError(null);
    newCustomerDialogRef.current?.showModal();
  }

  function openEditSelectedCustomerDialog() {
    if (!selectedCustomer) return;
    setCustomerModalMode("EDIT");
    setNewCustomerName(selectedCustomer.fullName);
    setNewCustomerPhone(selectedCustomer.phone);
    setNewCustomerDocumentId(selectedCustomer.documentId ?? "");
    setNewCustomerInstagram(selectedCustomer.instagram ?? "");
    setCustomerModalError(null);
    newCustomerDialogRef.current?.showModal();
  }

  async function handleDeleteSelectedCustomer() {
    if (!selectedCustomer) return;
    if (
      !window.confirm(
        `¿Eliminar al cliente "${selectedCustomer.fullName}" (${selectedCustomer.phone})?`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/customers?id=${selectedCustomer.id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      const nextList = customers.filter((c) => c.id !== selectedCustomer.id);
      setCustomers(nextList);
      setSelectedCustomerId(nextList[0]?.id ?? "");
      router.refresh();
    } else {
      window.alert(json.error || "No se pudo eliminar el cliente.");
    }
  }

  async function handleCreateQuickCustomer(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setCreatingCustomer(true);
    setCustomerModalError(null);
    try {
      const targetDigits = newCustomerPhone.replace(/\D/g, "");
      const duplicateLocal = customers.find((c) => {
        if (customerModalMode === "EDIT" && c.id === selectedCustomerId) {
          return false;
        }
        const cDigits = c.phone.replace(/\D/g, "");
        return (
          (targetDigits.length >= 6 && cDigits === targetDigits) ||
          c.phone.trim().toLowerCase() === newCustomerPhone.trim().toLowerCase()
        );
      });

      if (duplicateLocal) {
        setCustomerModalError(
          `Ya existe un cliente registrado con el número "${newCustomerPhone.trim()}" (${duplicateLocal.fullName}).`
        );
        return;
      }

      const isEdit = customerModalMode === "EDIT";
      const res = await fetch("/api/customers", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          ...(isEdit ? { customerId: selectedCustomerId } : {}),
          fullName: newCustomerName.trim(),
          phone: newCustomerPhone.trim(),
          documentId: newCustomerDocumentId.trim() || null,
          instagram: newCustomerInstagram.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setCustomerModalError(
          json.error || "No se pudo guardar el cliente."
        );
        return;
      }

      if (isEdit) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === json.customer.id ? json.customer : c))
        );
      } else {
        setCustomers((prev) => [json.customer, ...prev]);
        setSelectedCustomerId(json.customer.id);
        setCustomerSearch("");
      }
      setNewCustomerName("");
      setNewCustomerPhone("+58 ");
      setNewCustomerDocumentId("");
      setNewCustomerInstagram("");
      newCustomerDialogRef.current?.close();
      router.refresh();
    } finally {
      setCreatingCustomer(false);
    }
  }

  function handleAddProductSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsedPrice =
      typeof draftPrice === "number"
        ? draftPrice
        : parseCurrencyInput(draftPrice, orderCurrency);
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

    const itemMeasurements: Record<string, string | number> = {};
    if (draftTalle.trim()) itemMeasurements["Talle"] = draftTalle.trim();
    if (draftWaist.trim()) itemMeasurements["Cintura"] = draftWaist.trim();
    if (draftUnderbust.trim()) itemMeasurements["Bajo Busto"] = draftUnderbust.trim();
    if (draftHip.trim()) itemMeasurements["Cadera"] = draftHip.trim();
    if (draftLegContour.trim()) itemMeasurements["Contorno de pierna"] = draftLegContour.trim();
    if (draftLegLength.trim()) itemMeasurements["Largo de pierna"] = draftLegLength.trim();

    const finalBackDesign =
      draftBackDesign === "Otros" && draftCustomBackDesign.trim()
        ? draftCustomBackDesign.trim()
        : draftBackDesign.trim();

    if (finalBackDesign) itemMeasurements["Diseño de espalda"] = finalBackDesign;
    if (draftButtockDesign.trim()) itemMeasurements["Diseño de la cola"] = draftButtockDesign.trim();
    if (draftHooks.trim()) itemMeasurements["Gafetes"] = draftHooks.trim();

    setItems((prev) => [
      ...prev,
      {
        localId: `item-${Date.now()}-${prev.length + 1}`,
        title: draftTitle.trim(),
        originalPrice: null,
        finalPrice: normalizedPrice,
        quantity: Math.max(1, Number(draftQuantity) || 1),
        size:
          draftSize.trim() ||
          (businessMode === "TAILORING" ? "A Medida" : ""),
        color: draftColor.trim(),
        modelVariant: draftModel.trim(),
        verificationNotes: "",
        serviceType:
          businessMode === "TAILORING" ? draftServiceType : undefined,
        fabricDetails:
          businessMode === "TAILORING"
            ? draftFabric.trim() || undefined
            : undefined,
        measurements:
          Object.keys(itemMeasurements).length > 0
            ? itemMeasurements
            : undefined,
        sourceImageUrl: null,
      },
    ]);

    setDraftTitle("");
    setDraftPrice("");
    setDraftQuantity(1);
    setDraftSize("");
    setDraftColor("");
    setDraftModel("");
    setDraftFabric("");
    setDraftTalle("");
    setDraftWaist("");
    setDraftUnderbust("");
    setDraftHip("");
    setDraftLegContour("");
    setDraftLegLength("");
    setDraftBackDesign("");
    setDraftCustomBackDesign("");
    setDraftButtockDesign("");
    setDraftHooks("");
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
      logoUrl: tenant.settings?.logoUrl,
      primaryColor: tenant.settings?.theme?.primaryColor,
      secondaryColor: tenant.settings?.theme?.secondaryColor,
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

  async function handleSendWhatsAppQuote() {
    if (!selectedCustomer || items.length === 0) return;
    setSendingWhatsApp(true);
    setWhatsAppNotice(null);
    try {
      const quoteResult = await generateQuoteBlob({
        tenantName: tenant.name,
        logoUrl: tenant.settings?.logoUrl,
        primaryColor: tenant.settings?.theme?.primaryColor,
        secondaryColor: tenant.settings?.theme?.secondaryColor,
        customerName: selectedCustomer.fullName,
        customerPhone: selectedCustomer.phone,
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

      const captionMsg = buildOrderWhatsAppMessage({
        tenantName: tenant.name,
        customerName: selectedCustomer.fullName,
        orderId: customOrderId.trim() || undefined,
        batchCode: selectedBatch
          ? `${selectedBatch.code} (${selectedBatch.name})`
          : null,
        currency: orderCurrency,
        subtotalUsd: subtotal,
        depositRequiredUsd: depositRequired,
        balanceDueUsd: Math.max(0, subtotal - depositRequired),
        vesRate,
        copRate,
        itemsCount: totalUnits,
        statusLabel: `Cotización (${tenant.defaultDepositPct || 50}% Inicial)`,
        customTemplate: tenant.settings?.whatsappConfig?.customMessage,
      });

      // 1. En móviles y navegadores compatibles: Web Share API directa con archivo PNG
      if (
        quoteResult &&
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [quoteResult.file] })
      ) {
        try {
          await navigator.share({
            title: `Cotización ${tenant.name}`,
            text: captionMsg,
            files: [quoteResult.file],
          });
          return;
        } catch (shareErr) {
          if ((shareErr as Error)?.name === "AbortError") return;
        }
      }

      // 2. Fallback de alta compatibilidad para Desktop:
      // Copiar la imagen al portapapeles, descargar archivo y abrir chat de WhatsApp
      if (quoteResult && typeof navigator !== "undefined" && navigator.clipboard) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": quoteResult.blob }),
          ]);
        } catch {
          // Permisos o formato no admitido por el navegador
        }

        // Descarga automática de respaldo
        const link = document.createElement("a");
        link.download = quoteResult.file.name;
        link.href = quoteResult.dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      const fullMsg = `${captionMsg}\n\n📸 *Adjunto de Cotización:* Te compartimos la imagen oficial con el desglose de prendas, seña y condiciones.`;
      const waUrl = buildWhatsAppUrl(selectedCustomer.phone, fullMsg);
      window.open(waUrl, "_blank");

      setWhatsAppNotice(
        "📸 ¡Imagen de cotización generada, copiada al portapapeles y descargada! Pégala directamente en el chat de WhatsApp con Ctrl+V."
      );
      setTimeout(() => setWhatsAppNotice(null), 9000);
    } catch (err) {
      setOrderError(
        err instanceof Error
          ? err.message
          : "No se pudo procesar el envío de la cotización por WhatsApp"
      );
    } finally {
      setSendingWhatsApp(false);
    }
  }

  const whatsappUrl = useMemo(() => {
    if (!selectedCustomer) return "#";
    const msg = buildOrderWhatsAppMessage({
      tenantName: tenant.name,
      customerName: selectedCustomer.fullName,
      orderId: customOrderId.trim() || undefined,
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
      statusLabel: "Por Confirmar (50% Abonado)",
      customTemplate: tenant.settings?.whatsappConfig?.customMessage,
    });
    return buildWhatsAppUrl(selectedCustomer.phone, msg);
  }, [
    selectedCustomer,
    tenant.name,
    customOrderId,
    selectedBatch,
    orderCurrency,
    subtotal,
    depositRequired,
    vesRate,
    copRate,
    items,
    tenant.settings?.whatsappConfig?.customMessage,
  ]);

  async function handleConfirmDepositOrder(payload: {
    paymentMethod: PaymentMethodType;
    paymentReference: string;
    receiptImageUrl: string | null;
    generalNotes: string;
  }) {
    if (!selectedCustomerId || items.length === 0) return;
    if (isDuplicateOrderId) {
      setOrderError(
        `Ya existe un pedido registrado con el identificador "${customOrderId.trim()}". Cambia el identificador antes de continuar.`
      );
      setDrawerOpen(false);
      return;
    }

    setSubmittingOrder(true);
    setOrderError(null);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          customOrderId: customOrderId.trim() || undefined,
          batchId: selectedBatchId || null,
          customerId: selectedCustomerId,
          currency: orderCurrency,
          businessType: businessMode,
          fittingDate: fittingDate || null,
          estimatedDeliveryDate: estimatedDeliveryDate || null,
          measurements:
            items.find((i) => i.measurements && Object.keys(i.measurements).length > 0)
              ?.measurements || null,
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
            serviceType: i.serviceType || null,
            fabricDetails: i.fabricDetails || null,
            measurements: i.measurements || null,
            sourceImageUrl: i.sourceImageUrl,
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        setOrderError(json.error || "Error al crear el pedido.");
        setDrawerOpen(false);
        return;
      }
      setKnownOrderIds((prev) => [...prev, json.order.id]);
      setDrawerOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setSubmittingOrder(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado Minimalista + Selector de Moneda del Pedido */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            Nuevo Pedido {businessMode === "TAILORING" ? "• Atelier de Costura y Ropa" : "• Tienda"}
          </h1>
          <p className="text-xs text-slate-400">
            {businessMode === "TAILORING"
              ? "Gestiona confección a medida, fechas de prueba (fitting), medidas corporales y abonos."
              : "Elige la moneda del pedido (COP para Shein o USD), selecciona el cliente y agrega sus productos."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Modo de Negocio: Importación vs Costura y Ropa */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => setBusinessMode("IMPORT")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                businessMode === "IMPORT"
                  ? "btn-brand-gradient text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📦 Importación
            </button>
            <button
              type="button"
              onClick={() => setBusinessMode("TAILORING")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                businessMode === "TAILORING"
                  ? "bg-fuchsia-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ✂️ Costura y Ropa
            </button>
          </div>

          {/* Moneda Operativa del Negocio (Fijada en settings del Tenant) */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-slate-300">
              Moneda: <strong className="text-white font-bold">{orderCurrency}</strong>
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
              Configurada en Tenant
            </span>
          </div>
        </div>
      </div>

      {/* Layout Responsive: 2 Columnas en Desktop, 1 en Mobile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* COLUMNA IZQUIERDA (5 cols en Desktop): Lote + Cliente + Agregar Producto + Totales */}
        <div className="space-y-3 lg:col-span-5">
          {/* 1. Lote de Salida + Identificador Único del Pedido */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2.5">
            {orderError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{orderError}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                <Boxes className="h-3.5 w-3.5 text-rose-400" />
                1. Lote de Salida e Identificador
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = suggestNextBatchCode(batches);
                  setNewBatchCode(next.code);
                  setNewBatchName(next.name);
                  setBatchModalError(null);
                  newBatchDialogRef.current?.showModal();
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2 py-1 text-[11px] font-bold text-rose-300 border border-rose-500/30"
              >
                <FolderPlus className="h-3 w-3" />
                + Lote
              </button>
            </div>

            <div>
              <label className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <Hash className="h-3 w-3 text-amber-400" />
                  Identificador del Pedido (ID Único)
                </span>
                {isDuplicateOrderId && (
                  <span className="text-[10px] font-bold text-rose-400">
                    ¡ID ya utilizado en otro pedido!
                  </span>
                )}
              </label>
              <input
                type="text"
                value={customOrderId}
                onChange={(e) => {
                  setCustomOrderId(e.target.value);
                  setOrderError(null);
                }}
                placeholder="Ej. ord-001"
                className={`w-full rounded-xl border bg-slate-950 px-3 py-1.5 font-mono text-xs font-bold text-white ${
                  isDuplicateOrderId
                    ? "border-rose-500 text-rose-300"
                    : "border-slate-700"
                }`}
              />
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

          {/* Opciones de Confección: Fechas Clave del Atelier (Fitting y Entrega) */}
          {businessMode === "TAILORING" && (
            <section className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3.5 space-y-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-fuchsia-300">
                <Scissors className="h-3.5 w-3.5" />
                Fechas Clave del Taller (Fitting y Entrega)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-fuchsia-200 block mb-1">
                    Fecha de Prueba (Fitting):
                  </label>
                  <input
                    type="date"
                    value={fittingDate}
                    onChange={(e) => setFittingDate(e.target.value)}
                    className="w-full rounded-xl border border-fuchsia-500/40 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-fuchsia-200 block mb-1">
                    Fecha Estimada de Entrega:
                  </label>
                  <input
                    type="date"
                    value={estimatedDeliveryDate}
                    onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                    className="w-full rounded-xl border border-fuchsia-500/40 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </section>
          )}

          {/* 2. Cliente */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                2. Cliente (WhatsApp)
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
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
                {isTenantAdmin && selectedCustomer && (
                  <>
                    <button
                      type="button"
                      onClick={openEditSelectedCustomerDialog}
                      title="Editar cliente seleccionado"
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedCustomer}
                      title="Eliminar cliente seleccionado"
                      className="inline-flex items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/15 px-2 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-500/25"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={openNewCustomerDialog}
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
                    placeholder="Buscar por nombre, cédula o WhatsApp..."
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
                      {c.fullName} — {c.phone} {c.documentId ? `(C.I: ${c.documentId})` : ""}
                    </option>
                  ))}
                </select>

                {selectedCustomer && (
                  <div className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-1.5 border border-slate-800 text-[11px]">
                    <span className="font-bold text-white truncate">
                      👤 {selectedCustomer.fullName}
                    </span>
                    <span className="text-emerald-400 font-mono font-semibold shrink-0">
                      {selectedCustomer.phone}
                    </span>
                  </div>
                )}
              </>
            )}
          </section>

          {/* 3. Formulario Directo de Agregar Productos o Confecciones (Multimoneda COP / USD) */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                {businessMode === "TAILORING" ? (
                  <>
                    <Scissors className="h-3.5 w-3.5 text-fuchsia-400" />
                    3. Prenda / Servicio de Confección
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-3.5 w-3.5 text-rose-400" />
                    3. Agregar Producto al Pedido
                  </>
                )}
              </span>
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-950 px-2 py-0.5 border border-slate-800">
                <span className="text-[10px] font-bold text-amber-300">
                  Moneda: {orderCurrency}
                </span>
              </div>
            </div>

            <form onSubmit={handleAddProductSubmit} className="space-y-2.5">
              {businessMode === "TAILORING" && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-fuchsia-300">
                    Tipo de Servicio de Confección
                  </label>
                  <select
                    value={draftServiceType}
                    onChange={(e) => setDraftServiceType(e.target.value)}
                    className="w-full rounded-xl border border-fuchsia-500/40 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="Confección a Medida">👗 Confección a Medida</option>
                    <option value="Arreglo / Modificación">✂️ Arreglo / Ajuste de Prenda</option>
                    <option value="Diseño Exclusivo">✨ Diseño Exclusivo / Alta Costura</option>
                    <option value="Prenda Terminada">🛍️ Prenda Lista / Terminada</option>
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                  {businessMode === "TAILORING"
                    ? "Nombre de la Prenda o Trabajo a Realizar"
                    : "Nombre o Descripción del Producto"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    businessMode === "TAILORING"
                      ? "Ej. Vestido largo de gala en satén / Pantalón sastre"
                      : "Ej. Vestido midi satén / Blusa manga larga"
                  }
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  style={{ minHeight: "36px", fontSize: "0.75rem" }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                />
              </div>

              {businessMode === "TAILORING" && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                    Telas y Materiales (Provista por cliente o taller)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Seda importada provista por cliente, forro satén blanco, cremallera invisible"
                    value={draftFabric}
                    onChange={(e) => setDraftFabric(e.target.value)}
                    style={{ minHeight: "34px", fontSize: "0.75rem" }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-rose-300">
                    Precio {businessMode === "TAILORING" ? "de Confección" : "Unitario"} ({orderCurrency})
                  </label>
                  <MaskedPriceInput
                    currency={orderCurrency}
                    required
                    value={draftPrice}
                    onChange={(numericVal, formatted) => setDraftPrice(formatted)}
                    style={{ minHeight: "36px", fontSize: "0.75rem" }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white font-mono"
                  />
                  {parseCurrencyInput(draftPrice, orderCurrency) > 0 && (
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Equivalente: {formatEquivalentSummary(
                        parseCurrencyInput(draftPrice, orderCurrency),
                        orderCurrency,
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

              {/* Talla, Color y Referencia */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                      {businessMode === "TAILORING" ? "Talla / Base" : "Talla"}
                    </label>
                    <input
                      type="text"
                      placeholder={businessMode === "TAILORING" ? "A Medida" : "S, M, L"}
                      value={draftSize}
                      onChange={(e) => setDraftSize(e.target.value)}
                      style={{ minHeight: "34px", fontSize: "0.75rem" }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                      {businessMode === "TAILORING" ? "Referencia / Código" : "SKU / Código"}
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

                {/* Selección de Color con Acceso Rápido */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Color de la Prenda
                    </label>
                    {businessMode === "TAILORING" && (
                      <div className="flex items-center gap-1">
                        {["Negro", "Beish", "Chocolate"].map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setDraftColor(col)}
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold border transition-colors ${
                              draftColor.toLowerCase() === col.toLowerCase()
                                ? "bg-fuchsia-500/30 text-fuchsia-200 border-fuchsia-400"
                                : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            {col}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Ej. Negro, Beish, Chocolate..."
                    value={draftColor}
                    onChange={(e) => setDraftColor(e.target.value)}
                    style={{ minHeight: "34px", fontSize: "0.75rem" }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
                  />
                </div>
              </div>

              {/* Ficha Especializada de Diseño y Medidas para Fajas / Confección */}
              {businessMode === "TAILORING" && (
                <div className="rounded-2xl border border-fuchsia-500/30 bg-slate-950/80 p-3 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-xs font-bold text-fuchsia-300 flex items-center gap-1.5">
                      <Scissors className="h-3.5 w-3.5" />
                      Especificaciones de Diseño y Medidas
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMeasureFields((prev) => !prev)}
                      className="text-[10px] text-slate-400 hover:text-white underline"
                    >
                      {showMeasureFields ? "Ocultar ficha" : "+ Ver medidas y opciones"}
                    </button>
                  </div>

                  {showMeasureFields && (
                    <div className="space-y-3">
                      {/* 1. Medidas Corporales */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 flex items-center gap-1">
                          <Ruler className="h-3 w-3 text-purple-400" />
                          Medidas Anatómicas (cm / pulgadas):
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block">Talle:</label>
                            <input
                              type="text"
                              placeholder="Ej. 42 cm"
                              value={draftTalle}
                              onChange={(e) => setDraftTalle(e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block">Cintura:</label>
                            <input
                              type="text"
                              placeholder="Ej. 68 cm"
                              value={draftWaist}
                              onChange={(e) => setDraftWaist(e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block">Bajo Busto:</label>
                            <input
                              type="text"
                              placeholder="Ej. 75 cm"
                              value={draftUnderbust}
                              onChange={(e) => setDraftUnderbust(e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block">Cadera:</label>
                            <input
                              type="text"
                              placeholder="Ej. 96 cm"
                              value={draftHip}
                              onChange={(e) => setDraftHip(e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block">Contorno de pierna:</label>
                            <input
                              type="text"
                              placeholder="Ej. 52 cm"
                              value={draftLegContour}
                              onChange={(e) => setDraftLegContour(e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block">Largo de pierna:</label>
                            <input
                              type="text"
                              placeholder="Ej. 78 cm"
                              value={draftLegLength}
                              onChange={(e) => setDraftLegLength(e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 2. Diseño de Espalda */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Diseño de Espalda:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            "espalda baja",
                            "espalda de pico",
                            "franelilla",
                            "estraple",
                            "otros",
                          ].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setDraftBackDesign(opt)}
                              className={`rounded-lg px-2 py-1 text-[11px] font-semibold border capitalize transition-colors ${
                                draftBackDesign === opt
                                  ? "bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400"
                                  : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        {draftBackDesign === "otros" && (
                          <input
                            type="text"
                            placeholder="Especifica el diseño de espalda..."
                            value={draftCustomBackDesign}
                            onChange={(e) => setDraftCustomBackDesign(e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-fuchsia-500/40 bg-slate-900 px-2.5 py-1 text-xs text-white"
                          />
                        )}
                      </div>

                      {/* 3. Diseño de la Cola */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Diseño de la Cola / Glúteos:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            "levanta cola",
                            "Cola normal (lycra)",
                            "Cola normal (powernet)",
                          ].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setDraftButtockDesign(opt)}
                              className={`rounded-lg px-2 py-1 text-[11px] font-semibold border transition-colors ${
                                draftButtockDesign === opt
                                  ? "bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400"
                                  : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 4. Gafetes */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Gafetes / Broches:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: "GF", label: "GF (Gafete Frontal)" },
                            { id: "DG", label: "DG (Doble Gafete)" },
                            { id: "Sin Gafete", label: "Sin Gafete" },
                          ].map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setDraftHooks(g.id)}
                              className={`rounded-lg px-2 py-1 text-[11px] font-semibold border transition-colors ${
                                draftHooks === g.id
                                  ? "bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400"
                                  : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              {g.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all ${
                  businessMode === "TAILORING"
                    ? "border-fuchsia-500/40 bg-fuchsia-600/20 text-fuchsia-200 hover:bg-fuchsia-600/30"
                    : "border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                {businessMode === "TAILORING"
                  ? `Agregar Prenda a Medida (${orderCurrency})`
                  : `Agregar Producto al Carrito (${orderCurrency})`}
              </button>
            </form>
          </section>

          {/* 4. Resumen de Totales + Exportar Cotización PNG + WhatsApp + Confirmar */}
          <section className="rounded-2xl border border-slate-700/90 bg-slate-900 p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <p className="text-xs text-slate-400">
                  Subtotal ({totalUnits} {totalUnits === 1 ? "prenda" : "prendas"})
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
                  Seña ({tenant.defaultDepositPct ?? 50}%)
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
                <button
                  type="button"
                  disabled={sendingWhatsApp || items.length === 0}
                  onClick={handleSendWhatsAppQuote}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40"
                >
                  {sendingWhatsApp ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <MessageCircle className="h-3.5 w-3.5" />
                  )}
                  {sendingWhatsApp ? "Generando..." : "Enviar Cotización WA"}
                </button>
              )}
            </div>

            {whatsAppNotice && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-2.5 text-xs font-medium text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>{whatsAppNotice}</span>
              </div>
            )}

            <button
              type="button"
              disabled={
                items.length === 0 ||
                !selectedCustomerId ||
                isDuplicateOrderId
              }
              onClick={() => setDrawerOpen(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl btn-brand-gradient px-4 text-sm font-bold shadow-lg disabled:opacity-40"
            >
              Confirmar y Cobrar {tenant.defaultDepositPct ?? 50}% ({formatMoney(depositRequired, orderCurrency)})
            </button>
          </section>
        </div>

        {/* COLUMNA DERECHA (7 cols en Desktop): Tarjetas Compactas de Productos */}
        <div className="space-y-2.5 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Prendas en el Pedido ({totalUnits} {totalUnits === 1 ? "prenda" : "prendas"}) • Moneda: {orderCurrency}
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
                        <MaskedPriceInput
                          currency={orderCurrency}
                          value={item.finalPrice}
                          onChange={(numericVal) =>
                            handleUpdateItem(
                              item.localId,
                              "finalPrice",
                              numericVal
                            )
                          }
                          style={{ minHeight: "32px", fontSize: "0.75rem" }}
                          className="w-full rounded-lg border border-rose-500/40 bg-slate-950 px-2 py-1 text-xs font-bold text-white font-mono"
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

                    {/* Detalles de Costura y Confección si aplican */}
                    {(item.serviceType ||
                      item.fabricDetails ||
                      (item.measurements &&
                        Object.keys(item.measurements).length > 0)) && (
                      <div className="space-y-1 pt-1.5 border-t border-slate-800/80">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.serviceType && (
                            <span className="rounded bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-300 border border-fuchsia-500/30">
                              {item.serviceType}
                            </span>
                          )}
                          {item.fabricDetails && (
                            <span
                              className="text-[10px] text-slate-300 italic truncate max-w-[240px]"
                              title={item.fabricDetails}
                            >
                              Tela: {item.fabricDetails}
                            </span>
                          )}
                        </div>

                        {item.measurements &&
                          Object.keys(item.measurements).length > 0 && (
                            <div className="flex flex-wrap gap-1 text-[10px]">
                              {Object.entries(item.measurements).map(
                                ([k, v]) => (
                                  <span
                                    key={k}
                                    className="rounded bg-slate-950 px-1.5 py-0.5 text-slate-300 font-mono border border-slate-800"
                                  >
                                    {k}: {String(v)}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                      </div>
                    )}

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
          {batchModalError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{batchModalError}</span>
            </div>
          )}

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
              className="rounded-xl btn-brand-gradient px-4 py-2 text-xs font-bold shadow-xs"
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
          <h3 className="text-base font-bold text-white">
            {customerModalMode === "EDIT"
              ? "Editar Cliente"
              : "Nuevo Cliente"}
          </h3>
          <button
            type="button"
            onClick={() => newCustomerDialogRef.current?.close()}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreateQuickCustomer} className="space-y-3">
          {customerModalError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{customerModalError}</span>
            </div>
          )}

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
              WhatsApp / Teléfono
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
              Número de Cédula / DNI
            </label>
            <input
              type="text"
              value={newCustomerDocumentId}
              onChange={(e) => setNewCustomerDocumentId(e.target.value)}
              placeholder="Ej. V-12.345.678 / Cédula"
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
              className="rounded-xl btn-brand-gradient px-4 py-2 text-xs font-bold shadow-xs"
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
