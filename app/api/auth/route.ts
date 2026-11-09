import { NextResponse, type NextRequest } from "next/server";
import { authenticateUser } from "@/lib/repositories/multiTenantRepository";
import { LoginSchema } from "@/lib/validations/schemas";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Datos de acceso inválidos",
        },
        { status: 400 }
      );
    }

    const { user, tenant } = await authenticateUser(
      parsed.data.email,
      parsed.data.password
    );

    const response = NextResponse.json({
      ok: true,
      user,
      tenant,
    });

    response.cookies.set(
      "ekita_session_user",
      encodeURIComponent(JSON.stringify(user)),
      {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 14,
      }
    );

    if (tenant) {
      response.cookies.set("ekita_tenant_id", tenant.id, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 14,
      });
    } else {
      response.cookies.delete("ekita_tenant_id");
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "No se pudo iniciar sesión",
      },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("ekita_session_user");
  response.cookies.delete("ekita_tenant_id");
  return response;
}
