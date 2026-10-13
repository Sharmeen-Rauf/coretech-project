import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/apiAuth";
import { getCallerIdentity } from "@/app/actions/users";
import { getMyPermissionKeysAction } from "@/app/actions/roles";
import { fetchLatestAnnouncementForCallerAction } from "@/app/actions/broadcast";
import { fetchMobileHomeStatsAction } from "@/app/actions/mobileStats";
import { fetchMyTargetAction } from "@/app/actions/targets";

const TARGET_PERMISSION_KEY = "resources";

// Consolidates the 4 separate backend calls CoreTech Digital's Home screen
// used to fire on every load/focus (/api/mobile/me, /api/mobile/home/stats,
// /api/mobile/announcements, /api/mobile/target) into one round trip. Each
// piece keeps its own existing gating logic exactly as the separate routes
// already enforce it - fetchMobileHomeStatsAction still checks each of its
// three modules' own mobile_granted internally, and target is still only
// fetched when the caller's own permission keys include it (mirroring the
// screen's own `keys.includes(TARGET_KEY)` check) - this just verifies the
// caller's token once instead of four times and runs the independent pieces
// in parallel instead of as four separate phone-to-server round trips.
export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ success: false, error: "Missing Authorization header" }, { status: 401 });
  }

  const identity = await getCallerIdentity(token);
  if (!identity || !identity.role) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const opts = { accessToken: token, surface: "mobile" as const };

  const [{ keys }, announcementRes, statsRes] = await Promise.all([
    getMyPermissionKeysAction(opts),
    fetchLatestAnnouncementForCallerAction(opts).catch(() => ({ success: false as const, announcement: null })),
    fetchMobileHomeStatsAction(opts).catch(() => ({ success: false as const, sellOut: null, st1: null, st2: null })),
  ]);

  let targets: any[] = [];
  if (keys.includes(TARGET_PERMISSION_KEY)) {
    const targetRes = await fetchMyTargetAction(opts);
    if (targetRes.success) targets = targetRes.targets;
  }

  return NextResponse.json({
    success: true,
    role: identity.role,
    keys,
    announcement: announcementRes.success ? announcementRes.announcement : null,
    stats: statsRes.success ? { sellOut: statsRes.sellOut, st1: statsRes.st1, st2: statsRes.st2 } : null,
    targets,
  });
}
