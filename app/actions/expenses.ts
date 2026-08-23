"use server";

import { createClient as createJSClient } from "@supabase/supabase-js";
import { getCallerIdentity } from "@/app/actions/users";
import { getMyScopeAction } from "@/app/actions/roles";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createJSClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Stage 2 (Role Management): same real gap this session already found and fixed on
// Buzzcart Orders - expenses was fetched client-side with the anon key, trusting a
// client-resolved role, against a table that (per CLAUDE.md) uses a fully
// permissive `using (true)` RLS policy. Moved to a real server action using the
// admin client + server-verified caller identity, same pattern as
// fetchOrdersAction/fetchStockAction/fetchSellOutAction. "self" mirrors today's
// only real scoping (an employee sees only their own submitted expenses via
// user_id). "region" is new - expenses has no region column of its own, but every
// expense has user_id referencing profiles, and profiles.region already exists, so
// region scope filters by the submitter's own region through that join rather than
// needing a schema change.
export async function fetchExpensesAction() {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated", data: [], role: null };

    const supabase = getAdminClient();
    const { scope, callerId, callerRegion, canWrite } = await getMyScopeAction("expenses");

    let query = supabase.from("expenses").select(`
        id,
        title,
        amount,
        category,
        date,
        status,
        description,
        receipt_urls,
        user_id,
        profile:profiles!user_id(first_name, last_name)
      `);

    if (scope === "self" && callerId) {
      query = query.eq("user_id", callerId);
    } else if (scope === "region" && callerRegion) {
      const { data: regionalProfiles } = await supabase.from("profiles").select("id").ilike("region", callerRegion);
      const ids = (regionalProfiles || []).map((p) => p.id);
      query = query.in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }
    // scope === "everything": no filter.

    const { data, error } = await query.order("date", { ascending: false });
    if (error) throw error;
    return { success: true, data: data || [], role: caller.role, canWrite };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch expenses", data: [], role: null, canWrite: false };
  }
}

// Stage 3 (Role Management): expense creation and status updates (approve/reject)
// were previously raw client-side inserts/updates against a fully permissive RLS
// policy - no real server-side check on who could submit or approve a claim.
// Moved to real server actions gated by role_permissions.can_write for
// "expenses" - the same single read/write flag covers both actions, since this
// feature scope is "read-only vs read/write" per permission, not a separate
// approve-specific sub-permission. In practice this changes nothing visible
// today (everyone currently granted "expenses" defaults to can_write: true), it
// just makes the check real instead of bypassable from devtools.
export async function submitExpenseAction(params: {
  title: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
  receiptUrls?: string[];
  onBehalfOfUserId?: string;
}) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    const { canWrite } = await getMyScopeAction("expenses");
    if (!canWrite) return { success: false, error: "You have read-only access to Expenses" };

    if (!params.title?.trim()) return { success: false, error: "Title is required" };
    if (!params.amount || params.amount <= 0) return { success: false, error: "A valid amount is required" };

    // Only admin may file an expense under someone else's name - everyone else's
    // submissions are always attributed to themselves, server-side, regardless
    // of what the client sends.
    const filedForUserId = caller.role === "admin" && params.onBehalfOfUserId ? params.onBehalfOfUserId : caller.id;

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: filedForUserId,
        title: params.title.trim(),
        amount: params.amount,
        category: params.category,
        date: params.date,
        description: params.description || null,
        receipt_urls: params.receiptUrls || [],
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw error;

    return { success: true, id: data.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit expense" };
  }
}

// Approve/Reject - reuses the same "expenses" can_write flag as Submit/Delete
// (Role Management doesn't split this feature into finer-grained sub-permissions
// today), so anyone granted read/write access to Expense Management can action
// a claim, not just admin.
export async function updateExpenseStatusAction(id: string, status: "approved" | "rejected") {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    const { canWrite } = await getMyScopeAction("expenses");
    if (!canWrite) return { success: false, error: "You have read-only access to Expenses" };

    const supabase = getAdminClient();
    const { error } = await supabase.from("expenses").update({ status }).eq("id", id);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update expense status" };
  }
}

// Admin-only: who an expense can be filed on behalf of, for the Create Expense
// popup's employee-picker.
export async function fetchExpenseSubmittersAction() {
  try {
    const caller = await getCallerIdentity();
    if (!caller || caller.role !== "admin") return { success: false, error: "Admin access required", data: [] };

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role")
      .order("first_name");
    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch users", data: [] };
  }
}

export async function deleteExpenseAction(id: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    const { canWrite } = await getMyScopeAction("expenses");
    if (!canWrite) return { success: false, error: "You have read-only access to Expenses" };

    const supabase = getAdminClient();
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete expense" };
  }
}
