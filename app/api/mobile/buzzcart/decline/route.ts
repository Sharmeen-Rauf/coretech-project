import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { declineOrderAction } from "@/app/actions/orders";

// Locked pair, same reasoning as approve/route.ts.
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

  const result = await declineOrderAction(orderId, { accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
