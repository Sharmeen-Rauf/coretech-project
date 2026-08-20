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

// Stage 2 (Role Management): the order ledger used to be fetched client-side with
// the anon key, trusting a client-resolved role to build the filter - meaning the
// only real barrier against seeing every order was a fully permissive RLS policy
// plus JS conditionals a browser devtools session could simply skip. Moved to a
// real server action using the admin client + server-verified caller identity,
// matching every other scoped fetch in this codebase (fetchStockAction,
// fetchSellOutAction). Scope comes from role_permissions.scope_level for
// "buzzcart", not a hardcoded role check - "self" still means a different
// ownership field per role (distributor/sub_dealer/employee each own a different
// column), and "region" faithfully reproduces the RSM's existing real behavior
// (their own coordinated orders OR any order tied to a distributor in their
// region) rather than a pure region filter, to avoid narrowing what an RSM could
// already see before this change.
export async function fetchOrdersAction() {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated", data: [], role: null };

    const supabase = getAdminClient();
    const { scope, callerId, callerRegion, canWrite } = await getMyScopeAction("buzzcart");

    let query = supabase.from("orders").select(`
        id,
        order_code,
        created_at,
        status,
        user_id,
        distributor_id,
        sales_coordinator_id,
        user:profiles!user_id(first_name, last_name, region),
        product:products(name),
        distributor:profiles!distributor_id(first_name, last_name, region),
        coordinator:profiles!sales_coordinator_id(first_name, last_name)
      `);

    if (scope === "self" && callerId) {
      if (caller.role === "distributor") {
        query = query.eq("distributor_id", callerId);
      } else if (caller.role === "sub_dealer") {
        query = query.eq("user_id", callerId);
      } else if (caller.role === "employee") {
        query = query.eq("sales_coordinator_id", callerId);
      } else {
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    } else if (scope === "region" && callerId) {
      query = query.or(`sales_coordinator_id.eq.${callerId},distributor.region.ilike.%${callerRegion || ""}%`);
    }
    // scope === "everything": no filter.

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return { success: true, data: data || [], role: caller.role, canWrite };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch orders", data: [], role: null, canWrite: false };
  }
}

// Buzzcart order approval chain: pending -> approved/declined (country head or
// admin) -> invoice_generated (admin only) -> delivered (admin only). The modal
// that calls these hides the buttons per role client-side, but that's not a
// security boundary on its own - every transition here independently
// re-verifies the caller's real role server-side, same pattern as the
// installer two-stage approval and ST2's distributor self-scoping.

// Stage 3 (Role Management): order creation was previously a raw client-side
// insert (same gap already found and fixed on reads) - worse, it also let the
// client dictate identity-sensitive fields like distributor_id/sales_coordinator_id
// directly. Moved to a real server action: caller identity is re-derived
// server-side via getCallerIdentity() rather than trusted from the client, so a
// distributor caller can never be attributed to someone else's account and a
// non-admin caller can never get a different employee credited as coordinator
// (mirrors the existing "Phase 2 only admin gets free choice" rule and the
// self-scoping pattern already used by ST2/Return/Transfer). Only genuinely
// non-identity selections (which distributor/sub-dealer/employee/products this
// order is FOR) are trusted as client input, gated by role_permissions.can_write
// for "buzzcart".
export async function createBuzzcartOrderAction(params: {
  buyerType: "distributor" | "sub_dealer";
  selectedDistributorId?: string | null;
  selectedSubDealerId?: string | null;
  selectedEmployeeId?: string | null; // only honored if caller is admin
  items: Array<{ productId: string; productName: string; quantity: number; price: number }>;
}) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    const { canWrite } = await getMyScopeAction("buzzcart");
    if (!canWrite) return { success: false, error: "You have read-only access to Buzzcart" };

    if (!params.items || params.items.length === 0) {
      return { success: false, error: "Please add at least one product with quantity > 0" };
    }

    const supabase = getAdminClient();
    const isDist = caller.role === "distributor";
    const isGeneralSubDealer = !isDist && params.buyerType === "sub_dealer";

    if (isDist) {
      if (!params.selectedSubDealerId) return { success: false, error: "Please select a Sub Dealer" };
    } else if (isGeneralSubDealer) {
      if (!params.selectedSubDealerId) return { success: false, error: "Please select a Sub Dealer" };
    } else {
      if (!params.selectedDistributorId) return { success: false, error: "Please select a Distributor" };
    }

    let distributorId: string | null = null;
    let userId: string | null = null;
    let salesCoordinatorId: string | null = null;

    if (isDist) {
      distributorId = caller.id; // never trust the client for this - caller IS the distributor
      userId = params.selectedSubDealerId || null;
      const { data: subDealer } = await supabase.from("profiles").select("rsm_id").eq("id", userId).maybeSingle();
      salesCoordinatorId = subDealer?.rsm_id || null;
    } else if (isGeneralSubDealer) {
      const { data: subDealer } = await supabase.from("profiles").select("distributor_id").eq("id", params.selectedSubDealerId).maybeSingle();
      distributorId = subDealer?.distributor_id || null;
      userId = params.selectedSubDealerId || null;
      salesCoordinatorId = caller.role === "admin" ? (params.selectedEmployeeId || null) : caller.id;
    } else {
      distributorId = params.selectedDistributorId || null;
      userId = caller.id;
      salesCoordinatorId = caller.role === "admin" ? (params.selectedEmployeeId || null) : caller.id;
    }

    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const orderCode = `#CM${randomDigits}`;

    const { data: insertedOrder, error } = await supabase
      .from("orders")
      .insert({
        order_code: orderCode,
        user_id: userId,
        product_id: params.items[0].productId,
        distributor_id: distributorId,
        sales_coordinator_id: salesCoordinatorId,
        status: "pending",
        items: params.items,
      })
      .select(`
        id, order_code, status, created_at, items, product_id, user_id, distributor_id,
        user:profiles!user_id(id, first_name, last_name, contact),
        product:products(*),
        distributor:profiles!distributor_id(id, first_name, last_name, contact),
        coordinator:profiles!sales_coordinator_id(id, first_name, last_name, contact)
      `)
      .single();
    if (error) throw error;

    try {
      const totalAmount = params.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      await supabase.from("activity_logs").insert({
        action: "Create Buzzcart Order",
        details: `Order ${orderCode} created. Total PKR ${totalAmount.toLocaleString()}`,
      });
    } catch {
      // Non-critical.
    }

    return { success: true, data: insertedOrder };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create order" };
  }
}

