import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/apiAuth";
import { getCallerIdentity } from "@/app/actions/users";
import { getMyScopeAction } from "@/app/actions/roles";

export interface MobileCaller {
  accessToken: string;
  callerId: string;
  role: string;
  scope: "self" | "region" | "everything";
  callerRegion: string | null;
  canWrite: boolean;
}

// Every app/api/mobile/* route calls this first, passing the exact
// permission key (lib/permissionCatalog.ts) that route backs. Verifies the
// caller's Supabase access token, then checks that role's mobile_granted for
// this key (§9 of notes/MOBILE-ADMIN-APP-PLAN.md) - unlike web, mobile has no
// Sidebar/middleware layer of its own, so this is the only gate standing
// between a request and the server action it wraps. `scope`/`canWrite` come
// from mobile's own independent columns, never web's - the wrapped action
// must be called with { accessToken, surface: "mobile" } too, or it would
// silently fall back to resolving against web's grants instead.
export async function resolveMobileCaller(
  request: NextRequest,
  permissionKey: string
): Promise<{ ok: true; caller: MobileCaller } | { ok: false; response: NextResponse }> {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return { ok: false, response: NextResponse.json({ success: false, error: "Missing Authorization header" }, { status: 401 }) };
  }

  const identity = await getCallerIdentity(accessToken);
  if (!identity || !identity.role) {
    return { ok: false, response: NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 }) };
  }

  const { scope, callerRegion, canWrite, granted } = await getMyScopeAction(permissionKey, { accessToken, surface: "mobile" });
  if (!granted) {
    return { ok: false, response: NextResponse.json({ success: false, error: "You don't have access to this on the app" }, { status: 403 }) };
  }

  return {
    ok: true,
    caller: { accessToken, callerId: identity.id, role: identity.role, scope, callerRegion, canWrite },
  };
}
