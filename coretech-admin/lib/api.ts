import Constants from "expo-constants";
import { supabase } from "./supabase";

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || "https://www.coretechsolar.com";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Every non-auth data call goes through app/api/mobile/* on the Next.js
// backend (§7 of notes/MOBILE-ADMIN-APP-PLAN.md) - never straight to
// Supabase. Attaches the caller's current Supabase access token so the route
// can verify it server-side and resolve mobile permissions the same way the
// web app already resolves web ones (see lib/mobileAuth.ts on the backend).
export async function mobileApiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new ApiError("Not signed in", 401);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status);
  }
  return body as T;
}
