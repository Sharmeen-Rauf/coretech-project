"use server";

import { createClient as createJSClient } from "@supabase/supabase-js";
import { getMyScopeAction } from "@/app/actions/roles";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createJSClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function fetchWarehousesAction() {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase.from("warehouses").select("id, name, created_at").order("name");
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch warehouses", data: [] };
  }
}

// Warehouses are a real, standalone entity - this is the one place a genuinely
// new physical warehouse gets created. Region Management only ever picks from
// this list, it never creates a warehouse by typing a name, which is what
// caused a phantom duplicate region earlier.
export async function createWarehouseAction(name: string) {
  const clean = (name || "").trim();
  if (!clean) return { success: false, error: "Warehouse name is required" };
  try {
    const { canWrite } = await getMyScopeAction("purchase.warehouse");
    if (!canWrite) return { success: false, error: "You have read-only access to Warehouse" };

    const supabase = getAdminClient();
    const { data: existing } = await supabase.from("warehouses").select("id").ilike("name", clean).maybeSingle();
    if (existing) return { success: false, error: "A warehouse with this name already exists" };

    const { data, error } = await supabase.from("warehouses").insert({ name: clean }).select("id, name").single();
    if (error) throw error;
    return { success: true, message: "Warehouse registered successfully", data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create warehouse" };
  }
}

// Renaming a warehouse has to cascade to every place that still references it
// by name (regions.warehouse, stock.warehouse_name) - both predate warehouses
// having a real id, and nothing else in this schema can support a real FK to
// warehouses.id for those two columns without a larger migration.
export async function updateWarehouseAction(id: string, name: string) {
  const clean = (name || "").trim();
  if (!clean) return { success: false, error: "Warehouse name is required" };
  try {
    const { canWrite } = await getMyScopeAction("purchase.warehouse");
    if (!canWrite) return { success: false, error: "You have read-only access to Warehouse" };

    const supabase = getAdminClient();
    const { data: current } = await supabase.from("warehouses").select("id, name").eq("id", id).maybeSingle();
    if (!current) return { success: false, error: "Warehouse not found" };

    if (current.name === clean) {
      return { success: true, message: "No changes to save" };
    }

    const { data: existing } = await supabase.from("warehouses").select("id").ilike("name", clean).neq("id", id).maybeSingle();
    if (existing) return { success: false, error: "A warehouse with this name already exists" };

    const { error: whErr } = await supabase.from("warehouses").update({ name: clean }).eq("id", id);
    if (whErr) throw whErr;

    await supabase.from("regions").update({ warehouse: clean }).eq("warehouse", current.name);
    await supabase.from("stock").update({ warehouse_name: clean }).eq("warehouse_name", current.name);

    return { success: true, message: "Warehouse renamed successfully" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update warehouse" };
  }
}

// Blocks deletion while any region or stock still references this warehouse by
// name, rather than silently leaving them pointing at a name that no longer
// exists anywhere.
export async function deleteWarehouseAction(id: string) {
  try {
    const { canWrite } = await getMyScopeAction("purchase.warehouse");
    if (!canWrite) return { success: false, error: "You have read-only access to Warehouse" };

    const supabase = getAdminClient();
    const { data: wh } = await supabase.from("warehouses").select("id, name").eq("id", id).maybeSingle();
    if (!wh) return { success: false, error: "Warehouse not found" };

    const { count: regionCount } = await supabase.from("regions").select("id", { count: "exact", head: true }).eq("warehouse", wh.name);
    const { count: stockCount } = await supabase.from("stock").select("id", { count: "exact", head: true }).eq("warehouse_name", wh.name);

    if ((regionCount || 0) > 0 || (stockCount || 0) > 0) {
      return {
        success: false,
        error: `Can't delete "${wh.name}" — ${regionCount || 0} region(s) and ${stockCount || 0} stock item(s) still reference it. Reassign them to a different warehouse first.`,
      };
    }

    const { error } = await supabase.from("warehouses").delete().eq("id", id);
    if (error) throw error;
    return { success: true, message: "Warehouse deleted successfully" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete warehouse" };
  }
}
