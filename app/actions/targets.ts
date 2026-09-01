"use server";

import { createClient as createJSClient } from "@supabase/supabase-js";
import { getCallerIdentity } from "@/app/actions/users";
import { getMyScopeAction } from "@/app/actions/roles";
import { computeAchievedUnitsForTargets, type TargetPeriodRef } from "@/lib/targetProgress";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createJSClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const PRODUCT_SELECT = "product:products(id, name, brand, model)";

// Self-facing: every one of the caller's own targets whose period covers
// today (one per product they've been assigned), or - if none currently
// cover today - every target sharing the single most recently assigned
// period, so a caller with several product-lines assigned together still
// sees all of them, not just one.
export async function fetchMyTargetAction() {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated", targets: [] };

    const supabase = getAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: current } = await supabase
      .from("targets")
      .select(`*, ${PRODUCT_SELECT}`)
      .eq("assignee_id", caller.id)
      .lte("period_start", today)
      .gte("period_end", today)
      .order("created_at", { ascending: false });

    let targets = current || [];
    if (targets.length === 0) {
      const { data: latest } = await supabase
        .from("targets")
        .select("period_start, period_end")
        .eq("assignee_id", caller.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest) {
        const { data: sameBatch } = await supabase
          .from("targets")
          .select(`*, ${PRODUCT_SELECT}`)
          .eq("assignee_id", caller.id)
          .eq("period_start", latest.period_start)
          .eq("period_end", latest.period_end)
          .order("created_at", { ascending: false });
        targets = sameBatch || [];
      }
    }

    if (targets.length === 0) return { success: true, targets: [] };

    const refs: TargetPeriodRef[] = targets.map((t: any) => ({
      id: t.id,
      assigneeId: caller.id,
      assigneeRole: caller.role || "",
      productId: t.product_id,
      periodStart: t.period_start,
      periodEnd: t.period_end,
    }));
    const achievedMap = await computeAchievedUnitsForTargets(supabase, refs);

    const enriched = targets.map((t: any) => ({ ...t, achieved_units: achievedMap.get(t.id) || 0 }));
    return { success: true, targets: enriched };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch target", targets: [] };
  }
}

// Admin-facing (Create Targets): every existing target (one row per
// assignee+product+period), joined to the assignee's name/role and the
// product, with real achieved units computed per-target.
export async function fetchAllTargetsAction() {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated", data: [] };

    const { canWrite } = await getMyScopeAction("resources.create_targets");
    if (caller.role !== "admin" && !canWrite) {
      return { success: false, error: "You don't have access to Create Targets", data: [] };
    }

    const supabase = getAdminClient();
    const { data: targets, error } = await supabase
      .from("targets")
      .select(`
        *,
        ${PRODUCT_SELECT},
        assignee:profiles!assignee_id(id, first_name, last_name, role),
        creator:profiles!created_by(id, first_name, last_name),
        updater:profiles!updated_by(id, first_name, last_name)
      `)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const refs: TargetPeriodRef[] = (targets || [])
      .filter((t: any) => t.assignee)
      .map((t: any) => ({
        id: t.id,
        assigneeId: t.assignee.id,
        assigneeRole: t.assignee.role,
        productId: t.product_id,
        periodStart: t.period_start,
        periodEnd: t.period_end,
      }));
    const achievedMap = await computeAchievedUnitsForTargets(supabase, refs);

    const enriched = (targets || []).map((t: any) => ({
      ...t,
      achieved_units: achievedMap.get(t.id) || 0,
    }));

    return { success: true, data: enriched };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch targets", data: [] };
  }
}

// Every user a target could be assigned to - "anyone" except installer, per
// the client's confirmed scope (installers don't have a Buzzcart/ST-2/Sell Out
// activity path a target could realistically be measured against).
export async function fetchAssignableUsersAction() {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated", data: [] };

    const { canWrite } = await getMyScopeAction("resources.create_targets");
    if (caller.role !== "admin" && !canWrite) {
      return { success: false, error: "You don't have access to Create Targets", data: [] };
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role")
      .neq("role", "installer")
      .order("first_name");
    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch users", data: [] };
  }
}

export async function deleteTargetAction(targetId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    const { canWrite } = await getMyScopeAction("resources.create_targets");
    if (caller.role !== "admin" && !canWrite) {
      return { success: false, error: "You don't have access to Create Targets" };
    }

    const supabase = getAdminClient();
    const { error } = await supabase.from("targets").delete().eq("id", targetId);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete target" };
  }
}

export async function createOrUpdateTargetAction(params: {
  targetId?: string;
  assigneeId: string;
  productId: string;
  targetUnits: number;
  periodStart: string;
  periodEnd: string;
}) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    const { canWrite } = await getMyScopeAction("resources.create_targets");
    if (caller.role !== "admin" && !canWrite) {
      return { success: false, error: "You don't have access to Create Targets" };
    }

    if (!params.assigneeId) return { success: false, error: "An assignee is required" };
    if (!params.productId) return { success: false, error: "A product is required" };
    if (!params.targetUnits || params.targetUnits <= 0) return { success: false, error: "Target units must be greater than 0" };
    if (!params.periodStart || !params.periodEnd) return { success: false, error: "Period start and end are required" };
    if (params.periodEnd < params.periodStart) return { success: false, error: "Period end must be on or after period start" };

    const supabase = getAdminClient();
    const { data: assignee } = await supabase.from("profiles").select("id, role").eq("id", params.assigneeId).maybeSingle();
    if (!assignee) return { success: false, error: "Selected assignee is invalid" };
    if (assignee.role === "installer") return { success: false, error: "Targets cannot be assigned to the installer role" };

    const { data: product } = await supabase.from("products").select("id").eq("id", params.productId).maybeSingle();
    if (!product) return { success: false, error: "Selected product is invalid" };

    if (params.targetId) {
      const { error } = await supabase
        .from("targets")
        .update({
          product_id: params.productId,
          target_units: params.targetUnits,
          period_start: params.periodStart,
          period_end: params.periodEnd,
          updated_at: new Date().toISOString(),
          updated_by: caller.id,
        })
        .eq("id", params.targetId);
      if (error) {
        if (error.code === "23505") {
          return { success: false, error: "This employee already has a target for this product and period — edit that one instead." };
        }
        throw error;
      }
      return { success: true, id: params.targetId };
    }

    const { data, error } = await supabase
      .from("targets")
      .insert({
        assignee_id: params.assigneeId,
        product_id: params.productId,
        target_units: params.targetUnits,
        period_start: params.periodStart,
        period_end: params.periodEnd,
        created_by: caller.id,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "This employee already has a target for this product and period — edit that one instead." };
      }
      throw error;
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save target" };
  }
}
