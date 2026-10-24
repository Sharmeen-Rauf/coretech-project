"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createJSClient } from "@supabase/supabase-js";
import { Client } from "pg";
// Type-only import - erased at compile time, so this can't create the real
// runtime circular dependency roles.ts's own comment warns about (it imports
// getCallerIdentity from this file).
import type { CallerOpts } from "@/app/actions/roles";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseServiceKey) {
    // If service role key is present, bypass SSR cookies to run as superuser
    return createJSClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  const cookieStore = cookies();
  const fallbackKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createServerClient(supabaseUrl, fallbackKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Safe to ignore in actions
        }
      },
    },
  });
}

// A sub_dealer must belong to exactly one distributor, and only to a distributor in
// the same region - re-checked here since the client-side dropdown filtering can be
// bypassed by calling the action directly.
async function validateSubDealerDistributor(distributorId: string | undefined, region: string | undefined) {
  if (!distributorId) {
    return { success: false, error: "A distributor is required for Sub Dealers" };
  }
  const supabase = getAdminClient();
  const { data: distributor } = await supabase
    .from("profiles")
    .select("id, role, region")
    .eq("id", distributorId)
    .maybeSingle();

  if (!distributor || distributor.role !== "distributor") {
    return { success: false, error: "Selected distributor is invalid" };
  }
  const distRegion = (distributor.region || "").trim().toLowerCase();
  const subRegion = (region || "").trim().toLowerCase();
  if (!subRegion || distRegion !== subRegion) {
    return { success: false, error: "Sub Dealer's region must match the selected distributor's region" };
  }
  return { success: true };
}

function catalogKeyForUserRole(role: string): string {
  if (role === "distributor") return "users.add_distributor";
  if (role === "sub_dealer") return "users.add_sub_dealer";
  if (role === "installer") return "users.add_installer";
  // Every other role - the 5 original office roles (employee/rsm/country_head/
  // retail_manager/marketing_manager/admin all go through the "Add Employee"
  // form already) plus any custom role created in Role Management - is
  // created the same way as an employee, so it's gated by the same
  // users.add_employee permission. Distributor/sub-dealer/installer are the
  // only categories with their own distinct creation form and permission key.
  return "users.add_employee";
}

// Stage 3 (Role Management): createUserAction/updateUserAction/deleteUserAction
// previously had NO server-side caller check at all - anyone able to trigger these
// actions directly (not just through the UI) could create, edit, or delete any
// account, including admin ones, entirely bypassing what the sidebar hides. This
// wasn't introduced by Stage 3 - it predates this feature - but adding a real
// write gate here requires establishing who the caller even is first, so both are
// fixed together rather than layering a permission check on top of no
// authentication check at all.
async function checkUsersWriteAccess(
  targetRole: string,
  allowAnonymousInstallerCreate = false
): Promise<{ allowed: boolean; anonymous?: boolean; error?: string }> {
  const caller = await getCallerIdentity();
  if (!caller) {
    // Installer self-registration (/installer/register, opened via QR code) is a
    // deliberately public, unauthenticated form - anyone can apply, the real gate
    // is the two-stage approval that happens later, not the submit button. Only
    // createUserAction passes this flag; updateUserAction/deleteUserAction never
    // do, so editing or deleting an existing installer's account still requires a
    // real authenticated, authorized caller.
    if (allowAnonymousInstallerCreate && targetRole === "installer") return { allowed: true, anonymous: true };
    return { allowed: false, error: "Not authenticated" };
  }
  if (caller.role === "admin") return { allowed: true };

  const key = catalogKeyForUserRole(targetRole);
  const { canWrite } = await getUsersScopeAndWrite(caller, key);
  if (!canWrite) return { allowed: false, error: "You don't have write access to manage this type of user" };
  return { allowed: true };
}

