import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { markInvoiceGeneratedAction } from "@/app/actions/orders";

// Mirrors components/OrderStatusModal.tsx's own gate exactly
// (canInvoiceOrGatepass = callerRole === "admin") - admin-only, hardcoded
// inside markInvoiceGeneratedAction itself, independent of buzzcart's own
// mobile_can_write. Still requires buzzcart to be mobile_granted at all to
// have reached the Buzzcart screen in the first place.
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

  const result = await markInvoiceGeneratedAction(orderId, { accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
