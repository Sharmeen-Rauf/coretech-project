import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { markGatePassGeneratedAction } from "@/app/actions/orders";

// Mirrors components/OrderStatusModal.tsx's own gate exactly
// (canInvoiceOrGatepass = callerRole === "admin") - admin-only, hardcoded
// inside markGatePassGeneratedAction itself, independent of buzzcart's own
// mobile_can_write. Moves the order straight to "delivered" (matching web -
// there's no separate mobile "mark delivered" step).
export async function POST(request: NextRequest) {
  const auth = await resolveMobileCaller(request, "buzzcart");
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const orderId = body?.orderId;
  if (!orderId) {
    return NextResponse.json({ success: false, error: "orderId is required" }, { status: 400 });
  }

  const result = await markGatePassGeneratedAction(orderId, { accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
