import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { fetchSalesLedgerAction, submitSt2Action } from "@/app/actions/sales";

const PERMISSION_KEY = "sales.st2";

// Sub-Dealer's ST2 view: recipient-scoped inbound tracker (§4.2) - "self"
// scope already matches on source_id OR destination_id, so a sub-dealer only
// ever sees consignments sent to them, from whichever distributor sent each.
export async function GET(request: NextRequest) {
  const auth = await resolveMobileCaller(request, PERMISSION_KEY);
  if (!auth.ok) return auth.response;

  const result = await fetchSalesLedgerAction("ST2", { accessToken: auth.caller.accessToken, surface: "mobile" });
  // fetchSalesLedgerAction doesn't return canWrite (web's ST2 page doesn't
  // need it - reaching the page at all already implies write access there).
  // Mobile has no such implication, so the route's own already-resolved
  // mobile canWrite is merged in here for the create button to key off.
  return NextResponse.json({ ...result, canWrite: auth.caller.canWrite }, { status: result.success ? 200 : 400 });
}

// Bulk scanning for ST2 doesn't need a server-side per-item loop the way
// Sell Out does - submitSt2Action already accepts the whole scanned batch as
// one `passedItems` array and records it as a single atomic transfer
// (matching web's existing behavior exactly), so this is a thin pass-through,
// not a new loop. distributorId is never trusted from the client - forced to
// the caller's own id, with submitSt2Action's own identity check as a second
// backstop for the non-distributor-caller case.
export async function POST(request: NextRequest) {
  const auth = await resolveMobileCaller(request, PERMISSION_KEY);
  if (!auth.ok) return auth.response;
  if (!auth.caller.canWrite) {
    return NextResponse.json({ success: false, error: "You have read-only access to ST-2" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { subDealerId, date, items } = body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ success: false, error: "No scanned serials to submit" }, { status: 400 });
  }

  const distributorId = auth.caller.role === "distributor" ? auth.caller.callerId : body?.distributorId;
  const passedItems = items.map((i: any) => ({ serial_no: String(i.serialNo || ""), product_id: i.productId }));

  const result = await submitSt2Action(
    { distributorId, subDealerId, passedItems, date, stId: `MOBILE-ST2-${Date.now()}` },
    { accessToken: auth.caller.accessToken, surface: "mobile" }
  );
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
