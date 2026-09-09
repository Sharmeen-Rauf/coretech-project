import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/apiAuth";
import { getCallerIdentity } from "@/app/actions/users";
import { getMyPermissionKeysAction } from "@/app/actions/roles";

// Nav-shell bootstrap (Phase 5) - the one thing the Home icon grid and the
// fixed bottom tab bar (§12.1) both need before they can decide what to
// show: every mobile-granted permission key the caller's role holds. Web
// has no equivalent single call (Sidebar/middleware read the catalog
// directly, server-side, on every request) - this is a thin new endpoint
// over the same getMyPermissionKeysAction every other mobile route already
// re-checks against, just asking for the whole set instead of one key.
export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ success: false, error: "Missing Authorization header" }, { status: 401 });
  }

  const identity = await getCallerIdentity(token);
  if (!identity || !identity.role) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { keys } = await getMyPermissionKeysAction({ accessToken: token, surface: "mobile" });
  return NextResponse.json({ success: true, role: identity.role, keys });
}
