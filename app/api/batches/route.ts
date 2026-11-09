import { NextResponse, type NextRequest } from "next/server";
import {
  assignOrderToBatchForTenant,
  createBatchForTenant,
  listBatchesByTenant,
  updateBatchForTenant,
} from "@/lib/repositories/multiTenantRepository";
import { resolveActiveTenant } from "@/lib/tenantContext";
import {
  AssignOrderBatchSchema,
  CreateBatchSchema,
  UpdateBatchStatusSchema,
} from "@/lib/validations/schemas";

export async function GET() {
  const { activeTenant, sessionUser } = await resolveActiveTenant();
  if (!sessionUser || !activeTenant) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
      { status: 401 }
    );
  }

  const batches = await listBatchesByTenant(activeTenant.id);
  return NextResponse.json({
    ok: true,
    tenantId: activeTenant.id,
    batches,
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
    const parsed = CreateBatchSchema.safeParse({
      ...body,
      tenantId: activeTenant.id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Datos del lote inválidos",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const batch = await createBatchForTenant(parsed.data);
    return NextResponse.json({ ok: true, batch }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error al crear el lote de pedido",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { activeTenant, sessionUser } = await resolveActiveTenant();
    if (!sessionUser || !activeTenant) {
      return NextResponse.json(
        { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (body.orderId) {
      const parsedAssign = AssignOrderBatchSchema.safeParse({
        ...body,
        tenantId: activeTenant.id,
      });
      if (!parsedAssign.success) {
        return NextResponse.json(
          {
            ok: false,
            error:
              parsedAssign.error.issues[0]?.message ||
              "Datos de reasignación de lote inválidos",
          },
          { status: 400 }
        );
      }
      const order = await assignOrderToBatchForTenant(parsedAssign.data);
      return NextResponse.json({ ok: true, order });
    }

    const parsed = UpdateBatchStatusSchema.safeParse({
      ...body,
      tenantId: activeTenant.id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message ||
            "Datos de actualización de lote inválidos",
        },
        { status: 400 }
      );
    }

    const batch = await updateBatchForTenant(parsed.data);
    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error al actualizar el lote",
      },
      { status: 500 }
    );
  }
}
