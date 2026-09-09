import { supabase } from "./supabase";
import { AdminAppRole, isAdminAppRole } from "./session";

export type AdminAccess =
  | { allowed: true; role: AdminAppRole; name: string; contact: string | null; region: string | null }
  | { allowed: false };

// Decides whether a logged-in Supabase user is allowed into this app, and if
// so, which role they hold. Used both right after a login attempt and on
// every app launch (index.tsx) - a session persists across app restarts
// (SecureStore), so the role has to be re-checked every time the app opens,
// not just at the moment someone taps "Sign in" - mirrors
// coretech-mobile's resolveInstallerAccess. No pending/approval state here:
// unlike installer self-registration, every account this app is shown to is
// admin-issued already active (§16).
export async function resolveAdminAccess(userId: string): Promise<AdminAccess> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, contact, region")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile || !isAdminAppRole(profile.role)) {
    return { allowed: false };
  }

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  return { allowed: true, role: profile.role, name, contact: profile.contact || null, region: profile.region || null };
}
