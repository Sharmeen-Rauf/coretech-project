import { NextRequest, NextResponse } from "next/server";
import { submitInstallationAction } from "@/app/actions/products";
import { getBearerToken } from "@/lib/apiAuth";

// Authenticated - requires the caller's Supabase access token in the
// Authorization header. submitInstallationAction itself resolves and
// enforces the caller's identity from this token (installer role required,
// payload.installer_id is overridden with the verified caller id, and a
// resubmission is checked against the job's real owner) - this route is a
// thin transport wrapper, not a second place that logic needs to live.
export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ success: false, error: "Missing Authorization header" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { payload, siteFormJobId } = body || {};
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ success: false, error: "payload is required" }, { status: 400 });
  }

  const result = await submitInstallationAction(payload, siteFormJobId, token);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
