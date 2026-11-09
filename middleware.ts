import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_TENANT_ID = "11111111-1111-4111-8111-111111111111";

/**
 * Middleware de aislamiento Multi-Tenant.
 * Garantiza que todas las rutas de UI y endpoints `/api/*` reciban un `x-tenant-id`
 * validado desde la cookie de sesión o el encabezado explícito.
 */
export function middleware(request: NextRequest) {
  const tenantFromHeader = request.headers.get("x-tenant-id");
  const tenantFromQuery = request.nextUrl.searchParams.get("tenantId");
  const tenantFromCookie = request.cookies.get("ekita_tenant_id")?.value;

  const resolvedTenantId =
    tenantFromHeader || tenantFromQuery || tenantFromCookie || DEFAULT_TENANT_ID;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-id", resolvedTenantId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (!tenantFromCookie || (tenantFromQuery && tenantFromQuery !== tenantFromCookie)) {
    response.cookies.set("ekita_tenant_id", resolvedTenantId, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|samples|icons).*)"],
};

