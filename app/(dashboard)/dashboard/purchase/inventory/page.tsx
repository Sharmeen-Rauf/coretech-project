"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import toast from "react-hot-toast";
import { createRecordAction, fetchRecordsAction, fetchProfilesAction } from "@/app/actions/users";
import { fetchStockAction, fetchProductsAction, deleteStockAction } from "@/app/actions/products";
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
  const perPage = 10;

  const fetchInventory = async () => {
    let dbData: any[] = [];
    setIsLoading(true);
    try {
      const [stockRes, prodRes, regRes] = await Promise.all([
        fetchStockAction().catch(() => ({ success: false, data: [], scope: "self" as const })),
        fetchProductsAction().catch(() => ({ success: false, data: [] })),
        fetchRecordsAction("regions").catch(() => ({ success: false, data: [] })),
      ]);

      if (stockRes.success && stockRes.data) {
        dbData = stockRes.data.filter((item: any) => item.status !== "sold_out");
      }
      setIsAdmin(!!(stockRes as any).isAdmin);
      const currentScope = ((stockRes as any).scope || "self") as "self" | "region" | "everything";
      setScope(currentScope);

      // Distributor/Sub-Dealer/Region filters are only meaningful (and only
      // shown) to a caller whose Inventory scope is "everything" - a scoped
      // user only ever sees their own slice anyway.
      if (currentScope === "everything") {
        const [distRes, subRes] = await Promise.all([
          fetchProfilesAction("distributor").catch(() => ({ success: false, data: [] })),
          fetchProfilesAction("sub_dealer").catch(() => ({ success: false, data: [] })),
        ]);
        if (distRes.success) setDistributors(distRes.data || []);
        if (subRes.success) setSubDealers(subRes.data || []);
      }

      let productsList: any[] = [];
      if (prodRes.success && prodRes.data) {
        productsList = prodRes.data;
      }
      const localProducts = getLocalItems("coretech_local_products") || [];
      const allProducts = [...productsList, ...localProducts];

      let regionsList: any[] = [];
      if (regRes.success && regRes.data) {
        regionsList = regRes.data;
      }
      const localRegions = getLocalItems("coretech_local_regions") || [];
      const allRegions = [...regionsList, ...localRegions];

      const formattedDb = dbData.map((row: any) => {
        const rawWh = row.warehouse_name || "-";
        const matched = allRegions.find((r: any) => 
          r.region_code?.toLowerCase() === rawWh.toLowerCase() ||
          r.name?.toLowerCase() === rawWh.toLowerCase() ||
          r.id === rawWh
        );
        let resolvedWh = matched ? matched.warehouse : rawWh;
        if (resolvedWh === "275") {
          resolvedWh = "Main Warehouse (275)";
        }

        return {
          id: row.id,
          product_name: row.products?.name || "Unknown Product",
          brand: row.products?.brand || "-",
          model: row.model_no || row.products?.model || "-",
          serial_no: row.serial_no || "-",
          warehouse_name: resolvedWh,
          quantity: row.quantity ?? 0,
          sale_price: row.products?.price ?? 0,
          import_date: row.import_date || "-",
          created_at: row.created_at || row.import_date || "",
          distributor_id: row.distributor_id || null,
          sub_dealer_id: row.sub_dealer_id || null,
        };
      });

      const localStock = getLocalItems("coretech_local_stock") || [];
      setLocalStockCount(localStock.length);
      const formattedLocal = localStock.map((row: any, idx: number) => {
        const prod = allProducts.find((p: any) => p.id === row.product_id);
        const rawWh = row.warehouse_name || "-";
        const matched = allRegions.find((r: any) => 
          r.region_code?.toLowerCase() === rawWh.toLowerCase() ||
          r.name?.toLowerCase() === rawWh.toLowerCase() ||
          r.id === rawWh
        );
        let resolvedWh = matched ? matched.warehouse : rawWh;
        if (resolvedWh === "275") {
          resolvedWh = "Main Warehouse (275)";
        }

        return {
          id: row.id || `local-${idx}`,
          product_name: prod?.name || "Unknown Product",
          brand: prod?.brand || "-",
          model: row.model_no || prod?.model || "-",
          serial_no: row.serial_no || "-",
          warehouse_name: resolvedWh,
          quantity: row.quantity ?? 0,
          sale_price: prod?.price ?? 0,
          import_date: row.import_date || "-",
          created_at: row.import_date || "",
        };
      });

      // Combine both lists and avoid duplicates by serial number
      const combined = [...formattedDb];
      formattedLocal.forEach((localItem: any) => {
        if (!combined.some((dbItem: any) => dbItem.serial_no === localItem.serial_no)) {
          combined.push(localItem);
        }
      });

      // Add visual sequence numbers (S.No)
      const finalStock = combined.map((item, idx) => ({
        ...item,
        sno: String(idx + 1).padStart(2, "0"),
      }));

      setStock(finalStock);
    } catch (err: any) {
      toast.error(err.message || "Failed to load inventory");
    } finally {
      setIsLoading(false);
    }
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
      fetchInventory();
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
      fetchInventory();
    } else {
      toast.error(res.error || "Failed to delete items.");
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchInventory().then(() => {
      const localStock = getLocalItems("coretech_local_stock") || [];
      if (localStock.length > 0) {
        syncLocalStock();
      }
    });
  }, []);

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
      await fetchInventory();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync local stock");
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter states
  const [filterDate, setFilterDate] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  // Advanced filters - only shown/usable at "everything" scope.
  const [filterDistributorId, setFilterDistributorId] = useState("");
  const [filterSubDealerId, setFilterSubDealerId] = useState("");

  const showAdvancedFilters = scope === "everything";

  // Derive unique products & warehouses for filter dropdowns
  const uniqueProducts = Array.from(new Set(stock.map((item) => item.product_name).filter((n) => n && n !== "Unknown Product")));
  const uniqueWarehouses = Array.from(new Set(stock.map((item) => item.warehouse_name).filter((w) => w && w !== "-")));
  const uniqueDates = Array.from(new Set(stock.map((item) => item.import_date).filter((d) => d && d !== "-"))).sort().reverse();

  // Sub-Dealer options cascade from the selected Distributor - a sub-dealer
  // belongs to exactly one distributor (profiles.distributor_id).
  const filteredSubDealers = filterDistributorId
    ? subDealers.filter((s) => s.distributor_id === filterDistributorId)
    : subDealers;

  const filtered = stock.filter((item) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = (
        item.product_name.toLowerCase().includes(q) ||
        item.serial_no.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.warehouse_name.toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;
    }

    // Date filter
    if (filterDate && item.import_date !== filterDate) return false;

    // Product filter
    if (filterProduct && item.product_name.toLowerCase() !== filterProduct.toLowerCase()) return false;

    // Warehouse filter
    if (filterWarehouse && item.warehouse_name.toLowerCase() !== filterWarehouse.toLowerCase()) return false;

    // Advanced filters (everything-scope only) - Distributor matches both the
    // distributor's own unclaimed stock and anything since passed on to one of
    // their sub-dealers (a stock row keeps distributor_id set either way).
    if (showAdvancedFilters) {
      if (filterDistributorId && item.distributor_id !== filterDistributorId) return false;
      if (filterSubDealerId && item.sub_dealer_id !== filterSubDealerId) return false;
    }

    return true;
  });

  const paginated = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

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

  // Top summary widgets — always reflect the whole inventory, not just the current filter/search
  const totalInventoryCount = stock.length;

  const oldestAgeDays = stock.reduce((maxDays, item) => {
    const ts = item.created_at ? new Date(item.created_at).getTime() : NaN;
    if (isNaN(ts)) return maxDays;
    const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    return Math.max(maxDays, days);
  }, 0);

  const totalEvaluation = stock.reduce((sum, item) => sum + (item.sale_price || 0) * (item.quantity || 1), 0);

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

      <DataTable allData={filtered}
        title="Warehouse Inventory"
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        searchPlaceholder="Search product name or serial number..."
        onSearch={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        pagination={{
          current: currentPage,
          total: filtered.length,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
        onDeleteClick={isAdmin ? handleDeleteStock : undefined}
        onBulkDelete={isAdmin ? handleBulkDeleteStock : undefined}
      />
    </div>
  );
}

