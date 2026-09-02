import Constants from "expo-constants";
import { supabase } from "./supabase";

export const API_BASE_URL: string =
  Constants.expoConfig?.extra?.apiBaseUrl || "https://www.coretechsolar.com";

export type InstallerAccess =
  | { allowed: true; state: "approved" }
  | { allowed: true; state: "pending" }
  | { allowed: false };

// Decides whether a logged-in Supabase user is allowed into the app, and if
// so, which state they land in. Used both right after a login attempt (to
// decide where to navigate and what error to show) and on every app launch
// (index.tsx) - a session persists across app restarts (SecureStore), so
// role/status has to be re-checked every time the app opens, not just at the
// moment someone taps "Sign in". Anything other than an explicit
// rejected/blocked status is treated as pending rather than denied, matching
// the web portal's own fallback ("Pending Review" for anything that isn't
// clearly approved or clearly rejected).
export async function resolveInstallerAccess(userId: string): Promise<InstallerAccess> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile || profile.role !== "installer") {
    return { allowed: false };
  }

  const status = String(profile.status || "").toLowerCase();
  if (status === "rejected" || status === "blocked") {
    return { allowed: false };
  }
  if (status === "approved" || status === "active") {
    return { allowed: true, state: "approved" };
  }
  return { allowed: true, state: "pending" };
}
