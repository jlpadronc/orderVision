import { NextResponse, type NextRequest } from "next/server";
import {
  createOrderForTenant,
  listOrdersByTenant,
} from "@/lib/repositories/multiTenantRepository";
import { resolveActiveTenant } from "@/lib/tenantContext";
import { CreateOrderSchema } from "@/lib/validations/schemas";

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
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error al crear el pedido",
      },
      { status: 500 }
    );
  }
}
