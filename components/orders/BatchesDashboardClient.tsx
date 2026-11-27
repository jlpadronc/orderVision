"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  Boxes,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Coins,
  Download,
  FolderPlus,
  ListFilter,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  QrCode,
  Scissors,
  Search,
  ShieldOff,
  ShoppingBag,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type {
  CustomerRecord,
  OrderBatchRecord,
  OrderItemRecord,
  OrderRecord,
  TenantRecord,
} from "@/lib/repositories/multiTenantRepository";
import {
  DEFAULT_FEATURES,
  type BatchStatusType,
  type CurrencyType,
  type OrderStatusType,
  type RoleType,
} from "@/lib/validations/schemas";
import {
  convertCurrency,
  formatEquivalentSummary,
  formatMoney,
  resolveExchangeRates,
} from "@/lib/utils/currency";
import {
  buildOrderTrackingWhatsAppMessage,
  buildOrderWhatsAppMessage,
  buildWhatsAppUrl,
} from "@/lib/utils/whatsapp";
import { exportQuoteAsPng } from "@/lib/utils/quoteImageExporter";
import { OrderQrModal } from "./OrderQrModal";

export function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

type OrderPhaseFilter = "ALL" | "PENDING_PURCHASE" | "IN_PROGRESS" | "COMPLETED";

export function getOrderPhase(status: OrderStatusType): OrderPhaseFilter {
  if (status === "DRAFT" || status === "CONFIRMED_DEPOSIT_PAID") {
    return "PENDING_PURCHASE";
  }
  if (status === "COMPLETED") {
    return "COMPLETED";
  }
  return "IN_PROGRESS";
}

const ORDER_STATUS_META: Record<
  OrderStatusType,
  { label: string; badgeClass: string }
