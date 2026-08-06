"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import toast from "react-hot-toast";
import { deleteRecordAction, createRecordAction, fetchRecordsAction } from "@/app/actions/users";
import { fetchStockAction, fetchProductsAction, getOrCreateProductByCode } from "@/app/actions/products";
import { getLocalItems } from "@/lib/supabaseLocalFallback";
import { Loader2, RefreshCw } from "lucide-react";

interface StockItem {
  id: string;
  sno: string;
  product_name: string;
  brand: string;
  model: string;
  serial_no: string;
  warehouse_name: string;
  quantity: number;
  import_date: string;
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
  const perPage = 10;

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const [stockRes, prodRes, regRes] = await Promise.all([
        fetchStockAction().catch(() => ({ success: false, data: [] })),
        fetchProductsAction().catch(() => ({ success: false, data: [] })),
        fetchRecordsAction("regions").catch(() => ({ success: false, data: [] })),
      ]);

      if (stockRes.success && stockRes.data) {
        dbData = stockRes.data.filter((item: any) => item.status !== "sold_out");
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
          import_date: row.import_date || "-",
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
          import_date: row.import_date || "-",
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
      // Load all products in DB to match
      const dbProdsRes = await fetchProductsAction();
      const dbProds = dbProdsRes.success ? (dbProdsRes.data || []) : [];

      // Load local products fallback
      const localProds = getLocalItems("coretech_local_products") || [];
      const allProds = [...dbProds, ...localProds];

      let successCount = 0;
      for (const localItem of localStock) {
        // Find local item's product info
        const prod = allProds.find((p: any) => p.id === localItem.product_id);
        if (!prod) continue;

        // 1. Resolve product in DB (using code fallback)
        const prodRes = await getOrCreateProductByCode(prod.code || prod.model || "GENERIC", {
          name: prod.name,
          code: prod.code || prod.model || "GENERIC",
          brand: prod.brand || "-",
          category: prod.category || "General",
          model: prod.model || "Generic",
          price: prod.price || 0,
          cost: prod.cost || 0,
          alert_quantity: 5,
        });

        if (!prodRes.success) continue;

        // 2. Insert stock item to DB
        const payload = {
          product_id: prodRes.data.id,
          model_no: localItem.model_no || prod.model || "Generic",
          serial_no: localItem.serial_no,
          warehouse_name: localItem.warehouse_name || "General Warehouse",
          import_date: localItem.import_date || new Date().toISOString().split('T')[0],
          quantity: localItem.quantity || 1,
        };

        const stockRes = await createRecordAction("stock", payload);
        if (stockRes.success) {
          successCount++;
        }
      }

      // Clear local stock
      localStorage.setItem("coretech_local_stock", JSON.stringify([]));
      toast.success(`Successfully uploaded & synced ${successCount} stock items to Supabase cloud!`);
      await fetchInventory();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync local stock");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteStock = async (row: any) => {
    if (!window.confirm(`Are you sure you want to delete ${row.product_name} (${row.serial_no})?`)) return;

    try {
      if (row.id && !row.id.startsWith("local-")) {
        const res = await deleteRecordAction("stock", row.id);
        if (!res.success) throw new Error(res.error || "Failed to delete from DB");
      } else {
        const localStock = getLocalItems("coretech_local_stock") || [];
        const updated = localStock.filter((s: any) => s.serial_no !== row.serial_no);
        localStorage.setItem("coretech_local_stock", JSON.stringify(updated));
      }
      toast.success(`Stock item deleted successfully!`);
      fetchInventory();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete stock");
    }
  };

