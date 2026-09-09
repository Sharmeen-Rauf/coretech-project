import { NextRequest, NextResponse } from "next/server";
import { resolveMobileIdentity } from "@/lib/mobileAuth";
import { fetchLatestAnnouncementForCallerAction } from "@/app/actions/broadcast";

// Home-screen announcements card (§18) - the single latest announcement
// targeted at the caller's role or "all". No permission-catalog gate: every
// logged-in mobile user sees this automatically, same as web's popup.
export async function GET(request: NextRequest) {
  const auth = await resolveMobileIdentity(request);
  if (!auth.ok) return auth.response;

  const result = await fetchLatestAnnouncementForCallerAction({ accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
