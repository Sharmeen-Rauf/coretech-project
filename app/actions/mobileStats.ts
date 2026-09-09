"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createJSClient } from "@supabase/supabase-js";
import { getCallerIdentity } from "@/app/actions/users";
import { getMyScopeAction, type CallerOpts } from "@/app/actions/roles";
import { buildPartyRegionMap, regionForParty, regionsMatch, type PartyRef } from "@/lib/regionScope";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseServiceKey) {
    return createJSClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const cookieStore = cookies();
  return createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
    },
  });
}

interface MonthWindows {
  startOfLastMonth: string;
  startOfThisMonth: string;
  startOfWeek: string;
}

function computeWindows(): MonthWindows {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return {
    startOfLastMonth: startOfLastMonth.toISOString(),
    startOfThisMonth: startOfThisMonth.toISOString(),
    startOfWeek: startOfWeek.toISOString(),
  };
}

async function computeSellOutStats(supabase: any, opts: CallerOpts | undefined, windows: MonthWindows) {
  const { scope, callerId, callerRegion, granted } = await getMyScopeAction("sales.sellout", opts);
  if (!granted) return null;

  let query = supabase
    .from("stock")
    .select("sold_out_at, distributor_id, sub_dealer_id, warehouse_name")
    .eq("status", "sold_out")
    .gte("sold_out_at", windows.startOfLastMonth);

  if (scope === "self" && callerId) {
    query = query.or(`distributor_id.eq.${callerId},sub_dealer_id.eq.${callerId}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  let rows = data || [];

  if (scope === "region" && callerRegion) {
    const parties: PartyRef[] = rows.map((r: any) =>
      r.sub_dealer_id
        ? { type: "sub_dealer", id: r.sub_dealer_id }
        : r.distributor_id
        ? { type: "distributor", id: r.distributor_id }
        : { type: "warehouse", warehouseName: r.warehouse_name }
    );
    const regionMap = await buildPartyRegionMap(supabase, parties);
    rows = rows.filter((_r: any, idx: number) => regionsMatch(regionForParty(regionMap, parties[idx]), callerRegion));
  }

  return {
    thisMonth: rows.filter((r: any) => r.sold_out_at >= windows.startOfThisMonth).length,
    lastMonth: rows.filter((r: any) => r.sold_out_at < windows.startOfThisMonth).length,
    thisWeek: rows.filter((r: any) => r.sold_out_at >= windows.startOfWeek).length,
  };
}

async function computeLedgerWeeklyCount(supabase: any, type: "ST1" | "ST2", permissionKey: string, opts: CallerOpts | undefined, windows: MonthWindows) {
  const { scope, callerId, callerRegion, granted } = await getMyScopeAction(permissionKey, opts);
  if (!granted) return null;

  let query = supabase
    .from("sales")
    .select("created_at, source_type, source_id, destination_type, destination_id")
    .eq("type", type)
    .gte("created_at", windows.startOfWeek);

  if (scope === "self" && callerId) {
    query = query.or(`source_id.eq.${callerId},destination_id.eq.${callerId}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  let rows = data || [];

  if (scope === "region" && callerRegion) {
    const parties: PartyRef[] = rows.flatMap((r: any) => [
      { type: r.source_type, id: r.source_id },
      { type: r.destination_type, id: r.destination_id },
    ]);
    const regionMap = await buildPartyRegionMap(supabase, parties);
    rows = rows.filter((r: any) =>
      regionsMatch(regionForParty(regionMap, { type: r.source_type, id: r.source_id }), callerRegion) ||
      regionsMatch(regionForParty(regionMap, { type: r.destination_type, id: r.destination_id }), callerRegion)
    );
  }

  return { thisWeek: rows.length };
}

// Home's stat tiles (§ theme-enhancement follow-up, "Sell Out trend" +
// "this week" activity). No single PERMISSION_CATALOG key covers this - it
// spans three independent modules - so each module is checked against its
// own mobile_granted independently, same posture as announcements/
// notifications: a caller without a given module's grant just gets `null`
// back for that module, and the Home screen skips rendering that card.
export async function fetchMobileHomeStatsAction(opts?: CallerOpts) {
  const supabase = getAdminClient();
  try {
    const windows = computeWindows();
    const [sellOut, st1, st2] = await Promise.all([
      computeSellOutStats(supabase, opts, windows),
      computeLedgerWeeklyCount(supabase, "ST1", "sales.st1", opts, windows),
      computeLedgerWeeklyCount(supabase, "ST2", "sales.st2", opts, windows),
    ]);
    return { success: true, sellOut, st1, st2 };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load home stats" };
  }
}

// Profile's "my activity this month" row - always the caller's own identity
// (distributor_id/sub_dealer_id or source_id/destination_id = caller.id),
// regardless of their granted scope level. An "everything"-scoped admin
// still only sees their own personal submissions here, never the org total -
// that's what fetchMobileHomeStatsAction is for. Still gated per-module by
// mobile_granted, same as above - no personal number for a module the
// caller has no access to at all.
export async function fetchMobileMyActivityAction(opts?: CallerOpts) {
  const supabase = getAdminClient();
  try {
    const caller = await getCallerIdentity(opts?.accessToken);
    if (!caller) return { success: false, error: "Not authenticated" };

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [sellOutScope, st1Scope, st2Scope] = await Promise.all([
      getMyScopeAction("sales.sellout", opts),
      getMyScopeAction("sales.st1", opts),
      getMyScopeAction("sales.st2", opts),
    ]);

    let sellOut: number | null = null;
    if (sellOutScope.granted) {
      const { count } = await supabase
        .from("stock")
        .select("id", { count: "exact", head: true })
        .eq("status", "sold_out")
        .gte("sold_out_at", startOfThisMonth)
        .or(`distributor_id.eq.${caller.id},sub_dealer_id.eq.${caller.id}`);
      sellOut = count || 0;
    }

    let st1: number | null = null;
    if (st1Scope.granted) {
      const { count } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("type", "ST1")
        .gte("created_at", startOfThisMonth)
        .or(`source_id.eq.${caller.id},destination_id.eq.${caller.id}`);
      st1 = count || 0;
    }

    let st2: number | null = null;
    if (st2Scope.granted) {
      const { count } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("type", "ST2")
        .gte("created_at", startOfThisMonth)
        .or(`source_id.eq.${caller.id},destination_id.eq.${caller.id}`);
      st2 = count || 0;
    }

    return { success: true, sellOut, st1, st2 };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load activity" };
  }
}