export async function createUserAction(formData: any): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  const supabase = getAdminClient();
  const {
    email,
    password,
    firstName,
    lastName,
    designation,
    contact,
    role,
    group,
    status: requestedStatus,
    state,
    region,
    warehouse,
    address,
    city,
    bankName,
    bankAccount,
    accountHolderName,
    cnic,
    maritalStatus,
    paymentProvider,
    paymentAccountNo,
    distributorId,
  } = formData;

  try {
    if (!role) return { success: false, error: "Role is required" };

    const access = await checkUsersWriteAccess(role, true);
    if (!access.allowed) return { success: false, error: access.error };

    // Public self-registration always starts at the beginning of the two-stage
    // review - the status is never taken from an anonymous request, otherwise
    // a direct call could register itself as already "active". Installers
    // added by staff through User Management keep the status they're given.
    const status = access.anonymous ? "pending_verification" : requestedStatus;

    if (role === "sub_dealer") {
      const validation = await validateSubDealerDistributor(distributorId, region);
      if (!validation.success) return validation;
    }

    // 0. Pre-register / Whitelist email to pass database auth.users trigger
    const cookieStore = cookies();
    const serverClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );
    const { data: { session } } = await serverClient.auth.getSession();
    const invitedBy = session?.user?.id || null;

    const { error: whitelistError } = await supabase.from("allowed_users").upsert({
      email: email.trim().toLowerCase(),
      role: role,
      approval_status: status === "active" ? "approved" : "pending",
      invited_by: invitedBy,
    }, { onConflict: "email" });

    if (whitelistError) {
      throw new Error(`Whitelist pre-registration failed: ${whitelistError.message}`);
    }

    // 1. Create Auth User
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (authError) {
      // If service role isn't available, we fallback to creating a mock profile with a generated UUID for demo/local display
      if (authError.message.includes("Service Role") || authError.status === 401) {
        const tempId = crypto.randomUUID();
        const profileInsertData: any = {
          id: tempId,
          first_name: firstName,
          last_name: lastName,
          designation,
          contact,
          role,
          group_name: group,
          status,
          state: state || null,
          region: region || null,
          warehouse: warehouse || null,
          address: address || null,
          city: city || null,
          bank_name: bankName || null,
          bank_account: bankAccount || null,
          account_holder_name: accountHolderName || null,
          cnic: cnic || null,
          marital_status: maritalStatus || null,
          payment_provider: paymentProvider || null,
          payment_account_no: paymentAccountNo || null,
          distributor_id: role === "sub_dealer" ? (distributorId || null) : null,
        };

        let { error: profileError } = await supabase.from("profiles").insert(profileInsertData);

        if (profileError && (profileError.message.includes("column") || profileError.code === "PGRST204" || profileError.code === "42703")) {
          const metadata = { state, region, warehouse, address, city, bankName, bankAccount, accountHolderName, cnic, maritalStatus, paymentProvider, paymentAccountNo, designation };
          const cleanInsertData = {
            id: tempId,
            first_name: firstName,
            last_name: lastName,
            designation: `[DISTRIBUTOR_METADATA]${JSON.stringify(metadata)}`,
            contact,
            role,
            group_name: group,
            status,
          };
          const { error: retryError } = await supabase.from("profiles").insert(cleanInsertData);
          profileError = retryError;
        }

        if (profileError) throw profileError;
        return { success: true, message: "Demo User created (Auth bypassed - local profile saved)", data: { id: tempId } };
      }
      throw authError;
    }

    // 2. Insert Profile row linked to the new Auth user
    const profileInsertData: any = {
      id: authUser.user.id,
      first_name: firstName,
      last_name: lastName,
      designation,
      contact,
      role,
      group_name: group,
      status,
      state: state || null,
      region: region || null,
      warehouse: warehouse || null,
      address: address || null,
      city: city || null,
      bank_name: bankName || null,
      bank_account: bankAccount || null,
      account_holder_name: accountHolderName || null,
      cnic: cnic || null,
      marital_status: maritalStatus || null,
      payment_provider: paymentProvider || null,
      payment_account_no: paymentAccountNo || null,
      distributor_id: role === "sub_dealer" ? (distributorId || null) : null,
    };

    let { error: profileError } = await supabase.from("profiles").insert(profileInsertData);

    if (profileError && (profileError.message.includes("column") || profileError.code === "PGRST204" || profileError.code === "42703")) {
      const metadata = { state, region, warehouse, address, city, bankName, bankAccount, accountHolderName, cnic, maritalStatus, paymentProvider, paymentAccountNo, designation };
      const cleanInsertData = {
        id: authUser.user.id,
        first_name: firstName,
        last_name: lastName,
        designation: `[DISTRIBUTOR_METADATA]${JSON.stringify(metadata)}`,
        contact,
        role,
        group_name: group,
        status,
      };
      const { error: retryError } = await supabase.from("profiles").insert(cleanInsertData);
      profileError = retryError;
    }

    if (profileError) {
      // Cleanup created auth user and whitelist entry if profile insert fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      await supabase.from("allowed_users").delete().eq("email", email.trim().toLowerCase());
      throw profileError;
    }

    return { success: true, message: "User and Profile successfully created", data: authUser.user };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create user" };
  }
}

