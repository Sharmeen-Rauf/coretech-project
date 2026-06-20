"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getAdminClient() {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Safe to ignore in actions
        }
      },
    },
  });
}

export async function createProductAction(data: any) {
  const supabase = getAdminClient();
  try {
    const { data: newProd, error } = await supabase
      .from("products")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data: newProd };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create product" };
  }
}

export async function updateProductAction(id: string, data: any) {
  const supabase = getAdminClient();
  try {
    const { data: updatedProd, error } = await supabase
      .from("products")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data: updatedProd };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update product" };
  }
}

export async function getOrCreateProductByCode(code: string, fallbackData: any) {
  const supabase = getAdminClient();
  try {
    // 1. Check if product exists
    const { data: existingProd, error: fetchErr } = await supabase
      .from("products")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (existingProd) {
      return { success: true, data: existingProd, created: false };
    }

    // 2. Insert new product
    const { data: newProd, error: insertErr } = await supabase
      .from("products")
      .insert(fallbackData)
      .select()
      .single();

    if (insertErr) throw insertErr;
    return { success: true, data: newProd, created: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get or create product" };
  }
}
