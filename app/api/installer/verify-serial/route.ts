import { NextRequest, NextResponse } from "next/server";
import { verifySerialNumberAction } from "@/app/actions/products";
import { getCallerIdentity } from "@/app/actions/users";
import { getBearerToken } from "@/lib/apiAuth";

// Authenticated - requires the caller's Supabase access token in the
// Authorization header (the mobile app has no cookie session to identify it
// with otherwise). Read-only inventory lookup, so the only real requirement
// is that the caller is a logged-in installer, not a specific job/ownership
// check - there's no sensitive per-installer data in this response.
export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ success: false, error: "Missing Authorization header" }, { status: 401 });
  }

  const caller = await getCallerIdentity(token);
  if (!caller || caller.role !== "installer") {
    return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { serialNumber, jobId } = body || {};
  if (!serialNumber || typeof serialNumber !== "string") {
    return NextResponse.json({ success: false, error: "serialNumber is required" }, { status: 400 });
  }

  const result = await verifySerialNumberAction(serialNumber, jobId);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