export async function updateUserAction(id: string, formData: any): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  const supabase = getAdminClient();
  const {
    firstName,
    lastName,
    designation,
    contact,
    role,
    group,
    status,
    state,
    region,
    warehouse,
    address,
    city,
    bankName,
    bankAccount,
    accountHolderName,
    cnic,
    maritalStatus,
    paymentProvider,
    paymentAccountNo,
    distributorId,
  } = formData;

  try {
    // A profile must never lose its role on edit - previously this fell
    // through to `role || null`, silently nulling it out if the field was
    // ever empty on submit instead of rejecting the save.
    if (!role) return { success: false, error: "Role is required" };

    const access = await checkUsersWriteAccess(role);
    if (!access.allowed) return { success: false, error: access.error };

    if (role === "sub_dealer") {
      const validation = await validateSubDealerDistributor(distributorId, region);
      if (!validation.success) return validation;
    }

    const updateData: any = {
      first_name: firstName,
      last_name: lastName,
      designation,
      contact,
      role,
      group_name: group,
      status,
      state: state || null,
      region: region || null,
      warehouse: warehouse || null,
      address: address || null,
      city: city || null,
      bank_name: bankName || null,
      bank_account: bankAccount || null,
      account_holder_name: accountHolderName || null,
      cnic: cnic || null,
      marital_status: maritalStatus || null,
      payment_provider: paymentProvider || null,
      payment_account_no: paymentAccountNo || null,
      distributor_id: role === "sub_dealer" ? (distributorId || null) : null,
    };

    let { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (!error && data) {
      // Sync role change to allowed_users for authentication triggers
      const userEmail = formData.email || data.email || "";
      if (userEmail && role) {
        await supabase
          .from("allowed_users")
          .update({ role })
          .eq("email", userEmail.trim().toLowerCase());
      }
    }

    if (error) {
      // If RLS or other errors happened, let's keep going to column-missing checks
    } else if (!data) {
      throw new Error(`Profile not found in database for ID ${id}`);
    }

    if (error && (error.message.includes("column") || error.code === "PGRST204" || error.code === "42703")) {
      const metadata = { state, region, warehouse, address, city, bankName, bankAccount, accountHolderName, cnic, maritalStatus, paymentProvider, paymentAccountNo, designation };
      const cleanUpdateData = {
        first_name: firstName,
        last_name: lastName,
        designation: `[DISTRIBUTOR_METADATA]${JSON.stringify(metadata)}`,
        contact,
        role,
        group_name: group,
        status,
      };
      const { data: retryData, error: retryError } = await supabase
        .from("profiles")
        .update(cleanUpdateData)
        .eq("id", id)
        .select()
        .maybeSingle();
      error = retryError;
      data = retryData;

      if (!error && !data) {
        throw new Error(`Profile not found in database during metadata fallback update for ID ${id}`);
      }
    }

    if (error) throw error;

    return { success: true, message: "User profile successfully updated", data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update profile" };
  }
}

export async function deleteUserAction(id: string) {
  const supabase = getAdminClient();
  try {
    const { data: target } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
    const access = await checkUsersWriteAccess(target?.role || "");
    if (!access.allowed) return { success: false, error: access.error };

    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) throw error;

    // Attempt to delete auth user as well if permissions allow
    await supabase.auth.admin.deleteUser(id);

    return { success: true, message: "User deleted successfully" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete user" };
  }
}

export async function deleteRecordAction(table: string, id: string) {
  const supabase = getAdminClient();
  try {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
    return { success: true, message: "Record deleted successfully" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete record" };
  }
}

export async function updateRecordAction(table: string, id: string, data: any) {
  const supabase = getAdminClient();
  try {
    const { data: updated, error } = await supabase
      .from(table)
      .update(data)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return { success: true, message: "Record updated successfully", data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update record" };
  }
}

export async function fetchRecordsAction(table: string, filters?: { column: string; value: string }[], orderBy?: string) {
  const supabase = getAdminClient();
  try {
    let query = supabase.from(table).select("*");
    if (filters) {
      for (const f of filters) {
        query = query.eq(f.column, f.value);
      }
    }
    if (orderBy) {
      query = query.order(orderBy, { ascending: false });
    }
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch records", data: [] };
  }
}

export async function fetchProfilesAction(role?: string) {
  const supabase = getAdminClient();
  try {
    let query = supabase.from("profiles").select("*");
    if (role) {
      query = query.eq("role", role);
    }
    query = query.order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch profiles", data: [] };
  }
}

// === Dealer Assignment (admin-only) ===
// Every action here independently re-verifies the caller is admin, same pattern as
// the password-reset actions - the Sidebar link and page render being admin-gated is
// not itself a security boundary.

export async function fetchDealerAssignmentsAction() {
  try {
    const callerRole = await getCallerRole();
    if (callerRole !== "admin") {
      return { success: false, error: "Only admins can view dealer assignments", data: [] };
    }

    const supabase = getAdminClient();
    // PostgREST won't resolve a self-referencing profiles->profiles embed to a
    // single object (it comes back as an always-empty array), so the distributor
    // is joined manually here instead of via a nested select.
    const { data: subDealers, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, region, distributor_id")
      .eq("role", "sub_dealer")
      .not("distributor_id", "is", null)
      .order("first_name", { ascending: true });

    if (error) throw error;

    const distributorIds = Array.from(new Set((subDealers || []).map((s: any) => s.distributor_id).filter(Boolean)));
    let distributorMap: Record<string, { id: string; first_name: string; region: string }> = {};
    if (distributorIds.length > 0) {
      const { data: distributors } = await supabase
        .from("profiles")
        .select("id, first_name, region")
        .in("id", distributorIds);
      (distributors || []).forEach((d: any) => { distributorMap[d.id] = d; });
    }

    const data = (subDealers || []).map((s: any) => ({
      ...s,
      distributor: distributorMap[s.distributor_id] || null,
    }));

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch dealer assignments", data: [] };
  }
}

export async function bulkAssignSubDealersAction(distributorId: string, subDealerIds: string[]) {
  try {
    const callerRole = await getCallerRole();
    if (callerRole !== "admin") {
      return { success: false, error: "Only admins can assign sub dealers to a distributor" };
    }
    if (!distributorId || !subDealerIds || subDealerIds.length === 0) {
      return { success: false, error: "Select a distributor and at least one sub dealer" };
    }

    const supabase = getAdminClient();
    const { data: distributor } = await supabase
      .from("profiles")
      .select("id, role, region")
      .eq("id", distributorId)
      .maybeSingle();

    if (!distributor || distributor.role !== "distributor") {
      return { success: false, error: "Selected distributor is invalid" };
    }

    const { data: subDealers } = await supabase
      .from("profiles")
      .select("id, role, region")
      .in("id", subDealerIds);

    const distRegion = (distributor.region || "").trim().toLowerCase();
    const mismatched = (subDealers || []).filter(
      (s: any) => s.role !== "sub_dealer" || (s.region || "").trim().toLowerCase() !== distRegion
    );
    if (mismatched.length > 0) {
      return {
        success: false,
        error: `${mismatched.length} selected sub dealer(s) are not in the distributor's region (${distributor.region || "no region"}) and were not assigned`,
      };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ distributor_id: distributorId })
      .in("id", subDealerIds);

    if (error) throw error;
    return { success: true, message: "Sub dealers assigned successfully" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to assign sub dealers" };
  }
}

export async function unassignSubDealerAction(subDealerId: string) {
  try {
    const callerRole = await getCallerRole();
    if (callerRole !== "admin") {
      return { success: false, error: "Only admins can unassign a sub dealer" };
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({ distributor_id: null })
      .eq("id", subDealerId)
      .eq("role", "sub_dealer");

    if (error) throw error;
    return { success: true, message: "Sub dealer unassigned successfully" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to unassign sub dealer" };
  }
}

export async function createRecordAction(table: string, data: any) {
  const supabase = getAdminClient();
  try {
    const { data: created, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .maybeSingle();

    if (error) throw error;
    return { success: true, message: "Record created successfully", data: created };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create record" };
  }
}

// auth.users (Supabase's own login table) is the one place a real, correctly-typed
// email is guaranteed to live - auth.users.id is always the same id as profiles.id
// since that's how accounts get created. allowed_users.id is NOT reliable for this:
// it's a separate, independently-generated id with no link back to the real account.
async function queryAuthUsers(whereClause: string, params: any[]): Promise<{ id: string; email: string }[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query(`SELECT id, email FROM auth.users WHERE ${whereClause}`, params);
    return res.rows;
  } finally {
    await client.end().catch(() => {});
  }
}

export async function fetchEmailsByIdsAction(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true, data: {} as Record<string, string> };
  try {
    const rows = await queryAuthUsers("id = ANY($1)", [ids]);
    const map: Record<string, string> = {};
    rows.forEach((r) => { map[r.id] = r.email; });
    return { success: true, data: map };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch emails", data: {} as Record<string, string> };
  }
}

const USERS_SCOPE_KEY_BY_ACTIVE_ROLE: Record<string, string> = {
  employee: "users.add_employee",
  distributor: "users.add_distributor",
  sub_dealer: "users.add_sub_dealer",
  installer: "users.add_installer",
};

// Shared local resolver for both the Users list scope (Stage 2) and the write
// gate on create/edit/delete (Stage 3). Duplicates a small piece of
// getMyScopeAction's logic locally instead of importing it from
// app/actions/roles.ts, because roles.ts already imports getCallerIdentity from
// this file - importing back the other way would create a circular dependency
// between the two "use server" modules, unlike the one-directional imports
// orders.ts/products.ts/expenses.ts already use safely.
async function getUsersScopeAndWrite(
  caller: { id: string; role: string | null },
  scopeKey: string | undefined,
  surface: "web" | "mobile" = "web"
) {
  const supabase = getAdminClient();
  if (caller.role === "admin") return { scope: "everything" as const, callerRegion: null as string | null, canWrite: true, granted: true };
  if (!scopeKey) return { scope: "everything" as const, callerRegion: null as string | null, canWrite: true, granted: true };

  const { data: callerProfile } = await supabase.from("profiles").select("region").eq("id", caller.id).maybeSingle();
  const callerRegion = callerProfile?.region || null;

  const { data: roleRow } = await supabase.from("roles").select("id").eq("name", caller.role || "").maybeSingle();
  if (!roleRow) return { scope: "self" as const, callerRegion, canWrite: false, granted: false };

  const { data: permRow } = await supabase
    .from("role_permissions")
    .select("scope_level, granted, can_write, mobile_scope_level, mobile_granted, mobile_can_write")
    .eq("role_id", roleRow.id)
    .eq("permission_key", scopeKey)
    .maybeSingle();

  const mobile = surface === "mobile";
  const granted = !!(mobile ? permRow?.mobile_granted : permRow?.granted);
  if (!granted) return { scope: "self" as const, callerRegion, canWrite: false, granted: false };
  return {
    scope: ((mobile ? permRow?.mobile_scope_level : permRow?.scope_level) as "self" | "region" | "everything") || "self",
    callerRegion,
    canWrite: (mobile ? permRow?.mobile_can_write : permRow?.can_write) !== false,
    granted: true,
  };
}

// Escapes SQL LIKE/ILIKE wildcard characters in user-supplied input before it
// reaches an .ilike() call - same helper as app/actions/products.ts, not
// imported from there to avoid a cross-module import (this file already has
// its own getAdminClient/Client pattern, matching every other action file).
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// Strips characters that are syntactically significant inside a PostgREST
// .or() filter string (comma separates conditions, parens group them).
function sanitizeForOrFilter(value: string): string {
  return value.replace(/[,()]/g, " ").trim();
}

// Paginated, server-filtered replacement for fetchUsersAction's old "fetch
// every profile matching this role tab, filter/paginate in the browser"
// approach - same unbounded-select-with-no-range problem already found and
// fixed for `stock` (August) and `installer_jobs` above, never applied here.
// Keeps fetchUsersAction itself unchanged (still used wherever something
// needs the full unpaginated list, e.g. UserModal's dropdowns elsewhere in
// this file that reuse it).
export async function fetchUsersPageAction(opts: {
  activeRole: string;
  page: number;
  pageSize: number;
  search?: string;
}) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated", data: [], totalCount: 0, canWrite: false };

    // This is a directly-callable Server Action, not just reachable through
    // the page's own role=employee|distributor|sub_dealer|installer tabs.
    // USERS_SCOPE_KEY_BY_ACTIVE_ROLE only maps those 4 - any other
    // activeRole string (e.g. "admin") has no scopeKey, and
    // getUsersScopeAndWrite's own fallback for "no scopeKey" is
    // scope:"everything", canWrite:true - i.e. unrestricted. Rejecting
    // anything outside the known 4 closes that off; a caller legitimately
    // permitted for one of the 4 still goes through the real scope check
    // right after.
    const activeRole = opts.activeRole;
    if (!(activeRole in USERS_SCOPE_KEY_BY_ACTIVE_ROLE)) {
      return { success: false, error: "Not authorized", data: [], totalCount: 0, canWrite: false };
    }
    const scopeKey = USERS_SCOPE_KEY_BY_ACTIVE_ROLE[activeRole];
    const { scope, callerRegion, canWrite, granted } = await getUsersScopeAndWrite(caller, scopeKey);
    if (!granted) {
      return { success: false, error: "Not authorized", data: [], totalCount: 0, canWrite: false };
    }

    const page = Math.max(1, Math.floor(Number(opts.page)) || 1);
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(opts.pageSize)) || 30));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = getAdminClient();

    // Search needs to match on email too, which lives in auth.users, not
    // profiles - resolve matching ids there first (same pattern as
    // resolving matching installer names in app/actions/products.ts).
    const hadRawSearch = (opts.search || "").trim().length > 0;
    const search = sanitizeForOrFilter(opts.search || "");
    if (hadRawSearch && !search) {
      // Every character was filter-syntax punctuation - genuinely zero
      // matches, not "no filter" (would otherwise silently return everyone).
      return { success: true, data: [], totalCount: 0, role: caller.role, canWrite };
    }

    let emailMatchIds: string[] = [];
    if (search) {
      try {
        const rows = await queryAuthUsers("email ILIKE $1", [`%${search}%`]);
        emailMatchIds = rows.map((r) => r.id);
      } catch {
        // Non-fatal - search still works against the profile columns below.
      }
    }

    let query = supabase.from("profiles").select("*", { count: "exact" });
    if (activeRole === "employee") {
      query = query.not("role", "in", "(distributor,sub_dealer,installer)");
    } else {
      query = query.eq("role", activeRole);
    }

    if (scope === "self") {
      if (activeRole === "sub_dealer" && caller.role === "distributor") {
        query = query.eq("distributor_id", caller.id);
      } else {
        query = query.eq("id", caller.id);
      }
    } else if (scope === "region" && callerRegion) {
      // sanitizeForOrFilter first - a region value containing a comma or
      // paren would otherwise break/misparse this .or() filter string the
      // same way an unsanitized search term would.
      query = query.or(`id.eq.${caller.id},region.ilike.${escapeLikePattern(sanitizeForOrFilter(callerRegion))}`);
    }
    // scope === "everything": no filter.

    if (search) {
      const pattern = escapeLikePattern(search);
      const orParts = [
        `first_name.ilike.%${pattern}%`,
        `last_name.ilike.%${pattern}%`,
        `designation.ilike.%${pattern}%`,
        `contact.ilike.%${pattern}%`,
        `group_name.ilike.%${pattern}%`,
      ];
      if (emailMatchIds.length > 0) {
        orParts.push(`id.in.(${emailMatchIds.join(",")})`);
      }
      query = query.or(orParts.join(","));
    }

    const { data: profiles, count, error } = await query.order("created_at", { ascending: false }).range(from, to);
    if (error) throw error;

    const rows = profiles || [];
    const emailsRes = await fetchEmailsByIdsAction(rows.map((p: any) => p.id));
    const emailMap = emailsRes.success ? emailsRes.data : {};
    const withEmails = rows.map((p: any) => ({ ...p, email: emailMap[p.id] || "" }));

    return { success: true, data: withEmails, totalCount: count || 0, role: caller.role, canWrite };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch users", data: [], totalCount: 0, canWrite: false };
  }
}

