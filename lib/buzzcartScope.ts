import { createClient as createJSClient } from "@supabase/supabase-js";
import { getMyScopeAction, type CallerOpts } from "@/app/actions/roles";
import { regionsMatch } from "@/lib/regionScope";

// Who a caller may create a Buzzcart order for - the single rule shared by the
// web create form, both mobile Buzzcart routes, and the server-side re-check in
// createBuzzcartOrderAction, so the picker and the submit can't disagree. It
// follows the caller's Role Management "buzzcart" scope, for any role (no
// RSM-only special case):
//   everything -> every distributor and sub dealer
//   region     -> only those whose region is the caller's own region
//   self       -> nobody
// Admin is always "everything" (getMyScopeAction). opts.surface picks the web
// or mobile scope column - server code sets it, never a browser.
//
// Server-only: uses the service-role key. Import it from server actions and
// API routes, never from a client component.

export interface BuzzcartParty {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  region: string | null;
  warehouse: string | null;
  rsm_id: string | null;
  distributor_id: string | null;
}

export interface BuzzcartRecipients {
  scope: "self" | "region" | "everything";
  distributors: BuzzcartParty[];
  subDealers: BuzzcartParty[];
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createJSClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Some older distributor rows keep warehouse/RSM inside a
// "[DISTRIBUTOR_METADATA]{...}" blob in `designation` instead of the real
// columns - same display fallback the web create form has always applied.
// Region is deliberately NOT taken from the blob: region scope matches on
// profiles.region only.
function toParty(p: any): BuzzcartParty {
  let warehouse = p.warehouse || null;
  let rsmId = p.rsm_id || null;
  if ((!warehouse || !rsmId) && typeof p.designation === "string" && p.designation.includes("DISTRIBUTOR_METADATA")) {
    try {
      const meta = JSON.parse(p.designation.replace("[DISTRIBUTOR_METADATA]", ""));
      if (!warehouse) warehouse = meta.warehouse || null;
      if (!rsmId) rsmId = meta.rsmId || meta.rsm_id || null;
    } catch {
      // Not valid JSON - keep whatever the real columns had.
    }
  }
  return {
    id: p.id,
    first_name: p.first_name || "",
    last_name: p.last_name || "",
    role: p.role,
    region: p.region || null,
    warehouse,
    rsm_id: rsmId,
    distributor_id: p.distributor_id || null,
  };
}

export async function getBuzzcartRecipients(opts?: CallerOpts): Promise<BuzzcartRecipients> {
  const { scope, callerRegion, granted } = await getMyScopeAction("buzzcart", opts);
  if (!granted || scope === "self") return { scope, distributors: [], subDealers: [] };
  if (scope === "region" && !callerRegion) return { scope, distributors: [], subDealers: [] };

  const supabase = getAdminClient();
  // Chunked past 1000 rows - PostgREST silently caps an unlimited read there.
  const PAGE_SIZE = 1000;
  let rows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["distributor", "sub_dealer"])
      .order("first_name", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows = rows.concat(page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  let parties = rows.map(toParty);
  if (scope === "region") {
    parties = parties.filter((p) => regionsMatch(p.region, callerRegion));
  }

  return {
    scope,
    distributors: parties.filter((p) => p.role === "distributor"),
    subDealers: parties.filter((p) => p.role === "sub_dealer"),
  };
}
