import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { submitManualSelloutAction } from "@/app/actions/sales";
import { fetchSellOutAction } from "@/app/actions/products";

const PERMISSION_KEY = "sales.sellout";

// Own Sell Out history - thin wrap of the same action the web Sell Out page
// already uses, just resolved against mobile's independent grant/scope.
export async function GET(request: NextRequest) {
  const auth = await resolveMobileCaller(request, PERMISSION_KEY);
  if (!auth.ok) return auth.response;

  const result = await fetchSellOutAction({ accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

// Bulk-scan submission (§3.1 of notes/MOBILE-ADMIN-APP-PLAN.md): one call,
// one serial per Sell Out record (matching submitManualSelloutAction's real
// shape - one sales+sale_items row per unit), looped server-side so a
// dropped connection mid-scan can't leave the phone unsure what actually
// saved. Not atomic on purpose - a bad serial in a batch of 10 shouldn't
// force re-scanning the other 9 good ones.
export async function POST(request: NextRequest) {
  const auth = await resolveMobileCaller(request, PERMISSION_KEY);
  if (!auth.ok) return auth.response;
  if (!auth.caller.canWrite) {
    return NextResponse.json({ success: false, error: "You have read-only access to Sell Out" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { date, consumerName, consumerPhone, siteAddress, items } = body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ success: false, error: "No scanned serials to submit" }, { status: 400 });
  }

  const batchStamp = Date.now();
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const serialNo = String(items[i]?.serialNo || "").trim();
    if (!serialNo) {
      results.push({ serialNo: items[i]?.serialNo ?? "", success: false, error: "Missing serial number" });
      continue;
    }
    const res = await submitManualSelloutAction(
      { serialNo, date, consumerName, consumerPhone, siteAddress, stId: `MOBILE-SO-${batchStamp}-${i}` },
      { accessToken: auth.caller.accessToken, surface: "mobile" }
    );
    results.push({ serialNo, success: res.success, error: res.success ? undefined : res.error });
  }

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({ success: true, results, successCount, failCount: results.length - successCount });
}