// Unpaginated companion to fetchUsersPageAction, for Export/"Select all
// matching" - same filters, every matching row instead of one page.
export async function fetchAllUsersForExportAction(opts: { activeRole: string; search?: string }) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated", data: [] };

    // Same allowlist + granted check as fetchUsersPageAction - this one
    // hands back the full matching set, so skipping it here would be the
    // bigger hole of the two.
    const activeRole = opts.activeRole;
    if (!(activeRole in USERS_SCOPE_KEY_BY_ACTIVE_ROLE)) {
      return { success: false, error: "Not authorized", data: [] };
    }
    const scopeKey = USERS_SCOPE_KEY_BY_ACTIVE_ROLE[activeRole];
    const { scope, callerRegion, granted } = await getUsersScopeAndWrite(caller, scopeKey);
    if (!granted) {
      return { success: false, error: "Not authorized", data: [] };
    }

    const supabase = getAdminClient();

    const hadRawSearch = (opts.search || "").trim().length > 0;
    const search = sanitizeForOrFilter(opts.search || "");
    if (hadRawSearch && !search) return { success: true, data: [] };

    let emailMatchIds: string[] = [];
    if (search) {
      try {
        const rows = await queryAuthUsers("email ILIKE $1", [`%${search}%`]);
        emailMatchIds = rows.map((r) => r.id);
      } catch {
        // Non-fatal
      }
    }

    const buildQuery = () => {
      let q = supabase.from("profiles").select("*");
      if (activeRole === "employee") {
        q = q.not("role", "in", "(distributor,sub_dealer,installer)");
      } else {
        q = q.eq("role", activeRole);
      }
      if (scope === "self") {
        if (activeRole === "sub_dealer" && caller.role === "distributor") {
          q = q.eq("distributor_id", caller.id);
        } else {
          q = q.eq("id", caller.id);
        }
      } else if (scope === "region" && callerRegion) {
        q = q.or(`id.eq.${caller.id},region.ilike.${escapeLikePattern(sanitizeForOrFilter(callerRegion))}`);
      }
      if (search) {
        const pattern = escapeLikePattern(search);
        const orParts = [
          `first_name.ilike.%${pattern}%`,
          `last_name.ilike.%${pattern}%`,
          `designation.ilike.%${pattern}%`,
          `contact.ilike.%${pattern}%`,
          `group_name.ilike.%${pattern}%`,
        ];
        if (emailMatchIds.length > 0) {
          orParts.push(`id.in.(${emailMatchIds.join(",")})`);
        }
        q = q.or(orParts.join(","));
      }
      return q.order("created_at", { ascending: false });
    };

    const PAGE_SIZE = 1000;
    let allRows: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const page = data || [];
      allRows = allRows.concat(page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const emailsRes = await fetchEmailsByIdsAction(allRows.map((p: any) => p.id));
    const emailMap = emailsRes.success ? emailsRes.data : {};
    const withEmails = allRows.map((p: any) => ({ ...p, email: emailMap[p.id] || "" }));

    return { success: true, data: withEmails };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch users for export", data: [] };
  }
}

