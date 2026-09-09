import { NextRequest, NextResponse } from "next/server";
import { resolveMobileIdentity } from "@/lib/mobileAuth";
import { fetchMobileMyActivityAction } from "@/app/actions/mobileStats";

// Profile's "my activity this month" row - always the caller's own
// identity, regardless of granted scope level.
export async function GET(request: NextRequest) {
  const auth = await resolveMobileIdentity(request);
  if (!auth.ok) return auth.response;

  const result = await fetchMobileMyActivityAction({ accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
