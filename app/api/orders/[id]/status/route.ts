import { NextResponse, type NextRequest } from "next/server";
import { resolveActiveTenant } from "@/lib/tenantContext";
import { addOrderStatusEventForTenant } from "@/lib/repositories/multiTenantRepository";
import { AddOrderStatusEventSchema } from "@/lib/validations/schemas";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { activeTenant, sessionUser } = await resolveActiveTenant();
    if (!sessionUser || !activeTenant) {
      return NextResponse.json(
        { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
        { status: 401 }
      );
    }

    const { id: orderId } = await context.params;
    const body = await request.json();

    const parsed = AddOrderStatusEventSchema.safeParse({
      ...body,
      tenantId: activeTenant.id,
      orderId,
      authorName: sessionUser.name,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Datos del evento inválidos",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const updatedOrder = await addOrderStatusEventForTenant(parsed.data);
    return NextResponse.json({ ok: true, order: updatedOrder });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al actualizar el estado del pedido",
      },
      { status: 500 }
    );
  }
}