export async function fetchUsersAction(activeRole: string, opts?: CallerOpts) {
  try {
    const caller = await getCallerIdentity(opts?.accessToken);
    if (!caller) return { success: false, error: "Not authenticated", data: [] };

    // Directly-callable Server Action - activeRole is only ever
    // "employee"/"distributor"/"sub_dealer"/"installer" from the page's own
    // tabs, but an arbitrary caller could otherwise pass anything. Any value
    // outside USERS_SCOPE_KEY_BY_ACTIVE_ROLE has no scopeKey, and
    // getUsersScopeAndWrite's own "no scopeKey" fallback is
    // scope:"everything" - unrestricted. "employee" is the intended
    // catch-all for admin/office roles (its own query below is already a
    // deny-list, not keyed to this map), so this isn't a new restriction on
    // legitimate access, only on activeRole values no real tab ever sends.
    if (!["employee", "distributor", "sub_dealer", "installer"].includes(activeRole)) {
      return { success: false, error: "Not authorized", data: [] };
    }

    const supabase = getAdminClient();
    let query = supabase.from("profiles").select("*");
    if (activeRole === "employee") {
      // Employee tab = every role except the three field/channel roles that
      // get their own dedicated tabs. Was previously a hardcoded allow-list
      // of the 5 original office roles, which silently excluded any new
      // custom role created via Role Management (e.g. "customer_support")
      // from ever appearing here - switched to a deny-list so new roles
      // resolve correctly without this query needing to be updated again.
      query = query.not("role", "in", "(distributor,sub_dealer,installer)");
    } else {
      query = query.eq("role", activeRole);
    }
    const { data: profiles, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    const scopeKey = USERS_SCOPE_KEY_BY_ACTIVE_ROLE[activeRole];
    const { scope, callerRegion, canWrite, granted } = await getUsersScopeAndWrite(caller, scopeKey);
    if (!granted) {
      return { success: false, error: "Not authorized", data: [] };
    }

    let scoped = profiles || [];
    if (scope === "self") {
      if (activeRole === "sub_dealer" && caller.role === "distributor") {
        // A distributor's own connected sub-dealers, not every sub-dealer in the system.
        scoped = scoped.filter((p: any) => p.distributor_id === caller.id);
      } else {
        scoped = scoped.filter((p: any) => p.id === caller.id);
      }
    } else if (scope === "region" && callerRegion) {
      const regionLower = callerRegion.toLowerCase().trim();
      scoped = scoped.filter((p: any) => p.id === caller.id || (p.region || "").toLowerCase().trim() === regionLower);
    }
    // scope === "everything": no filter.

    const emailsRes = await fetchEmailsByIdsAction(scoped.map((p: any) => p.id));
    const emailMap = emailsRes.success ? emailsRes.data : {};
    const withEmails = scoped.map((p: any) => ({ ...p, email: emailMap[p.id] || "" }));

    return { success: true, data: withEmails, role: caller.role, canWrite };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch users", data: [], canWrite: false };
  }
}

// Resolves the logged-in caller's own role from their session cookie, independent of
// whatever the client claims - the password reset actions below must never trust the client.
// Web callers (Server Actions from a browser session) are identified via the
// Supabase auth cookie the browser client already set - no token needed. The
// mobile app has no cookies at all, so API routes it calls pass its Supabase
// session's access token explicitly instead; verifying that token against the
// admin client resolves the same caller identity through a different channel.
async function getCallerSessionId(accessToken?: string): Promise<string | null> {
  if (accessToken) {
    const supabase = getAdminClient();
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user) return null;
    return data.user.id;
  }

  const cookieStore = cookies();
  const serverClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe to ignore in actions
          }
        },
      },
    }
  );
  const { data: { session } } = await serverClient.auth.getSession();
  return session?.user?.id || null;
}

