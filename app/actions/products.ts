"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createJSClient } from "@supabase/supabase-js";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseServiceKey) {
    // If service role key is present, bypass SSR cookies to run as superuser
    return createJSClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  const cookieStore = cookies();
  const fallbackKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createServerClient(supabaseUrl, fallbackKey, {
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
      .maybeSingle();

    if (error) throw error;
    if (!updatedProd) {
      throw new Error(`Product not found in database for ID ${id}`);
    }
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

export async function fetchProductsAction(category?: string) {
  const supabase = getAdminClient();
  try {
    let query = supabase.from("products").select("*");
    if (category) {
      query = query.eq("category", category);
    }
    query = query.order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch products", data: [] };
  }
}

export async function fetchStockAction() {
  const supabase = getAdminClient();
  try {
    const { data, error } = await supabase
      .from("stock")
      .select(`
        *,
        products (
          name,
          brand,
          model
        )
      `)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch stock", data: [] };
  }
}

export async function verifySerialNumberAction(sNo: string, currentJobId?: string) {
  const supabase = getAdminClient();
  try {
    const cleanSNo = sNo.trim();
    if (!cleanSNo) {
      return { success: false, error: "Serial number is empty" };
    }

    // 1. Query the stock table case-insensitively using service role key (bypasses RLS)
    const { data: stockData, error: stockError } = await supabase
      .from("stock")
      .select(`
        *,
        products (
          name,
          brand,
          model
        )
      `)
      .ilike("serial_no", cleanSNo)
      .maybeSingle();

    if (stockError) throw stockError;

    if (!stockData) {
      return { success: false, error: "Serial number not found in active inventory." };
    }

    // 2. Check if the serial number is already registered or used in installer_jobs
    let jobsQuery = supabase
      .from("installer_jobs")
      .select("id, job_title")
      .ilike("serial_number", cleanSNo);

    if (currentJobId && currentJobId !== "new") {
      jobsQuery = jobsQuery.neq("id", currentJobId);
    }

    const { data: jobData, error: jobError } = await jobsQuery;

    if (jobError) throw jobError;

    if (jobData && jobData.length > 0) {
      return { 
        success: false, 
        error: `Serial number is already registered for another installation: "${jobData[0].job_title}".` 
      };
    }

    return {
      success: true,
      product: {
        product_name: stockData.products?.name || "Unknown Product",
        brand: stockData.products?.brand || "-",
        model: stockData.model_no || stockData.products?.model || "-",
        warehouse_name: stockData.warehouse_name || "-",
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to verify serial number" };
  }
}

