import { NextRequest, NextResponse } from "next/server";
import { resolveMobileIdentity } from "@/lib/mobileAuth";
import { fetchMobileHomeStatsAction } from "@/app/actions/mobileStats";

// Home's stat tiles (Sell Out trend + this week's ST1/ST2/Sell Out
// activity) - spans three independently-gated modules, so this uses
// resolveMobileIdentity like announcements/notifications and lets the
// action check each module's own mobile_granted internally instead of one
// permission key for the whole route.
export async function GET(request: NextRequest) {
  const auth = await resolveMobileIdentity(request);
  if (!auth.ok) return auth.response;

  const result = await fetchMobileHomeStatsAction({ accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