export async function getCallerRole(): Promise<string | null> {
  const callerId = await getCallerSessionId();
  if (!callerId) return null;

  const supabase = getAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  return profile?.role || null;
}

// Same lookup as getCallerRole, but also returns the caller's own id — needed
// wherever an action must both authorize the caller AND stamp who performed it
// (e.g. verified_by/approved_by columns).
export async function getCallerIdentity(accessToken?: string): Promise<{ id: string; role: string | null } | null> {
  const callerId = await getCallerSessionId(accessToken);
  if (!callerId) return null;

  const supabase = getAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  return { id: callerId, role: profile?.role || null };
}

// === Installer registration two-stage review ===
// Stage 1 (verify/reject): Regional Manager, Country Head, or Admin.
// Stage 2 (final approve/reject): Country Head or Admin only.

const INSTALLER_STATUS_GROUPS: Record<string, string[]> = {
  active: ["active", "approved"],
  approved: ["active", "approved"],
  pending_approval: ["pending_approval", "verified"],
  verified: ["pending_approval", "verified"],
  pending_verification: ["pending_verification", "pending"],
  pending: ["pending_verification", "pending"],
};

// Resolves (a) whether the caller is allowed to see the installer list at
// all, and (b) their RSM region-isolation filter, if any. The route itself
// is gated on "installer.verify_installer" (lib/permissionCatalog.ts) via
// middleware, but these are directly-callable Server Actions - not just
// reachable through that middleware-gated page - so the same permission is
// re-checked here, same posture as every other scoped action in this file.
// "RSM" region isolation is the caller's own role/group_name, not itself a
// Role Management scope_level (this page predates that system for the
// region-filter specifically, though the base grant now goes through it).
async function resolveInstallerListAuth(supabase: any) {
  const caller = await getCallerIdentity();
  if (!caller) return { caller: null, rsmRegion: null as string | null };

  const { granted } = await getUsersScopeAndWrite(caller, "installer.verify_installer");
  if (!granted) return { caller: null, rsmRegion: null as string | null };

  const { data: prof } = await supabase.from("profiles").select("region, group_name").eq("id", caller.id).maybeSingle();
  const isRsmUser = caller.role === "rsm" || prof?.group_name === "rsm";
  if (isRsmUser && prof?.region) {
    return { caller, rsmRegion: prof.region as string };
  }
  return { caller, rsmRegion: null as string | null };
}