  // Filter states
  const [filterDate, setFilterDate] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleBulkDeleteStock = async (selectedIds: string[]) => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected stock items?`)) return;

    setIsBulkDeleting(true);
    try {
      const { bulkDeleteStockAction } = await import("@/app/actions/products");
      const res = await bulkDeleteStockAction(selectedIds);
      
      // Clean local storage items if any
      let localStock = getLocalItems("coretech_local_stock") || [];
      selectedIds.forEach((id) => {
        if (id.startsWith("local-")) {
          const item = stock.find((s) => s.id === id);
          if (item) {
            localStock = localStock.filter((s: any) => s.serial_no !== item.serial_no);
          }
        }
      });
      localStorage.setItem("coretech_local_stock", JSON.stringify(localStock));

      if (!res.success) throw new Error(res.error || "Failed bulk delete");
      toast.success(`Successfully bulk deleted ${res.count || selectedIds.length} stock items!`);
      fetchInventory();
    } catch (err: any) {
      toast.error(err.message || "Failed to bulk delete stock items");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkDeleteByFilter = async () => {
    if (!filterDate && !filterModel && !filterWarehouse) {
      toast.error("Please select at least a Date, Product Model, or Warehouse filter first!");
      return;
    }

    const matchingCount = filtered.length;
    if (matchingCount === 0) {
      toast.error("No stock items match the currently selected filter.");
      return;
    }

    const filterDesc = [
      filterDate && `Import Date: ${filterDate}`,
      filterModel && `Model: ${filterModel}`,
      filterWarehouse && `Warehouse: ${filterWarehouse}`,
    ].filter(Boolean).join(" | ");

    if (!window.confirm(`CRITICAL WARNING: Are you sure you want to BULK DELETE ALL ${matchingCount} stock items matching (${filterDesc})? This action cannot be undone!`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const { bulkDeleteStockByFilterAction } = await import("@/app/actions/products");
      const res = await bulkDeleteStockByFilterAction({
        importDate: filterDate,
        modelNo: filterModel,
        warehouseName: filterWarehouse,
      });

      if (!res.success) throw new Error(res.error || "Failed bulk deletion by filter");
      toast.success(res.message || `Successfully deleted ${matchingCount} stock items!`);

      setFilterDate("");
      setFilterModel("");
      setFilterWarehouse("");
      fetchInventory();
    } catch (err: any) {
      toast.error(err.message || "Failed bulk deletion by filter");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Derive unique models & warehouses for filter dropdowns
  const uniqueModels = Array.from(new Set(stock.map((item) => item.model).filter((m) => m && m !== "-")));
  const uniqueWarehouses = Array.from(new Set(stock.map((item) => item.warehouse_name).filter((w) => w && w !== "-")));
  const uniqueDates = Array.from(new Set(stock.map((item) => item.import_date).filter((d) => d && d !== "-"))).sort().reverse();

  const filtered = stock.filter((item) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = (
        item.product_name.toLowerCase().includes(q) ||
        item.serial_no.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q) ||
        item.warehouse_name.toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;
    }

    // Date filter
    if (filterDate && item.import_date !== filterDate) return false;

    // Model filter
    if (filterModel && item.model.toLowerCase() !== filterModel.toLowerCase()) return false;

    // Warehouse filter
    if (filterWarehouse && item.warehouse_name.toLowerCase() !== filterWarehouse.toLowerCase()) return false;

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
    { key: "model", label: "Model" },
    { key: "serial_no", label: "Serial No" },
    { key: "warehouse_name", label: "Warehouse" },
    { key: "quantity", label: "Quantity" },
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
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold rounded-[6px] shadow flex items-center gap-1.5 transition-all"
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

            {/* Product Model Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Product Model:</span>
              <select
                value={filterModel}
                onChange={(e) => {
                  setFilterModel(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-700 focus:outline-none focus:border-[#00B4D8]"
              >
                <option value="">All Products / Models</option>
                {uniqueModels.map((model) => (
                  <option key={model} value={model}>{model}</option>
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

            {/* Clear Filters button */}
            {(filterDate || filterModel || filterWarehouse) && (
              <button
                onClick={() => {
                  setFilterDate("");
                  setFilterModel("");
                  setFilterWarehouse("");
                  setCurrentPage(1);
                }}
                className="text-xs font-bold text-rose-600 hover:underline ml-2"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Bulk Delete All Filtered Button */}
          {(filterDate || filterModel || filterWarehouse) && (
            <button
              onClick={handleBulkDeleteByFilter}
              disabled={isBulkDeleting || filtered.length === 0}
              className="h-8 px-3.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-[6px] shadow flex items-center gap-1.5 transition-all animate-in fade-in"
            >
              {isBulkDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              <span>Bulk Delete All Filtered ({filtered.length} Items)</span>
            </button>
          )}
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
        onDeleteClick={handleDeleteStock}
        onBulkDelete={handleBulkDeleteStock}
      />
    </div>
  );
}

