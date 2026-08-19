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

// Self-facing: the caller's own current target (whichever one covers today,
// or the most recently created one if none does) plus real achieved units.
export async function fetchMyTargetAction() {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated", target: null, achievedUnits: 0 };

    const supabase = getAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: current } = await supabase
      .from("targets")
      .select("*")
      .eq("assignee_id", caller.id)
      .lte("period_start", today)
      .gte("period_end", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let target = current;
    if (!target) {
      const { data: latest } = await supabase
        .from("targets")
        .select("*")
        .eq("assignee_id", caller.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      target = latest || null;
    }

    if (!target) return { success: true, target: null, achievedUnits: 0 };

    const achievedMap = await computeAchievedUnitsForTargets(supabase, [
      {
        id: target.id,
        assigneeId: caller.id,
        assigneeRole: caller.role,
        periodStart: target.period_start,
        periodEnd: target.period_end,
      },
    ]);

    return { success: true, target, achievedUnits: achievedMap.get(target.id) || 0 };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch target", target: null, achievedUnits: 0 };
  }
}

// Admin-facing (Create Targets): every existing target, joined to the
// assignee's name/role, with real achieved units computed per-target.
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
      .select("*, assignee:profiles!assignee_id(id, first_name, last_name, role)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const refs: TargetPeriodRef[] = (targets || [])
      .filter((t: any) => t.assignee)
      .map((t: any) => ({
        id: t.id,
        assigneeId: t.assignee.id,
        assigneeRole: t.assignee.role,
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

// Every user a target could be assigned to - "anyone", per the client's
// confirmed scope, so this is every profile regardless of role.
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
      .order("first_name");
    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch users", data: [] };
  }
}

export async function createOrUpdateTargetAction(params: {
  targetId?: string;
  assigneeId: string;
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
    if (!params.targetUnits || params.targetUnits <= 0) return { success: false, error: "Target units must be greater than 0" };
    if (!params.periodStart || !params.periodEnd) return { success: false, error: "Period start and end are required" };
    if (params.periodEnd < params.periodStart) return { success: false, error: "Period end must be on or after period start" };

    const supabase = getAdminClient();
    const { data: assignee } = await supabase.from("profiles").select("id").eq("id", params.assigneeId).maybeSingle();
    if (!assignee) return { success: false, error: "Selected assignee is invalid" };

    if (params.targetId) {
      const { error } = await supabase
        .from("targets")
        .update({
          target_units: params.targetUnits,
          period_start: params.periodStart,
          period_end: params.periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.targetId);
      if (error) throw error;
      return { success: true, id: params.targetId };
    }

    const { data, error } = await supabase
      .from("targets")
      .insert({
        assignee_id: params.assigneeId,
        target_units: params.targetUnits,
        period_start: params.periodStart,
        period_end: params.periodEnd,
        created_by: caller.id,
      })
      .select("id")
      .single();
    if (error) throw error;

    return { success: true, id: data.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save target" };
  }
}
