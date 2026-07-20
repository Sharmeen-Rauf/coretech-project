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
      let dbData: any[] = [];
      try {
        const res = await fetchStockAction();
        if (res.success && res.data) {
          dbData = res.data.filter((item: any) => item.status !== "sold_out");
        }
      } catch (dbErr) {
        console.warn("Failed to fetch stock from database, using local fallback.", dbErr);
      }

      // Fetch products list
      let productsList: any[] = [];
      try {
        const prodRes = await fetchProductsAction();
        if (prodRes.success && prodRes.data) {
          productsList = prodRes.data;
        }
      } catch (e) {
        console.warn(e);
      }

      const localProducts = getLocalItems("coretech_local_products") || [];
      const allProducts = [...productsList, ...localProducts];

      // Fetch regions list to resolve warehouse name/area
      let regionsList: any[] = [];
      try {
        const regRes = await fetchRecordsAction("regions");
        if (regRes.success && regRes.data) {
          regionsList = regRes.data;
        }
      } catch (e) {
        console.warn("Failed to fetch regions:", e);
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

  const handleBulkDeleteStock = async (selectedIds: string[]) => {
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected stock items?`)) return;

    try {
      let successCount = 0;
      let localStock = getLocalItems("coretech_local_stock") || [];

      for (const id of selectedIds) {
        if (id.startsWith("local-")) {
          const stockItemObj = stock.find(item => item.id === id);
          if (stockItemObj) {
            localStock = localStock.filter((s: any) => s.serial_no !== stockItemObj.serial_no);
            successCount++;
          }
        } else {
          const res = await deleteRecordAction("stock", id);
          if (res.success) {
            successCount++;
          }
        }
      }

      localStorage.setItem("coretech_local_stock", JSON.stringify(localStock));
      toast.success(`Successfully deleted ${successCount} stock items!`);
      fetchInventory();
    } catch (err: any) {
      toast.error(err.message || "Failed to perform bulk deletion");
    }
  };

  const filtered = stock.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.product_name.toLowerCase().includes(q) ||
      item.serial_no.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.warehouse_name.toLowerCase().includes(q)
    );
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