> = {
  DRAFT: {
    label: "Pendiente (Borrador)",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  },
  CONFIRMED_DEPOSIT_PAID: {
    label: "Por Confirmar (50% Abonado)",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  },
  PURCHASED_AT_ORIGIN: {
    label: "En Curso • Comprado",
    badgeClass: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  },
  IN_TRANSIT: {
    label: "En Curso • En Tránsito",
    badgeClass: "border-indigo-500/40 bg-indigo-500/15 text-indigo-300",
  },
  RECEIVED_IN_WAREHOUSE: {
    label: "En Curso • En Almacén",
    badgeClass: "border-purple-500/40 bg-purple-500/15 text-purple-200",
  },
  MEASUREMENTS_TAKEN: {
    label: "En Curso • Patronaje y Corte",
    badgeClass: "border-indigo-500/40 bg-indigo-500/15 text-indigo-300",
  },
  IN_PRODUCTION: {
    label: "En Curso • En Confección",
    badgeClass: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300",
  },
  READY_FOR_FITTING: {
    label: "En Curso • Listo para Prueba",
    badgeClass: "border-purple-500/40 bg-purple-500/15 text-purple-200",
  },
  FINAL_ADJUSTMENTS: {
    label: "En Curso • En Ajustes Finales",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  },
  READY_FOR_DELIVERY: {
    label: "En Curso • Listo Entregar",
    badgeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
  COMPLETED: {
    label: "Culminado (Entregado)",
    badgeClass: "border-teal-500/40 bg-teal-500/15 text-teal-200",
  },
  CANCELLED: {
    label: "Cancelado",
    badgeClass: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  },
};

export function suggestNextBatchCode(batches: OrderBatchRecord[]): {
  code: string;
  name: string;
} {
  const usedCodes = new Set(batches.map((b) => b.code.trim().toUpperCase()));
  let num = batches.length + 1;
  let candidate = `PEDIDO-${String(num).padStart(2, "0")}`;
  while (usedCodes.has(candidate)) {
    num += 1;
    candidate = `PEDIDO-${String(num).padStart(2, "0")}`;
  }
  return {
    code: candidate,
    name: `Pedido Consolidado #${num}`,
  };
}

interface BatchesDashboardClientProps {
  tenant: TenantRecord;
  initialBatches: OrderBatchRecord[];
  unassignedOrders: OrderRecord[];
  initialCustomers?: CustomerRecord[];
  userRole?: RoleType;
}

export function BatchesDashboardClient({
  tenant,
  initialBatches,
  unassignedOrders,
  initialCustomers = [],
  userRole = "TENANT_ADMIN",
}: BatchesDashboardClientProps) {
  const router = useRouter();
  const isTenantAdmin =
    userRole === "TENANT_ADMIN" || userRole === "SUPERADMIN";

  const [batches, setBatches] = useState<OrderBatchRecord[]>(initialBatches);
  const [unassigned, setUnassigned] =
    useState<OrderRecord[]>(unassignedOrders);
  const [customers, setCustomers] =
    useState<CustomerRecord[]>(initialCustomers);

  const [mainTab, setMainTab] = useState<"STATS" | "ORDERS" | "CUSTOMERS">(
    "STATS"
  );
  const [phaseFilter, setPhaseFilter] = useState<OrderPhaseFilter>("ALL");
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Modal para crear nuevo Lote por Fecha de Compra/Salida
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
  const [newBatchNotes, setNewBatchNotes] = useState("");
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [batchModalError, setBatchModalError] = useState<string | null>(null);

  // Modal para editar Lote existente (exclusivo Admin del Tenant)
  const editBatchDialogRef = useRef<HTMLDialogElement | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string>("");
  const [editBatchCode, setEditBatchCode] = useState("");
  const [editBatchName, setEditBatchName] = useState("");
  const [editBatchDate, setEditBatchDate] = useState("");
  const [editBatchStatus, setEditBatchStatus] =
    useState<BatchStatusType>("OPEN_FOR_ORDERS");
  const [editBatchNotes, setEditBatchNotes] = useState("");
  const [savingBatchEdit, setSavingBatchEdit] = useState(false);
  const [editBatchError, setEditBatchError] = useState<string | null>(null);

  // Modal para Crear / Editar Cliente
  const customerDialogRef = useRef<HTMLDialogElement | null>(null);
  const [customerDialogMode, setCustomerDialogMode] = useState<
    "CREATE" | "EDIT"
  >("CREATE");
  const [editingCustomerId, setEditingCustomerId] = useState<string>("");
  const [custFullName, setCustFullName] = useState("");
  const [custPhone, setCustPhone] = useState("+58 ");
  const [custInstagram, setCustInstagram] = useState("");
  const [custNotes, setCustNotes] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerModalError, setCustomerModalError] = useState<string | null>(
    null
  );

  // Modal para Editar Pedido Completo (exclusivo Admin del Tenant)
  const editOrderDialogRef = useRef<HTMLDialogElement | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [editOrderCustomerId, setEditOrderCustomerId] = useState("");
  const [editOrderBatchId, setEditOrderBatchId] = useState<string>("");
  const [editOrderStatus, setEditOrderStatus] =
    useState<OrderStatusType>("CONFIRMED_DEPOSIT_PAID");
  const [editOrderCurrency, setEditOrderCurrency] =
    useState<CurrencyType>("COP");
  const [editOrderPaymentRef, setEditOrderPaymentRef] = useState("");
  const [editOrderNotes, setEditOrderNotes] = useState("");
  const [editOrderItems, setEditOrderItems] = useState<OrderItemRecord[]>([]);
  const [savingOrderEdit, setSavingOrderEdit] = useState(false);
  const [editOrderError, setEditOrderError] = useState<string | null>(null);

  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    setBatches(initialBatches);
  }, [initialBatches]);

  useEffect(() => {
    setUnassigned(unassignedOrders);
  }, [unassignedOrders]);

  useEffect(() => {
    setCustomers(initialCustomers);
  }, [initialCustomers]);

  const features = tenant.settings?.features ?? DEFAULT_FEATURES;
  const vesRate = tenant.settings?.exchangeRates?.VES ?? 46.8;
  const copRate = tenant.settings?.exchangeRates?.COP ?? 4180;
  const rates = useMemo(
    () => resolveExchangeRates(tenant.settings?.exchangeRates),
    [tenant.settings?.exchangeRates]
  );
  const tenantCurrency: CurrencyType =
    tenant.currency === "COP" || tenant.currency === "VES"
      ? tenant.currency
      : "USD";

  // Modal para ver QR, enlace de seguimiento y publicar avances
  const [qrModalOrder, setQrModalOrder] = useState<OrderRecord | null>(null);

  // Todas las órdenes aplanadas (con su lote asociado)
  const allOrders = useMemo(() => {
    const fromBatches = batches.flatMap((b) =>
      b.orders.map((o) => ({
        ...o,
        batch: {
          id: b.id,
          tenantId: b.tenantId,
          code: b.code,
          name: b.name,
          purchaseDate: b.purchaseDate,
          status: b.status,
          trackingRef: b.trackingRef,
          notes: b.notes,
        },
      }))
    );
    return [...fromBatches, ...unassigned];
  }, [batches, unassigned]);

  // Estadísticas consolidadas
  const stats = useMemo(() => {
    const pendingPurchase = allOrders.filter(
      (o) => getOrderPhase(o.status) === "PENDING_PURCHASE"
    );
    const inProgress = allOrders.filter(
      (o) => getOrderPhase(o.status) === "IN_PROGRESS"
    );
    const completed = allOrders.filter(
      (o) => getOrderPhase(o.status) === "COMPLETED"
    );

    const totalProducts = allOrders.reduce(
      (acc, o) => acc + o.items.reduce((s, i) => s + (i.quantity || 1), 0),
      0
    );
    const totalInTenantCurrency = allOrders.reduce(
      (acc, o) =>
        acc + convertCurrency(o.subtotal, o.currency, tenantCurrency, rates),
      0
    );
    const collectedInTenantCurrency = allOrders.reduce(
      (acc, o) =>
        acc +
        convertCurrency(
          o.finalPaymentPaid ? o.subtotal : o.depositAmountPaid,
          o.currency,
          tenantCurrency,
          rates
        ),
      0
    );
    const pendingInTenantCurrency = allOrders.reduce(
      (acc, o) =>
        acc +
        (o.finalPaymentPaid
          ? 0
          : convertCurrency(o.balanceDue, o.currency, tenantCurrency, rates)),
      0
    );
    const pendingPurchaseInTenantCurrency = pendingPurchase.reduce(
      (acc, o) =>
        acc + convertCurrency(o.subtotal, o.currency, tenantCurrency, rates),
      0
    );

    return {
      totalOrders: allOrders.length,
      totalBatches: batches.length,
      totalProducts,
      pendingPurchaseCount: pendingPurchase.length,
      pendingPurchaseInTenantCurrency,
      inProgressCount: inProgress.length,
      completedCount: completed.length,
      totalInTenantCurrency,
      collectedInTenantCurrency,
      pendingInTenantCurrency,
    };
  }, [allOrders, batches, tenantCurrency, rates]);

  // Filtrado de pedidos en la pestaña "Todos los Pedidos"
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allOrders.filter((o) => {
      if (
        selectedBatchFilter !== "ALL" &&
        o.batchId !== selectedBatchFilter
      ) {
        return false;
      }
      if (phaseFilter !== "ALL" && getOrderPhase(o.status) !== phaseFilter) {
        return false;
      }
      if (!q) return true;
      return (
        o.customer?.fullName.toLowerCase().includes(q) ||
        o.customer?.phone.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.batch?.code && o.batch.code.toLowerCase().includes(q)) ||
        o.items.some((i) => i.title.toLowerCase().includes(q))
      );
    });
  }, [allOrders, selectedBatchFilter, phaseFilter, searchQuery]);

  // Filtrado de clientes en la pestaña "Clientes"
  const filteredCustomers = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.instagram && c.instagram.toLowerCase().includes(q))
    );
  }, [customers, customerSearchQuery]);

  async function refreshOrdersAndBatches() {
    const [bRes, oRes, cRes] = await Promise.all([
      fetch(`/api/batches?tenantId=${tenant.id}`),
      fetch(`/api/orders`),
      fetch(`/api/customers`),
    ]);
    if (bRes.ok) {
      const bJson = await bRes.json();
      if (bJson.ok) setBatches(bJson.batches);
    }
    if (oRes.ok) {
      const oJson = await oRes.json();
      if (oJson.ok) {
        setUnassigned(
          (oJson.orders as OrderRecord[]).filter((o) => !o.batchId)
        );
      }
    }
    if (cRes.ok) {
      const cJson = await cRes.json();
      if (cJson.ok) setCustomers(cJson.customers);
    }
    router.refresh();
  }

  async function handleCreateBatch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreatingBatch(true);
    setBatchModalError(null);
    try {
      const cleanCode = newBatchCode.trim().toUpperCase();
      if (
        batches.some((b) => b.code.trim().toUpperCase() === cleanCode)
      ) {
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
          notes: newBatchNotes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setBatchModalError(
          json.error || "No se pudo crear el lote de pedido."
        );
        return;
      }
      setBatches((prev) => [...prev, json.batch]);
      newBatchDialogRef.current?.close();
      setFeedbackToast(`Lote "${json.batch.code}" creado correctamente.`);
      router.refresh();
    } finally {
      setCreatingBatch(false);
    }
  }

  function openEditBatchModal(batch: OrderBatchRecord) {
    setEditingBatchId(batch.id);
    setEditBatchCode(batch.code);
    setEditBatchName(batch.name);
    setEditBatchDate(batch.purchaseDate.slice(0, 10));
    setEditBatchStatus(batch.status);
    setEditBatchNotes(batch.notes ?? "");
    setEditBatchError(null);
    editBatchDialogRef.current?.showModal();
  }

  async function handleSaveBatchEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingBatchEdit(true);
    setEditBatchError(null);
    try {
      const cleanCode = editBatchCode.trim().toUpperCase();
      if (
        batches.some(
          (b) =>
            b.id !== editingBatchId &&
            b.code.trim().toUpperCase() === cleanCode
        )
      ) {
        setEditBatchError(
          `Ya existe otro lote con el identificador "${cleanCode}".`
        );
        return;
      }

      const res = await fetch("/api/batches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          batchId: editingBatchId,
          code: cleanCode,
          name: editBatchName.trim(),
          purchaseDate: new Date(
            `${editBatchDate}T14:00:00.000Z`
          ).toISOString(),
          status: editBatchStatus,
          notes: editBatchNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setEditBatchError(json.error || "Error al actualizar el lote.");
        return;
      }
      await refreshOrdersAndBatches();
      editBatchDialogRef.current?.close();
      setFeedbackToast(`Lote "${cleanCode}" actualizado correctamente.`);
    } finally {
      setSavingBatchEdit(false);
    }
  }

  async function handleDeleteBatch(batch: OrderBatchRecord) {
    const confirmed = window.confirm(
      `¿Eliminar el lote "${batch.code} - ${batch.name}"? Los ${batch.orders.length} pedidos asociados pasarán a "Sin lote asignado".`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/batches?id=${batch.id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      await refreshOrdersAndBatches();
      setFeedbackToast(`Lote "${batch.code}" eliminado.`);
    } else {
      window.alert(json.error || "No se pudo eliminar el lote.");
    }
  }

  function openEditOrderModal(order: OrderRecord) {
    setEditingOrder(order);
    setEditOrderCustomerId(order.customerId);
    setEditOrderBatchId(order.batchId ?? "");
    setEditOrderStatus(order.status);
    setEditOrderCurrency(order.currency || tenantCurrency);
    setEditOrderPaymentRef(order.paymentReference ?? "");
    setEditOrderNotes(order.generalNotes ?? "");
    setEditOrderItems(
      order.items.map((item) => ({
        ...item,
      }))
    );
    setEditOrderError(null);
    editOrderDialogRef.current?.showModal();
  }

  function handleEditOrderItemChange<K extends keyof OrderItemRecord>(
    idx: number,
    field: K,
    value: OrderItemRecord[K]
  ) {
    setEditOrderItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  }

  function handleAddEditOrderItem() {
    if (!editingOrder) return;
    setEditOrderItems((prev) => [
      ...prev,
      {
        id: "",
        tenantId: tenant.id,
        orderId: editingOrder.id,
        title: "Nueva prenda",
        originalPrice: null,
        finalPrice: editOrderCurrency === "COP" ? 45000 : 12,
        quantity: 1,
        size: "M",
        color: "",
        modelVariant: null,
        verificationNotes: null,
        sourceImageUrl: null,
        isPhysicallyVerified: false,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function handleRemoveEditOrderItem(idx: number) {
    if (editOrderItems.length <= 1) {
      setEditOrderError("El pedido debe conservar al menos un producto.");
      return;
    }
    setEditOrderItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveOrderEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingOrder) return;
    setSavingOrderEdit(true);
    setEditOrderError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          orderId: editingOrder.id,
          customerId: editOrderCustomerId,
          batchId: editOrderBatchId || null,
          status: editOrderStatus,
          currency: editOrderCurrency,
          paymentReference: editOrderPaymentRef.trim() || null,
          generalNotes: editOrderNotes.trim() || null,
          items: editOrderItems.map((it) => ({
            id: it.id || undefined,
            title: it.title.trim(),
            originalPrice: it.originalPrice,
            finalPrice: Number(it.finalPrice) || 1,
            quantity: Math.max(1, Number(it.quantity) || 1),
            size: it.size?.trim() || null,
            color: it.color?.trim() || null,
            modelVariant: it.modelVariant?.trim() || null,
            verificationNotes: it.verificationNotes?.trim() || null,
            sourceImageUrl: it.sourceImageUrl ?? null,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setEditOrderError(json.error || "No se pudo actualizar el pedido.");
        return;
      }
      await refreshOrdersAndBatches();
      editOrderDialogRef.current?.close();
      setFeedbackToast(`Pedido #${editingOrder.id} actualizado.`);
    } finally {
      setSavingOrderEdit(false);
    }
  }

  async function handleDeleteOrder(order: OrderRecord) {
    const confirmed = window.confirm(
      `¿Eliminar el pedido #${order.id} de "${
        order.customer?.fullName ?? "Cliente"
      }"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/orders?id=${order.id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      await refreshOrdersAndBatches();
      setFeedbackToast(`Pedido #${order.id} eliminado.`);
    } else {
      window.alert(json.error || "No se pudo eliminar el pedido.");
    }
  }

  function openCreateCustomerModal() {
    setCustomerDialogMode("CREATE");
    setEditingCustomerId("");
    setCustFullName("");
    setCustPhone("+58 ");
    setCustInstagram("");
    setCustNotes("");
    setCustomerModalError(null);
    customerDialogRef.current?.showModal();
  }

  function openEditCustomerModal(customer: CustomerRecord) {
    setCustomerDialogMode("EDIT");
    setEditingCustomerId(customer.id);
    setCustFullName(customer.fullName);
    setCustPhone(customer.phone);
    setCustInstagram(customer.instagram ?? "");
    setCustNotes(customer.notes ?? "");
    setCustomerModalError(null);
    customerDialogRef.current?.showModal();
  }

  async function handleSaveCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingCustomer(true);
    setCustomerModalError(null);
    try {
      const targetDigits = custPhone.replace(/\D/g, "");
      const duplicateLocal = customers.find((c) => {
        if (customerDialogMode === "EDIT" && c.id === editingCustomerId) {
          return false;
        }
        const cDigits = c.phone.replace(/\D/g, "");
        return (
          (targetDigits.length >= 6 && cDigits === targetDigits) ||
          c.phone.trim().toLowerCase() === custPhone.trim().toLowerCase()
        );
      });

      if (duplicateLocal) {
        setCustomerModalError(
          `Ya existe un cliente registrado con el número "${custPhone.trim()}" (${duplicateLocal.fullName}).`
        );
        return;
      }

      const isEdit = customerDialogMode === "EDIT";
      const res = await fetch("/api/customers", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          ...(isEdit ? { customerId: editingCustomerId } : {}),
          fullName: custFullName.trim(),
          phone: custPhone.trim(),
          instagram: custInstagram.trim() || null,
          notes: custNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setCustomerModalError(
          json.error || "No se pudo guardar el cliente."
        );
        return;
      }

      await refreshOrdersAndBatches();
      customerDialogRef.current?.close();
      setFeedbackToast(
        isEdit
          ? `Cliente "${json.customer.fullName}" actualizado.`
          : `Cliente "${json.customer.fullName}" registrado.`
      );
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleDeleteCustomer(customer: CustomerRecord) {
    const customerOrdersCount = allOrders.filter(
      (o) => o.customerId === customer.id
    ).length;
    const warning =
      customerOrdersCount > 0
        ? `¿Eliminar al cliente "${customer.fullName}"? También se eliminarán sus ${customerOrdersCount} pedido(s) asociados.`
        : `¿Eliminar al cliente "${customer.fullName}" (${customer.phone})?`;

    if (!window.confirm(warning)) return;

    const res = await fetch(`/api/customers?id=${customer.id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      await refreshOrdersAndBatches();
      setFeedbackToast(`Cliente "${customer.fullName}" eliminado.`);
    } else {
      window.alert(json.error || "No se pudo eliminar el cliente.");
    }
  }

  async function handleQuickOrderUpdate(
    orderId: string,
    payload: { batchId?: string | null; status?: OrderStatusType }
  ) {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch("/api/batches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          orderId,
          ...payload,
        }),
      });
      if (res.ok) {
        await refreshOrdersAndBatches();
      }
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function handleExportOrderQuote(order: OrderRecord) {
    await exportQuoteAsPng({
      tenantName: tenant.name,
      logoUrl: tenant.settings?.logoUrl,
      primaryColor: tenant.settings?.theme?.primaryColor,
      secondaryColor: tenant.settings?.theme?.secondaryColor,
      customerName: order.customer?.fullName ?? "Cliente",
      customerPhone: order.customer?.phone,
      orderId: order.id,
      batchLabel: order.batch
        ? `${order.batch.code} (${formatShortDate(order.batch.purchaseDate)})`
        : null,
      dateLabel: formatShortDate(order.orderDate),
      currency: order.currency || tenantCurrency,
      items: order.items.map((i) => ({
        title: i.title,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        finalPrice: i.finalPrice,
      })),
      subtotalUsd: order.subtotal,
      depositPct: tenant.defaultDepositPct,
      depositUsd: order.depositRequired,
      vesRate,
      copRate,
      paymentSummary: order.paymentMethod
        ? `Método: ${order.paymentMethod}`
        : undefined,
    });
  }

  // Si el dueño de la app desactivó el servicio para este Tenant
  if (!tenant.active) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/40 bg-slate-900 p-6 text-center space-y-3 my-8">
        <ShieldOff className="mx-auto h-10 w-10 text-rose-400" />
        <h1 className="text-lg font-bold text-white">
          Servicio Suspendido para {tenant.name}
        </h1>
        <p className="text-xs text-slate-400">
          El administrador de la plataforma ha desactivado temporalmente el
          acceso o las funciones de este negocio.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Link
            href="/login"
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
          >
            Cambiar de Cuenta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Barra Superior Minimalista: Pestañas (Estadísticas vs Pedidos vs Clientes) + Acciones Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-900 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setMainTab("STATS")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${
              mainTab === "STATS"
                ? "btn-brand-gradient text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Resumen y Estadísticas
          </button>

          <button
            type="button"
            onClick={() => setMainTab("ORDERS")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${
              mainTab === "ORDERS"
                ? "btn-brand-gradient text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            Todos los Pedidos ({allOrders.length})
          </button>

          <button
            type="button"
            onClick={() => setMainTab("CUSTOMERS")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${
              mainTab === "CUSTOMERS"
                ? "btn-brand-gradient text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Clientes ({customers.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateCustomerModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            <UserPlus className="h-3.5 w-3.5 text-emerald-400" />
            + Nuevo Cliente
          </button>

          <button
            type="button"
            onClick={() => {
              const next = suggestNextBatchCode(batches);
              setNewBatchCode(next.code);
              setNewBatchName(next.name);
              setBatchModalError(null);
              newBatchDialogRef.current?.showModal();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            <FolderPlus className="h-3.5 w-3.5 text-amber-400" />
            + Nuevo Lote
          </button>

          <Link
            href="/orders/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl btn-brand-gradient px-3.5 text-xs font-bold shadow-md"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            + Nuevo Pedido
          </Link>
        </div>
      </div>

      {feedbackToast && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-200"
        >
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {feedbackToast}
          </span>
          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 1: RESUMEN Y ESTADÍSTICAS DE PEDIDOS Y LOTES
         ===================================================================== */}
      {mainTab === "STATS" && (
        <div className="space-y-5">
          {/* 4 Tarjetas KPI Compactas */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {/* 1. Pendientes / Por Confirmar del lado del Tenant */}
            <button
              type="button"
              onClick={() => {
                setPhaseFilter("PENDING_PURCHASE");
                setMainTab("ORDERS");
              }}
              className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-3.5 text-left transition-colors hover:border-amber-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-amber-300">
                  Por Confirmar / Pendiente
                </span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-white">
                {stats.pendingPurchaseCount}{" "}
                <span className="text-xs font-normal text-slate-400">
                  pedidos
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-amber-200/80">
                {formatMoney(stats.pendingPurchaseInTenantCurrency, tenantCurrency)} pendientes →
              </p>
            </button>

            {/* 2. Pedidos en Curso / Almacén */}
            <button
              type="button"
              onClick={() => {
                setPhaseFilter("IN_PROGRESS");
                setMainTab("ORDERS");
              }}
              className="rounded-2xl border border-sky-500/30 bg-slate-900/90 p-3.5 text-left transition-colors hover:border-sky-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-sky-300">
                  En Curso / Almacén
                </span>
                <Package className="h-4 w-4 text-sky-400" />
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-white">
                {stats.inProgressCount}{" "}
                <span className="text-xs font-normal text-slate-400">
                  pedidos
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-sky-200/80">
                Comprados, viajando o en cotejo →
              </p>
            </button>

            {/* 3. Pedidos Culminados */}
            <button
              type="button"
              onClick={() => {
                setPhaseFilter("COMPLETED");
                setMainTab("ORDERS");
              }}
              className="rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-3.5 text-left transition-colors hover:border-emerald-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-emerald-300">
                  Culminados
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-white">
                {stats.completedCount}{" "}
                <span className="text-xs font-normal text-slate-400">
                  entregados
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-200/80">
                100% pagados y verificados →
              </p>
            </button>

            {/* 4. Resumen Financiero */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Volumen Total ({stats.totalProducts} prod.)
                </span>
                <ShoppingBag className="h-4 w-4 text-rose-400" />
              </div>
              <p className="mt-1.5 text-xl font-extrabold text-white">
                {formatMoney(stats.totalInTenantCurrency, tenantCurrency)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Cobrado:{" "}
                <strong className="text-emerald-400">
                  {formatMoney(stats.collectedInTenantCurrency, tenantCurrency, false)}
                </strong>{" "}
                • Resta:{" "}
                <strong className="text-amber-300">
                  {formatMoney(stats.pendingInTenantCurrency, tenantCurrency, false)}
                </strong>
              </p>
            </div>
          </div>

          {/* Resumen de Lotes por Fecha de Salida / Compra */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Lotes de Salida / Compra ({batches.length})
              </h2>
              <span className="text-[11px] text-slate-400">
                Haz clic en un lote para gestionar sus clientes y productos
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {batches.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:border-slate-700 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-xs font-bold text-rose-300">
                        <Boxes className="h-3 w-3" />
                        {b.code}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                          <Calendar className="h-3 w-3" />
                          {formatShortDate(b.purchaseDate)}
                        </span>

                        {isTenantAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditBatchModal(b)}
                              title={`Editar lote ${b.code}`}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBatch(b)}
                              title={`Eliminar lote ${b.code}`}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-2 text-sm font-bold text-white">
                      {b.name}
                    </h3>

                    <div className="mt-2.5 flex items-center gap-3 text-xs text-slate-300">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-rose-400" />
                        <strong>{b.metrics.clientsCount}</strong> clientes
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="h-3.5 w-3.5 text-purple-400" />
                        <strong>{b.metrics.productsCount}</strong> prod.
                      </span>
                      <span>•</span>
                      <strong className="text-emerald-400">
                        {tenantCurrency === "COP"
                          ? formatMoney(b.metrics.subtotalCop, "COP")
                          : formatMoney(b.metrics.subtotalUsd, "USD")}
                      </strong>
                    </div>

                    {/* Mini semáforo de estados dentro del Lote */}
                    <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">
                      <div className="rounded-lg bg-amber-500/10 py-1 text-amber-300 border border-amber-500/20">
                        <strong>{b.metrics.pendingPurchaseOrdersCount}</strong>{" "}
                        Por confirmar
                      </div>
                      <div className="rounded-lg bg-sky-500/10 py-1 text-sky-300 border border-sky-500/20">
                        <strong>{b.metrics.inProgressOrdersCount}</strong> En
                        curso
                      </div>
                      <div className="rounded-lg bg-emerald-500/10 py-1 text-emerald-300 border border-emerald-500/20">
                        <strong>{b.metrics.completedOrdersCount}</strong>{" "}
                        Culminados
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                    <Link
                      href={`/orders/new?batchId=${b.id}`}
                      className="text-xs font-semibold text-rose-400 hover:underline"
                    >
                      + Agregar cliente
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBatchFilter(b.id);
                        setPhaseFilter("ALL");
                        setMainTab("ORDERS");
                      }}
                      className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-white hover:bg-slate-700"
                    >
                      Ver {b.orders.length} pedidos →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 2: TODOS LOS PEDIDOS (SEPARADOS POR ETAPA Y LOTE)
         ===================================================================== */}
      {mainTab === "ORDERS" && (
        <div className="space-y-4">
          {/* Barra de Filtros: Por Etapa (Por Comprar / En Curso / Culminados) + Lote + Búsqueda */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-800 bg-slate-900/75 p-3 md:flex-row md:items-center md:justify-between">
            {/* Filtro de Etapa del Pedido */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  id: "ALL" as const,
                  label: `Todos (${allOrders.length})`,
                },
                {
                  id: "PENDING_PURCHASE" as const,
                  label: `Por Confirmar (${stats.pendingPurchaseCount})`,
                },
                {
                  id: "IN_PROGRESS" as const,
                  label: `En Curso (${stats.inProgressCount})`,
                },
                {
                  id: "COMPLETED" as const,
                  label: `Culminados (${stats.completedCount})`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPhaseFilter(tab.id)}
                  className={`h-8 rounded-lg px-2.5 text-xs font-bold transition-colors ${
                    phaseFilter === tab.id
                      ? "btn-brand-gradient text-white shadow-xs"
                      : "bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selector de Lote + Buscador */}
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="batch-select-filter" className="visually-hidden">
                Filtrar por Lote
              </label>
              <select
                id="batch-select-filter"
                value={selectedBatchFilter}
                onChange={(e) => setSelectedBatchFilter(e.target.value)}
                style={{ minHeight: "34px", fontSize: "0.75rem" }}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-slate-200"
              >
                <option value="ALL">Todos los Lotes</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} • {formatShortDate(b.purchaseDate)} ({b.orders.length})
                  </option>
                ))}
              </select>

              <div className="relative flex-1 sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="search"
                  placeholder="Buscar cliente o prenda..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ minHeight: "34px", fontSize: "0.75rem" }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1 text-xs text-white placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Grid Adaptable (1 col en móvil, 2 cols en Desktop) con Tarjetas Compactas */}
          {filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
              No hay pedidos que coincidan con el filtro seleccionado.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filteredOrders.map((order) => {
                const statusMeta =
                  ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.DRAFT;
                const totalUnits = order.items.reduce(
                  (s, i) => s + (i.quantity || 1),
                  0
                );
                const verifiedUnits = order.items.filter(
                  (i) => i.isPhysicallyVerified
                ).length;

                const orderCurr = order.currency || tenantCurrency;

                const trackingUrl =
                  typeof window !== "undefined"
                    ? `${window.location.origin}/track/${order.id}`
                    : `/track/${order.id}`;

                const orderStatusLabel =
                  ORDER_STATUS_META[order.status]?.label || "Por Confirmar";

                const whatsappHref = buildWhatsAppUrl(
                  order.customer?.phone,
                  buildOrderTrackingWhatsAppMessage({
                    tenantName: tenant.name,
                    customerName: order.customer?.fullName ?? "Cliente",
                    customerDocumentId: order.customer?.documentId,
                    orderId: order.id,
                    statusLabel: orderStatusLabel,
                    businessType: tenant.settings?.businessType,
                    trackingUrl,
                    subtotal: order.subtotal,
                    depositAmountPaid: order.depositAmountPaid,
                    balanceDue: order.balanceDue,
                    currency: orderCurr,
                    fittingDate: order.fittingDate,
                    estimatedDeliveryDate: order.estimatedDeliveryDate,
                    itemsDescription: order.items.map((i) => i.title).join(", "),
                    customTemplate: tenant.settings?.whatsappConfig?.customMessage,
                  })
                );

                return (
                  <article
                    key={order.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/85 p-3.5 hover:border-slate-700 transition-all"
                  >
                    <div>
                      {/* Fila 1: Lote + ID + Moneda + Badge de Estado */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {order.batch && (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300 border border-amber-500/30">
                              {order.batch.code} •{" "}
                              {formatShortDate(order.batch.purchaseDate)}
                            </span>
                          )}
                          <span className="font-mono text-[11px] text-slate-400">
                            #{order.id}
                          </span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                            {orderCurr}
                          </span>
                        </div>

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      {/* Fila 2: Cliente y Montos Multimoneda */}
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            {order.customer?.fullName ?? "Cliente"}
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            {order.customer?.phone} •{" "}
                            <strong className="text-slate-200">
                              {totalUnits} prod.
                            </strong>{" "}
                            (Cotejo: {verifiedUnits}/{order.items.length})
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-extrabold text-white">
                            {formatMoney(order.subtotal, orderCurr)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatEquivalentSummary(order.subtotal, orderCurr, rates)}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Seña:{" "}
                            <span className="text-emerald-400 font-semibold">
                              {formatMoney(order.depositAmountPaid, orderCurr, false)}
                            </span>{" "}
                            • Resta:{" "}
                            <span className="text-amber-300 font-semibold">
                              {formatMoney(order.balanceDue, orderCurr, false)}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Fila 3: Mini lista compacta de prendas */}
                      <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px]"
                          >
                            {item.sourceImageUrl && (
                              <img
                                src={item.sourceImageUrl}
                                alt=""
                                className="h-6 w-6 rounded object-cover"
                              />
                            )}
                            <span className="max-w-[110px] truncate text-slate-200">
                              {item.title}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({item.size || "-"})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Fila 4: Controles Rápidos (Estado, Lote, WhatsApp, Cotización PNG, Cotejo) */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
                      <div className="flex items-center gap-1.5">
                        {/* Cambiar estado rápido (Por comprar -> Comprado -> En Almacén -> Culminado) */}
                        <label
                          htmlFor={`status-${order.id}`}
                          className="visually-hidden"
                        >
                          Estado del pedido
                        </label>
                        <select
                          id={`status-${order.id}`}
                          disabled={updatingOrderId === order.id}
                          value={order.status}
                          onChange={(e) =>
                            handleQuickOrderUpdate(order.id, {
                              status: e.target.value as OrderStatusType,
                            })
                          }
                          style={{ minHeight: "30px", fontSize: "0.7rem" }}
                          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-semibold text-slate-200"
                        >
                          {order.businessType === "TAILORING" ||
                          tenant.settings?.businessType === "TAILORING" ? (
                            <>
                              <option value="DRAFT">📐 Presupuesto / Medidas</option>
                              <option value="CONFIRMED_DEPOSIT_PAID">
                                💵 Seña Abonada
                              </option>
                              <option value="MEASUREMENTS_TAKEN">
                                ✂️ Patronaje y Corte
                              </option>
                              <option value="IN_PRODUCTION">
                                👗 En Confección
                              </option>
                              <option value="READY_FOR_FITTING">
                                🪞 Listo para Prueba
                              </option>
                              <option value="FINAL_ADJUSTMENTS">
                                ✨ Ajustes Finales
                              </option>
                              <option value="READY_FOR_DELIVERY">
                                🛍️ Listo para Retiro
                              </option>
                              <option value="COMPLETED">
                                🎉 Culminado (100%)
                              </option>
                              <option value="CANCELLED">❌ Cancelado</option>
                            </>
                          ) : (
                            <>
                              <option value="CONFIRMED_DEPOSIT_PAID">
                                ⏳ Por Confirmar (50% Abonado)
                              </option>
                              <option value="PURCHASED_AT_ORIGIN">
                                🛒 Comprado en Origen
                              </option>
                              <option value="IN_TRANSIT">✈️ En Tránsito</option>
                              <option value="RECEIVED_IN_WAREHOUSE">
                                📦 En Almacén (Cotejo)
                              </option>
                              <option value="READY_FOR_DELIVERY">
                                ✅ Listo para Entregar
                              </option>
                              <option value="COMPLETED">
                                🎉 Culminado (Entregado)
                              </option>
                              <option value="CANCELLED">❌ Cancelado</option>
                            </>
                          )}
                        </select>

                        {/* Cambiar Lote */}
                        <label
                          htmlFor={`batch-${order.id}`}
                          className="visually-hidden"
                        >
                          Lote del pedido
                        </label>
                        <select
                          id={`batch-${order.id}`}
                          disabled={updatingOrderId === order.id}
                          value={order.batchId ?? ""}
                          onChange={(e) =>
                            handleQuickOrderUpdate(order.id, {
                              batchId: e.target.value || null,
                            })
                          }
                          style={{ minHeight: "30px", fontSize: "0.7rem" }}
                          className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-300"
                        >
                          <option value="">Sin lote</option>
                          {batches.map((bOpt) => (
                            <option key={bOpt.id} value={bOpt.id}>
                              {bOpt.code}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Botones de Acción: WhatsApp, Cotización PNG, Cotejo + Editar/Eliminar para Admin */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {features.whatsappButton && (
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Hablar con el cliente por WhatsApp"
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </a>
                        )}

                        {/* Botón de QR y Seguimiento en Vivo */}
                        <button
                          type="button"
                          onClick={() => setQrModalOrder(order)}
                          title="Ver Código QR y Seguimiento en Vivo"
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand-soft bg-brand-soft px-2.5 text-[11px] font-bold text-brand-primary hover:brightness-110 shadow-xs"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          QR / Estado
                        </button>

                        {features.quoteExport && (
                          <button
                            type="button"
                            onClick={() => handleExportOrderQuote(order)}
                            title="Exportar cotización en imagen PNG"
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                          >
                            <Download className="h-3.5 w-3.5 text-rose-400" />
                            Cotización
                          </button>
                        )}

                        {features.warehouseVerify && (
                          <Link
                            href={`/orders/${order.id}/verify`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-800 px-2.5 text-[11px] font-bold text-white hover:bg-slate-700"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5 text-purple-400" />
                            Cotejo
                          </Link>
                        )}

                        {isTenantAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditOrderModal(order)}
                              title="Editar pedido y sus productos"
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOrder(order)}
                              title="Eliminar pedido"
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/15 px-2 text-[11px] font-bold text-rose-300 hover:bg-rose-500/25"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 3: DIRECTORIO Y GESTIÓN DE CLIENTES
         ===================================================================== */}
      {mainTab === "CUSTOMERS" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-800 bg-slate-900/75 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">
                Directorio de Clientes ({customers.length})
              </h2>
              <p className="text-[11px] text-slate-400">
                Cada cliente tiene validado un número de contacto único en la tienda.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="search"
                  placeholder="Buscar por nombre, teléfono o Instagram..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  style={{ minHeight: "34px", fontSize: "0.75rem" }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1 text-xs text-white placeholder:text-slate-500"
                />
              </div>

              <button
                type="button"
                onClick={openCreateCustomerModal}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                <UserPlus className="h-3.5 w-3.5" />
                + Registrar Cliente
              </button>
            </div>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
              No se encontraron clientes registrados con ese criterio.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredCustomers.map((cust) => {
                const custOrders = allOrders.filter(
                  (o) => o.customerId === cust.id
                );
                const custTotalInTenantCurrency = custOrders.reduce(
                  (acc, o) =>
                    acc +
                    convertCurrency(
                      o.subtotal,
                      o.currency,
                      tenantCurrency,
                      rates
                    ),
                  0
                );
                const latestOrder = custOrders[0];
                const latestTrackingUrl =
                  latestOrder && typeof window !== "undefined"
                    ? `${window.location.origin}/track/${latestOrder.id}`
                    : latestOrder
                    ? `/track/${latestOrder.id}`
                    : "";

                const waUrl = latestOrder
                  ? buildWhatsAppUrl(
                      cust.phone,
                      buildOrderTrackingWhatsAppMessage({
                        tenantName: tenant.name,
                        customerName: cust.fullName,
                        customerDocumentId: cust.documentId,
                        orderId: latestOrder.id,
                        statusLabel:
                          ORDER_STATUS_META[latestOrder.status]?.label ||
                          "Por Confirmar",
                        businessType: tenant.settings?.businessType,
                        trackingUrl: latestTrackingUrl,
                        subtotal: latestOrder.subtotal,
                        depositAmountPaid: latestOrder.depositAmountPaid,
                        balanceDue: latestOrder.balanceDue,
                        currency: latestOrder.currency || tenantCurrency,
                        fittingDate: latestOrder.fittingDate,
                        estimatedDeliveryDate: latestOrder.estimatedDeliveryDate,
                        itemsDescription: latestOrder.items
                          .map((i) => i.title)
                          .join(", "),
                        customTemplate:
                          tenant.settings?.whatsappConfig?.customMessage,
                      })
                    )
                  : buildWhatsAppUrl(
                      cust.phone,
                      `¡Hola *${cust.fullName}*! Te saludamos de *${tenant.name}* ✨ ¿En qué podemos ayudarte hoy?`
                    );

                return (
                  <article
                    key={cust.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/85 p-3.5 hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            {cust.fullName}
                          </h3>
                          <p className="mt-0.5 font-mono text-xs text-emerald-400">
                            {cust.phone}
                          </p>
                          {cust.instagram && (
                            <p className="text-[11px] text-rose-300">
                              {cust.instagram}
                            </p>
                          )}
                        </div>

                        <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                          {custOrders.length} pedido(s)
                        </span>
                      </div>

                      {cust.notes && (
                        <p className="mt-2 rounded-lg border border-slate-800/80 bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-slate-300">
                          {cust.notes}
                        </p>
                      )}

                      <p className="mt-2 text-[11px] text-slate-400">
                        Volumen acumulado:{" "}
                        <strong className="text-white">
                          {formatMoney(
                            custTotalInTenantCurrency,
                            tenantCurrency
                          )}
                        </strong>
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-800/80 pt-2.5">
                      <div className="flex items-center gap-1.5">
                        {features.whatsappButton && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25"
                          >
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </a>
                        )}

                        {custOrders.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery(cust.phone);
                              setSelectedBatchFilter("ALL");
                              setPhaseFilter("ALL");
                              setMainTab("ORDERS");
                            }}
                            className="inline-flex h-7 items-center rounded-lg bg-slate-800 px-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                          >
                            Ver pedidos
                          </button>
                        )}
                      </div>

                      {isTenantAdmin && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditCustomerModal(cust)}
                            title={`Editar cliente ${cust.fullName}`}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25"
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(cust)}
                            title={`Eliminar cliente ${cust.fullName}`}
                            className="inline-flex h-7 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/15 px-2 text-[11px] font-bold text-rose-300 hover:bg-rose-500/25"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Nativo <dialog> para Crear un Nuevo Lote por Fecha de Salida/Compra */}
      <dialog
        ref={newBatchDialogRef}
        aria-labelledby="new-batch-dialog-title"
        className="m-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 id="new-batch-dialog-title" className="text-sm font-bold text-white">
            Nuevo Lote de Pedido por Fecha de Salida
          </h3>
          <button
            type="button"
            onClick={() => newBatchDialogRef.current?.close()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreateBatch} method="POST" className="space-y-3 p-4">
          {batchModalError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{batchModalError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="batch-code-input"
                className="mb-1 block text-xs font-semibold text-slate-300"
              >
                Código / ID Único *
              </label>
              <input
                id="batch-code-input"
                type="text"
                required
                value={newBatchCode}
                onChange={(e) => setNewBatchCode(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs font-bold text-white"
              />
            </div>

            <div>
              <label
                htmlFor="batch-date-input"
                className="mb-1 block text-xs font-semibold text-amber-300"
              >
                Fecha de Salida / Compra *
              </label>
              <input
                id="batch-date-input"
                type="date"
                required
                value={newBatchDate}
                onChange={(e) => setNewBatchDate(e.target.value)}
                className="w-full rounded-xl border border-amber-500/40 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="batch-name-input"
              className="mb-1 block text-xs font-semibold text-slate-300"
            >
              Nombre del Lote *
            </label>
            <input
              id="batch-name-input"
              type="text"
              required
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label
              htmlFor="batch-notes-input"
              className="mb-1 block text-xs font-semibold text-slate-300"
            >
              Notas (Opcional)
            </label>
            <input
              id="batch-notes-input"
              type="text"
              placeholder="Ej. Sale 2 días después del lote anterior"
              value={newBatchNotes}
              onChange={(e) => setNewBatchNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => newBatchDialogRef.current?.close()}
              className="h-9 rounded-xl border border-slate-700 px-3.5 text-xs text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creatingBatch}
              className="h-9 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-slate-950"
            >
              {creatingBatch ? "Guardando..." : "Guardar Lote"}
            </button>
          </div>
        </form>
      </dialog>

      {/* Modal Nativo <dialog> para Editar un Lote (Exclusivo Admin del Tenant) */}
      <dialog
        ref={editBatchDialogRef}
        aria-labelledby="edit-batch-dialog-title"
        className="m-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 id="edit-batch-dialog-title" className="text-sm font-bold text-white">
            Editar Lote Consolidado
          </h3>
          <button
            type="button"
            onClick={() => editBatchDialogRef.current?.close()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSaveBatchEdit} method="POST" className="space-y-3 p-4">
          {editBatchError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{editBatchError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Código / ID Único *
              </label>
              <input
                type="text"
                required
                value={editBatchCode}
                onChange={(e) => setEditBatchCode(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs font-bold text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-amber-300">
                Fecha de Salida *
              </label>
              <input
                type="date"
                required
                value={editBatchDate}
                onChange={(e) => setEditBatchDate(e.target.value)}
                className="w-full rounded-xl border border-amber-500/40 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Nombre del Lote *
            </label>
            <input
              type="text"
              required
              value={editBatchName}
              onChange={(e) => setEditBatchName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Estado del Lote
            </label>
            <select
              value={editBatchStatus}
              onChange={(e) =>
                setEditBatchStatus(e.target.value as BatchStatusType)
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="OPEN_FOR_ORDERS">Abierto para Pedidos</option>
              <option value="PURCHASED_AT_ORIGIN">Comprado en Origen</option>
              <option value="IN_TRANSIT">En Tránsito</option>
              <option value="RECEIVED_IN_WAREHOUSE">En Almacén</option>
              <option value="COMPLETED">Completado</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Notas
            </label>
            <input
              type="text"
              value={editBatchNotes}
              onChange={(e) => setEditBatchNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => editBatchDialogRef.current?.close()}
              className="h-9 rounded-xl border border-slate-700 px-3.5 text-xs text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingBatchEdit}
              className="h-9 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-slate-950"
            >
              {savingBatchEdit ? "Guardando..." : "Actualizar Lote"}
            </button>
          </div>
        </form>
      </dialog>

      {/* Modal Nativo <dialog> para Crear o Editar Cliente (Con Validación de Teléfono Único) */}
      <dialog
        ref={customerDialogRef}
        aria-labelledby="customer-dialog-title"
        className="m-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 id="customer-dialog-title" className="text-sm font-bold text-white">
            {customerDialogMode === "EDIT"
              ? "Editar Datos del Cliente"
              : "Registrar Nuevo Cliente"}
          </h3>
          <button
            type="button"
            onClick={() => customerDialogRef.current?.close()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSaveCustomer} method="POST" className="space-y-3 p-4">
          {customerModalError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{customerModalError}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Nombre Completo *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Valentina Gómez"
              value={custFullName}
              onChange={(e) => setCustFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-emerald-300">
                WhatsApp (Único) *
              </label>
              <input
                type="tel"
                required
                placeholder="+58 412 0000000"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                className="w-full rounded-xl border border-emerald-500/40 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Instagram (Opcional)
              </label>
              <input
                type="text"
                placeholder="@usuario"
                value={custInstagram}
                onChange={(e) => setCustInstagram(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Notas o Dirección de Entrega (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Entrega en agencia Zoom centro"
              value={custNotes}
              onChange={(e) => setCustNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => customerDialogRef.current?.close()}
              className="h-9 rounded-xl border border-slate-700 px-3.5 text-xs text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingCustomer}
              className="h-9 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-slate-950"
            >
              {savingCustomer
                ? "Guardando..."
                : customerDialogMode === "EDIT"
                ? "Actualizar Cliente"
                : "Guardar Cliente"}
            </button>
          </div>
        </form>
      </dialog>

      {/* Modal Nativo <dialog> para Editar un Pedido Completo y sus Productos (Exclusivo Admin del Tenant) */}
      <dialog
        ref={editOrderDialogRef}
        aria-labelledby="edit-order-dialog-title"
        className="m-auto w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h3 id="edit-order-dialog-title" className="text-sm font-bold text-white">
              Editar Pedido #{editingOrder?.id}
            </h3>
            <p className="text-[11px] text-slate-400">
              Modifica el cliente, lote, moneda, estado o las prendas del pedido.
            </p>
          </div>
          <button
            type="button"
            onClick={() => editOrderDialogRef.current?.close()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSaveOrderEdit}
          method="POST"
          className="max-h-[80vh] overflow-y-auto space-y-3.5 p-4"
        >
          {editOrderError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{editOrderError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Cliente Asociado *
              </label>
              <select
                value={editOrderCustomerId}
                onChange={(e) => setEditOrderCustomerId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Lote de Salida
              </label>
              <select
                value={editOrderBatchId}
                onChange={(e) => setEditOrderBatchId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="">Sin lote asignado</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} • {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Moneda Operativa
              </label>
              <div className="flex h-[38px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs font-bold text-white">
                <Coins className="h-3.5 w-3.5 text-amber-400" />
                <span>{editOrderCurrency}</span>
                <span className="text-[10px] font-normal text-slate-400">(Fijada por Tenant)</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Estado del Pedido
              </label>
              <select
                value={editOrderStatus}
                onChange={(e) =>
                  setEditOrderStatus(e.target.value as OrderStatusType)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="DRAFT">Borrador</option>
                <option value="CONFIRMED_DEPOSIT_PAID">
                  Por Confirmar (50% Abonado)
                </option>
                <option value="PURCHASED_AT_ORIGIN">Comprado en Origen</option>
                <option value="IN_TRANSIT">En Tránsito</option>
                <option value="RECEIVED_IN_WAREHOUSE">En Almacén</option>
                <option value="READY_FOR_DELIVERY">Listo para Entregar</option>
                <option value="COMPLETED">Culminado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Referencia de Pago
              </label>
              <input
                type="text"
                value={editOrderPaymentRef}
                onChange={(e) => setEditOrderPaymentRef(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Notas Generales del Pedido
            </label>
            <input
              type="text"
              value={editOrderNotes}
              onChange={(e) => setEditOrderNotes(e.target.value)}
              placeholder="Observaciones del pedido..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          {/* Lista editable de Productos del Pedido */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-300">
                Productos del Pedido ({editOrderItems.length})
              </span>
              <button
                type="button"
                onClick={handleAddEditOrderItem}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-slate-800 px-2.5 text-[11px] font-bold text-emerald-300 hover:bg-slate-700"
              >
                <Plus className="h-3 w-3" />
                Agregar prenda
              </button>
            </div>

            <div className="space-y-2">
              {editOrderItems.map((item, idx) => (
                <div
                  key={item.id || `new-${idx}`}
                  className="grid grid-cols-12 items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-2"
                >
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[10px] text-slate-400">
                      Prenda
                    </label>
                    <input
                      type="text"
                      required
                      value={item.title}
                      onChange={(e) =>
                        handleEditOrderItemChange(idx, "title", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-[10px] text-slate-400">
                      Talla
                    </label>
                    <input
                      type="text"
                      value={item.size ?? ""}
                      onChange={(e) =>
                        handleEditOrderItemChange(idx, "size", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-[10px] text-slate-400">
                      Color
                    </label>
                    <input
                      type="text"
                      value={item.color ?? ""}
                      onChange={(e) =>
                        handleEditOrderItemChange(idx, "color", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-1">
                    <label className="block text-[10px] text-slate-400">
                      Cant.
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        handleEditOrderItemChange(
                          idx,
                          "quantity",
                          Math.max(1, Number(e.target.value) || 1)
                        )
                      }
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white"
                    />
                  </div>

                  <div className="col-span-10 sm:col-span-2">
                    <label className="block text-[10px] text-slate-400">
                      Precio ({editOrderCurrency})
                    </label>
                    <input
                      type="number"
                      step={editOrderCurrency === "COP" ? "100" : "0.01"}
                      min={0.01}
                      value={item.finalPrice}
                      onChange={(e) =>
                        handleEditOrderItemChange(
                          idx,
                          "finalPrice",
                          Number(e.target.value) || 0
                        )
                      }
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-xs text-emerald-300"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => handleRemoveEditOrderItem(idx)}
                      title="Quitar prenda"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs">
              <span className="text-slate-400">Nuevo Total Calculado:</span>
              <strong className="text-sm text-emerald-400">
                {formatMoney(
                  editOrderItems.reduce(
                    (acc, it) =>
                      acc + Number(it.finalPrice || 0) * (it.quantity || 1),
                    0
                  ),
                  editOrderCurrency
                )}
              </strong>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => editOrderDialogRef.current?.close()}
              className="h-9 rounded-xl border border-slate-700 px-3.5 text-xs text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingOrderEdit}
              className="h-9 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-slate-950"
            >
              {savingOrderEdit ? "Guardando..." : "Guardar Cambios del Pedido"}
            </button>
          </div>
        </form>
      </dialog>

      {/* Modal de Código QR y Seguimiento en Vivo */}
      {qrModalOrder && (
        <OrderQrModal
          isOpen={Boolean(qrModalOrder)}
          onClose={() => setQrModalOrder(null)}
          order={qrModalOrder}
          tenant={tenant}
          onOrderUpdated={(updated) => {
            setQrModalOrder(updated);
            setBatches((prevBatches) =>
              prevBatches.map((b) => ({
                ...b,
                orders: b.orders.map((o) =>
                  o.id === updated.id ? updated : o
                ),
              }))
            );
            setUnassigned((prevUnassigned) =>
              prevUnassigned.map((o) =>
                o.id === updated.id ? updated : o
              )
            );
            setFeedbackToast(`Estado de orden #${updated.id} actualizado.`);
          }}
        />
      )}
    </div>
  );
}
