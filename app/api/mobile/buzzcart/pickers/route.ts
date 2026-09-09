import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { fetchBuzzcartPickersAction } from "@/app/actions/orders";
import { fetchProductsAction } from "@/app/actions/products";

// Standalone create-order screen (app/screens/buzzcart-create.tsx) needs
// just the product catalog and the distributor/sub-dealer picker options -
// the same data the main GET /api/mobile/buzzcart bundled alongside the
// order list, but that screen has no reason to also pull the whole order
// list just to open a form. canWrite-gated since only someone who can
// actually create an order needs this at all.
export async function GET(request: NextRequest) {
  const auth = await resolveMobileCaller(request, "buzzcart");
  if (!auth.ok) return auth.response;
  if (!auth.caller.canWrite) {
    return NextResponse.json({ success: false, error: "You have read-only access to Buzzcart" }, { status: 403 });
  }

  const [productsResult, pickersResult] = await Promise.all([fetchProductsAction(), fetchBuzzcartPickersAction()]);

  return NextResponse.json({
    success: true,
    products: productsResult.data,
    distributors: pickersResult.distributors,
    subDealers: pickersResult.subDealers,
  });
}
