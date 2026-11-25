import { NextResponse, type NextRequest } from "next/server";
import {
  createCustomerForTenant,
  deleteCustomerForTenant,
  listCustomersByTenant,
  updateCustomerForTenant,
} from "@/lib/repositories/multiTenantRepository";
import { resolveActiveTenant } from "@/lib/tenantContext";
import {
  CreateCustomerSchema,
  UpdateCustomerSchema,
} from "@/lib/validations/schemas";

function isTenantAdminRole(role?: string | null): boolean {
  return role === "TENANT_ADMIN" || role === "SUPERADMIN";
}

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
    const message =
      error instanceof Error ? error.message : "Error al registrar cliente";
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
          error: "Solo el administrador del negocio puede editar clientes",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = UpdateCustomerSchema.safeParse({
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

    const customer = await updateCustomerForTenant(parsed.data);
    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al actualizar cliente";
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
          error: "Solo el administrador del negocio puede eliminar clientes",
        },
        { status: 403 }
      );
    }

    const customerId = request.nextUrl.searchParams.get("id");
    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "ID de cliente obligatorio" },
        { status: 400 }
      );
    }

    await deleteCustomerForTenant(activeTenant.id, customerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error al eliminar cliente",
      },
      { status: 500 }
    );
  }
}
