"use server";

import { createClient as createJSClient } from "@supabase/supabase-js";
import { getCallerIdentity } from "@/app/actions/users";
import { getMyPermissionKeysAction } from "@/app/actions/roles";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createJSClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// SN Lookup is a plain grant/no-grant permission (no self/region/everything
// filter, per the client's decision - it's only ever handed to roles who
// should see full traceability). No canWrite concept either - this feature
// has no write path at all, it's a read-only chain-of-custody view.
async function assertGranted() {
  const caller = await getCallerIdentity();
  if (!caller) return { ok: false as const, error: "Not authenticated" };

  const { role, keys } = await getMyPermissionKeysAction();
  if (role !== "admin" && !keys.includes("sn_lookup")) {
    return { ok: false as const, error: "You don't have access to SN Lookup" };
  }
  return { ok: true as const };
}

// Resolves parties (warehouse/distributor/sub_dealer/employee/etc./consumer)
// to human-readable names, given the loose source_type/source_id (or
// destination_type/destination_id) pairs each sales row carries. Batched -
// two queries total (one per name-bearing table) instead of one query per
// party per chain step, which used to run 2x the chain length in queries.
async function resolvePartyNames(
  supabase: any,
  parties: { type: string | null; id: string | null }[]
): Promise<Map<string, string>> {
  const warehouseIds = Array.from(new Set(parties.filter((p) => p.type === "warehouse" && p.id).map((p) => p.id!)));
  const profileIds = Array.from(
    new Set(parties.filter((p) => p.type && p.type !== "warehouse" && p.type !== "consumer" && p.id).map((p) => p.id!))
  );

  const nameById = new Map<string, string>();

  const [warehouseRes, profileRes] = await Promise.all([
    warehouseIds.length > 0
      ? supabase.from("warehouses").select("id, name").in("id", warehouseIds)
      : Promise.resolve({ data: [] }),
    profileIds.length > 0
      ? supabase.from("profiles").select("id, first_name, last_name").in("id", profileIds)
      : Promise.resolve({ data: [] }),
  ]);

  (warehouseRes.data || []).forEach((w: any) => nameById.set(w.id, w.name || "Unknown Warehouse"));
  (profileRes.data || []).forEach((p: any) => nameById.set(p.id, `${p.first_name} ${p.last_name || ""}`.trim()));

  return nameById;
}

function partyDisplayName(
  nameById: Map<string, string>,
  type: string | null,
  id: string | null,
  consumerName: string | null
): string {
  if (type === "consumer") return consumerName || "Consumer";
  if (!id) return type ? type.replace("_", " ") : "Unknown";
  return nameById.get(id) || "Unknown";
}

export async function fetchSnLookupAction(serialNo: string) {
  try {
    const gate = await assertGranted();
    if (!gate.ok) return { success: false, error: gate.error, found: false };

    const sn = (serialNo || "").trim();
    if (!sn) return { success: false, error: "Enter a serial number", found: false };

    const supabase = getAdminClient();

    const { data: stock, error: stockErr } = await supabase
      .from("stock")
      .select("*, products(name, brand, model)")
      .ilike("serial_no", sn)
      .maybeSingle();
    if (stockErr) throw stockErr;

    if (!stock) {
      return { success: true, found: false, stock: null, chain: [], installerJobs: [] };
    }

    // Full transaction chain: every ST-1/ST-2/Return/Transfer/Sell Out step
    // that ever moved this exact unit, oldest first.
    const { data: items } = await supabase
      .from("sale_items")
      .select("sale_id, sales(id, type, date, st_id, source_type, source_id, destination_type, destination_id, consumer_name, consumer_phone, site_address)")
      .eq("stock_id", stock.id);

    const salesRows = (items || []).map((i: any) => i.sales).filter(Boolean);
    salesRows.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const partiesToResolve = salesRows.flatMap((s: any) => [
      { type: s.source_type, id: s.source_id },
      { type: s.destination_type, id: s.destination_id },
    ]);
    const nameById = await resolvePartyNames(supabase, partiesToResolve);

    const chain = salesRows.map((s: any) => ({
      id: s.id,
      type: s.type,
      date: s.date,
      stId: s.st_id,
      from: partyDisplayName(nameById, s.source_type, s.source_id, s.consumer_name),
      to: partyDisplayName(nameById, s.destination_type, s.destination_id, s.consumer_name),
      consumerPhone: s.destination_type === "consumer" ? s.consumer_phone : null,
      siteAddress: s.destination_type === "consumer" ? s.site_address : null,
    }));

    // Every installer job submission tied to this SN - approved, rejected, or
    // pending, including resubmissions - not just whichever one is "current".
    const { data: jobs } = await supabase
      .from("installer_jobs")
      .select(`
        id, status, created_at, remarks, is_resubmitted,
        verified_at, verification_note,
        approved_at, approval_note,
        installer:profiles!installer_id(first_name, last_name),
        verifier:profiles!verified_by(first_name, last_name),
        approver:profiles!approved_by(first_name, last_name)
      `)
      .ilike("serial_number", sn)
      .order("created_at", { ascending: true });

    const installerJobs = (jobs || []).map((j: any) => ({
      id: j.id,
      status: j.status,
      createdAt: j.created_at,
      remarks: j.remarks,
      isResubmitted: j.is_resubmitted,
      installerName: j.installer ? `${j.installer.first_name} ${j.installer.last_name || ""}`.trim() : "Unknown",
      verifiedAt: j.verified_at,
      verificationNote: j.verification_note,
      verifierName: j.verifier ? `${j.verifier.first_name} ${j.verifier.last_name || ""}`.trim() : null,
      approvedAt: j.approved_at,
      approvalNote: j.approval_note,
      approverName: j.approver ? `${j.approver.first_name} ${j.approver.last_name || ""}`.trim() : null,
    }));

    return {
      success: true,
      found: true,
      stock: {
        serialNo: stock.serial_no,
        productName: stock.products?.name || "Unknown Product",
        brand: stock.products?.brand || "-",
        model: stock.products?.model || stock.model_no || "-",
        warehouseName: stock.warehouse_name,
        importDate: stock.import_date,
        status: stock.status,
        soldOutAt: stock.sold_out_at,
      },
      chain,
      installerJobs,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to look up serial number", found: false };
  }
}
