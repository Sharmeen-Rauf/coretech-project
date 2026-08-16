"use server";

import { createClient as createJSClient } from "@supabase/supabase-js";
import { getCallerIdentity } from "@/app/actions/users";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createJSClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ST2 moves stock from a distributor's own holdings to one of their assigned sub
// dealers. A distributor calling this for themselves is expected (and the whole
// point of giving them ST2 access) - but they must never be able to submit an
// ST2 against a DIFFERENT distributor's inventory. Hiding the picker client-side
// isn't enough, since this action can be called directly - so the caller's own
// identity is the real boundary here, re-checked server-side every time.
export async function submitSt2Action(params: {
  distributorId: string;
  subDealerId: string;
  passedItems: { serial_no: string; product_id: string }[];
  date: string;
  stId: string;
}) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) {
      return { success: false, error: "Not authenticated" };
    }
    if (caller.role === "distributor" && caller.id !== params.distributorId) {
      return { success: false, error: "You can only create ST2 transfers for your own distributor account" };
    }

    if (!params.distributorId || !params.subDealerId) {
      return { success: false, error: "Distributor and Sub Dealer are required" };
    }
    if (!params.passedItems || params.passedItems.length === 0) {
      return { success: false, error: "No passed serial numbers to submit" };
    }

    const supabase = getAdminClient();

    // Re-verify the distributor is real.
    const { data: distributor } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", params.distributorId)
      .maybeSingle();
    if (!distributor || distributor.role !== "distributor") {
      return { success: false, error: "Selected distributor is invalid" };
    }

    // Re-verify the sub dealer is real AND actually assigned to this distributor -
    // never trust the client-side dropdown filtering alone.
    const { data: subDealer } = await supabase
      .from("profiles")
      .select("id, role, distributor_id")
      .eq("id", params.subDealerId)
      .maybeSingle();
    if (!subDealer || subDealer.role !== "sub_dealer" || subDealer.distributor_id !== params.distributorId) {
      return { success: false, error: "Selected sub dealer is not assigned to this distributor" };
    }

    const serials = params.passedItems.map((i) => i.serial_no);

    // Re-scope and transfer ownership - guards against a serial being claimed by
    // another order between "Check" and "Submit". If this doesn't fully succeed,
    // no ledger entry is created, so a transfer never gets recorded as having
    // happened when it didn't.
    const { data: transferred, error: transferErr } = await supabase
      .from("stock")
      .update({ sub_dealer_id: params.subDealerId })
      .in("serial_no", serials)
      .eq("distributor_id", params.distributorId)
      .is("sub_dealer_id", null)
      .neq("status", "sold_out")
      .select("id, product_id, serial_no");

    if (transferErr) throw transferErr;
    if (!transferred || transferred.length !== serials.length) {
      return {
        success: false,
        error: `Only ${transferred?.length || 0} of ${serials.length} units could be transferred — some may have already been claimed by another order. Please re-check serials and try again.`,
      };
    }

    const { data: saleRow, error: saleErr } = await supabase
      .from("sales")
      .insert({
        type: "ST2",
        source_type: "distributor",
        source_id: params.distributorId,
        destination_type: "sub_dealer",
        destination_id: params.subDealerId,
        st_id: params.stId,
        date: params.date,
      })
      .select("id")
      .single();

    if (saleErr) throw saleErr;

    const itemRows = transferred.map((t: any) => ({
      sale_id: saleRow.id,
      stock_id: t.id,
      product_id: t.product_id,
    }));
    const { error: itemsErr } = await supabase.from("sale_items").insert(itemRows);
    if (itemsErr) throw itemsErr;

    try {
      await supabase.from("activity_logs").insert({
        action: "Create ST2 Ledger",
        details: `ST2 transaction ID "${params.stId}" transferred ${transferred.length} units from distributor to sub dealer.`,
      });
    } catch {
      // Non-critical, safe to ignore.
    }

    return { success: true, message: "ST2 transaction successfully created", data: saleRow };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit ST2 transaction" };
  }
}

// Fetches the sub dealers assigned to a given distributor (via profiles.distributor_id,
// set through the Dealer Assignment feature) - used to populate ST2's Sub Dealer dropdown.
export async function fetchAssignedSubDealersAction(distributorId: string) {
  if (!distributorId) return { success: true, data: [] };
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("role", "sub_dealer")
      .eq("distributor_id", distributorId)
      .order("first_name", { ascending: true });
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch assigned sub dealers", data: [] };
  }
}

