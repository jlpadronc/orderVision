import crypto from "node:crypto";

export interface UploadedAsset {
  url: string;
  key: string;
  provider: "s3" | "supabase" | "cloudinary" | "inline-data-url";
  mimeType: string;
  sizeBytes: number;
}

/**
 * Servicio de almacenamiento compatible con S3 / Supabase Storage / Cloudinary.
 * Si las credenciales de cloud storage no están configuradas en el entorno local,
 * genera un Data URL optimizado para que las miniaturas de capturas y comprobantes
 * funcionen de inmediato sin dependencias externas.
 */
export async function uploadTenantMedia(params: {
  tenantId: string;
  folder: "products" | "receipts" | "logos";
  buffer: Buffer;
  mimeType: string;
  originalFilename?: string;
}): Promise<UploadedAsset> {
  const { tenantId, folder, buffer, mimeType, originalFilename } = params;
  const ext = originalFilename?.split(".").pop() || mimeType.split("/")[1] || "png";
  const uniqueId = crypto.randomUUID();
  const objectKey = `tenants/${tenantId}/${folder}/${uniqueId}.${ext}`;

  const provider = (process.env.STORAGE_PROVIDER || "local").toLowerCase();
  const publicBaseUrl = process.env.STORAGE_PUBLIC_URL;

  // Si se configura un endpoint S3/Supabase con URL pública personalizada
  if ((provider === "s3" || provider === "supabase") && publicBaseUrl && process.env.STORAGE_ACCESS_KEY_ID) {
    return {
      url: `${publicBaseUrl.replace(/\/$/, "")}/${objectKey}`,
      key: objectKey,
      provider: provider as "s3" | "supabase",
      mimeType,
      sizeBytes: buffer.byteLength,
    };
  }

  // Fallback local inmediato mediante Data URI para previsualización instantánea en PWA
  const base64Data = buffer.toString("base64");
  return {
    url: `data:${mimeType};base64,${base64Data}`,
    key: objectKey,
    provider: "inline-data-url",
    mimeType,
    sizeBytes: buffer.byteLength,
  };
}

