import { NextRequest, NextResponse } from "next/server";
import { resolveMobileIdentity } from "@/lib/mobileAuth";
import { fetchMyNotificationsAction, markNotificationsReadAction } from "@/app/actions/broadcast";

// Notifications bell (§18) - last 20 matching the caller's role or "all",
// each with its own per-user read flag. No permission-catalog gate, same
// reasoning as the announcements route. Read-only, no side effects - safe
// to call from Home for the unread badge without marking anything read.
// The Notifications screen itself is what marks things read (POST below),
// on open, matching §18's "opening the screen marks everything in it read."
export async function GET(request: NextRequest) {
  const auth = await resolveMobileIdentity(request);
  if (!auth.ok) return auth.response;

  const result = await fetchMyNotificationsAction({ accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

export async function POST(request: NextRequest) {
  const auth = await resolveMobileIdentity(request);
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const ids = Array.isArray(body?.ids) ? body.ids : [];
  const result = await markNotificationsReadAction(ids, { accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
