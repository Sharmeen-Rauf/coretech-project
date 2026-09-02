import { type NextRequest } from "next/server";

// The mobile app has no cookies, so it authenticates to API routes by sending
// its Supabase session's access token in a standard Authorization header
// instead - this just extracts that token so route handlers can pass it into
// the same server actions the web app already uses (which accept an optional
// access token for exactly this reason).
export function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
