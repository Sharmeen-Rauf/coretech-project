import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { fetchSalesLedgerAction, enrichSalesRowsForMobile } from "@/app/actions/sales";

// ST-1 is view-only on mobile everywhere it appears (§2's confirmed
// decision, mobileWriteEligible: false on this key in permissionCatalog.ts)
// - recipient-scoped inbound tracker (§4.2), no POST route exists here.
export async function GET(request: NextRequest) {
  const auth = await resolveMobileCaller(request, "sales.st1");
  if (!auth.ok) return auth.response;

  const result = await fetchSalesLedgerAction("ST1", { accessToken: auth.caller.accessToken, surface: "mobile" });
  if (result.success) result.data = await enrichSalesRowsForMobile(result.data);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
