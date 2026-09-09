import * as SecureStore from "expo-secure-store";

// The 7 roles this app is ever shown to - distributor/sub_dealer plus the 5
// office roles the client calls "employee(s)" colloquially (not the literal
// DB role string, which was removed - see notes/MOBILE-ADMIN-APP-PLAN.md §8.1
// and CLAUDE.md's Role Management section). installer is never valid here.
export const ADMIN_APP_ROLES = [
  "distributor",
  "sub_dealer",
  "admin",
  "country_head",
  "marketing_manager",
  "retail_manager",
  "rsm",
] as const;

export type AdminAppRole = (typeof ADMIN_APP_ROLES)[number];

export function isAdminAppRole(role: string): role is AdminAppRole {
  return (ADMIN_APP_ROLES as readonly string[]).includes(role);
}

export interface AdminSession {
  token: string;
  userId: string;
  role: AdminAppRole;
  name: string;
}

const SESSION_KEY = "coretech_admin_session";

export async function getSession(): Promise<AdminSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !isAdminAppRole(parsed?.role)) return null;
    return parsed as AdminSession;
  } catch {
    return null;
  }
}

export async function setSession(session: AdminSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
