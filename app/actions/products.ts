"use server";
// DEPLOYMENT v2.1.0 — Re-apply always creates NEW row, never mutates rejected history

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
        id,
        serial_no,
        model_no,
        status,
        warehouse_name,
        quantity,
        import_date,
        created_at,
        product_id,
        products (
          name,
          brand,
          model,
          price
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
  // Pure live-inventory existence check: green (success) if the serial number
  // exists in the `stock` table, red (failure) if it doesn't. Deliberately does
  // NOT check for other installers/jobs already using this serial — the item
  // stays "live" in inventory until an admin approves a job against it (Stage 2),
  // so multiple installers are allowed to submit against the same serial while
  // pending; duplicates are surfaced to the admin for review instead of being
  // blocked here.
  const supabase = getAdminClient();
  try {
    const cleanSNo = sNo.trim();
    if (!cleanSNo) {
      return { success: false, error: "Serial number is empty" };
    }

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
      return { success: false, error: "Serial number not found in inventory." };
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

export async function submitInstallationAction(payload: any, siteFormJobId: string) {
  const MIN_PHOTOS = 3;

  // === SERVER-SIDE SANITIZATION: Strip ALL fake/placeholder URLs ===
  // This runs on the server so no matter what the client sends, fake URLs NEVER reach the DB.
  const BLOCKED_DOMAINS = ["unsplash.com", "mixkit.co", "picsum.photos", "placeholder.com", "zencdn", "gtv-videos-bucket", "lorem.space", "placehold.co"];

  const isFakeUrl = (url: string) => {
    if (!url || typeof url !== "string") return true;
    const lower = url.trim().toLowerCase();
    if (!lower) return true;
    return BLOCKED_DOMAINS.some(domain => lower.includes(domain));
  };

  // Sanitize photos array
  if (Array.isArray(payload.photos)) {
    payload.photos = payload.photos.filter((url: string) => !isFakeUrl(url));
  } else if (typeof payload.photos === "string") {
    try {
      const parsed = JSON.parse(payload.photos);
      if (Array.isArray(parsed)) {
        payload.photos = parsed.filter((url: string) => !isFakeUrl(url));
      } else {
        payload.photos = [];
      }
    } catch {
      payload.photos = [];
    }
  } else {
    payload.photos = [];
  }

  // Sanitize notes: remove fake video URLs from VIDEO: metadata
  if (typeof payload.notes === "string") {
    payload.notes = payload.notes.replace(
      /VIDEO:https?:\/\/[^\s|]*(?:mixkit|zencdn|gtv-videos-bucket|unsplash)[^\s|]*/gi,
      "VIDEO:"
    );
  }

  // === SERVER-SIDE VALIDATION: required for both a brand-new submission and a
  // resubmission of a rejected job — the client already enforces this, but the
  // server must not trust it as the only line of defense. ===
  const validationErrors: string[] = [];
  if (!String(payload.job_title || "").trim()) validationErrors.push("Job title is required.");
  if (!String(payload.address || "").trim()) validationErrors.push("Address is required.");
  if (!String(payload.serial_number || "").trim()) validationErrors.push("Serial number is required.");
  if (payload.photos.length < MIN_PHOTOS) {
    validationErrors.push(`At least ${MIN_PHOTOS} real site photos are required (got ${payload.photos.length}).`);
  }
  const videoMatch = String(payload.notes || "").match(/VIDEO:(\S*)/i);
  const videoUrl = videoMatch ? videoMatch[1] : "";
  if (!videoUrl || isFakeUrl(videoUrl)) {
    validationErrors.push("A real installation video is required.");
  }

  if (validationErrors.length > 0) {
    return { success: false, error: validationErrors.join(" ") };
  }

  const { Client } = require("pg");
  const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query("BEGIN");

    // 1. Optional check for stock item in active inventory
    const stockCheck = await client.query(
      "SELECT id, status, installation_id FROM public.stock WHERE LOWER(serial_no) = LOWER($1) LIMIT 1",
      [payload.serial_number]
    );

    // Note: deliberately NOT blocking on other active jobs sharing this serial number.
    // The item stays live in inventory until an admin approves a job against it, so
    // multiple installers are allowed to submit pending applications for the same
    // serial — the admin resolves the conflict (approve one, reject the rest) using
    // the duplicate-serial flag shown on the review screen.

    // 2. Insert or update the installation job record
    let jobResult;
    if (siteFormJobId && siteFormJobId !== "new") {
      jobResult = await client.query(
        `UPDATE public.installer_jobs 
         SET status = 'pending_verification',
             job_title = $1,
             address = $2,
             serial_number = $3,
             remarks = $4,
             photos = $5,
             notes = $6,
             approval_note = NULL,
             verification_note = NULL,
             is_resubmitted = TRUE
         WHERE id = $7
         RETURNING id`,
        [
          payload.job_title,
          payload.address,
          payload.serial_number,
          payload.remarks || "",
          Array.isArray(payload.photos) ? payload.photos : [],
          payload.notes || "",
          siteFormJobId
        ]
      );
    } else {
      const newJobId = payload.id || require("crypto").randomUUID();
      jobResult = await client.query(
        `INSERT INTO public.installer_jobs (
          id, installer_id, job_title, address, status, serial_number, remarks, photos, notes, incentive, payment_status, created_at, is_resubmitted
         ) VALUES ($1, $2, $3, $4, 'pending_verification', $5, $6, $7, $8, $9, $10, NOW(), FALSE)
         RETURNING id`,
        [
          newJobId,
          payload.installer_id,
          payload.job_title,
          payload.address,
          payload.serial_number,
          payload.remarks || "",
          Array.isArray(payload.photos) ? payload.photos : [],
          payload.notes || "",
          payload.incentive || 5000,
          payload.payment_status || "unpaid"
        ]
      );
    }

    const jobId = jobResult.rows[0]?.id;
    if (!jobId) {
      throw new Error("Failed to insert or update the installation record.");
    }

    // Deliberately NOT marking stock as sold_out here. The item stays live in
    // inventory while this job is pending — it only becomes sold_out once an
    // admin gives final (Stage 2) approval, in handleApproveJobStage2.

    await client.query("COMMIT");
    await client.end();
    return { success: true, message: "Installation submitted for verification!" };
  } catch (err: any) {
    await client.query("ROLLBACK");
    await client.end();
    return { success: false, error: err.message || "Failed to process installation transaction" };
  }
}

export async function fetchSellOutAction() {
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
        ),
        installer:profiles!sold_out_by_installer_id (
          first_name,
          last_name
        )
      `)
      .eq("status", "sold_out")
      .order("sold_out_at", { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch sell out stock", data: [] };
  }
}

export async function bulkImportStockAction(
  items: Array<{
    name?: string;
    code?: string;
    serial_no: string;
    brand?: string;
    category?: string;
    model?: string;
    price?: number;
    cost?: number;
    warehouse_name?: string;
  }>,
  globalImportDate?: string,
  globalWarehouse?: string
) {
  if (!items || items.length === 0) {
    return { success: true, count: 0, message: "No items to import" };
  }

  const { Client } = require("pg");
  const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 1. Fetch existing products to resolve IDs
    const prodRes = await client.query(`SELECT id, code, model FROM public.products;`);
    const existingProducts = prodRes.rows || [];
    const codeMap = new Map<string, string>();
    const modelMap = new Map<string, string>();

    existingProducts.forEach((p: any) => {
      if (p.code) codeMap.set(p.code.toLowerCase(), p.id);
      if (p.model) modelMap.set(p.model.toLowerCase(), p.id);
    });

    // 2. Identify missing products in items list
    const missingProdsMap = new Map<string, any>();
    items.forEach((item) => {
      const codeKey = (item.code || "").toLowerCase();
      const modelKey = (item.model || "").toLowerCase();
      if (!codeMap.has(codeKey) && !modelMap.has(modelKey) && item.code) {
        if (!missingProdsMap.has(codeKey)) {
          missingProdsMap.set(codeKey, {
            name: item.name || item.code,
            code: item.code,
            brand: item.brand || "CoreTech",
            category: (item.category || "inverter").toLowerCase(),
            model: item.model || item.code,
            price: Number(item.price) || 0,
            cost: Number(item.cost) || 0,
            alert_quantity: 5,
          });
        }
      }
    });

    // Bulk insert missing products
    if (missingProdsMap.size > 0) {
      const prodValues: string[] = [];
      const prodParams: any[] = [];
      let pIdx = 1;

      for (const prod of Array.from(missingProdsMap.values())) {
        prodValues.push(`(gen_random_uuid(), $${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, NOW())`);
        prodParams.push(prod.name, prod.code, prod.brand, prod.category, prod.model, prod.price, prod.cost, prod.alert_quantity);
        pIdx += 8;
      }

      const prodInsertQuery = `
        INSERT INTO public.products (id, name, code, brand, category, model, price, cost, alert_quantity, created_at)
        VALUES ${prodValues.join(",\n")}
        ON CONFLICT (code) DO UPDATE SET model = EXCLUDED.model
        RETURNING id, code, model;
      `;

      const insertedProds = await client.query(prodInsertQuery, prodParams);
      (insertedProds.rows || []).forEach((p: any) => {
        if (p.code) codeMap.set(p.code.toLowerCase(), p.id);
        if (p.model) modelMap.set(p.model.toLowerCase(), p.id);
      });
    }

    const fallbackProdId = existingProducts[0]?.id || null;
    const defaultDate = globalImportDate || new Date().toISOString().split("T")[0];

    // 3. Bulk insert/upsert stock items in chunks of 2,500
    const batchSize = 2500;
    let insertedCount = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);
      const valuePlaceholders: string[] = [];
      const params: any[] = [];
      let sIdx = 1;

      chunk.forEach((item) => {
        const codeKey = (item.code || "").toLowerCase();
        const modelKey = (item.model || "").toLowerCase();
        const prodId = codeMap.get(codeKey) || modelMap.get(modelKey) || fallbackProdId;
        const targetWarehouse = item.warehouse_name || globalWarehouse || "Main Warehouse (275)";

        valuePlaceholders.push(`(gen_random_uuid(), $${sIdx}, $${sIdx + 1}, $${sIdx + 2}, $${sIdx + 3}, $${sIdx + 4}, 1, NOW(), 'active')`);
        params.push(
          prodId,
          item.model || "CoreTech Product",
          item.serial_no,
          targetWarehouse,
          defaultDate
        );
        sIdx += 5;
      });

      const stockQuery = `
        INSERT INTO public.stock (id, product_id, model_no, serial_no, warehouse_name, import_date, quantity, created_at, status)
        VALUES ${valuePlaceholders.join(",\n")}
        ON CONFLICT (serial_no) DO UPDATE
        SET quantity = public.stock.quantity + EXCLUDED.quantity,
            warehouse_name = EXCLUDED.warehouse_name,
            import_date = EXCLUDED.import_date;
      `;

      await client.query(stockQuery, params);
      insertedCount += chunk.length;
    }

    await client.end();
    return { success: true, count: insertedCount, message: `Successfully imported ${insertedCount} stock entries!` };
  } catch (err: any) {
    try {
      await client.end();
    } catch {}
    return { success: false, error: err.message || "Failed bulk stock import operation" };
  }
}

export async function bulkDeleteStockAction(ids: string[]) {
  if (!ids || ids.length === 0) {
    return { success: true, count: 0 };
  }

  const { Client } = require("pg");
  const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Filter out local temporary IDs
    const dbIds = ids.filter(id => id && !id.startsWith("local-"));
    if (dbIds.length === 0) {
      await client.end();
      return { success: true, count: ids.length };
    }

    const deleteQuery = `DELETE FROM public.stock WHERE id = ANY($1);`;
    const res = await client.query(deleteQuery, [dbIds]);

    await client.end();
    return { success: true, count: res.rowCount || dbIds.length };
  } catch (err: any) {
    try { await client.end(); } catch {}
    return { success: false, error: err.message || "Failed bulk delete operation" };
  }
}

export async function bulkDeleteStockByFilterAction(filters: {
  importDate?: string;
  productName?: string;
  modelNo?: string;
  warehouseName?: string;
}) {
  const { Client } = require("pg");
  const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filters.importDate) {
      conditions.push(`import_date = $${pIdx}`);
      params.push(filters.importDate);
      pIdx++;
    }

    if (filters.modelNo) {
      conditions.push(`model_no ILIKE $${pIdx}`);
      params.push(`%${filters.modelNo}%`);
      pIdx++;
    }

    if (filters.warehouseName) {
      conditions.push(`warehouse_name ILIKE $${pIdx}`);
      params.push(`%${filters.warehouseName}%`);
      pIdx++;
    }

    if (conditions.length === 0) {
      await client.end();
      return { success: false, error: "At least one filter criterion is required for bulk deletion" };
    }

    const query = `DELETE FROM public.stock WHERE ${conditions.join(" AND ")};`;
    const res = await client.query(query, params);

    await client.end();
    return { success: true, count: res.rowCount || 0, message: `Bulk deleted ${res.rowCount || 0} stock items matching filter!` };
  } catch (err: any) {
    try { await client.end(); } catch {}
    return { success: false, error: err.message || "Failed bulk filter delete operation" };
  }
}

export async function revertRejectedInstallationStockAction(jobId: string, serialNumber?: string) {
  const { Client } = require("pg");
  const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 1. Revert stock item linked by installation_id
    const res = await client.query(`
      UPDATE public.stock
      SET status = 'active',
          sold_out_at = NULL,
          sold_out_by_installer_id = NULL,
          installation_id = NULL,
          installation_project_title = NULL,
          deployment_site_address = NULL
      WHERE installation_id = $1;
    `, [jobId]);

    // 2. Revert stock item by serial_number if provided or found in job notes
    let sn = serialNumber ? serialNumber.trim() : "";
    if (!sn) {
      const jobRes = await client.query(`SELECT serial_number, notes FROM public.installer_jobs WHERE id = $1;`, [jobId]);
      if (jobRes.rows[0]?.serial_number) {
        sn = jobRes.rows[0].serial_number.trim();
      } else if (jobRes.rows[0]?.notes && jobRes.rows[0].notes.includes("SN:")) {
        const match = jobRes.rows[0].notes.match(/SN:\s*([^\s|]+)/);
        if (match && match[1]) sn = match[1].trim();
      }
    }

    if (sn) {
      await client.query(`
        UPDATE public.stock
        SET status = 'active',
            sold_out_at = NULL,
            sold_out_by_installer_id = NULL,
            installation_id = NULL,
            installation_project_title = NULL,
            deployment_site_address = NULL
        WHERE LOWER(serial_no) = LOWER($1) AND status = 'sold_out';
      `, [sn]);
    }

    await client.end();
    return { success: true, count: res.rowCount };
  } catch (err: any) {
    try { await client.end(); } catch {}
    return { success: false, error: err.message || "Failed to revert stock for rejected installation" };
  }
}

export async function revertStockBySerialAction(serialNumber: string) {
  const { Client } = require("pg");
  const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const res = await client.query(`
      UPDATE public.stock
      SET status = 'active',
          sold_out_at = NULL,
          sold_out_by_installer_id = NULL,
          installation_id = NULL,
          installation_project_title = NULL,
          deployment_site_address = NULL
      WHERE LOWER(serial_no) = LOWER($1);
    `, [serialNumber.trim()]);

    await client.end();
    return { success: true, count: res.rowCount };
  } catch (err: any) {
    try { await client.end(); } catch {}
    return { success: false, error: err.message || "Failed to revert stock" };
  }
}


