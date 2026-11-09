import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { z } from "zod";

export const productExtractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Nombre o descripción completa del producto mostrado en la captura",
    },
    originalPrice: {
      type: Type.NUMBER,
      nullable: true,
      description: "Precio tachado o rayado previo al descuento (null si no existe)",
    },
    finalPrice: {
      type: Type.NUMBER,
      description: "Precio real de la página que se debe cobrar al cliente",
    },
    detectedSize: {
      type: Type.STRING,
      nullable: true,
      description: "Talla visible o seleccionada (ej. S, M, L, XL, 38) o null",
    },
    detectedColor: {
      type: Type.STRING,
      nullable: true,
      description: "Color visible o seleccionado en la pantalla o null",
    },
    detectedModel: {
      type: Type.STRING,
      nullable: true,
      description: "Código SKU, modelo o variante si es legible en la captura",
    },
  },
  required: ["title", "finalPrice"],
};

export const ExtractedProductZodSchema = z.object({
  title: z.string().min(1, "El título del producto es requerido"),
  originalPrice: z.number().nullable().optional().default(null),
  finalPrice: z.number().nonnegative("El precio final debe ser mayor o igual a 0"),
  detectedSize: z.string().nullable().optional().default(null),
  detectedColor: z.string().nullable().optional().default(null),
  detectedModel: z.string().nullable().optional().default(null),
});

export type ExtractedProductData = z.infer<typeof ExtractedProductZodSchema>;

export class VisionExtractionError extends Error {
  public readonly code: "UNREADABLE_IMAGE" | "INVALID_MIME" | "API_KEY_MISSING" | "GEMINI_ERROR";
  public readonly statusCode: number;

  constructor(
    message: string,
    code: "UNREADABLE_IMAGE" | "INVALID_MIME" | "API_KEY_MISSING" | "GEMINI_ERROR",
    statusCode = 422
  ) {
    super(message);
    this.name = "VisionExtractionError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Limpia cualquier cadena numérica o monto monetario (ej: "$19,50 USD", "US$ 24.99")
 * convirtiendo comas en puntos decimales y eliminando símbolos de moneda.
 */
export function sanitizeMonetaryValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? Number(raw.toFixed(2)) : null;
  }
  if (typeof raw === "string") {
    const cleaned = raw
      .replace(/[^\d.,-]/g, "")
      .replace(/,(?=\d{1,2}$)/, ".")
      .replace(/,/g, "");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
  }
  return null;
}

/**
 * Analiza una captura de pantalla de un producto de e-commerce (ej. Shein, Temu, Amazon, Zara)
 * mediante Gemini 2.5 Flash con Structured Outputs.
 */
export async function extractProductFromScreenshot(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractedProductData> {
  if (!imageBuffer || imageBuffer.byteLength < 64) {
    throw new VisionExtractionError(
      "El archivo de imagen está vacío o corrupto. Sube una captura legible.",
      "UNREADABLE_IMAGE",
      400
    );
  }

  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
    throw new VisionExtractionError(
      `Formato de imagen no soportado (${mimeType}). Usa PNG, JPG, WEBP o HEIC.`,
      "INVALID_MIME",
      415
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "AIzaSyYourGeminiApiKeyHere") {
    throw new VisionExtractionError(
      "La variable de entorno GEMINI_API_KEY no está configurada.",
      "API_KEY_MISSING",
      503
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: imageBuffer.toString("base64"), mimeType } },
            {
              text: `Analiza esta captura de pantalla de un producto de e-commerce (como Shein). 
Extrae el título del producto, detecta el precio rayado/tachado (originalPrice) y el precio final de la página (finalPrice).
Si están marcadas la talla, color o modelo, extráelos con precisión.
Limpia cualquier símbolo de moneda ($, USD, EUR, etc.) y convierte comas por puntos decimales.
Si la imagen es completamente ilegible, borrosa o no corresponde a un producto de tienda, devuelve title como "UNREADABLE" y finalPrice como 0.
Responde únicamente en formato JSON estructurado.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: productExtractionSchema,
        temperature: 0.1,
      },
    });

    const rawText = response.text;
    if (!rawText) {
      throw new VisionExtractionError(
        "El motor de visión no pudo extraer texto de la imagen. Verifica que la captura no esté borrosa.",
        "UNREADABLE_IMAGE",
        422
      );
    }

    const parsedJson = JSON.parse(rawText);

    const sanitizedPayload = {
      title: typeof parsedJson.title === "string" ? parsedJson.title.trim() : "",
      originalPrice: sanitizeMonetaryValue(parsedJson.originalPrice),
      finalPrice: sanitizeMonetaryValue(parsedJson.finalPrice) ?? 0,
      detectedSize:
        typeof parsedJson.detectedSize === "string" && parsedJson.detectedSize.trim() !== ""
          ? parsedJson.detectedSize.trim()
          : null,
      detectedColor:
        typeof parsedJson.detectedColor === "string" && parsedJson.detectedColor.trim() !== ""
          ? parsedJson.detectedColor.trim()
          : null,
      detectedModel:
        typeof parsedJson.detectedModel === "string" && parsedJson.detectedModel.trim() !== ""
          ? parsedJson.detectedModel.trim()
          : null,
    };

    if (
      !sanitizedPayload.title ||
      sanitizedPayload.title.toUpperCase() === "UNREADABLE" ||
      sanitizedPayload.finalPrice <= 0
    ) {
      throw new VisionExtractionError(
        "La captura es borrosa, ilegible o no muestra un precio de producto válido. Puedes editar los campos manualmente.",
        "UNREADABLE_IMAGE",
        422
      );
    }

    // Asegurar que si originalPrice es igual o menor que finalPrice, originalPrice sea null
    if (
      sanitizedPayload.originalPrice !== null &&
      sanitizedPayload.originalPrice <= sanitizedPayload.finalPrice
    ) {
      sanitizedPayload.originalPrice = null;
    }

    return ExtractedProductZodSchema.parse(sanitizedPayload);
  } catch (error) {
    if (error instanceof VisionExtractionError) {
      throw error;
    }
    throw new VisionExtractionError(
      error instanceof Error
        ? `Error al analizar la captura con Gemini Vision: ${error.message}`
        : "Error inesperado procesando la captura con IA.",
      "GEMINI_ERROR",
      500
    );
  }
}

