import { NextResponse, type NextRequest } from "next/server";
import {
  createCustomerForTenant,
  listCustomersByTenant,
} from "@/lib/repositories/multiTenantRepository";
import { resolveActiveTenant } from "@/lib/tenantContext";
import { CreateCustomerSchema } from "@/lib/validations/schemas";

export async function GET(request: NextRequest) {
  const { activeTenant, sessionUser } = await resolveActiveTenant();
  if (!sessionUser || !activeTenant) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
      { status: 401 }
    );
  }

  const query = request.nextUrl.searchParams.get("q") || "";
  const customers = await listCustomersByTenant(activeTenant.id, query);

  return NextResponse.json({
    ok: true,
    tenantId: activeTenant.id,
    customers,
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
    const parsed = CreateCustomerSchema.safeParse({
      ...body,
      tenantId: activeTenant.id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Datos de cliente inválidos",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const customer = await createCustomerForTenant(parsed.data);
    return NextResponse.json({ ok: true, customer }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error al registrar cliente",
      },
      { status: 500 }
    );
  }
}
