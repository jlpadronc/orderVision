import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getTenantByIdOrSlug,
  getUserById,
  listTenants,
  type TenantRecord,
  type UserRecord,
} from "@/lib/repositories/multiTenantRepository";

/**
 * Resuelve la sesión actual validándola contra SQLite (`prisma/dev.db`).
 * No asigna ningún tenant por defecto si el usuario no se ha autenticado con una cuenta de Tenant.
 */
export async function resolveActiveTenant(): Promise<{
  activeTenant: TenantRecord | null;
  allTenants: TenantRecord[];
  sessionUser: UserRecord | null;
}> {
  const allTenants = await listTenants(true);

  try {
    const cookieStore = await cookies();
    const rawUserCookie = cookieStore.get("ekita_session_user")?.value;
    if (!rawUserCookie) {
      return { activeTenant: null, allTenants, sessionUser: null };
    }

    const parsed = JSON.parse(decodeURIComponent(rawUserCookie)) as { id?: string };
    if (!parsed?.id) {
      return { activeTenant: null, allTenants, sessionUser: null };
    }

    const dbUser = await getUserById(parsed.id);
    if (!dbUser) {
      return { activeTenant: null, allTenants, sessionUser: null };
    }

    if (dbUser.role === "SUPERADMIN") {
      return { activeTenant: null, allTenants, sessionUser: dbUser };
    }

    if (!dbUser.tenantId) {
      return { activeTenant: null, allTenants, sessionUser: null };
    }

    const boundTenant = await getTenantByIdOrSlug(dbUser.tenantId);
    if (!boundTenant) {
      return { activeTenant: null, allTenants, sessionUser: null };
    }

    return {
      activeTenant: boundTenant,
      allTenants,
      sessionUser: dbUser,
    };
  } catch {
    return { activeTenant: null, allTenants, sessionUser: null };
  }
}

/**
 * Exige una sesión autenticada de un usuario perteneciente a un Tenant (`TENANT_ADMIN` o `TENANT_OPERATOR`).
 * Si no hay sesión redirige a `/login`. Si es `SUPERADMIN` redirige a `/admin`.
 */
export async function requireTenantSession(): Promise<{
  activeTenant: TenantRecord;
  sessionUser: UserRecord;
}> {
  const { activeTenant, sessionUser } = await resolveActiveTenant();

  if (!sessionUser) {
    redirect("/login");
  }

  if (sessionUser.role === "SUPERADMIN") {
    redirect("/admin");
  }

  if (!activeTenant) {
    redirect("/login");
  }

  return { activeTenant, sessionUser };
}

/**
 * Exige una sesión autenticada con rol `SUPERADMIN`.
 * Si no hay sesión redirige a `/login`. Si es un usuario de Tenant redirige a `/`.
 */
export async function requireSuperAdminSession(): Promise<{
  sessionUser: UserRecord;
}> {
  const { sessionUser } = await resolveActiveTenant();

  if (!sessionUser) {
    redirect("/login");
  }

  if (sessionUser.role !== "SUPERADMIN") {
    redirect("/");
  }

  return { sessionUser };
}
