"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import toast from "react-hot-toast";
import { deleteRecordAction } from "@/app/actions/users";

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
  const perPage = 10;

  const fetchInventory = async () => {
    setIsLoading(true);
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

      const formatted = (data || []).map((row: any, idx: number) => ({
        id: row.id,
        sno: String(idx + 1).padStart(2, "0"),
        product_name: row.products?.name || "Unknown Product",
        brand: row.products?.brand || "-",
        model: row.model_no || row.products?.model || "-",
        serial_no: row.serial_no || "-",
        warehouse_name: row.warehouse_name || "-",
        quantity: row.quantity ?? 0,
        import_date: row.import_date || "-",
      }));

      setStock(formatted);
    } catch (err: any) {
      toast.error(err.message || "Failed to load inventory");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleDeleteStock = async (row: any) => {
    if (!window.confirm(`Are you sure you want to delete ${row.product_name} (${row.serial_no})?`)) return;

    try {
      if (row.id) {
        const res = await deleteRecordAction("stock", row.id);
        if (!res.success) throw new Error(res.error || "Failed to delete from DB");
      }
      toast.success(`Stock item deleted successfully!`);
      fetchInventory();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete stock");
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
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
        <p className="text-xs text-slate-500">
          Monitor your current distributed warehouse stock items and quantities.
        </p>
      </div>

      <DataTable
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
      />
    </div>
  );
}
