import { NextResponse, type NextRequest } from "next/server";
import { uploadTenantMedia } from "@/lib/services/storage";
import { resolveActiveTenant } from "@/lib/tenantContext";

export async function POST(request: NextRequest) {
  try {
    const { activeTenant, sessionUser } = await resolveActiveTenant();
    if (!sessionUser || !activeTenant) {
      return NextResponse.json(
        { ok: false, error: "Debes iniciar sesión con un usuario de negocio" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = ((formData.get("folder") as string) || "receipts") as
      | "products"
      | "receipts"
      | "logos";

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "No se adjuntó ningún archivo." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadTenantMedia({
      tenantId: activeTenant.id,
      folder,
      buffer,
      mimeType: file.type || "image/png",
      originalFilename: file.name,
    });

    return NextResponse.json({
      ok: true,
      asset: uploaded,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Error al subir el comprobante.",
      },
      { status: 500 }
    );
  }
}
