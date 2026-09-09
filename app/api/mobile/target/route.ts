import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { fetchMyTargetAction } from "@/app/actions/targets";

// Target (Read Only) everywhere on mobile (§12.1) - no write route exists.
// fetchMyTargetAction is inherently self-scoped (assignee_id = caller.id
// inside the query itself), so there's no scope/canWrite to thread beyond
// the permission gate below and the caller's own verified identity.
export async function GET(request: NextRequest) {
  const auth = await resolveMobileCaller(request, "resources");
  if (!auth.ok) return auth.response;

  const result = await fetchMyTargetAction({ accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