function applyInstallerListFilters(
  query: any,
  opts: { statusFilter?: string; startDate?: string; endDate?: string; rsmRegion?: string | null }
) {
  if (opts.statusFilter && INSTALLER_STATUS_GROUPS[opts.statusFilter]) {
    query = query.in("status", INSTALLER_STATUS_GROUPS[opts.statusFilter]);
  } else if (opts.statusFilter) {
    query = query.eq("status", opts.statusFilter);
  }
  if (opts.startDate) query = query.gte("created_at", opts.startDate);
  if (opts.endDate) query = query.lte("created_at", `${opts.endDate}T23:59:59.999Z`);
  if (opts.rsmRegion) {
    // Matches the original client-side rule: a row with no region at all
    // still shows (not excluded as "wrong region"), only a *different*
    // non-empty region is excluded. sanitizeForOrFilter first - a region
    // value containing a comma or paren would otherwise break/misparse this
    // .or() filter string.
    query = query.or(`region.is.null,region.eq.,region.ilike.${escapeLikePattern(sanitizeForOrFilter(opts.rsmRegion))}`);
  }
  return query;
}

// Paginated, server-filtered replacement for Installer List's old
// "fetch every installer profile, filter/paginate in the browser" approach -
// same unbounded-select problem already found and fixed elsewhere. Search
// covers first_name/last_name/contact (not the installer_id prefix shown in
// the UI, which is just a slice of the uuid - a narrower, disclosed gap
// versus the old client-side search, which could match that prefix too).
export async function fetchInstallersPageAction(opts: {
  page: number;
  pageSize: number;
  search?: string;
  statusFilter?: string;
  startDate?: string;
  endDate?: string;
}) {
  const supabase = getAdminClient();
  try {
    const { caller, rsmRegion } = await resolveInstallerListAuth(supabase);
    if (!caller) return { success: false, error: "Not authenticated", data: [], totalCount: 0, counts: {} };

    const page = Math.max(1, Math.floor(Number(opts.page)) || 1);
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(opts.pageSize)) || 30));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const hadRawSearch = (opts.search || "").trim().length > 0;
    const search = sanitizeForOrFilter(opts.search || "");
    const searchIsEmptyMatch = hadRawSearch && !search;

    let query = applyInstallerListFilters(
      supabase.from("profiles").select("*", { count: "exact" }).eq("role", "installer"),
      { statusFilter: opts.statusFilter, startDate: opts.startDate, endDate: opts.endDate, rsmRegion }
    );
    if (search) {
      const pattern = escapeLikePattern(search);
      query = query.or(`first_name.ilike.%${pattern}%,last_name.ilike.%${pattern}%,contact.ilike.%${pattern}%`);
    }

    const { data: rows, count, error } = searchIsEmptyMatch
      ? { data: [] as any[], count: 0, error: null as any }
      : await query.order("created_at", { ascending: false }).range(from, to);
    if (error) throw error;

    const emailsRes = await fetchEmailsByIdsAction((rows || []).map((p: any) => p.id));
    const emailMap = emailsRes.success ? emailsRes.data : {};
    const data = (rows || []).map((prof: any) => ({
      ...prof,
      email: emailMap[prof.id] || "",
      installer_id: (prof.id || "").substring(0, 8).toUpperCase(),
      installer_name: `${prof.first_name || ""} ${prof.last_name || ""}`.trim() || "Installer",
    }));

    // KPI tiles: counts per status group, scoped by RSM region but
    // deliberately NOT by the current date-range filter (the original
    // per-status date fields - verified_at/approved_at vs created_at - don't
    // reduce to one straightforward range query across all four at once;
    // simplified here to always-all-time tile counts rather than silently
    // getting the date-aware figure wrong).
    const STATUS_KEYS = ["pending_verification", "pending_approval", "approved"] as const;
    const countsArr = await Promise.all(
      STATUS_KEYS.map(async (key) => {
        let q = applyInstallerListFilters(
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "installer"),
          { statusFilter: key, rsmRegion }
        );
        const { count: c, error: cErr } = await q;
        if (cErr) throw cErr;
        return [key, c || 0] as const;
      })
    );
    const counts: Record<string, number> = Object.fromEntries(countsArr);
    let registeredQuery = applyInstallerListFilters(
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "installer"),
      { rsmRegion }
    );
    const { count: registeredCount, error: regErr } = await registeredQuery;
    if (regErr) throw regErr;
    counts.registered = registeredCount || 0;

    return { success: true, data, totalCount: count || 0, counts };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch installers", data: [], totalCount: 0, counts: {} };
  }
}