// Return moves stock back up the chain (sub dealer -> distributor, or distributor
// -> warehouse). The source/destination pair is resolved client-side from where
// each serial currently lives (there's no picker to trust), but it's fully
// re-derived and re-verified here too, since a distributor or sub dealer caller
// must only ever be able to return stock that's currently their own.
export async function submitReturnAction(params: {
  sourceType: "distributor" | "sub_dealer";
  sourceId: string;
  destType: "distributor" | "warehouse";
  destId: string;
  passedItems: { serial_no: string; product_id: string }[];
  date: string;
  stId: string;
}) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    if (caller.role === "distributor" && !(params.sourceType === "distributor" && params.sourceId === caller.id)) {
      return { success: false, error: "You can only return stock that's currently your own" };
    }
    if (caller.role === "sub_dealer" && !(params.sourceType === "sub_dealer" && params.sourceId === caller.id)) {
      return { success: false, error: "You can only return stock that's currently your own" };
    }

    if (!params.sourceId || !params.destId) {
      return { success: false, error: "Source and destination could not be resolved" };
    }
    if (!params.passedItems || params.passedItems.length === 0) {
      return { success: false, error: "No passed serial numbers to submit" };
    }

    const supabase = getAdminClient();

    if (params.sourceType === "sub_dealer") {
      const { data: subDealer } = await supabase
        .from("profiles")
        .select("id, role, distributor_id")
        .eq("id", params.sourceId)
        .maybeSingle();
      if (!subDealer || subDealer.role !== "sub_dealer" || subDealer.distributor_id !== params.destId) {
        return { success: false, error: "Resolved sub dealer / distributor relationship is invalid" };
      }
    } else {
      const { data: distributor } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", params.sourceId)
        .maybeSingle();
      if (!distributor || distributor.role !== "distributor") {
        return { success: false, error: "Resolved distributor is invalid" };
      }
      const { data: warehouse } = await supabase
        .from("warehouses")
        .select("id")
        .eq("id", params.destId)
        .maybeSingle();
      if (!warehouse) {
        return { success: false, error: "Resolved warehouse is invalid" };
      }
    }

    const serials = params.passedItems.map((i) => i.serial_no);

    let transferred: any[] | null = null;
    let transferErr: any = null;
    if (params.sourceType === "sub_dealer") {
      const res = await supabase
        .from("stock")
        .update({ sub_dealer_id: null })
        .in("serial_no", serials)
        .eq("sub_dealer_id", params.sourceId)
        .eq("distributor_id", params.destId)
        .neq("status", "sold_out")
        .select("id, product_id, serial_no");
      transferred = res.data;
      transferErr = res.error;
    } else {
      const res = await supabase
        .from("stock")
        .update({ distributor_id: null })
        .in("serial_no", serials)
        .eq("distributor_id", params.sourceId)
        .is("sub_dealer_id", null)
        .neq("status", "sold_out")
        .select("id, product_id, serial_no");
      transferred = res.data;
      transferErr = res.error;
    }

    if (transferErr) throw transferErr;
    if (!transferred || transferred.length !== serials.length) {
      return {
        success: false,
        error: `Only ${transferred?.length || 0} of ${serials.length} units could be returned — some may have already moved. Please re-check serials and try again.`,
      };
    }

    const { data: saleRow, error: saleErr } = await supabase
      .from("sales")
      .insert({
        type: "return",
        source_type: params.sourceType,
        source_id: params.sourceId,
        destination_type: params.destType,
        destination_id: params.destId,
        st_id: params.stId,
        date: params.date,
      })
      .select("id")
      .single();
    if (saleErr) throw saleErr;

    const itemRows = transferred.map((t: any) => ({ sale_id: saleRow.id, stock_id: t.id, product_id: t.product_id }));
    const { error: itemsErr } = await supabase.from("sale_items").insert(itemRows);
    if (itemsErr) throw itemsErr;

    try {
      await supabase.from("activity_logs").insert({
        action: "Create Return Ledger",
        details: `Return transaction ID "${params.stId}" moved ${transferred.length} units from ${params.sourceType} back to ${params.destType}.`,
      });
    } catch {
      // Non-critical.
    }

    return { success: true, message: "Return transaction successfully created", data: saleRow };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit return transaction" };
  }
}

