import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { fetchProductsAction } from "@/app/actions/products";
import { getBuzzcartRecipients } from "@/lib/buzzcartScope";

// Standalone create-order screen (app/screens/buzzcart-create.tsx) needs
// just the product catalog and the distributor/sub-dealer picker options -
// the same data the main GET /api/mobile/buzzcart bundled alongside the
// order list, but that screen has no reason to also pull the whole order
// list just to open a form. canWrite-gated since only someone who can
// actually create an order needs this at all. The pickers follow the
// caller's mobile buzzcart scope (lib/buzzcartScope.ts): everything -> all,
// region -> own region only, self -> none.
export async function GET(request: NextRequest) {
  const auth = await resolveMobileCaller(request, "buzzcart");
  if (!auth.ok) return auth.response;
  if (!auth.caller.canWrite) {
    return NextResponse.json({ success: false, error: "You have read-only access to Buzzcart" }, { status: 403 });
  }

  let recipients;
  try {
    recipients = await getBuzzcartRecipients({ accessToken: auth.caller.accessToken, surface: "mobile" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch order recipients" }, { status: 500 });
  }
  const productsResult = await fetchProductsAction();

  return NextResponse.json({
    success: true,
    products: productsResult.data,
    distributors: recipients.distributors,
    subDealers: recipients.subDealers,
  });
}
