import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { fetchOrdersAction, createBuzzcartOrderAction, fetchBuzzcartPickersAction } from "@/app/actions/orders";
import { fetchProductsAction } from "@/app/actions/products";

const PERMISSION_KEY = "buzzcart";

// Also returns the product catalog and the distributor/sub-dealer picker
// options the create form needs (fetchBuzzcartPickersAction) - both
// intrinsic to completing an order, not separately permission-gated, so
// they ride along with the same buzzcart-gated request instead of needing
// their own routes.
export async function GET(request: NextRequest) {
  const auth = await resolveMobileCaller(request, PERMISSION_KEY);
  if (!auth.ok) return auth.response;

  const [ordersResult, productsResult, pickersResult] = await Promise.all([
    fetchOrdersAction({ accessToken: auth.caller.accessToken, surface: "mobile" }),
    fetchProductsAction(),
    fetchBuzzcartPickersAction(),
  ]);
  if (!ordersResult.success) return NextResponse.json(ordersResult, { status: 400 });

  return NextResponse.json({
    ...ordersResult,
    products: productsResult.data,
    distributors: pickersResult.distributors,
    subDealers: pickersResult.subDealers,
    // Approve/decline is a locked pair on web (hardcoded to country_head/
    // admin, independent of buzzcart's own can_write - §8), not something
    // Role Management's mobile column can grant. Mirrored here rather than
    // exposed as a mobile permission.
    canApprove: ["country_head", "admin"].includes(auth.caller.role),
    // Generate Invoice / Generate Gate Pass - mirrors
    // components/OrderStatusModal.tsx's own canInvoiceOrGatepass gate
    // (admin only), same locked-pair posture as canApprove above.
    canManageInvoice: auth.caller.role === "admin",
  });
}

// Buzzcart items are product+quantity, not individual serials (orders.items
// has no serial field at all) - bulk scanning here (§3.1) means the phone
// resolves each scanned serial to a product and tallies quantities client-
// side, then submits once through this same existing multi-item action, not
// a server-side per-serial loop the way Sell Out needs.
export async function POST(request: NextRequest) {
  const auth = await resolveMobileCaller(request, PERMISSION_KEY);
  if (!auth.ok) return auth.response;
  if (!auth.caller.canWrite) {
    return NextResponse.json({ success: false, error: "You have read-only access to Buzzcart" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { buyerType, selectedDistributorId, selectedSubDealerId, items } = body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ success: false, error: "Please add at least one product with quantity > 0" }, { status: 400 });
  }

  // selectedEmployeeId is admin-only on web (createBuzzcartOrderAction only
  // honors it when caller.role === "admin") - never accepted from mobile,
  // which no admin role uses today.
  const result = await createBuzzcartOrderAction(
    { buyerType, selectedDistributorId, selectedSubDealerId, items },
    { accessToken: auth.caller.accessToken, surface: "mobile" }
  );
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
