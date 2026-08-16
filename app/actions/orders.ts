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

// Buzzcart order approval chain: pending -> approved/declined (country head or
// admin) -> invoice_generated (admin only) -> delivered (admin only). The modal
// that calls these hides the buttons per role client-side, but that's not a
// security boundary on its own - every transition here independently
// re-verifies the caller's real role server-side, same pattern as the
// installer two-stage approval and ST2's distributor self-scoping.

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
