"use client";

import React, { useEffect, useRef, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import toast from "react-hot-toast";
import { createRecordAction, fetchProfilesAction } from "@/app/actions/users";
import { fetchInventoryPageAction, fetchAllInventoryForExportAction, fetchProductsAction, deleteStockAction } from "@/app/actions/products";
import { getLocalItems } from "@/lib/supabaseLocalFallback";
import { Loader2, RefreshCw, Boxes, Clock, Wallet } from "lucide-react";

interface StockItem {
  id: string;
  sno: string;
  product_name: string;
  brand: string;
  model: string;
  serial_no: string;
  warehouse_name: string;
  quantity: number;
  sale_price: number;
  import_date: string;
  created_at?: string;
  distributor_id?: string | null;
  sub_dealer_id?: string | null;
}

interface ProfileOption {
  id: string;
  first_name: string;
  last_name: string | null;
  distributor_id?: string | null;
}

export default function InventoryPage() {
  const supabase = createClientComponentClient();

  const [stock, setStock] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const [localStockCount, setLocalStockCount] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [scope, setScope] = useState<"self" | "region" | "everything">("self");
  const [distributors, setDistributors] = useState<ProfileOption[]>([]);
  const [subDealers, setSubDealers] = useState<ProfileOption[]>([]);
  const perPage = 30;

  // Server-reported total matching the current filter/search (what the
  // pagination controls below paginate over), plus the 3 summary widgets
  // and 3 filter-dropdown option lists, all computed server-side and always
  // reflecting the whole (scoped) inventory regardless of the current
  // filter/search - same rule the page always documented, now actually
  // enforced via fetchInventoryWidgetsAndFilterOptions instead of scanning
  // whatever happened to already be loaded in the browser.
  const [pageTotalCount, setPageTotalCount] = useState(0);
  const [totalInventoryCount, setTotalInventoryCount] = useState(0);
  const [oldestAgeDays, setOldestAgeDays] = useState(0);
  const [totalEvaluation, setTotalEvaluation] = useState(0);
  const [uniqueProducts, setUniqueProducts] = useState<string[]>([]);
  const [uniqueWarehouses, setUniqueWarehouses] = useState<string[]>([]);
  const [uniqueDates, setUniqueDates] = useState<string[]>([]);

  // Filter states
  const [filterDate, setFilterDate] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  // Advanced filters - only shown/usable at "everything" scope.
  const [filterDistributorId, setFilterDistributorId] = useState("");
  const [filterSubDealerId, setFilterSubDealerId] = useState("");

  const showAdvancedFilters = scope === "everything";

  // Sub-Dealer options cascade from the selected Distributor - a sub-dealer
  // belongs to exactly one distributor (profiles.distributor_id).
  const filteredSubDealers = filterDistributorId
    ? subDealers.filter((s) => s.distributor_id === filterDistributorId)
    : subDealers;

  const formatStockRow = (row: any): Omit<StockItem, "sno"> => ({
    id: row.id,
    product_name: row.products?.name || "Unknown Product",
    brand: row.products?.brand || "-",
    model: row.model_no || row.products?.model || "-",
    serial_no: row.serial_no || "-",
    // Resolving a warehouse code to a friendlier display label (e.g. "275"
    // -> "Main Warehouse (275)") was previously done client-side against the
    // regions table, scanned per row. That's dropped here for now - this
    // page's filter dropdown shows the same raw warehouse_name used for
    // filtering/display, documented as a known simplification rather than
    // silently re-adding a full-table regions scan per request.
    warehouse_name: row.warehouse_name || "-",
    quantity: row.quantity ?? 0,
    sale_price: row.products?.price ?? 0,
    import_date: row.import_date || "-",
    created_at: row.created_at || row.import_date || "",
    distributor_id: row.distributor_id || null,
    sub_dealer_id: row.sub_dealer_id || null,
  });

  // Guards against a slower, older request's response landing after a
  // newer one and clobbering it - same pattern as Job Assignment's fetchData.
  const fetchRequestIdRef = useRef(0);

  // includeWidgets defaults to false - the 3 summary tiles and 3 filter
  // dropdown option lists are a full (chunked) scope-wide table scan,
  // deliberately unfiltered by search/page/filters ("always reflect the
  // whole inventory"), so recomputing them on every page turn or keystroke
  // would re-scan the entire table for no reason. Only requested on initial
  // load and after a mutation (delete/sync) that could actually change them.
  const fetchInventory = async (includeWidgets = false) => {
    const requestId = ++fetchRequestIdRef.current;
    setIsLoading(true);
    try {
      const res = await fetchInventoryPageAction({
        page: currentPage,
        pageSize: perPage,
        search: searchQuery,
        filterDate,
        filterProduct,
        filterWarehouse,
        filterDistributorId,
        filterSubDealerId,
        includeWidgets,
      });

      if (requestId !== fetchRequestIdRef.current) return;

      if (!res.success) throw new Error(res.error || "Failed to load inventory");

      setIsAdmin(!!res.isAdmin);
      setScope(res.scope as "self" | "region" | "everything");

      if (res.scope === "everything") {
        const [distRes, subRes] = await Promise.all([
          fetchProfilesAction("distributor").catch(() => ({ success: false, data: [] })),
          fetchProfilesAction("sub_dealer").catch(() => ({ success: false, data: [] })),
        ]);
        if (requestId !== fetchRequestIdRef.current) return;
        if (distRes.success) setDistributors(distRes.data || []);
        if (subRes.success) setSubDealers(subRes.data || []);
      }

      const formatted: StockItem[] = res.data.map(formatStockRow).map((item: Omit<StockItem, "sno">, idx: number) => ({
        ...item,
        sno: String((currentPage - 1) * perPage + idx + 1).padStart(2, "0"),
      }));

      // A delete (single or bulk) can empty out the page currently being
      // viewed without it being the last page overall - step back one page
      // instead of leaving an empty table in view (same pattern as Job
      // Assignment's fetchData).
      if (formatted.length === 0 && currentPage > 1 && res.totalCount > 0) {
        setStock([]);
        setCurrentPage((p) => Math.max(1, p - 1));
        return;
      }

      setStock(formatted);
      setPageTotalCount(res.totalCount);
      if (res.widgets) {
        setTotalInventoryCount(res.widgets.totalInventoryCount);
        setOldestAgeDays(res.widgets.oldestAgeDays);
        setTotalEvaluation(res.widgets.totalEvaluation);
        setUniqueProducts(res.widgets.uniqueProducts);
        setUniqueWarehouses(res.widgets.uniqueWarehouses);
        setUniqueDates(res.widgets.uniqueDates);
      }

      // Disclosed simplification: previously-queued local-fallback items
      // (Supabase write failures saved to the browser's own localStorage,
      // see lib/supabaseLocalFallback.ts) no longer get merged directly into
      // the displayed table rows the way they did before this page moved to
      // server-side pagination - merging a client-only array into a
      // server-paginated page doesn't have a well-defined "page" to live on.
      // They're still surfaced via the "Sync Local Stock to Cloud Database
      // (N pending)" banner/button below and this count, and syncing moves
      // them into the real table immediately - but until synced, they will
      // NOT appear as rows here. Per this project's own CLAUDE.md, this
      // local-fallback mechanism exists to mask backend write failures, not
      // as an intentional offline-first design - worth revisiting if pending
      // items are ever expected to sit unsynced for a meaningful stretch.
      const localStock = getLocalItems("coretech_local_stock") || [];
      setLocalStockCount(localStock.length);
    } catch (err: any) {
      if (requestId !== fetchRequestIdRef.current) return;
      toast.error(err.message || "Failed to load inventory");
    } finally {
      if (requestId === fetchRequestIdRef.current) setIsLoading(false);
    }
  };

  // Fetches EVERY row matching the current filter/search (not just the
  // current page) - passed to DataTable as onFetchAll, called only when
  // Export or "Select all matching" is actually clicked.
  const fetchAllMatchingInventory = async (): Promise<StockItem[]> => {
    const res = await fetchAllInventoryForExportAction({
      search: searchQuery,
      filterDate,
      filterProduct,
      filterWarehouse,
      filterDistributorId,
      filterSubDealerId,
    });
    if (!res.success) throw new Error(res.error || "Failed to load records");
    return res.data.map(formatStockRow).map((item: Omit<StockItem, "sno">, idx: number) => ({
      ...item,
      sno: String(idx + 1).padStart(2, "0"),
    }));
  };

  // Admin-only, permanent - not tied to purchase.inventory's own read/write
  // toggle in Role Management (other roles already have that on). Server side
  // independently re-checks the caller is admin regardless of what this button
  // shows.
  const handleDeleteStock = async (row: StockItem) => {
    if (!window.confirm(`Permanently delete serial "${row.serial_no}" from inventory? This cannot be undone.`)) {
      return;
    }
    const res = await deleteStockAction([row.id]);
    if (res.success) {
      toast.success("Item permanently deleted from inventory.");
      fetchInventory(true); // a delete changes the summary widgets too
    } else {
      toast.error(res.error || "Failed to delete item.");
    }
  };

  const handleBulkDeleteStock = async (selectedIds: string[]) => {
    if (!window.confirm(`Permanently delete ${selectedIds.length} item(s) from inventory? This cannot be undone.`)) {
      return;
    }
    const res = await deleteStockAction(selectedIds);
    if (res.success) {
      toast.success(`Permanently deleted ${(res as any).deletedCount ?? selectedIds.length} item(s) from inventory.`);
      fetchInventory(true);
    } else {
      toast.error(res.error || "Failed to delete items.");
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const localStock = getLocalItems("coretech_local_stock") || [];
    if (localStock.length > 0) {
      syncLocalStock(); // calls fetchInventory() itself once syncing finishes
    }
  }, []);

  // Re-fetches whenever the page, search term, or any filter changes -
  // debounced only when this run was triggered by the search term itself
  // changing (same pattern as Job Assignment's fetchData). This also covers
  // the initial load (requesting widgets only that first time), so no
  // separate mount-only fetchInventory() call is needed above.
  const prevSearchQueryRef = useRef(searchQuery);
  const isFirstFetchRef = useRef(true);
  useEffect(() => {
    const searchChanged = prevSearchQueryRef.current !== searchQuery;
    prevSearchQueryRef.current = searchQuery;
    const isFirst = isFirstFetchRef.current;
    isFirstFetchRef.current = false;
    const handle = setTimeout(() => {
      fetchInventory(isFirst);
    }, searchChanged ? 350 : 0);
    return () => clearTimeout(handle);
  }, [currentPage, searchQuery, filterDate, filterProduct, filterWarehouse, filterDistributorId, filterSubDealerId]);

  const syncLocalStock = async () => {
    const localStock = getLocalItems("coretech_local_stock") || [];
    if (localStock.length === 0) {
      toast.error("No local stock items found to sync.");
      return;
    }

    setIsSyncing(true);
    try {
      // Load real, already-registered products from Product Management — no
      // auto-creation. A local item can only sync if it maps to a product code
      // that genuinely exists there.
      const dbProdsRes = await fetchProductsAction();
      const dbProds = dbProdsRes.success ? (dbProdsRes.data || []) : [];
      const codeMap = new Map<string, string>();
      dbProds.forEach((p: any) => {
        if (p.code) codeMap.set(p.code.toLowerCase().trim(), p.id);
      });

      // Local products fallback, only used to look up what code a queued item was for
      const localProds = getLocalItems("coretech_local_products") || [];
      const allProds = [...dbProds, ...localProds];

      let successCount = 0;
      const stillQueued: any[] = [];
      const failedReasons: string[] = [];

      for (const localItem of localStock) {
        const serial = (localItem.serial_no || "").trim();
        const prod = allProds.find((p: any) => p.id === localItem.product_id);

        if (!serial) {
          failedReasons.push("Missing serial number");
          stillQueued.push(localItem);
          continue;
        }

        const productId = prod?.code ? codeMap.get(prod.code.toLowerCase().trim()) : undefined;
        if (!productId) {
          failedReasons.push(`${serial}: product code "${prod?.code || "unknown"}" not found in Product Management`);
          stillQueued.push(localItem);
          continue;
        }

        const payload = {
          product_id: productId,
          serial_no: serial,
          warehouse_name: localItem.warehouse_name || "General Warehouse",
          import_date: localItem.import_date || new Date().toISOString().split('T')[0],
          quantity: localItem.quantity || 1,
        };

        const stockRes = await createRecordAction("stock", payload);
        if (stockRes.success) {
          successCount++;
        } else {
          failedReasons.push(`${serial}: ${stockRes.error || "insert failed"}`);
          stillQueued.push(localItem);
        }
      }

      // Only clear the items that actually synced — anything skipped stays queued
      // locally so it isn't silently lost.
      localStorage.setItem("coretech_local_stock", JSON.stringify(stillQueued));

      if (successCount > 0) {
        toast.success(`Synced ${successCount} stock item(s) to the cloud database!`);
      }
      if (failedReasons.length > 0) {
        toast.error(`${failedReasons.length} item(s) could not be synced — still queued locally.`);
      }
      await fetchInventory(true); // newly-synced stock changes the summary widgets too
    } catch (err: any) {
      toast.error(err.message || "Failed to sync local stock");
    } finally {
      setIsSyncing(false);
    }
  };

  const columns = [
    { key: "sno", label: "S.No" },
    { key: "product_name", label: "Product" },
    { key: "brand", label: "Brand" },
    { key: "serial_no", label: "Serial No" },
    { key: "warehouse_name", label: "Warehouse" },
    {
      key: "sale_price",
      label: "Sale Price",
      render: (val: number) => <span className="font-semibold text-slate-700">Rs. {val?.toLocaleString() || "0"}</span>,
    },
    { key: "import_date", label: "Import Date" },
  ];

  return (
    <div className="space-y-6 select-none">
      <div className="flex items-center justify-between border-b pb-4 border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
          <p className="text-xs text-slate-500">
            Monitor your current distributed warehouse stock items and quantities.
          </p>
        </div>
        {isMounted && localStockCount > 0 && (
          <button
            onClick={syncLocalStock}
            disabled={isSyncing}
            className="h-9 px-4 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 text-white text-xs font-bold rounded-[6px] shadow flex items-center gap-1.5 transition-all"
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Sync Local Stock to Cloud Database ({localStockCount} pending)</span>
          </button>
        )}
      </div>

      {/* Top summary widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#F0FAFE] text-[#00B4D8] rounded-[8px]">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Inventory</p>
            <p className="text-lg font-extrabold text-slate-800">{totalInventoryCount} Item(s)</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-[8px]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Inventory Aging</p>
            <p className="text-lg font-extrabold text-slate-800">{oldestAgeDays} Day(s)</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-[8px]">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Evaluation</p>
            <p className="text-lg font-extrabold text-slate-800">Rs. {totalEvaluation.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Date & Product Filter Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-[8px] p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filter Stock By:</span>
            
            {/* Import Date Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Date:</span>
              <select
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-700 focus:outline-none focus:border-[#00B4D8]"
              >
                <option value="">All Import Dates</option>
                {uniqueDates.map((date) => (
                  <option key={date} value={date}>{date}</option>
                ))}
              </select>
            </div>

            {/* Product Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Product:</span>
              <select
                value={filterProduct}
                onChange={(e) => {
                  setFilterProduct(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-700 focus:outline-none focus:border-[#00B4D8]"
              >
                <option value="">All Products</option>
                {uniqueProducts.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Warehouse Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Warehouse:</span>
              <select
                value={filterWarehouse}
                onChange={(e) => {
                  setFilterWarehouse(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-700 focus:outline-none focus:border-[#00B4D8]"
              >
                <option value="">All Warehouses</option>
                {uniqueWarehouses.map((wh) => (
                  <option key={wh} value={wh}>{wh}</option>
                ))}
              </select>
            </div>

            {/* Distributor / Sub-Dealer Filters - "everything" scope only */}
            {showAdvancedFilters && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Distributor:</span>
                  <select
                    value={filterDistributorId}
                    onChange={(e) => {
                      setFilterDistributorId(e.target.value);
                      setFilterSubDealerId("");
                      setCurrentPage(1);
                    }}
                    className="h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-700 focus:outline-none focus:border-[#00B4D8]"
                  >
                    <option value="">All Distributors</option>
                    {distributors.map((d) => (
                      <option key={d.id} value={d.id}>{d.first_name} {d.last_name || ""}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Sub-Dealer:</span>
                  <select
                    value={filterSubDealerId}
                    onChange={(e) => {
                      setFilterSubDealerId(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-700 focus:outline-none focus:border-[#00B4D8]"
                  >
                    <option value="">All Sub-Dealers</option>
                    {filteredSubDealers.map((s) => (
                      <option key={s.id} value={s.id}>{s.first_name} {s.last_name || ""}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Clear Filters button */}
            {(filterDate || filterProduct || filterWarehouse || filterDistributorId || filterSubDealerId) && (
              <button
                onClick={() => {
                  setFilterDate("");
                  setFilterProduct("");
                  setFilterWarehouse("");
                  setFilterDistributorId("");
                  setFilterSubDealerId("");
                  setCurrentPage(1);
                }}
                className="text-xs font-bold text-rose-600 hover:underline ml-2"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      <DataTable
        title="Warehouse Inventory"
        columns={columns}
        data={stock}
        isLoading={isLoading}
        searchPlaceholder="Search product name or serial number..."
        onSearch={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        onFetchAll={fetchAllMatchingInventory}
        pagination={{
          current: currentPage,
          total: pageTotalCount,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
        onDeleteClick={isAdmin ? handleDeleteStock : undefined}
        onBulkDelete={isAdmin ? handleBulkDeleteStock : undefined}
      />
    </div>
  );
}

