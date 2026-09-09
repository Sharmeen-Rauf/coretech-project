import Constants from "expo-constants";
import { AdminSession, isAdminAppRole } from "./session";

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || "https://www.coretechsolar.com";

export class ApiError extends Error {}

// Wired to app/api/mobile/auth/login on the Next.js backend - that route
// doesn't exist yet (it's built in Phase 3, see notes/MOBILE-ADMIN-APP-PLAN.md
// §15). Calling this before then fails with a 404, which is expected: this
// app is API-backed, never talking to Supabase directly (§7), so login has
// nothing to hit until the API layer ships.
export async function login(email: string, password: string): Promise<AdminSession> {
  const res = await fetch(`${API_BASE_URL}/api/mobile/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error || `Login failed (${res.status})`);
  }
  if (!body?.token || !body?.role || !isAdminAppRole(body.role)) {
    throw new ApiError("This account isn't set up for the admin app.");
  }
  return { token: body.token, userId: body.userId, role: body.role, name: body.name || "" };
}
