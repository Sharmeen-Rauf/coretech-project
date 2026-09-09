import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { fetchUsersAction } from "@/app/actions/users";

// Employee's Distributor View / Sub-Dealer View (§2.3) - both hard view-only
// on mobile (mobileWriteEligible: false on both keys). ?type= picks which
// directory and which permission key gates it; anything else is rejected
// before touching the database.
const KEY_BY_TYPE: Record<string, string> = {
  distributor: "users.add_distributor",
  sub_dealer: "users.add_sub_dealer",
};

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "";
  const permissionKey = KEY_BY_TYPE[type];
  if (!permissionKey) {
    return NextResponse.json({ success: false, error: "type must be 'distributor' or 'sub_dealer'" }, { status: 400 });
  }

  const auth = await resolveMobileCaller(request, permissionKey);
  if (!auth.ok) return auth.response;

  const result = await fetchUsersAction(type, { accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
