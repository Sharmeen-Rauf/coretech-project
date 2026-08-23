"use server";

import { createClient as createJSClient } from "@supabase/supabase-js";
import { getCallerIdentity } from "@/app/actions/users";
import { ALL_PERMISSION_KEYS } from "@/lib/permissionCatalog";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createJSClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const RESERVED_SYSTEM_ROLE_NAMES = [
  "admin", "country_head", "retail_manager", "rsm", "marketing_manager",
  "distributor", "sub_dealer", "installer", "employee",
];

// Sidebar and middleware both call this to find out what the current caller can
// actually see. Admin is short-circuited here before the permission table is ever
// consulted - that's the structural "admin always has everything" guarantee, not
// just a fully-checked, lockable row that a bad edit could theoretically leave
// incomplete. Every other role's grants are re-read fresh on every call, by design -
// permission changes are meant to apply on the very next request, not next login,
// so this deliberately has no caching layer of its own.
export async function getMyPermissionKeysAction(): Promise<{ role: string | null; keys: string[] }> {
  const caller = await getCallerIdentity();
  if (!caller || !caller.role) return { role: null, keys: [] };
  if (caller.role === "admin") return { role: "admin", keys: ALL_PERMISSION_KEYS };

  const supabase = getAdminClient();
  const { data: roleRow } = await supabase.from("roles").select("id").eq("name", caller.role).maybeSingle();
  if (!roleRow) return { role: caller.role, keys: [] }; // default-deny if the role has no catalog row

  const { data: perms } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_id", roleRow.id)
    .eq("granted", true);

  return { role: caller.role, keys: (perms || []).map((p) => p.permission_key) };
}

// Stage 2/3: resolves what data scope the caller's role holds for a given
// permission key (self / region / everything), plus whether that role can write
// through it at all (Stage 3), for pages whose fetch/write logic wires this in.
// Admin is short-circuited to "everything" + full write access the same way as
// page visibility. Reads fresh every call, same no-caching rationale as
// getMyPermissionKeysAction.
export async function getMyScopeAction(permissionKey: string): Promise<{
  scope: "self" | "region" | "everything";
  callerId: string | null;
  callerRegion: string | null;
  canWrite: boolean;
}> {
  const caller = await getCallerIdentity();
  if (!caller) return { scope: "self", callerId: null, callerRegion: null, canWrite: false };
  if (caller.role === "admin") return { scope: "everything", callerId: caller.id, callerRegion: null, canWrite: true };

  const supabase = getAdminClient();
  const { data: profile } = await supabase.from("profiles").select("region").eq("id", caller.id).maybeSingle();

  const { data: roleRow } = await supabase.from("roles").select("id").eq("name", caller.role || "").maybeSingle();
  let scope: "self" | "region" | "everything" = "self";
  let canWrite = false; // not granted at all -> definitely can't write
  if (roleRow) {
    const { data: permRow } = await supabase
      .from("role_permissions")
      .select("scope_level, granted, can_write")
      .eq("role_id", roleRow.id)
      .eq("permission_key", permissionKey)
      .maybeSingle();
    if (permRow?.granted) {
      scope = (permRow.scope_level as "self" | "region" | "everything") || "self";
      canWrite = permRow.can_write !== false;
    }
  }

  return { scope, callerId: caller.id, callerRegion: profile?.region || null, canWrite };
}

export async function fetchRolesAction() {
  try {
    const caller = await getCallerIdentity();
    if (!caller || caller.role !== "admin") return { success: false, error: "Only admins can view roles", data: [] };

    const supabase = getAdminClient();
    const { data: roles, error } = await supabase.from("roles").select("*").order("is_system_role", { ascending: false }).order("display_name");
    if (error) throw error;

    // "employee" is hidden from Role Management by client request - it stays a
    // fully real, functional role everywhere else (Buzzcart self-scope,
    // users.add_employee, etc.), it's just not surfaced as an editable row
    // here. Filtered here rather than client-side so it can't be reached via
    // fetchRolePermissionsAction/updateRolePermissionsAction by id either -
    // this is the only place that lists role ids for the UI to act on.
    const visibleRoles = (roles || []).filter((r) => r.name !== "employee");

    const { data: allPerms } = await supabase.from("role_permissions").select("role_id, granted");
    const grantedCounts: Record<string, number> = {};
    (allPerms || []).forEach((p) => {
      if (p.granted) grantedCounts[p.role_id] = (grantedCounts[p.role_id] || 0) + 1;
    });

    const withCounts = visibleRoles.map((r) => ({ ...r, granted_count: grantedCounts[r.id] || 0 }));
    return { success: true, data: withCounts };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch roles", data: [] };
  }
}

// Narrower than fetchRolesAction (admin-only, full role_permissions detail) -
// this only exposes id/display_name for non-system roles, gated to whoever
// can actually create an employee (same check createUserAction itself
// applies), so the "Add Employee" form can offer custom roles as an option
// without needing every caller who can create an employee to also be admin.
export async function fetchAssignableCustomRolesAction(): Promise<{
  success: boolean;
  data: { name: string; display_name: string }[];
  error?: string;
}> {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated", data: [] };

    if (caller.role !== "admin") {
      const { canWrite } = await getMyScopeAction("users.add_employee");
      if (!canWrite) return { success: false, error: "You don't have permission to view roles", data: [] };
    }

    const supabase = getAdminClient();
    const { data: roles, error } = await supabase
      .from("roles")
      .select("name, display_name")
      .eq("is_system_role", false)
      .order("display_name");
    if (error) throw error;

    return { success: true, data: roles || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch roles", data: [] };
  }
}