// Transfer moves stock laterally between two entities of the same type (warehouse
// <-> warehouse, distributor <-> distributor, or sub dealer <-> sub dealer). A
// distributor or sub dealer caller must only ever be able to transfer stock that's
// currently their own - so when the transfer type matches the caller's own role,
// the "from" side is locked server-side to their identity, same as Return/ST2.
export async function submitTransferAction(params: {
  transferType: "warehouse" | "distributor" | "sub_dealer";
  fromId: string;
  toId: string;
  passedItems: { serial_no: string; product_id: string }[];
  date: string;
  stId: string;
}) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    if (caller.role === "distributor" && params.transferType === "distributor" && params.fromId !== caller.id) {
      return { success: false, error: "You can only transfer stock that's currently your own" };
    }
    if (caller.role === "sub_dealer" && params.transferType === "sub_dealer" && params.fromId !== caller.id) {
      return { success: false, error: "You can only transfer stock that's currently your own" };
    }

    if (!params.fromId || !params.toId) {
      return { success: false, error: "Transfer From and Transfer To are required" };
    }
    if (params.fromId === params.toId) {
      return { success: false, error: "Transfer From and Transfer To must be different" };
    }
    if (!params.passedItems || params.passedItems.length === 0) {
      return { success: false, error: "No passed serial numbers to submit" };
    }

    const supabase = getAdminClient();
    const serials = params.passedItems.map((i) => i.serial_no);

    let transferred: any[] | null = null;
    let transferErr: any = null;

    if (params.transferType === "distributor") {
      const { data: fromProfile } = await supabase.from("profiles").select("id, role").eq("id", params.fromId).maybeSingle();
      const { data: toProfile } = await supabase.from("profiles").select("id, role").eq("id", params.toId).maybeSingle();
      if (!fromProfile || fromProfile.role !== "distributor" || !toProfile || toProfile.role !== "distributor") {
        return { success: false, error: "Both distributors must be valid" };
      }
      const res = await supabase
        .from("stock")
        .update({ distributor_id: params.toId })
        .in("serial_no", serials)
        .eq("distributor_id", params.fromId)
        .is("sub_dealer_id", null)
        .neq("status", "sold_out")
        .select("id, product_id, serial_no");
      transferred = res.data;
      transferErr = res.error;
    } else if (params.transferType === "sub_dealer") {
      const { data: fromProfile } = await supabase.from("profiles").select("id, role").eq("id", params.fromId).maybeSingle();
      const { data: toProfile } = await supabase.from("profiles").select("id, role").eq("id", params.toId).maybeSingle();
      if (!fromProfile || fromProfile.role !== "sub_dealer" || !toProfile || toProfile.role !== "sub_dealer") {
        return { success: false, error: "Both sub dealers must be valid" };
      }
      const res = await supabase
        .from("stock")
        .update({ sub_dealer_id: params.toId })
        .in("serial_no", serials)
        .eq("sub_dealer_id", params.fromId)
        .neq("status", "sold_out")
        .select("id, product_id, serial_no");
      transferred = res.data;
      transferErr = res.error;
    } else {
      const { data: fromWh } = await supabase.from("warehouses").select("id, name").eq("id", params.fromId).maybeSingle();
      const { data: toWh } = await supabase.from("warehouses").select("id, name").eq("id", params.toId).maybeSingle();
      if (!fromWh || !toWh) {
        return { success: false, error: "Both warehouses must be valid" };
      }
      const res = await supabase
        .from("stock")
        .update({ warehouse_name: toWh.name })
        .in("serial_no", serials)
        .eq("warehouse_name", fromWh.name)
        .is("distributor_id", null)
        .neq("status", "sold_out")
        .select("id, product_id, serial_no");
      transferred = res.data;
      transferErr = res.error;
    }

    if (transferErr) throw transferErr;
    if (!transferred || transferred.length !== serials.length) {
      return {
        success: false,
        error: `Only ${transferred?.length || 0} of ${serials.length} units could be transferred — some may have already moved. Please re-check serials and try again.`,
      };
    }

    const { data: saleRow, error: saleErr } = await supabase
      .from("sales")
      .insert({
        type: "transfer",
        source_type: params.transferType,
        source_id: params.fromId,
        destination_type: params.transferType,
        destination_id: params.toId,
        st_id: params.stId,
        date: params.date,
      })
      .select("id")
      .single();
    if (saleErr) throw saleErr;

    const itemRows = transferred.map((t: any) => ({ sale_id: saleRow.id, stock_id: t.id, product_id: t.product_id }));
    const { error: itemsErr } = await supabase.from("sale_items").insert(itemRows);
    if (itemsErr) throw itemsErr;

    try {
      await supabase.from("activity_logs").insert({
        action: "Create Transfer Ledger",
        details: `Transfer transaction ID "${params.stId}" moved ${transferred.length} units between ${params.transferType}s.`,
      });
    } catch {
      // Non-critical.
    }

    return { success: true, message: "Transfer transaction successfully created", data: saleRow };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit transfer transaction" };
  }
}

