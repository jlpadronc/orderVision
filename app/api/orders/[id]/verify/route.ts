import { NextResponse, type NextRequest } from "next/server";
import {
  getOrderByTenantAndId,
  settleFinalPaymentForTenant,
  verifyOrderItemForTenant,
} from "@/lib/repositories/multiTenantRepository";
import { resolveActiveTenant } from "@/lib/tenantContext";
import {
  SettleFinalPaymentSchema,
  VerifyOrderItemSchema,
} from "@/lib/validations/schemas";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { activeTenant, sessionUser } = await resolveActiveTenant();
  if (!sessionUser || !activeTenant) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
      { status: 401 }
    );
  }

  const order = await getOrderByTenantAndId(activeTenant.id, id);
  if (!order) {
    return NextResponse.json(
      { ok: false, error: "Pedido no encontrado para este Tenant." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, order });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { activeTenant, sessionUser } = await resolveActiveTenant();
    if (!sessionUser || !activeTenant) {
      return NextResponse.json(
        { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = VerifyOrderItemSchema.safeParse({
      ...body,
      tenantId: activeTenant.id,
      orderId: id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Datos de verificación inválidos",
        },
        { status: 400 }
      );
    }

    const updatedOrder = await verifyOrderItemForTenant(parsed.data);
    return NextResponse.json({ ok: true, order: updatedOrder });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al actualizar verificación física",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { activeTenant, sessionUser } = await resolveActiveTenant();
    if (!sessionUser || !activeTenant) {
      return NextResponse.json(
        { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = SettleFinalPaymentSchema.safeParse({
      ...body,
      tenantId: activeTenant.id,
      orderId: id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message ||
            "Datos de liquidación del 50% restante inválidos",
        },
        { status: 400 }
      );
    }

    const settledOrder = await settleFinalPaymentForTenant(parsed.data);
    return NextResponse.json({ ok: true, order: settledOrder });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al liquidar el pago final",
      },
      { status: 500 }
    );
  }
}
