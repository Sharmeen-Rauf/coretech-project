import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { fetchStockAction } from "@/app/actions/products";

export async function GET(request: NextRequest) {
  const auth = await resolveMobileCaller(request, "purchase.inventory");
  if (!auth.ok) return auth.response;

  const result = await fetchStockAction({ accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
