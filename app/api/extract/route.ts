import { NextResponse, type NextRequest } from "next/server";
import {
  extractProductFromScreenshot,
  VisionExtractionError,
} from "@/lib/services/visionExtractor";
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

    if (!file) {
      return NextResponse.json(
        {
          ok: false,
          code: "MISSING_FILE",
          error: "No se recibió ninguna captura de pantalla para analizar.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "image/png";

    const uploadedAsset = await uploadTenantMedia({
      tenantId: activeTenant.id,
      folder: "products",
      buffer,
      mimeType,
      originalFilename: file.name,
    });

    const extracted = await extractProductFromScreenshot(buffer, mimeType);
    return NextResponse.json({
      ok: true,
      provider: "gemini-2.5-flash",
      tenantId: activeTenant.id,
      sourceImageUrl: uploadedAsset.url,
      data: extracted,
    });
  } catch (error) {
    if (error instanceof VisionExtractionError) {
      return NextResponse.json(
        {
          ok: false,
          code: error.code,
          error: error.message,
        },
        { status: 422 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_EXTRACTION_ERROR",
        error:
          error instanceof Error
            ? error.message
            : "Error al procesar la imagen.",
      },
      { status: 500 }
    );
  }
}
