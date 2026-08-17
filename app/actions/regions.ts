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

// Region creation was a raw client-side insert with no server-side check at all -
// same gap found and fixed across Expenses/Buzzcart/ST1 during the read-only/
// read-write pass. Region deletion still goes through the generic
// deleteRecordAction (app/actions/users.ts), which has no authorization of its
// own either - deliberately left alone here since it's shared across many
// unrelated tables and fixing it safely needs its own dedicated pass.
export async function createRegionAction(params: {
  regionCode: string;
  name: string;
  warehouse: string;
}) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    const { canWrite } = await getMyScopeAction("region");
    if (!canWrite) return { success: false, error: "You have read-only access to Region Management" };

    if (!params.regionCode?.trim() || !params.name?.trim() || !params.warehouse?.trim()) {
      return { success: false, error: "Region code, name, and warehouse are all required" };
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("regions")
      .insert({
        region_code: params.regionCode.trim().toUpperCase(),
        name: params.name.trim(),
        warehouse: params.warehouse.trim(),
        distributors: 0,
        sub_dealers: 0,
        status: "active",
      })
      .select("id, region_code")
      .single();
    if (error) throw error;

    try {
      await supabase.from("activity_logs").insert({
        action: "Region Registered",
        details: `Region ${data.region_code} registered.`,
      });
    } catch {
      // Non-critical.
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create region" };
  }
}