export async function approveOrderAction(orderId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || !["country_head", "admin"].includes(caller.role || "")) {
      return { success: false, error: "Only Country Head or Admin can approve this order" };
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: caller.id })
      .eq("id", orderId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return { success: false, error: "This order is no longer pending - it may have already been actioned." };

    try {
      await supabase.from("activity_logs").insert({ action: "Order Approved", details: `Order ${orderId} approved.` });
    } catch {
      // Non-critical.
    }

    return { success: true, message: "Order approved" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to approve order" };
  }
}

export async function declineOrderAction(orderId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || !["country_head", "admin"].includes(caller.role || "")) {
      return { success: false, error: "Only Country Head or Admin can decline this order" };
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "declined", declined_at: new Date().toISOString(), declined_by: caller.id })
      .eq("id", orderId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return { success: false, error: "This order is no longer pending - it may have already been actioned." };

    try {
      await supabase.from("activity_logs").insert({ action: "Order Declined", details: `Order ${orderId} declined.` });
    } catch {
      // Non-critical.
    }

    return { success: true, message: "Order declined" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to decline order" };
  }
}

// Invoicing happens in a separate system outside this app - this just records
// that the admin has generated it there and moves the order to the next stage.
// No invoice record is created here.
export async function markInvoiceGeneratedAction(orderId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || caller.role !== "admin") {
      return { success: false, error: "Only Admin can mark the invoice as generated" };
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "invoice_generated", invoice_created_at: new Date().toISOString(), invoice_created_by: caller.id })
      .eq("id", orderId)
      .eq("status", "approved")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return { success: false, error: "This order isn't in an approved state." };

    try {
      await supabase.from("activity_logs").insert({ action: "Invoice Marked Generated", details: `Order ${orderId} invoice marked generated.` });
    } catch {
      // Non-critical.
    }

    return { success: true, message: "Invoice marked as generated" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update order" };
  }
}

// Gate pass likewise happens in a separate system - this just records that the
// admin has issued it there and moves the order to its final stage.
export async function markGatePassGeneratedAction(orderId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || caller.role !== "admin") {
      return { success: false, error: "Only Admin can mark the gate pass as generated" };
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "delivered", gate_pass_created_at: new Date().toISOString(), gate_pass_created_by: caller.id })
      .eq("id", orderId)
      .eq("status", "invoice_generated")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return { success: false, error: "This order isn't in an invoiced state." };

    try {
      await supabase.from("activity_logs").insert({ action: "Gate Pass Marked Generated", details: `Order ${orderId} gate pass marked generated.` });
    } catch {
      // Non-critical.
    }

    return { success: true, message: "Gate pass marked as generated" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update order" };
  }
}

// Lets the admin step a stage back if the invoice/gate pass turns out not to
// have actually been generated yet - same role requirement as the forward step.
export async function revertOrderStageAction(orderId: string, toStatus: "pending" | "approved") {
  try {
    const caller = await getCallerIdentity();
    if (!caller || caller.role !== "admin") {
      return { success: false, error: "Only Admin can revert this order's stage" };
    }

    const supabase = getAdminClient();
    const fromStatus = toStatus === "pending" ? "approved" : "invoice_generated";
    const { data, error } = await supabase
      .from("orders")
      .update({ status: toStatus })
      .eq("id", orderId)
      .eq("status", fromStatus)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return { success: false, error: "This order is not in the expected stage." };

    return { success: true, message: "Order stage reverted" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to revert order stage" };
  }
}

// Deleting an order was previously routed through the generic, unauthenticated
// deleteRecordAction (app/actions/users.ts) - no caller check at all, and the
// Delete button itself wasn't even gated on write access, so any Buzzcart
// viewer (including read-only) could see and successfully use it. Client
// wants this admin-only specifically, not just "has write access" like the
// rest of Buzzcart - a real, stricter rule than can_write.
export async function deleteOrderAction(orderId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || caller.role !== "admin") {
      return { success: false, error: "Only Admin can delete orders" };
    }

    const supabase = getAdminClient();
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) throw error;

    return { success: true, message: "Order deleted successfully" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete order" };
  }
}
