import { NextResponse, type NextRequest } from "next/server";
import {
  createUserRecord,
  deleteUserRecord,
  listUsers,
} from "@/lib/repositories/multiTenantRepository";
import { resolveActiveTenant } from "@/lib/tenantContext";
import { CreateUserSchema } from "@/lib/validations/schemas";

export async function GET(request: NextRequest) {
  const { activeTenant, sessionUser } = await resolveActiveTenant();
  if (!sessionUser) {
    return NextResponse.json(
      { ok: false, error: "No autenticado" },
      { status: 401 }
    );
  }

  const tenantIdParam = request.nextUrl.searchParams.get("tenantId");
  const filterTenantId =
    sessionUser.role === "SUPERADMIN"
      ? tenantIdParam || null
      : activeTenant?.id ?? sessionUser.tenantId;

  const users = await listUsers(filterTenantId);
  return NextResponse.json({ ok: true, users });
}

export async function POST(request: NextRequest) {
  try {
    const { activeTenant, sessionUser } = await resolveActiveTenant();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const resolvedTenantId =
      sessionUser.role === "SUPERADMIN"
        ? body.tenantId
        : activeTenant?.id ?? sessionUser.tenantId;

    const parsed = CreateUserSchema.safeParse({
      ...body,
      tenantId: resolvedTenantId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message || "Datos de usuario inválidos",
        },
        { status: 400 }
      );
    }

    const user = await createUserRecord(parsed.data);
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear el usuario (verifica si el correo ya existe)",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { sessionUser } = await resolveActiveTenant();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const userId = request.nextUrl.searchParams.get("id");
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "ID de usuario requerido" },
        { status: 400 }
      );
    }
    await deleteUserRecord(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "No se pudo eliminar el usuario",
      },
      { status: 500 }
    );
  }
}
