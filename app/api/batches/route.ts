import { NextResponse, type NextRequest } from "next/server";
import {
  assignOrderToBatchForTenant,
  createBatchForTenant,
  deleteBatchForTenant,
  listBatchesByTenant,
  updateBatchForTenant,
} from "@/lib/repositories/multiTenantRepository";
import { resolveActiveTenant } from "@/lib/tenantContext";
import {
  AssignOrderBatchSchema,
  CreateBatchSchema,
  UpdateBatchStatusSchema,
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
    const message =
      error instanceof Error ? error.message : "Error al crear el lote de pedido";
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
    const message =
      error instanceof Error ? error.message : "Error al actualizar el lote";
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
          error: "Solo el administrador del negocio puede eliminar lotes",
        },
        { status: 403 }
      );
    }

    const batchId = request.nextUrl.searchParams.get("id");
    if (!batchId) {
      return NextResponse.json(
        { ok: false, error: "ID de lote obligatorio" },
        { status: 400 }
      );
    }

    await deleteBatchForTenant(activeTenant.id, batchId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error al eliminar el lote",
      },
      { status: 500 }
    );
  }
}