// Unpaginated companion to fetchInstallersPageAction, for Export/"Select all
// matching" - same filters, every matching row instead of one page.
export async function fetchAllInstallersForExportAction(opts: {
  search?: string;
  statusFilter?: string;
  startDate?: string;
  endDate?: string;
}) {
  const supabase = getAdminClient();
  try {
    const { caller, rsmRegion } = await resolveInstallerListAuth(supabase);
    if (!caller) return { success: false, error: "Not authenticated", data: [] };

    const hadRawSearch = (opts.search || "").trim().length > 0;
    const search = sanitizeForOrFilter(opts.search || "");
    if (hadRawSearch && !search) return { success: true, data: [] };

    const buildQuery = () => {
      let q = applyInstallerListFilters(
        supabase.from("profiles").select("*").eq("role", "installer"),
        { statusFilter: opts.statusFilter, startDate: opts.startDate, endDate: opts.endDate, rsmRegion }
      );
      if (search) {
        const pattern = escapeLikePattern(search);
        q = q.or(`first_name.ilike.%${pattern}%,last_name.ilike.%${pattern}%,contact.ilike.%${pattern}%`);
      }
      return q.order("created_at", { ascending: false });
    };

    const PAGE_SIZE = 1000;
    let allRows: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const page = data || [];
      allRows = allRows.concat(page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const emailsRes = await fetchEmailsByIdsAction(allRows.map((p: any) => p.id));
    const emailMap = emailsRes.success ? emailsRes.data : {};
    const data = allRows.map((prof: any) => ({
      ...prof,
      email: emailMap[prof.id] || "",
      installer_id: (prof.id || "").substring(0, 8).toUpperCase(),
      installer_name: `${prof.first_name || ""} ${prof.last_name || ""}`.trim() || "Installer",
    }));

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch installers for export", data: [] };
  }
}

export async function verifyInstallerStage1Action(instId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || !["retail_manager", "country_head", "admin"].includes(caller.role || "")) {
      return { success: false, error: "You don't have permission to verify this registration" };
    }

    // Only a registration still waiting for Stage 1 can be verified - the
    // two stages must happen in order.
    const supabase = getAdminClient();
    const { data: updated, error } = await supabase
      .from("profiles")
      .update({
        status: "pending_approval",
        verified_by: caller.id,
        verified_at: new Date().toISOString(),
        verification_note: "Credentials and documents verified by Retail Manager.",
      })
      .eq("id", instId)
      .in("status", INSTALLER_STATUS_GROUPS.pending_verification)
      .select("id");

    if (error) throw error;
    if (!updated || updated.length === 0) {
      return { success: false, error: "This registration is no longer waiting for verification — please refresh." };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to verify installer" };
  }
}

export async function approveInstallerStage2Action(instId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || !["country_head", "admin"].includes(caller.role || "")) {
      return { success: false, error: "Only Country Head or Admin can give final approval" };
    }

    // Final approval only after Stage 1 verification - never straight from
    // a fresh registration.
    const supabase = getAdminClient();
    const { data: updated, error } = await supabase
      .from("profiles")
      .update({
        status: "active",
        approved_by: caller.id,
        approved_at: new Date().toISOString(),
        approval_note: "Final approval granted by Country Head.",
      })
      .eq("id", instId)
      .in("status", INSTALLER_STATUS_GROUPS.pending_approval)
      .select("id");

    if (error) throw error;
    if (!updated || updated.length === 0) {
      return { success: false, error: "This registration must be verified (Stage 1) before final approval — please refresh." };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to approve installer" };
  }
}

export async function rejectInstallerStage1Action(instId: string) {
  const caller = await getCallerIdentity();
  if (!caller || !["retail_manager", "country_head", "admin"].includes(caller.role || "")) {
    return { success: false, error: "You don't have permission to reject this registration" };
  }
  return deleteUserAction(instId);
}

export async function rejectInstallerStage2Action(instId: string) {
  const caller = await getCallerIdentity();
  if (!caller || !["country_head", "admin"].includes(caller.role || "")) {
    return { success: false, error: "Only Country Head or Admin can reject at this stage" };
  }
  return deleteUserAction(instId);
}

export async function lookupUserByEmailAction(email: string) {
  try {
    const callerRole = await getCallerRole();
    if (callerRole !== "admin") {
      return { success: false, error: "Only admins can look up accounts for password reset" };
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) return { success: false, error: "Email is required" };

    const [authUser] = await queryAuthUsers("email = $1", [cleanEmail]);
    if (!authUser) {
      return { success: false, error: "No account found with that email" };
    }

    const supabase = getAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role, status")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!profile) {
      return { success: false, error: "Account found but no profile record exists for it" };
    }

    return {
      success: true,
      data: {
        id: profile.id,
        name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "-",
        role: profile.role,
        status: profile.status,
        email: authUser.email,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Lookup failed" };
  }
}

export async function resetUserPasswordAction(email: string, newPassword: string) {
  try {
    const callerRole = await getCallerRole();
    if (callerRole !== "admin") {
      return { success: false, error: "Only admins can reset passwords" };
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) return { success: false, error: "Email is required" };

    // Server-side floor — the UI enforces this too, but a server action can be
    // called directly, so this is the real security boundary.
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }

    const [authUser] = await queryAuthUsers("email = $1", [cleanEmail]);
    if (!authUser) {
      return { success: false, error: "No account found with that email" };
    }

    const supabase = getAdminClient();
    const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
      password: newPassword,
    });

    if (updateError) throw updateError;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reset password" };
  }
}

export async function reloadSchemaAction() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  try {
    await client.connect();
    await client.query("NOTIFY pgrst, 'reload schema';");
    await client.end();
    return { success: true, message: "PostgREST schema cache reloaded successfully!" };
  } catch (err: any) {
    console.error("Failed to reload schema cache on Supabase:", err);
    return { success: false, error: err.message };
  }
}

