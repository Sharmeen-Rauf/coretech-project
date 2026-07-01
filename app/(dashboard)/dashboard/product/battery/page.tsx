"use client";
 
import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import ProductModal from "@/components/ProductModal";
import toast from "react-hot-toast";
 
export default function BatteryProductPage() {
  const supabase = createClientComponentClient();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
 
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(undefined);
 
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      let dbData: any[] = [];
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("category", "battery")
          .order("created_at", { ascending: false });
        if (error) throw error;
        dbData = data || [];
      } catch (dbErr) {
        console.warn("Failed to fetch battery products from Supabase. Using local fallback.", dbErr);
      }

      const { mergeLocalItems } = require("@/lib/supabaseLocalFallback");
      const merged = mergeLocalItems(dbData, "coretech_local_products", (p: any) => p.category === "battery");

      const formatted = merged.map((item: any, idx: number) => ({
        ...item,
        sno: String(idx + 1).padStart(2, "0"),
      }));
 
      setProducts(formatted);
    } catch (err: any) {
      console.error("fetchProducts error:", err);
    } finally {
      setIsLoading(false);
    }
  };
 
  useEffect(() => {
    fetchProducts();
  }, []);
 
  const filtered = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.model && p.model.toLowerCase().includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q))
    );
  });
 
  const paginated = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );
 
  const columns = [
    { key: "sno", label: "S.No" },
    { key: "brand", label: "Brand" },
    { key: "name", label: "Product Name" },
    { key: "model", label: "Model" },
    { key: "code", label: "Product Code" },
    {
      key: "price",
      label: "Sale Price",
      render: (val: number) => <span className="font-semibold text-slate-700">Rs. {val?.toLocaleString() || "0"}</span>,
    },
    {
      key: "cost",
      label: "Cost Price",
      render: (val: number) => <span className="font-semibold text-slate-500">Rs. {val?.toLocaleString() || "0"}</span>,
    },
  ];
 
  const handleEditClick = (prod: any) => {
    setEditingProduct(prod);
    setIsModalOpen(true);
  };

  const handleDeleteProduct = async (prod: any) => {
    if (!window.confirm(`Are you sure you want to delete ${prod.name}?`)) return;

    try {
      if (prod.id) {
        const { error } = await supabase.from("products").delete().eq("id", prod.id);
        if (error) {
          console.warn("DB delete failed, attempting local delete", error);
        }
      }
      
      const { deleteLocalItem } = require("@/lib/supabaseLocalFallback");
      deleteLocalItem("coretech_local_products", prod.id || prod.code, prod.id ? "id" : "code");
      
      toast.success(`${prod.name} deleted successfully!`);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete product");
    }
  };
 
  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Battery Catalog</h1>
        <p className="text-xs text-slate-500">
          View and manage the core inventory for Battery units.
        </p>
      </div>
 
      <DataTable
        title="Batteries"
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        searchPlaceholder="Search Batteries..."
        onSearch={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        actionButton={{
          label: "Add Battery",
          onClick: () => {
            setEditingProduct(undefined);
            setIsModalOpen(true);
          },
        }}
        onEditClick={handleEditClick}
        pagination={{
          current: currentPage,
          total: filtered.length,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
        onDeleteClick={handleDeleteProduct}
      />
 
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        category="battery"
        onSuccess={fetchProducts}
        editingProduct={editingProduct}
      />
    </div>
  );
}
