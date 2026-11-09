import { NextResponse, type NextRequest } from "next/server";
import { updateTenantSettings } from "@/lib/repositories/multiTenantRepository";
import { resolveActiveTenant } from "@/lib/tenantContext";
import { TenantSettingsSchema } from "@/lib/validations/schemas";

export async function GET() {
  const { activeTenant, sessionUser } = await resolveActiveTenant();
  if (!sessionUser || !activeTenant) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    activeTenant,
  });
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

    const body = await request.json();
    const parsed = TenantSettingsSchema.safeParse({
      ...body,
      tenantId: activeTenant.id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Parámetros de configuración inválidos",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const updatedTenant = await updateTenantSettings(parsed.data);
    return NextResponse.json({
      ok: true,
      tenant: updatedTenant,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al actualizar la configuración del Tenant",
      },
      { status: 500 }
    );
  }
}
