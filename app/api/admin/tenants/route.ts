import { NextResponse, type NextRequest } from "next/server";
import {
  createTenantByAdmin,
  listTenants,
  listUsers,
  updateTenantAdminControls,
} from "@/lib/repositories/multiTenantRepository";
import { resolveActiveTenant } from "@/lib/tenantContext";
import {
  CreateTenantByAdminSchema,
  UpdateTenantAdminControlsSchema,
} from "@/lib/validations/schemas";

export async function GET() {
  const { sessionUser } = await resolveActiveTenant();
  if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
    return NextResponse.json(
      { ok: false, error: "Acceso restringido a SuperAdmin" },
      { status: 403 }
    );
  }

  const [tenants, users] = await Promise.all([listTenants(true), listUsers()]);
  return NextResponse.json({
    ok: true,
    tenants,
    users,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { sessionUser } = await resolveActiveTenant();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { ok: false, error: "Acceso restringido a SuperAdmin" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = CreateTenantByAdminSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message ||
            "Datos inválidos para registrar el negocio",
        },
        { status: 400 }
      );
    }

    const tenant = await createTenantByAdmin(parsed.data);
    const users = await listUsers();
    return NextResponse.json({ ok: true, tenant, users }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al registrar el nuevo negocio",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { sessionUser } = await resolveActiveTenant();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { ok: false, error: "Acceso restringido a SuperAdmin" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = UpdateTenantAdminControlsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message ||
            "Parámetros de control de Tenant inválidos",
        },
        { status: 400 }
      );
    }

    const tenant = await updateTenantAdminControls(parsed.data);
    return NextResponse.json({ ok: true, tenant });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al actualizar estado del negocio",
      },
      { status: 500 }
    );
  }
}
