"use server";
// DEPLOYMENT v2.1.0 — Re-apply always creates NEW row, never mutates rejected history

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createJSClient } from "@supabase/supabase-js";
import { getCallerIdentity } from "@/app/actions/users";
import { getMyScopeAction } from "@/app/actions/roles";
import { buildPartyRegionMap, regionForParty, regionsMatch, type PartyRef } from "@/lib/regionScope";

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
    const { canWrite } = await getMyScopeAction("product");
    if (!canWrite) return { success: false, error: "You have read-only access to Product Management" };

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
    const { canWrite } = await getMyScopeAction("product");
    if (!canWrite) return { success: false, error: "You have read-only access to Product Management" };

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
    // A unit stays "in inventory" its whole life - warehouse, then distributor,
    // then sub dealer - only truly leaving once it's sold out. Which slice of that
    // pool shows up here now comes from the caller's role_permissions scope_level
    // for "purchase.inventory" (Role Management, Stage 2), not a hardcoded role
    // check: "self" mirrors the exact ownership each role already has elsewhere
    // (distributor's own unclaimed-by-a-sub-dealer stock, sub dealer's own stock),
    // "region" shows everything held by any distributor in the caller's region,
    // and "everything" shows the full pool with no filter at all - genuinely every
    // unit regardless of allocation stage, not just unclaimed warehouse stock the
    // way the old hardcoded catch-all worked.
    const caller = await getCallerIdentity();
    const { scope, callerId, callerRegion } = await getMyScopeAction("purchase.inventory");

    let query = supabase.from("stock").select(`
        id,
        serial_no,
        model_no,
        status,
        warehouse_name,
        quantity,
        import_date,
        created_at,
        product_id,
        distributor_id,
        sub_dealer_id,
        products (
          name,
          brand,
          model,
          price
        )
      `);

    if (scope === "self" && callerId) {
      if (caller?.role === "distributor") {
        query = query.eq("distributor_id", callerId).is("sub_dealer_id", null);
      } else if (caller?.role === "sub_dealer") {
        query = query.eq("sub_dealer_id", callerId);
      } else {
        // No ownership concept defined for this role on inventory - default-deny
        // rather than guess, same posture as every other scope check in this system.
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    } else if (scope === "region" && callerRegion) {
      const { data: regionalDistributors } = await supabase
        .from("profiles").select("id").eq("role", "distributor").ilike("region", callerRegion);
      const ids = (regionalDistributors || []).map((d) => d.id);
      query = query.in("distributor_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }
    // scope === "everything": no filter - full pool, every allocation stage.

    const { data, error } = await query.order("created_at", { ascending: false });
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
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
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

// === Job submission two-stage review ===
// Stage 1 (verify/reject): Regional Manager, Country Head, or Admin.
// Stage 2 (final approve/reject): Country Head or Admin only.

export async function verifyJobStage1Action(jobId: string, note: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || !["retail_manager", "country_head", "admin"].includes(caller.role || "")) {
      return { success: false, error: "You don't have permission to verify this installation" };
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from("installer_jobs")
      .update({
        status: "pending_approval",
        verified_by: caller.id,
        verified_at: new Date().toISOString(),
        verification_note: (note || "").trim(),
      })
      .eq("id", jobId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to verify job" };
  }
}

export async function approveJobStage2Action(jobId: string, serialNumber: string, note: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || !["country_head", "admin"].includes(caller.role || "")) {
      return { success: false, error: "Only Country Head or Admin can give final approval" };
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from("installer_jobs")
      .update({
        status: "approved",
        approved_by: caller.id,
        approved_at: new Date().toISOString(),
        approval_note: (note || "").trim(),
      })
      .eq("id", jobId);

    if (error) throw error;

    if (serialNumber) {
      await supabase
        .from("stock")
        .update({
          status: "sold_out",
          sold_out_at: new Date().toISOString(),
          sold_out_by_installer_id: jobId,
          installation_id: jobId,
        })
        .ilike("serial_no", serialNumber.trim());
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to approve job" };
  }
}

// Incentive payment status: admin-only, one-way (unpaid -> paid), and only
// once the job has cleared Stage 2 approval. Re-verified server-side rather
// than trusting the client, since a client-only check is trivially bypassed.
export async function setJobPaymentPaidAction(jobId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || caller.role !== "admin") {
      return { success: false, error: "Only Admin can mark incentive payments as paid" };
    }

    const supabase = getAdminClient();
    const { data: job, error: fetchError } = await supabase
      .from("installer_jobs")
      .select("status, payment_status, job_title")
      .eq("id", jobId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!job) return { success: false, error: "Job not found" };
    if (job.status !== "approved") {
      return { success: false, error: "Incentive can only be marked paid after Stage 2 approval" };
    }
    if (job.payment_status === "paid") {
      return { success: true };
    }

    const { error } = await supabase
      .from("installer_jobs")
      .update({ payment_status: "paid" })
      .eq("id", jobId);
    if (error) throw error;

    try {
      await supabase.from("activity_logs").insert({
        action: "Job Payment Settlement",
        details: `Installer incentive for job "${job.job_title}" marked as Paid by admin`,
      });
    } catch {
      // Non-critical, don't fail the payment update over a log-write failure
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update payment status" };
  }
}

async function rejectJobInternal(jobId: string, serialNumber: string, note: string, callerId: string) {
  try {
    const supabase = getAdminClient();
    const { error } = await supabase
      .from("installer_jobs")
      .update({
        status: "rejected",
        approved_by: callerId,
        approved_at: new Date().toISOString(),
        approval_note: (note || "").trim() || "Rejected during site audit.",
      })
      .eq("id", jobId);

    if (error) throw error;

    await revertRejectedInstallationStockAction(jobId, serialNumber);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reject job" };
  }
}

export async function rejectJobStage1Action(jobId: string, serialNumber: string, note: string) {
  const caller = await getCallerIdentity();
  if (!caller || !["retail_manager", "country_head", "admin"].includes(caller.role || "")) {
    return { success: false, error: "You don't have permission to reject this installation" };
  }
  return rejectJobInternal(jobId, serialNumber, note, caller.id);
}

export async function rejectJobStage2Action(jobId: string, serialNumber: string, note: string) {
  const caller = await getCallerIdentity();
  if (!caller || !["country_head", "admin"].includes(caller.role || "")) {
    return { success: false, error: "Only Country Head or Admin can reject at this stage" };
  }
  return rejectJobInternal(jobId, serialNumber, note, caller.id);
}

export async function fetchSellOutAction() {
  const supabase = getAdminClient();
  try {
    const { scope, callerId, callerRegion, canWrite } = await getMyScopeAction("sales.sellout");

    let query = supabase
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
      .eq("status", "sold_out");

    // Self scope mirrors the ownership check submitManualSelloutAction already
    // enforces on write - a sub-dealer (or distributor) only ever sees sellouts
    // that were actually theirs, not the whole table.
    if (scope === "self" && callerId) {
      query = query.or(`distributor_id.eq.${callerId},sub_dealer_id.eq.${callerId}`);
    }

    let { data, error } = await query.order("sold_out_at", { ascending: false });

    if (error) throw error;
    let rows = data || [];

    // Region scope: Sell Out has no "two sides" the way ST2/Return/Transfer do -
    // the unit was sold by whichever of sub_dealer/distributor/warehouse held it,
    // to a walk-in consumer (no id, no region). Same shared resolver as the
    // ledger, just against `stock`'s own columns instead of `sales`'
    // source_type/source_id pair. See lib/regionScope.ts.
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

    // A manually-sold-out unit has no installer job, but does have a matching
    // sales/sale_items row (type='sellout') carrying the consumer's details -
    // enrich each stock row with that, where it exists.
    const stockIds = rows.map((r: any) => r.id);
    const consumerMap = new Map<string, { consumer_name: string; consumer_phone: string; site_address: string | null }>();
    if (stockIds.length > 0) {
      const { data: items } = await supabase.from("sale_items").select("stock_id, sale_id").in("stock_id", stockIds);
      const saleIds = Array.from(new Set((items || []).map((i: any) => i.sale_id)));
      if (saleIds.length > 0) {
        const { data: salesRows } = await supabase
          .from("sales")
          .select("id, consumer_name, consumer_phone, site_address")
          .in("id", saleIds)
          .eq("type", "sellout");
        const saleMap = new Map((salesRows || []).map((s: any) => [s.id, s]));
        (items || []).forEach((i: any) => {
          const sale = saleMap.get(i.sale_id);
          if (sale) consumerMap.set(i.stock_id, sale);
        });
      }
    }

    // Seller Type / Seller Name: whichever entity actually held the unit right
    // before it sold out - same priority order the region-scope resolver above
    // already uses (sub_dealer, then distributor, then warehouse). Batched into
    // one query for whichever profile ids show up, instead of one lookup per
    // row - warehouse needs no lookup at all since stock already carries its
    // name directly.
    const sellerProfileIds = Array.from(
      new Set(rows.flatMap((r: any) => [r.sub_dealer_id, r.distributor_id]).filter(Boolean))
    );
    const sellerNameByProfileId = new Map<string, string>();
    if (sellerProfileIds.length > 0) {
      const { data: sellerProfiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", sellerProfileIds);
      (sellerProfiles || []).forEach((p: any) => sellerNameByProfileId.set(p.id, `${p.first_name} ${p.last_name || ""}`.trim()));
    }

    const enriched = rows.map((row: any) => {
      let sellerType: string;
      let sellerName: string;
      if (row.sub_dealer_id) {
        sellerType = "Sub Dealer";
        sellerName = sellerNameByProfileId.get(row.sub_dealer_id) || "Unknown";
      } else if (row.distributor_id) {
        sellerType = "Distributor";
        sellerName = sellerNameByProfileId.get(row.distributor_id) || "Unknown";
      } else {
        sellerType = "Direct from Warehouse";
        sellerName = row.warehouse_name || "Unknown Warehouse";
      }
      return { ...row, sellerType, sellerName, consumer: consumerMap.get(row.id) || null };
    });
    return { success: true, data: enriched, canWrite };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch sell out stock", data: [], canWrite: false };
  }
}

export async function bulkImportStockAction(
  items: Array<{
    code?: string;
    serial_no: string;
    warehouse_name?: string;
    [key: string]: any; // other CSV columns (name/brand/category/model/price/cost) are accepted but ignored
  }>,
  globalImportDate?: string,
  globalWarehouse?: string
) {
  const { canWrite } = await getMyScopeAction("purchase.import_stock");
  if (!canWrite) return { success: false, error: "You have read-only access to Import Stock", count: 0, skipped: [] };

  if (!items || items.length === 0) {
    return { success: true, count: 0, skipped: [], message: "No items to import" };
  }

  const { Client } = require("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const skipped: { serial_no?: string; code?: string; reason: string }[] = [];

  try {
    await client.connect();

    // 1. Resolve every item's product strictly by Product Code — no auto-creation.
    const prodRes = await client.query(`SELECT id, code FROM public.products WHERE code IS NOT NULL;`);
    const codeMap = new Map<string, string>();
    (prodRes.rows || []).forEach((p: any) => {
      if (p.code) codeMap.set(p.code.toLowerCase().trim(), p.id);
    });

    // A warehouse must be one of the real, currently-registered warehouses (sourced
    // from regions.warehouse - there's no separate hardcoded warehouse list, so a
    // newly added region's warehouse is automatically accepted here too).
    const whRes = await client.query(`SELECT DISTINCT warehouse FROM public.regions WHERE warehouse IS NOT NULL;`);
    const canonicalWarehouses = new Map<string, string>();
    (whRes.rows || []).forEach((r: any) => {
      if (r.warehouse) canonicalWarehouses.set(r.warehouse.toLowerCase().trim(), r.warehouse);
    });
    const warehouseList = Array.from(canonicalWarehouses.values()).join(", ");

    const defaultDate = globalImportDate || new Date().toISOString().split("T")[0];

    // 2. Validate every row: must have a serial number, must map to a real product,
    // must have a recognized warehouse, and must not repeat a serial already seen
    // in this file.
    const seenInFile = new Set<string>();
    const valid: { productId: string; serial: string; warehouse: string }[] = [];

    for (const item of items) {
      const serial = (item.serial_no || "").trim();
      const codeKey = (item.code || "").toLowerCase().trim();

      if (!serial) {
        skipped.push({ code: item.code, reason: "Missing serial number" });
        continue;
      }

      const serialKey = serial.toLowerCase();
      if (seenInFile.has(serialKey)) {
        skipped.push({ serial_no: serial, code: item.code, reason: "Duplicate serial number within this file" });
        continue;
      }

      const productId = codeMap.get(codeKey);
      if (!productId) {
        skipped.push({ serial_no: serial, code: item.code, reason: `Product code "${item.code || ""}" does not exist in Product Management` });
        continue;
      }

      const rawWarehouse = (item.warehouse_name || globalWarehouse || "").trim();
      if (!rawWarehouse) {
        skipped.push({ serial_no: serial, code: item.code, reason: "Missing warehouse" });
        continue;
      }
      const resolvedWarehouse = canonicalWarehouses.get(rawWarehouse.toLowerCase());
      if (!resolvedWarehouse) {
        skipped.push({ serial_no: serial, code: item.code, reason: `Unknown warehouse "${rawWarehouse}" — must be one of: ${warehouseList}` });
        continue;
      }

      seenInFile.add(serialKey);
      valid.push({
        productId,
        serial,
        warehouse: resolvedWarehouse,
      });
    }

    if (valid.length === 0) {
      await client.end();
      return { success: true, count: 0, skipped, message: "No valid rows to import" };
    }

    // 3. Check which of the remaining serials already exist in stock (covers both
    // pre-existing inventory and duplicates spanning earlier chunks of this same import).
    const candidateSerials = valid.map((v) => v.serial);
    const existingRes = await client.query(
      `SELECT serial_no FROM public.stock WHERE serial_no = ANY($1);`,
      [candidateSerials]
    );
    const existingSerials = new Set((existingRes.rows || []).map((r: any) => String(r.serial_no).toLowerCase()));

    const toInsert = valid.filter((v) => {
      if (existingSerials.has(v.serial.toLowerCase())) {
        skipped.push({ serial_no: v.serial, reason: "Serial number already exists in inventory" });
        return false;
      }
      return true;
    });

    // 4. Bulk insert the clean rows in chunks of 2,500
    const batchSize = 2500;
    let insertedCount = 0;

    for (let i = 0; i < toInsert.length; i += batchSize) {
      const chunk = toInsert.slice(i, i + batchSize);
      const valuePlaceholders: string[] = [];
      const params: any[] = [];
      let sIdx = 1;

      chunk.forEach((item) => {
        valuePlaceholders.push(`(gen_random_uuid(), $${sIdx}, $${sIdx + 1}, $${sIdx + 2}, $${sIdx + 3}, 1, NOW(), 'active')`);
        params.push(item.productId, item.serial, item.warehouse, defaultDate);
        sIdx += 4;
      });

      const stockQuery = `
        INSERT INTO public.stock (id, product_id, serial_no, warehouse_name, import_date, quantity, created_at, status)
        VALUES ${valuePlaceholders.join(",\n")}
        ON CONFLICT (serial_no) DO NOTHING;
      `;

      await client.query(stockQuery, params);
      insertedCount += chunk.length;
    }

    await client.end();
    return {
      success: true,
      count: insertedCount,
      skipped,
      message: `Imported ${insertedCount} stock entries${skipped.length ? `, skipped ${skipped.length}` : ""}.`,
    };
  } catch (err: any) {
    try {
      await client.end();
    } catch {}
    return { success: false, error: err.message || "Failed bulk stock import operation", skipped };
  }
}

export async function revertRejectedInstallationStockAction(jobId: string, serialNumber?: string) {
  const { Client } = require("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
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
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
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


