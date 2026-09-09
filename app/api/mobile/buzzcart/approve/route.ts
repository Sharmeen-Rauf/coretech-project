import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { approveOrderAction } from "@/app/actions/orders";

// Locked pair (§8/§17 #18) - hardcoded to country_head/admin inside
// approveOrderAction itself, independent of buzzcart's own mobile_can_write.
// Still requires buzzcart to be mobile_granted at all (to have reached the
// Buzzcart screen in the first place); the role check is the real gate.
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

  const result = await approveOrderAction(orderId, { accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