export async function fetchRolePermissionsAction(roleId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || caller.role !== "admin") return { success: false, error: "Only admins can view role permissions", data: [] };

    const supabase = getAdminClient();
    const { data, error } = await supabase.from("role_permissions").select("*").eq("role_id", roleId);
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch role permissions", data: [] };
  }
}

export async function createRoleAction(displayName: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || caller.role !== "admin") return { success: false, error: "Only admins can create roles" };

    const cleanDisplayName = (displayName || "").trim();
    // Internal name is derived from the display name - the Create Role form
    // only ever collects one field, there's no separate "internal name"
    // input for an admin to fill in.
    const cleanName = cleanDisplayName.toLowerCase().replace(/\s+/g, "_");
    if (!cleanName || !cleanDisplayName) return { success: false, error: "Display name is required" };
    if (RESERVED_SYSTEM_ROLE_NAMES.includes(cleanName)) {
      return { success: false, error: "That name is reserved by a system role" };
    }

    const supabase = getAdminClient();
    const { data: existing } = await supabase.from("roles").select("id").eq("name", cleanName).maybeSingle();
    if (existing) return { success: false, error: "A role with that name already exists" };

    const { data: newRole, error } = await supabase
      .from("roles")
      .insert({ name: cleanName, display_name: cleanDisplayName, is_system_role: false, created_by: caller.id })
      .select("id")
      .single();
    if (error) throw error;

    const rows = ALL_PERMISSION_KEYS.map((key) => ({
      role_id: newRole.id, permission_key: key, granted: false, locked: false, scope_level: "everything", can_write: true,
    }));
    const { error: permErr } = await supabase.from("role_permissions").insert(rows);
    if (permErr) throw permErr;

    return { success: true, roleId: newRole.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create role" };
  }
}

// Updates only the freely-editable permission rows for a role. Locked rows are
// silently skipped rather than erroring the whole request - the UI already
// disables locked checkboxes, so a locked key showing up in `grants` means the
// client sent back its current (already-granted) state, not an attempted change.
export async function updateRolePermissionsAction(
  roleId: string,
  grants: { key: string; scope?: "self" | "region" | "everything"; canWrite?: boolean }[],
  newDisplayName?: string
) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || caller.role !== "admin") return { success: false, error: "Only admins can edit role permissions" };

    const supabase = getAdminClient();
    const { data: role } = await supabase.from("roles").select("id, name, is_system_role").eq("id", roleId).maybeSingle();
    if (!role) return { success: false, error: "Role not found" };

    // System roles can't be renamed - only their non-locked permissions are editable.
    if (newDisplayName && newDisplayName.trim() && !role.is_system_role) {
      const { error: renameErr } = await supabase.from("roles").update({ display_name: newDisplayName.trim() }).eq("id", roleId);
      if (renameErr) throw renameErr;
    }

    const { data: currentRows, error: fetchErr } = await supabase
      .from("role_permissions")
      .select("permission_key, granted, locked, scope_level, can_write")
      .eq("role_id", roleId);
    if (fetchErr) throw fetchErr;

    const grantMap = new Map(grants.map((g) => [g.key, g]));
    const updates = (currentRows || [])
      .filter((row) => !row.locked) // locked rows are never touched, regardless of what was submitted
      .map((row) => {
        const g = grantMap.get(row.permission_key);
        return {
          permission_key: row.permission_key,
          granted: !!g,
          scope_level: g?.scope || row.scope_level || "everything",
          can_write: g ? g.canWrite !== false : row.can_write,
        };
      });

    for (const u of updates) {
      const { error } = await supabase
        .from("role_permissions")
        .update({ granted: u.granted, scope_level: u.scope_level, can_write: u.can_write })
        .eq("role_id", roleId)
        .eq("permission_key", u.permission_key);
      if (error) throw error;
    }

    // A permission key added to the catalog after this role's row was last
    // saved has no existing row to update above - without this, granting it
    // for the first time would silently do nothing. `grants` only ever
    // contains checked/granted items, so every key here is a real grant, not
    // a placeholder for something left unchecked.
    const currentKeys = new Set((currentRows || []).map((r) => r.permission_key));
    const missingGrantedKeys = grants.map((g) => g.key).filter((key) => !currentKeys.has(key));
    if (missingGrantedKeys.length > 0) {
      const inserts = missingGrantedKeys.map((key) => {
        const g = grantMap.get(key)!;
        return {
          role_id: roleId,
          permission_key: key,
          granted: true,
          locked: false,
          scope_level: g.scope || "everything",
          can_write: g.canWrite !== false,
        };
      });
      const { error: insertErr } = await supabase.from("role_permissions").insert(inserts);
      if (insertErr) throw insertErr;
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update role permissions" };
  }
}

export async function deleteRoleAction(roleId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || caller.role !== "admin") return { success: false, error: "Only admins can delete roles" };

    const supabase = getAdminClient();
    const { data: role } = await supabase.from("roles").select("id, name, is_system_role").eq("id", roleId).maybeSingle();
    if (!role) return { success: false, error: "Role not found" };
    if (role.is_system_role) return { success: false, error: "System roles can't be deleted" };

    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", role.name);
    if (count && count > 0) {
      return { success: false, error: `${count} user(s) are still assigned to this role - reassign them before deleting it` };
    }

    const { error } = await supabase.from("roles").delete().eq("id", roleId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete role" };
  }
}