// Manual Sell Out - a single unit sold directly to a walk-in consumer, with no
// installer job involved. Re-verifies the serial isn't already sold out and, for
// a distributor/sub dealer caller, that the unit is currently theirs to sell.
export async function submitManualSelloutAction(params: {
  serialNo: string;
  date: string;
  consumerName: string;
  consumerPhone: string;
  siteAddress?: string;
  stId: string;
}) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    if (!params.serialNo?.trim()) return { success: false, error: "Serial number is required" };
    if (!params.consumerName?.trim()) return { success: false, error: "Consumer name is required" };
    if (!params.consumerPhone?.trim()) return { success: false, error: "Consumer phone is required" };

    const supabase = getAdminClient();

    const { data: stockRow } = await supabase
      .from("stock")
      .select("id, product_id, status, warehouse_name, distributor_id, sub_dealer_id")
      .ilike("serial_no", params.serialNo.trim())
      .maybeSingle();

    if (!stockRow) return { success: false, error: "Serial number not found" };
    if (stockRow.status === "sold_out") return { success: false, error: "This serial number is already sold out" };

    if (caller.role === "distributor" && !(stockRow.distributor_id === caller.id && !stockRow.sub_dealer_id)) {
      return { success: false, error: "This unit isn't currently in your inventory" };
    }
    if (caller.role === "sub_dealer" && stockRow.sub_dealer_id !== caller.id) {
      return { success: false, error: "This unit isn't currently in your inventory" };
    }

    let sourceType: "warehouse" | "distributor" | "sub_dealer" = "warehouse";
    let sourceId: string | null = null;
    if (stockRow.sub_dealer_id) {
      sourceType = "sub_dealer";
      sourceId = stockRow.sub_dealer_id;
    } else if (stockRow.distributor_id) {
      sourceType = "distributor";
      sourceId = stockRow.distributor_id;
    } else {
      const { data: wh } = await supabase.from("warehouses").select("id").eq("name", stockRow.warehouse_name).maybeSingle();
      sourceId = wh?.id || null;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("stock")
      .update({ status: "sold_out", sold_out_at: new Date().toISOString() })
      .eq("id", stockRow.id)
      .neq("status", "sold_out")
      .select("id, product_id")
      .maybeSingle();

    if (updateErr) throw updateErr;
    if (!updated) {
      return { success: false, error: "This serial number was just sold out by another action — please refresh and try again" };
    }

    const { data: saleRow, error: saleErr } = await supabase
      .from("sales")
      .insert({
        type: "sellout",
        source_type: sourceType,
        source_id: sourceId,
        destination_type: "consumer",
        destination_id: null,
        consumer_name: params.consumerName.trim(),
        consumer_phone: params.consumerPhone.trim(),
        site_address: params.siteAddress?.trim() || null,
        st_id: params.stId,
        date: params.date,
      })
      .select("id")
      .single();
    if (saleErr) throw saleErr;

    const { error: itemErr } = await supabase.from("sale_items").insert({
      sale_id: saleRow.id,
      stock_id: updated.id,
      product_id: updated.product_id,
    });
    if (itemErr) throw itemErr;

    try {
      await supabase.from("activity_logs").insert({
        action: "Manual Sell Out",
        details: `Serial "${params.serialNo}" manually sold out to consumer "${params.consumerName}".`,
      });
    } catch {
      // Non-critical.
    }

    return { success: true, message: "Sell out recorded successfully", data: saleRow };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record sell out" };
  }
}
