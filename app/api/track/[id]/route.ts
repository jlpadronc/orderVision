import { NextResponse, type NextRequest } from "next/server";
import { getPublicOrderTrackRecord } from "@/lib/repositories/multiTenantRepository";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "ID de pedido no especificado" },
        { status: 400 }
      );
    }

    const order = await getPublicOrderTrackRecord(orderId);
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Pedido no encontrado o enlace caducado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al consultar el seguimiento del pedido",
      },
      { status: 500 }
    );
  }
}
