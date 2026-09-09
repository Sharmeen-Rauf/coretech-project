import { NextRequest, NextResponse } from "next/server";
import { resolveMobileCaller } from "@/lib/mobileAuth";
import { fetchSnLookupAction } from "@/app/actions/snLookup";

// Single-serial only, no bulk (§3.1 explicitly excludes SN Lookup) - plain
// grant/no-grant permission, no scope concept, no write path.
export async function GET(request: NextRequest) {
  const auth = await resolveMobileCaller(request, "sn_lookup");
  if (!auth.ok) return auth.response;

  const serial = request.nextUrl.searchParams.get("serial") || "";
  const result = await fetchSnLookupAction(serial, { accessToken: auth.caller.accessToken, surface: "mobile" });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
