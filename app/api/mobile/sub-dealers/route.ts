import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { fetchAssignedSubDealersAction } from "@/app/actions/sales";

// Distributor's own Sub Dealer List (§2.2) - a read-only filter of the same
// data admin's Dealer Assignment feature manages (users.dealer_assignment).
// distributorId is never taken from the request - always the verified
// caller's own id, so a distributor can only ever see their own list.
export async function GET(request: NextRequest) {
  const auth = await resolveMobileCaller(request, "users.dealer_assignment");
  if (!auth.ok) return auth.response;

  const result = await fetchAssignedSubDealersAction(auth.caller.callerId);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
