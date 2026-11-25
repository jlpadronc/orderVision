import { NextResponse, type NextRequest } from "next/server";
import {
  createOrderForTenant,
  deleteOrderForTenant,
  listOrdersByTenant,
  updateOrderForTenant,
} from "@/lib/repositories/multiTenantRepository";
import { resolveActiveTenant } from "@/lib/tenantContext";
import {
  CreateOrderSchema,
  UpdateOrderSchema,
} from "@/lib/validations/schemas";

function isTenantAdminRole(role?: string | null): boolean {
  return role === "TENANT_ADMIN" || role === "SUPERADMIN";
}

export async function GET() {
  const { activeTenant, sessionUser } = await resolveActiveTenant();
  if (!sessionUser || !activeTenant) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
      { status: 401 }
    );
  }

  const orders = await listOrdersByTenant(activeTenant.id);
  return NextResponse.json({
    ok: true,
    tenantId: activeTenant.id,
    orders,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { activeTenant, sessionUser } = await resolveActiveTenant();
    if (!sessionUser || !activeTenant) {
      return NextResponse.json(
        { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = CreateOrderSchema.safeParse({
      ...body,
      tenantId: activeTenant.id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Datos del pedido inválidos",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const createdOrder = await createOrderForTenant(parsed.data);
    return NextResponse.json({ ok: true, order: createdOrder }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al crear el pedido";
    const status = message.includes("Ya existe") ? 409 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { activeTenant, sessionUser } = await resolveActiveTenant();
    if (!sessionUser || !activeTenant) {
      return NextResponse.json(
        { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
        { status: 401 }
      );
    }

    if (!isTenantAdminRole(sessionUser.role)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Solo el administrador del negocio puede editar pedidos",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = UpdateOrderSchema.safeParse({
      ...body,
      tenantId: activeTenant.id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Datos del pedido inválidos",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const updatedOrder = await updateOrderForTenant(parsed.data);
    return NextResponse.json({ ok: true, order: updatedOrder });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Error al actualizar el pedido",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { activeTenant, sessionUser } = await resolveActiveTenant();
    if (!sessionUser || !activeTenant) {
      return NextResponse.json(
        { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
        { status: 401 }
      );
    }

    if (!isTenantAdminRole(sessionUser.role)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Solo el administrador del negocio puede eliminar pedidos",
        },
        { status: 403 }
      );
    }

    const orderId = request.nextUrl.searchParams.get("id");
    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "ID de pedido obligatorio" },
        { status: 400 }
      );
    }

    await deleteOrderForTenant(activeTenant.id, orderId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error al eliminar el pedido",
      },
      { status: 500 }
    );
  }
}
