"use server";
// DEPLOYMENT v2.1.0 — Re-apply always creates NEW row, never mutates rejected history

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createJSClient } from "@supabase/supabase-js";
import { getCallerIdentity } from "@/app/actions/users";
import { getMyScopeAction, type CallerOpts } from "@/app/actions/roles";
import { buildPartyRegionMap, regionForParty, regionsMatch, type PartyRef } from "@/lib/regionScope";

// Escapes SQL LIKE/ILIKE wildcard characters in user-supplied input before it
// reaches an .ilike() call. Without this, a serial number containing a
// literal % or _ is treated as a search pattern instead of literal text -
// case-insensitive matching is still the point (ilike over eq), this only
// stops the two wildcard characters from being interpreted as wildcards.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// A serial is "taken" once an installation against it has cleared Stage 2.
// "completed" is the status the old Approvals page used for the same thing.
const APPROVED_JOB_STATUSES = ["approved", "completed"];
// Verified at Stage 1, waiting for the Country Head's final Stage 2 decision.
const STAGE2_PENDING_JOB_STATUSES = ["pending_approval", "pending_installation_approval"];

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

export async function fetchStockAction(opts?: CallerOpts) {
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
    const caller = await getCallerIdentity(opts?.accessToken);
    const { scope, callerId, callerRegion } = await getMyScopeAction("purchase.inventory", opts);

    // Region scope's distributor-id lookup only needs to happen once, not once
    // per page below.
    let regionalDistributorIds: string[] | null = null;
    if (scope === "region" && callerRegion) {
      const { data: regionalDistributors } = await supabase
        .from("profiles").select("id").eq("role", "distributor").ilike("region", callerRegion);
      regionalDistributorIds = (regionalDistributors || []).map((d) => d.id);
    }

    // A Postgrest query builder is single-use once awaited, so a fresh one has
    // to be built for every page fetched below - this rebuilds the same
    // select + scope filter each time, only .range() changes per iteration.
    const buildQuery = () => {
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
        const ids = regionalDistributorIds || [];
        query = query.in("distributor_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      }
      // scope === "everything": no filter - full pool, every allocation stage.

      return query.order("created_at", { ascending: false });
    };

    // Supabase/PostgREST silently caps any single response at the project's
    // max-rows setting (1000 by default) - a query with no explicit range was
    // truncating this table's oldest rows with no error once stock passed 1000
    // entries (confirmed live 2026-08-31: 1168 rows in `stock`, only the newest
    // 1000 were ever reaching the Inventory page). Page through in fixed-size
    // chunks until a page comes back short of the page size, so every row is
    // always returned no matter how large the table grows.
    const PAGE_SIZE = 1000;
    let allRows: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const page = data || [];
      allRows = allRows.concat(page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // Region filtering was removed (Inventory page) - with every current
    // stock row sitting in a single warehouse that itself serves 4 different
    // regions, and nothing yet allocated to a distributor/sub-dealer, there
    // was no way to resolve a region for any row without guessing. Revisit if
    // region ever becomes resolvable (e.g. captured explicitly at import time
    // instead of inferred from a shared warehouse).

    return { success: true, data: allRows, isAdmin: caller?.role === "admin", scope };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch stock", data: [], scope: "self" };
  }
}

// Permanent delete, admin-only. Deliberately not wired to purchase.inventory's
// Role Management can_write flag - country_head/employee/distributor/sub_dealer
// all currently have that flag on, and this needs to stay true regardless of how
// anyone configures Role Management, the same way Reset Password and Dealer
// Assignment are hardcoded to admin elsewhere in this codebase rather than left
// as a grantable permission.
const STOCK_SELECT_CLAUSE = `
  id, serial_no, model_no, status, warehouse_name, quantity, import_date,
  created_at, product_id, distributor_id, sub_dealer_id,
  products (name, brand, model, price)
`;

// Shared by fetchInventoryPageAction and fetchAllInventoryForExportAction -
// resolves the caller's purchase.inventory scope once (same rule
// fetchStockAction above already uses) and returns a factory that builds a
// fresh, scope-filtered query each call (Postgrest builders are single-use
// once awaited - see the chunked loop in fetchStockAction above for why a
// factory, not a single built query, is required for anything read in more
// than one page).
async function buildScopedStockQueryFactory(
  supabase: any,
  opts?: CallerOpts
): Promise<{
  factory: (selectClause: string, selectOpts?: { count: "exact" }) => any;
  scope: "self" | "region" | "everything";
  isAdmin: boolean;
  granted: boolean;
}> {
  const caller = await getCallerIdentity(opts?.accessToken);
  const { scope, callerId, callerRegion, granted } = await getMyScopeAction("purchase.inventory", opts);

  let regionalDistributorIds: string[] | null = null;
  if (scope === "region" && callerRegion) {
    const { data: regionalDistributors } = await supabase
      .from("profiles").select("id").eq("role", "distributor").ilike("region", callerRegion);
    regionalDistributorIds = (regionalDistributors || []).map((d: any) => d.id);
  }

  const factory = (selectClause: string, selectOpts?: { count: "exact" }) => {
    let q = selectOpts
      ? supabase.from("stock").select(selectClause, selectOpts)
      : supabase.from("stock").select(selectClause);
    if (scope === "self" && callerId) {
      if (caller?.role === "distributor") {
        q = q.eq("distributor_id", callerId).is("sub_dealer_id", null);
      } else if (caller?.role === "sub_dealer") {
        q = q.eq("sub_dealer_id", callerId);
      } else {
        q = q.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    } else if (scope === "region" && callerRegion) {
      const ids = regionalDistributorIds || [];
      q = q.in("distributor_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }
    return q;
  };

  return { factory, scope, isAdmin: caller?.role === "admin", granted };
}

// Chunked, scope-filtered read used for the three "always reflect the whole
// inventory" summary widgets (Total Inventory, Inventory Aging, Total
// Evaluation) and the filter dropdowns' option lists - deliberately
// unfiltered by the caller's own search/date/product/warehouse filters
// (matching the page's existing rule), but still scoped and excluding
// sold_out, matching what the page actually displays.
async function fetchInventoryWidgetsAndFilterOptions(
  factory: (selectClause: string) => any
): Promise<{
  totalInventoryCount: number;
  oldestAgeDays: number;
  totalEvaluation: number;
  uniqueProducts: string[];
  uniqueWarehouses: string[];
  uniqueDates: string[];
}> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await factory("quantity, created_at, import_date, warehouse_name, products(name, price)")
      .neq("status", "sold_out")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    allRows = allRows.concat(page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  let oldestAgeDays = 0;
  let totalEvaluation = 0;
  const products = new Set<string>();
  const warehouses = new Set<string>();
  const dates = new Set<string>();

  allRows.forEach((r: any) => {
    const qty = r.quantity || 1;
    const price = r.products?.price ? parseFloat(r.products.price) : 0;
    totalEvaluation += price * qty;
    if (r.created_at) {
      const ts = new Date(r.created_at).getTime();
      if (!isNaN(ts)) {
        const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
        oldestAgeDays = Math.max(oldestAgeDays, days);
      }
    }
    if (r.products?.name && r.products.name !== "Unknown Product") products.add(r.products.name);
    if (r.warehouse_name && r.warehouse_name !== "-") warehouses.add(r.warehouse_name);
    if (r.import_date && r.import_date !== "-") dates.add(r.import_date);
  });

  return {
    totalInventoryCount: allRows.length,
    oldestAgeDays,
    totalEvaluation,
    uniqueProducts: Array.from(products),
    uniqueWarehouses: Array.from(warehouses),
    uniqueDates: Array.from(dates).sort().reverse(),
  };
}

// Resolves Inventory's search box (product name / serial / brand /
// warehouse) and its 5 dropdown filters (date, product, warehouse,
// distributor, sub-dealer) into a SYNC applier function, so the result can
// be used to build a fresh query more than once (required for the export
// path's chunked read loop - a Postgrest builder is single-use once
// awaited, so re-applying filters to a brand-new base query each chunk is
// the only safe way to re-range past the first page; see the identical
// factory pattern in buildFilteredJobsQueryFactory above). Returns null when
// a non-blank search term sanitized down to nothing (same rule as the
// installer_jobs actions above - the caller must treat that as zero
// matches, not "no filter").
async function resolveInventoryFilterApplier(
  supabase: any,
  opts: {
    search?: string;
    filterDate?: string;
    filterProduct?: string;
    filterWarehouse?: string;
    filterDistributorId?: string;
    filterSubDealerId?: string;
  }
): Promise<((query: any) => any) | null> {
  let filterProductIds: string[] | null = null;
  if (opts.filterProduct) {
    const { data: matchedProducts, error } = await supabase
      .from("products")
      .select("id")
      .ilike("name", escapeLikePattern(opts.filterProduct));
    if (error) throw error;
    filterProductIds = (matchedProducts || []).map((p: any) => p.id);
  }

  const hadRawSearch = (opts.search || "").trim().length > 0;
  const search = (opts.search || "").replace(/[,()]/g, " ").trim();
  if (hadRawSearch && !search) return null;

  let searchMatchingProductIds: string[] = [];
  if (search) {
    const pattern = escapeLikePattern(search);
    const { data: matchedProducts, error } = await supabase
      .from("products")
      .select("id")
      .or(`name.ilike.%${pattern}%,brand.ilike.%${pattern}%`);
    if (error) throw error;
    searchMatchingProductIds = (matchedProducts || []).map((p: any) => p.id);
  }

  return (query: any) => {
    if (opts.filterDate) query = query.eq("import_date", opts.filterDate);
    if (opts.filterWarehouse) query = query.ilike("warehouse_name", escapeLikePattern(opts.filterWarehouse));
    if (opts.filterDistributorId) query = query.eq("distributor_id", opts.filterDistributorId);
    if (opts.filterSubDealerId) query = query.eq("sub_dealer_id", opts.filterSubDealerId);
    if (filterProductIds) {
      query = query.in("product_id", filterProductIds.length ? filterProductIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    if (search) {
      const pattern = escapeLikePattern(search);
      const orParts = [`serial_no.ilike.%${pattern}%`, `warehouse_name.ilike.%${pattern}%`];
      if (searchMatchingProductIds.length > 0) {
        orParts.push(`product_id.in.(${searchMatchingProductIds.join(",")})`);
      }
      query = query.or(orParts.join(","));
    }
    return query;
  };
}

export type InventoryFilterOpts = {
  search?: string;
  filterDate?: string;
  filterProduct?: string;
  filterWarehouse?: string;
  filterDistributorId?: string;
  filterSubDealerId?: string;
};

// Paginated, server-filtered replacement for Inventory's old "fetch the
// entire stock table on every load, then filter/sort/paginate in the
// browser" approach (fetchStockAction above, unchanged, still does the
// fetch-everything version for the mobile admin app's own Inventory screen,
// which has no pagination UI of its own to drive this with).
export async function fetchInventoryPageAction(
  opts: InventoryFilterOpts & { page: number; pageSize: number; includeWidgets?: boolean }
) {
  const supabase = getAdminClient();
  try {
    const { factory, scope, isAdmin, granted } = await buildScopedStockQueryFactory(supabase);
    if (!granted) {
      return {
        success: false, error: "Not authorized", data: [], totalCount: 0, isAdmin: false, scope: "self" as const,
        widgets: null,
      };
    }

    const page = Math.max(1, Math.floor(Number(opts.page)) || 1);
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(opts.pageSize)) || 30));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const applier = await resolveInventoryFilterApplier(supabase, opts);

    // Widgets/filter-options are a full (chunked, scope-wide) table scan -
    // "always reflect the whole inventory" regardless of the current
    // page/search/filter, so they don't need to be recomputed on every page
    // turn or keystroke, only on initial load (and whenever the page
    // explicitly asks, e.g. after a delete/sync that could change them).
    const [pageResult, widgets] = await Promise.all([
      applier === null
        ? Promise.resolve({ data: [] as any[], count: 0, error: null as any })
        : applier(factory(STOCK_SELECT_CLAUSE, { count: "exact" }).neq("status", "sold_out"))
            .order("created_at", { ascending: false })
            .range(from, to),
      opts.includeWidgets
        ? fetchInventoryWidgetsAndFilterOptions((selectClause: string) => factory(selectClause))
        : Promise.resolve(null),
    ]);

    if (pageResult.error) throw pageResult.error;

    return {
      success: true,
      data: pageResult.data || [],
      totalCount: pageResult.count || 0,
      isAdmin,
      scope,
      // null when includeWidgets wasn't requested - caller keeps whatever
      // widget values it already has rather than this overwriting them with
      // zeros, since this response simply never computed them this time.
      widgets: widgets as {
        totalInventoryCount: number;
        oldestAgeDays: number;
        totalEvaluation: number;
        uniqueProducts: string[];
        uniqueWarehouses: string[];
        uniqueDates: string[];
      } | null,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to fetch stock",
      data: [],
      totalCount: 0,
      isAdmin: false,
      scope: "self" as const,
      widgets: null,
    };
  }
}

// Unpaginated companion to fetchInventoryPageAction, for Export/"Select all
// matching" - same filters, every matching row instead of one page.
export async function fetchAllInventoryForExportAction(opts: InventoryFilterOpts) {
  const supabase = getAdminClient();
  try {
    const { factory, granted } = await buildScopedStockQueryFactory(supabase);
    if (!granted) {
      return { success: false, error: "Not authorized", data: [] };
    }

    const applier = await resolveInventoryFilterApplier(supabase, opts);
    if (applier === null) return { success: true, data: [] };

    const PAGE_SIZE = 1000;
    let allRows: any[] = [];
    let from = 0;
    while (true) {
      // A fresh base query is built every iteration (factory(...), not a
      // reused builder) since a Postgrest builder is single-use once
      // awaited - re-ranging the same already-awaited query past its first
      // page silently returns nothing instead of the next chunk.
      const { data, error } = await applier(factory(STOCK_SELECT_CLAUSE).neq("status", "sold_out"))
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const page = data || [];
      allRows = allRows.concat(page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return { success: true, data: allRows };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch inventory for export", data: [] };
  }
}

export async function deleteStockAction(ids: string[]) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || caller.role !== "admin") {
      return { success: false, error: "Only Admin can delete inventory items" };
    }
    if (!ids || ids.length === 0) {
      return { success: false, error: "No items selected" };
    }

    const supabase = getAdminClient();

    // Read the rows before deleting them - once gone, there's nothing left to
    // log against. A stock row that's already sold_out and referenced by a
    // sale_items row will have that reference silently SET NULL by the
    // database's own foreign key on delete (not blocked) - the sale record
    // survives, but loses which physical serial it was tied to. The UI is
    // expected to warn about this before calling here; this action doesn't
    // block it, since "delete anything" was the explicit ask.
    const { data: rowsToDelete } = await supabase
      .from("stock")
      .select("serial_no, status")
      .in("id", ids);

    const { error, count } = await supabase
      .from("stock")
      .delete({ count: "exact" })
      .in("id", ids);

    if (error) throw error;

    try {
      const serials = (rowsToDelete || []).map((r: any) => r.serial_no).filter(Boolean);
      const preview = serials.slice(0, 10).join(", ") + (serials.length > 10 ? ` and ${serials.length - 10} more` : "");
      await supabase.from("activity_logs").insert({
        action: "Inventory Item(s) Deleted",
        details: `Admin permanently deleted ${ids.length} stock item(s): ${preview || "(no serial numbers on record)"}`,
      });
    } catch {
      // Non-critical, don't fail the delete over a log-write failure
    }

    return { success: true, deletedCount: count ?? ids.length };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete inventory item(s)" };
  }
}

export async function verifySerialNumberAction(sNo: string, currentJobId?: string) {
  // Green (success) if the serial number exists in the `stock` table AND has
  // no Stage 2 approved installation against it; red (failure) otherwise.
  // Where the unit currently sits doesn't matter - warehouse, distributor,
  // sub dealer, or already sold to a consumer via Sell Out (which also marks
  // stock sold_out, so stock.status is deliberately NOT the check here).
  // Pending installations against the same serial don't block either: several
  // installers may submit while it's pending, and duplicates are surfaced to
  // the admin for review instead.
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
      .ilike("serial_no", escapeLikePattern(cleanSNo))
      .maybeSingle();

    if (stockError) throw stockError;

    if (!stockData) {
      return { success: false, error: "Serial number not found in inventory." };
    }

    const { data: approvedJobs, error: approvedError } = await supabase
      .from("installer_jobs")
      .select("id")
      .ilike("serial_number", escapeLikePattern(cleanSNo))
      .in("status", APPROVED_JOB_STATUSES)
      .limit(1);
    if (approvedError) throw approvedError;
    if (approvedJobs && approvedJobs.length > 0) {
      return { success: false, error: "This serial number already has a Stage 2 approved installation." };
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

// null when the installer may submit, otherwise the reason they can't.
async function installerSubmitAccessError(installerId: string): Promise<string | null> {
  const supabase = getAdminClient();
  const { data: profile, error } = await supabase.from("profiles").select("status").eq("id", installerId).maybeSingle();
  if (error) throw error;
  const status = String(profile?.status || "").trim().toLowerCase();
  if (status === "approved" || status === "active") return null;
  if (status === "rejected" || status === "blocked") return "Your installer registration was rejected, so you can't submit installations.";
  if (status === "inactive") return "Your installer account is inactive, so you can't submit installations.";
  return "Your installer account isn't approved yet. You can submit installations once it has been verified and approved.";
}

export async function submitInstallationAction(payload: any, siteFormJobId: string, accessToken?: string) {
  // === SERVER-SIDE IDENTITY CHECK ===
  // This action previously trusted payload.installer_id outright on a new
  // submission, and matched an update by job id alone — no verification
  // anywhere that the caller was actually the installer they claimed to be,
  // or actually owned the job they were editing. accessToken lets a caller
  // with no cookie session (the mobile app) prove identity the same way a
  // web caller's cookie does; either way, everything below is now scoped to
  // whoever this resolves to, never to whatever the client claims in payload.
  // Failure results carry `retryable: true` when the same submission could
  // still succeed later (session not resolved, database hiccup) - the web
  // portal's device-saved sync keeps those, and drops only real refusals.
  const caller = await getCallerIdentity(accessToken);
  if (!caller) {
    return { success: false, error: "Your session could not be verified — please try again.", retryable: true };
  }
  if (caller.role !== "installer") {
    return { success: false, error: "Not authorized to submit an installation." };
  }
  payload.installer_id = caller.id;
  payload.serial_number = String(payload.serial_number || "").trim();

  // Only an installer who has cleared both registration stages (verify, then
  // approve) may submit. Previously only the mobile app checked this, client-
  // side - the web portal never did, and this action trusted the role alone.
  // Same approved/active rule as coretech-mobile/lib/installerAccess.ts.
  let accessError: string | null;
  try {
    accessError = await installerSubmitAccessError(caller.id);
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to check your installer account status", retryable: true };
  }
  if (accessError) {
    return { success: false, error: accessError };
  }

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

    // 1. Same rule as verifySerialNumberAction, re-checked here so it can't be
    // skipped by calling this action directly: the serial must exist in stock
    // and must not already have a Stage 2 approved installation.
    const serialForCheck = String(payload.serial_number).trim();
    const stockCheck = await client.query(
      "SELECT id FROM public.stock WHERE LOWER(serial_no) = LOWER($1) LIMIT 1",
      [serialForCheck]
    );
    if (stockCheck.rows.length === 0) {
      throw new Error("Serial number not found in inventory.");
    }
    const approvedCheck = await client.query(
      "SELECT id FROM public.installer_jobs WHERE LOWER(TRIM(serial_number)) = LOWER($1) AND status = ANY($2) LIMIT 1",
      [serialForCheck, APPROVED_JOB_STATUSES]
    );
    if (approvedCheck.rows.length > 0) {
      throw new Error("This serial number already has a Stage 2 approved installation.");
    }

    // Note: deliberately NOT blocking on other active jobs sharing this serial number.
    // The item stays live in inventory until an admin approves a job against it, so
    // multiple installers are allowed to submit pending applications for the same
    // serial — the admin resolves the conflict (approve one, reject the rest) using
    // the duplicate-serial flag shown on the review screen.

    // 2. Insert or update the installation job record
    let jobResult;
    if (siteFormJobId && siteFormJobId !== "new") {
      // Ownership check: an installer may only resubmit their own job, never
      // one belonging to someone else, no matter what siteFormJobId points to.
      const ownerCheck = await client.query(
        "SELECT installer_id, status FROM public.installer_jobs WHERE id = $1 LIMIT 1",
        [siteFormJobId]
      );
      if (!ownerCheck.rows[0]) {
        throw new Error("Installation record not found.");
      }
      if (ownerCheck.rows[0].installer_id !== caller.id) {
        throw new Error("Not authorized to modify this installation record.");
      }
      // An approved installation is final - resubmitting it would move it back
      // to pending and could swap its serial while the old unit stays sold out.
      if (APPROVED_JOB_STATUSES.includes(String(ownerCheck.rows[0].status || "").toLowerCase())) {
        throw new Error("This installation is already approved and can't be changed.");
      }

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
         WHERE id = $7 AND installer_id = $8
         RETURNING id`,
        [
          payload.job_title,
          payload.address,
          payload.serial_number,
          payload.remarks || "",
          Array.isArray(payload.photos) ? payload.photos : [],
          payload.notes || "",
          siteFormJobId,
          caller.id
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
    await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
    // 23505 on the primary key: a job with this id already exists - this exact
    // submission already went through earlier, nothing to retry or redo.
    // 23505 on installer_jobs_serial_number_unique (a DB-level unique index
    // on serial_number, any status): another job already uses this exact
    // serial - a real refusal, not "already submitted".
    if (err?.code === "23505") {
      if (err?.constraint === "installer_jobs_pkey") {
        return { success: false, error: "This installation was already submitted.", alreadySubmitted: true };
      }
      return { success: false, error: "Another installation has already been submitted with this serial number." };
    }
    // The rule checks above throw plain Errors (no code) - those are real
    // refusals. Anything carrying a code came from the database or network.
    return { success: false, error: err.message || "Failed to process installation transaction", retryable: Boolean(err?.code) };
  }
}

// Strips characters that are syntactically significant inside a PostgREST
// .or() filter string (comma separates conditions, parens group them) -
// escapeLikePattern alone only protects ILIKE wildcards, not this. A search
// term containing any of these just has them dropped rather than breaking
// the query. If sanitizing empties an otherwise non-blank search term (e.g.
// the user typed only "(" or ","), the caller must treat that as "zero rows
// match" - NOT "no filter" - see buildFilteredJobsQueryFactory below.
function sanitizeForOrFilter(value: string): string {
  return value.replace(/[,()]/g, " ").trim();
}

const JOB_STATUS_GROUPS: Record<string, string[]> = {
  pending_rm: ["pending_verification", "assigned", "in_progress"],
  pending_ch: ["pending_approval", "pending_installation_approval"],
  approved: ["approved"],
  rejected: ["rejected"],
};

// Chunked past 1000 rows - the installer-name search below is realistically
// small (matches within role=installer profiles), but every other full read
// in this file pages through the same way rather than assuming a table
// stays under PostgREST's default cap forever.
async function resolveMatchingInstallerIds(supabase: any, search: string): Promise<string[]> {
  const pattern = escapeLikePattern(search);
  const PAGE_SIZE = 1000;
  let ids: string[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "installer")
      .or(`first_name.ilike.%${pattern}%,last_name.ilike.%${pattern}%`)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    ids = ids.concat(page.map((p: any) => p.id));
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return ids;
}

// Shared by fetchInstallerJobsPageAction and fetchAllInstallerJobsForExportAction,
// so the status/search filtering logic (and its edge cases) only exists once.
// Returns:
//  - null: the raw search term was non-blank but sanitized down to nothing -
//    the caller must return zero rows, not fall through to an unfiltered query.
//  - a factory function otherwise: Postgrest query builders are single-use
//    once awaited, so a fresh one has to be built for every page/chunk a
//    caller reads (same pattern fetchStockAction already uses below) -
//    returning an already-built query here would break the export path's
//    chunked read loop after its first iteration.
async function buildFilteredJobsQueryFactory(
  supabase: any,
  selectClause: string,
  selectOpts: { count: "exact" } | undefined,
  statusFilter: string,
  rawSearch: string
): Promise<(() => any) | null> {
  const hadRawSearch = (rawSearch || "").trim().length > 0;
  const search = sanitizeForOrFilter(rawSearch || "");
  if (hadRawSearch && !search) return null;

  const matchingInstallerIds = search ? await resolveMatchingInstallerIds(supabase, search) : [];

  return () => {
    let q = selectOpts
      ? supabase.from("installer_jobs").select(selectClause, selectOpts)
      : supabase.from("installer_jobs").select(selectClause);
    if (statusFilter !== "all") {
      q = q.in("status", JOB_STATUS_GROUPS[statusFilter]);
    }
    if (search) {
      const pattern = escapeLikePattern(search);
      const orParts = [`address.ilike.%${pattern}%`, `serial_number.ilike.%${pattern}%`];
      if (matchingInstallerIds.length > 0) {
        orParts.push(`installer_id.in.(${matchingInstallerIds.join(",")})`);
      }
      q = q.or(orParts.join(","));
    }
    return q.order("created_at", { ascending: false });
  };
}

// Table-wide count of how many non-rejected jobs share each serial number -
// feeds the "⚠ Duplicate" badge on both the paginated view and the Export/
// "Select all matching" path, deliberately unfiltered by the caller's own
// status/search so a duplicate sitting in a different tab is still caught
// (matches the original client-side logic, which scanned every loaded job
// regardless of the active filter). Chunked past 1000 rows for the same
// reason as everything else in this file - non-rejected installer_jobs rows
// can already be in that range.
async function fetchActiveSerialCounts(supabase: any): Promise<Record<string, number>> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("installer_jobs")
      .select("serial_number")
      .neq("status", "rejected")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    allRows = allRows.concat(page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const counts: Record<string, number> = {};
  allRows.forEach((r: any) => {
    const sn = (r.serial_number || "").trim().toLowerCase();
    if (sn) counts[sn] = (counts[sn] || 0) + 1;
  });
  return counts;
}

const JOB_SELECT_CLAUSE = `
  id, job_title, address, status, payment_status, created_at, photos, notes,
  serial_number, remarks, incentive,
  installer:profiles!installer_id(first_name, last_name, contact, payment_provider, payment_account_no)
`;

// Paginated, server-filtered replacement for fetching every installer_jobs
// row into the browser on every page load (the old approach, no range/limit
// at all, silently capped at PostgREST's 1000-row default - the exact bug
// already found and fixed for `stock` in August, never applied here). Also
// computes the per-status tab counts and the active-serial duplicate map
// from narrow, count-only/two-column queries instead of requiring the full
// row set to be in memory - this is what the Job Assignment page's "N
// Installation(s)" tiles and "⚠ Duplicate" badge now read from.
export async function fetchInstallerJobsPageAction(opts: {
  page: number;
  pageSize: number;
  statusFilter: "all" | "pending_rm" | "pending_ch" | "approved" | "rejected";
  search?: string;
}) {
  // Server actions are directly callable (not just reachable through the
  // page's own middleware-gated route), unlike the old inline client-side
  // query this replaces, which only ever ran inside a session already past
  // middleware. Re-checks the same installer.verify_installation grant the
  // page itself requires to be reachable at all, same pattern as
  // verifyJobStage1Action/approveJobStage2Action elsewhere in this file -
  // deny-by-default, not just "assume the caller got this far legitimately".
  const { granted } = await getMyScopeAction("installer.verify_installation");
  if (!granted) {
    return { success: false, error: "Not authorized", data: [], totalCount: 0, statusCounts: {}, activeSerialCounts: {} };
  }

  // This action is directly callable, not just reachable through the page's
  // own UI, which only ever sends sane values - an authorized-but-arbitrary
  // caller could otherwise request e.g. pageSize: 100000 (re-opening a
  // milder version of the "whole table in one response" problem this
  // action exists to fix) or a statusFilter string outside the literal
  // union (unenforceable at runtime, since this repo's own next.config.mjs
  // ignores TS errors at build - see CLAUDE.md).
  const page = Math.max(1, Math.floor(Number(opts.page)) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(opts.pageSize)) || 30));
  const statusFilter = (["all", ...Object.keys(JOB_STATUS_GROUPS)].includes(opts.statusFilter)
    ? opts.statusFilter
    : "all") as typeof opts.statusFilter;

  const supabase = getAdminClient();
  try {
    const factory = await buildFilteredJobsQueryFactory(
      supabase,
      JOB_SELECT_CLAUSE,
      { count: "exact" },
      statusFilter,
      opts.search || ""
    );

    const STATUS_KEYS = Object.keys(JOB_STATUS_GROUPS) as (keyof typeof JOB_STATUS_GROUPS)[];
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const [pageResult, countsArr, allTotalRes, activeSerialCounts] = await Promise.all([
      factory === null
        ? Promise.resolve({ data: [] as any[], count: 0, error: null as any })
        : factory().range(from, to),
      Promise.all(
        STATUS_KEYS.map(async (key) => {
          const { count, error } = await supabase
            .from("installer_jobs")
            .select("id", { count: "exact", head: true })
            .in("status", JOB_STATUS_GROUPS[key]);
          if (error) throw error;
          return [key, count || 0] as const;
        })
      ),
      supabase.from("installer_jobs").select("id", { count: "exact", head: true }),
      fetchActiveSerialCounts(supabase),
    ]);

    if (pageResult.error) throw pageResult.error;
    if (allTotalRes.error) throw allTotalRes.error;

    const statusCounts: Record<string, number> = Object.fromEntries(countsArr);
    statusCounts.all = allTotalRes.count || 0;

    return {
      success: true,
      data: pageResult.data || [],
      totalCount: pageResult.count || 0,
      statusCounts,
      activeSerialCounts,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to fetch jobs",
      data: [],
      totalCount: 0,
      statusCounts: {},
      activeSerialCounts: {},
    };
  }
}

// Unpaginated companion to fetchInstallerJobsPageAction, for Export/"Select
// all matching" - same status+search filter, every matching row instead of
// one page, plus the same table-wide duplicate-serial map (not scoped to
// just the exported rows - a duplicate sitting outside the current filter
// must still be flagged on the exported rows that share its serial). Only
// called on demand (button click), never loaded into page state
// automatically, so the per-page view above never pays this cost.
export async function fetchAllInstallerJobsForExportAction(opts: {
  statusFilter: "all" | "pending_rm" | "pending_ch" | "approved" | "rejected";
  search?: string;
}) {
  // Same re-check as fetchInstallerJobsPageAction above - this one hands
  // back the full matching set (Export/"Select all matching"), so skipping
  // it here would be the bigger hole of the two.
  const { granted } = await getMyScopeAction("installer.verify_installation");
  if (!granted) {
    return { success: false, error: "Not authorized", data: [], activeSerialCounts: {} };
  }

  // Same defense as fetchInstallerJobsPageAction - a directly-callable
  // action can't trust the literal union is actually enforced at runtime.
  const statusFilter = (["all", ...Object.keys(JOB_STATUS_GROUPS)].includes(opts.statusFilter)
    ? opts.statusFilter
    : "all") as typeof opts.statusFilter;

  const supabase = getAdminClient();
  try {
    const factory = await buildFilteredJobsQueryFactory(
      supabase,
      JOB_SELECT_CLAUSE,
      undefined,
      statusFilter,
      opts.search || ""
    );

    const [allRows, activeSerialCounts] = await Promise.all([
      factory === null
        ? Promise.resolve([] as any[])
        : (async () => {
            // Same 1000-row-per-response ceiling as stock - page through
            // until a page comes back short, so export always returns every
            // matching row no matter how large the table grows. A fresh
            // query is built each iteration (factory(), not a reused
            // builder) since a Postgrest builder is single-use once awaited.
            const PAGE_SIZE = 1000;
            let rows: any[] = [];
            let from = 0;
            while (true) {
              const { data, error } = await factory().range(from, from + PAGE_SIZE - 1);
              if (error) throw error;
              const page = data || [];
              rows = rows.concat(page);
              if (page.length < PAGE_SIZE) break;
              from += PAGE_SIZE;
            }
            return rows;
          })(),
      fetchActiveSerialCounts(supabase),
    ]);

    return { success: true, data: allRows, activeSerialCounts };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch jobs for export", data: [], activeSerialCounts: {} };
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

    // Only from Stage 1 - verifying an already approved job would move it
    // back to pending and free its serial for a duplicate approval.
    const supabase = getAdminClient();
    const { data: updated, error } = await supabase
      .from("installer_jobs")
      .update({
        status: "pending_approval",
        verified_by: caller.id,
        verified_at: new Date().toISOString(),
        verification_note: (note || "").trim(),
      })
      .eq("id", jobId)
      .in("status", JOB_STATUS_GROUPS.pending_rm)
      .select("id");

    if (error) throw error;
    if (!updated || updated.length === 0) {
      return { success: false, error: "This installation is no longer waiting for Stage 1 verification — please refresh." };
    }
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

    // One transaction, with the job and its stock row locked, so two duplicate
    // jobs for the same serial can't both be approved at the same moment. The
    // serial comes from the job record itself - the serialNumber argument from
    // the browser is no longer trusted for this.
    const { Client } = require("pg");
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    try {
      await client.query("BEGIN");

      const jobRes = await client.query(
        "SELECT id, status, serial_number, installer_id FROM public.installer_jobs WHERE id = $1 FOR UPDATE",
        [jobId]
      );
      const job = jobRes.rows[0];
      if (!job) throw new Error("Installation record not found.");
      if (!STAGE2_PENDING_JOB_STATUSES.includes(String(job.status || "").toLowerCase())) {
        throw new Error("This installation isn't waiting for Stage 2 approval — please refresh.");
      }

      const sn = String(job.serial_number || "").trim();
      if (sn) {
        await client.query("SELECT id FROM public.stock WHERE LOWER(serial_no) = LOWER($1) FOR UPDATE", [sn]);
        const otherApproved = await client.query(
          "SELECT id FROM public.installer_jobs WHERE LOWER(TRIM(serial_number)) = LOWER($1) AND status = ANY($2) AND id <> $3 LIMIT 1",
          [sn, APPROVED_JOB_STATUSES, jobId]
        );
        if (otherApproved.rows.length > 0) {
          throw new Error(`Serial ${sn} already has a Stage 2 approved installation — reject this duplicate instead.`);
        }
      }

      await client.query(
        "UPDATE public.installer_jobs SET status = 'approved', approved_by = $2, approved_at = NOW(), approval_note = $3 WHERE id = $1",
        [jobId, caller.id, (note || "").trim()]
      );

      if (sn) {
        // sold_out_by_installer_id is FK-constrained to profiles.id - passing
        // jobId here (as this used to) silently violated that constraint and
        // failed on effectively every approval. It records that THIS
        // installation sold the unit - so it's only set when the approval is
        // what sells it. A unit already sold to a consumer via Sell Out keeps
        // its sale (date, no installer seller) and just gets linked to this
        // installation; undoing the installation then leaves it sold out
        // (revertInstallationStockWithClient and the DB trigger
        // fn_revert_rejected_installation_stock both use this marker).
        await client.query(
          `UPDATE public.stock
           SET sold_out_at = CASE WHEN status = 'sold_out' THEN COALESCE(sold_out_at, NOW()) ELSE NOW() END,
               sold_out_by_installer_id = CASE WHEN status = 'sold_out' THEN sold_out_by_installer_id ELSE $2 END,
               status = 'sold_out',
               installation_id = $3
           WHERE LOWER(serial_no) = LOWER($1)`,
          [sn, job.installer_id || null, jobId]
        );
      }

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      await client.end().catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to approve job" };
  }
}

// Incentive payment status: gated by write access on the same permission
// (installer.verify_installation) that gates the page this button lives on,
// one-way (unpaid -> paid), and only once the job has cleared Stage 2
// approval. Re-verified server-side rather than trusting the client, since a
// client-only check is trivially bypassed. Was hardcoded to caller.role ===
// "admin" - predates Role Management and never got migrated to it, unlike
// every other write action in this file.
export async function setJobPaymentPaidAction(jobId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) {
      return { success: false, error: "Not authenticated" };
    }
    const { canWrite } = await getMyScopeAction("installer.verify_installation");
    if (!canWrite) {
      return { success: false, error: "You don't have permission to mark incentive payments as paid" };
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
        details: `Installer incentive for job "${job.job_title}" marked as Paid`,
      });
    } catch {
      // Non-critical, don't fail the payment update over a log-write failure
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update payment status" };
  }
}

// Stock revert and the job's own status change happen in one transaction, so
// neither can land without the other. Only allowed from the stage the reject
// button belongs to - an approved installation is never undone by a reject.
async function rejectJobInternal(jobId: string, allowedStatuses: string[], note: string, callerId: string) {
  const { Client } = require("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    try {
      await client.query("BEGIN");
      const jobRes = await client.query("SELECT status FROM public.installer_jobs WHERE id = $1 FOR UPDATE", [jobId]);
      if (!jobRes.rows[0]) throw new Error("Installation record not found.");
      if (!allowedStatuses.includes(String(jobRes.rows[0].status || "").toLowerCase())) {
        throw new Error("This installation is no longer at this review stage — please refresh.");
      }

      await revertInstallationStockWithClient(client, jobId);

      await client.query(
        "UPDATE public.installer_jobs SET status = 'rejected', approved_by = $2, approved_at = NOW(), approval_note = $3 WHERE id = $1",
        [jobId, callerId, (note || "").trim() || "Rejected during site audit."]
      );
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      await client.end().catch(() => {});
    }
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
  return rejectJobInternal(jobId, JOB_STATUS_GROUPS.pending_rm, note, caller.id);
}

export async function rejectJobStage2Action(jobId: string, serialNumber: string, note: string) {
  const caller = await getCallerIdentity();
  if (!caller || !["country_head", "admin"].includes(caller.role || "")) {
    return { success: false, error: "Only Country Head or Admin can reject at this stage" };
  }
  return rejectJobInternal(jobId, STAGE2_PENDING_JOB_STATUSES, note, caller.id);
}

export async function fetchSellOutAction(opts?: CallerOpts) {
  const supabase = getAdminClient();
  try {
    const { scope, callerId, callerRegion, canWrite } = await getMyScopeAction("sales.sellout", opts);

    // A Postgrest query builder is single-use once awaited, so a fresh one
    // has to be built for every chunk fetched below (same pattern
    // fetchStockAction above uses).
    const buildQuery = () => {
      let q = supabase
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
        q = q.or(`distributor_id.eq.${callerId},sub_dealer_id.eq.${callerId}`);
      }
      return q.order("sold_out_at", { ascending: false });
    };

    // Chunked past 1000 rows - same silent PostgREST cap already found and
    // fixed for `stock` elsewhere in this file (confirmed live: rows beyond
    // the newest 1000 were silently never reaching the page). This query
    // hits the same table, filtered to status=sold_out but still unbounded.
    const PAGE_SIZE = 1000;
    let rows: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const page = data || [];
      rows = rows.concat(page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

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
    const consumerMap = new Map<string, { consumer_name: string; consumer_phone: string; site_address: string | null; receipt_url: string | null }>();
    if (stockIds.length > 0) {
      const { data: items } = await supabase.from("sale_items").select("stock_id, sale_id").in("stock_id", stockIds);
      const saleIds = Array.from(new Set((items || []).map((i: any) => i.sale_id)));
      if (saleIds.length > 0) {
        const { data: salesRows } = await supabase
          .from("sales")
          .select("id, consumer_name, consumer_phone, site_address, receipt_url")
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

// Undoes what a Stage 2 approval did to stock, for this job only - the unit
// whose installation_id points at this job. It used to also reset ANY sold-out
// unit carrying the same serial number, which meant rejecting or deleting a
// duplicate job wiped out a different job's approval, or un-sold a unit a
// consumer had bought via Sell Out. A unit that this approval didn't sell
// (already sold via Sell Out - no installer recorded as its seller) stays sold
// out and only loses its link to this job. The DB trigger
// fn_revert_rejected_installation_stock applies the same rule.
// Runs inside the caller's already-open transaction (rejectJobInternal), or
// its own via revertInstallationStock below. Throws on failure.
async function revertInstallationStockWithClient(client: any, jobId: string): Promise<number> {
  const stockRes = await client.query(
    "SELECT id, status, sold_out_by_installer_id FROM public.stock WHERE installation_id = $1 FOR UPDATE",
    [jobId]
  );

  for (const row of stockRes.rows) {
    // Sold out with no installer recorded as the seller = this installation
    // didn't sell it (it was sold via Sell Out before the approval - see
    // approveJobStage2Action), so the sale stands.
    const soldOtherwise = row.status === "sold_out" && !row.sold_out_by_installer_id;

    if (soldOtherwise) {
      await client.query(`
        UPDATE public.stock
        SET sold_out_by_installer_id = NULL,
            installation_id = NULL,
            installation_project_title = NULL,
            deployment_site_address = NULL
        WHERE id = $1;
      `, [row.id]);
    } else {
      await client.query(`
        UPDATE public.stock
        SET status = 'active',
            sold_out_at = NULL,
            sold_out_by_installer_id = NULL,
            installation_id = NULL,
            installation_project_title = NULL,
            deployment_site_address = NULL
        WHERE id = $1;
      `, [row.id]);
    }
  }
  return stockRes.rows.length;
}

async function revertInstallationStock(jobId: string): Promise<{ success: boolean; count?: number; error?: string }> {
  const { Client } = require("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query("BEGIN");
    const count = await revertInstallationStockWithClient(client, jobId);
    await client.query("COMMIT");
    await client.end();
    return { success: true, count };
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch {}
    try { await client.end(); } catch {}
    return { success: false, error: err.message || "Failed to revert stock for rejected installation" };
  }
}

// Exported for the Job Assignment page's delete flow. Was callable by anyone
// with no check at all - now needs write access to Verify Installation, same
// as the page itself. serialNumber is no longer used (see above), kept so
// existing callers don't break.
export async function revertRejectedInstallationStockAction(jobId: string, serialNumber?: string) {
  const { canWrite } = await getMyScopeAction("installer.verify_installation");
  if (!canWrite) {
    return { success: false, error: "You don't have permission to change installation stock" };
  }
  return revertInstallationStock(jobId);
}

// Deleting a Sell Out record (Sell Out page) puts the unit back into active
// inventory. Was callable by anyone with no check - now needs write access to
// Sell Out. Refused outright when the unit has a Stage 2 approved
// installation: deleting the sale must never undo an approved installation.
export async function revertStockBySerialAction(serialNumber: string) {
  const { canWrite } = await getMyScopeAction("sales.sellout");
  if (!canWrite) {
    return { success: false, error: "You don't have permission to delete Sell Out records" };
  }

  const { Client } = require("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    // Locks the stock row first - the same lock approveJobStage2Action takes -
    // so an approval can't land between the check and the revert.
    await client.query("BEGIN");
    await client.query("SELECT id FROM public.stock WHERE LOWER(serial_no) = LOWER($1) FOR UPDATE", [serialNumber.trim()]);

    const approved = await client.query(
      "SELECT id FROM public.installer_jobs WHERE LOWER(TRIM(serial_number)) = LOWER($1) AND status = ANY($2) LIMIT 1",
      [serialNumber.trim(), APPROVED_JOB_STATUSES]
    );
    if (approved.rows.length > 0) {
      await client.query("ROLLBACK");
      await client.end();
      return {
        success: false,
        blockedByInstallation: true,
        error: `Serial ${serialNumber.trim()} has an approved installation — the Sell Out can't be deleted.`,
      };
    }

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

    await client.query("COMMIT");
    await client.end();
    return { success: true, count: res.rowCount };
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch {}
    try { await client.end(); } catch {}
    return { success: false, error: err.message || "Failed to revert stock" };
  }
}


