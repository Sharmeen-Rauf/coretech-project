"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import toast from "react-hot-toast";

interface ProductItem {
  id: string;
  name: string;
  code: string;
  brand: string;
  category: string;
  model: string;
  price: number;
  cost: number;
  alert_quantity: number;
}

export default function InverterProductPage() {
  const supabase = createClientComponentClient();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("category", "inverter")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Add Serial Number (S.No) index to table rows
      const formatted = (data || []).map((item, idx) => ({
        ...item,
        sno: String(idx + 1).padStart(2, "0"),
      }));

      setProducts(formatted);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch products");
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
    { key: "category", label: "Category" },
  ];

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Inverter Catalog</h1>
        <p className="text-xs text-slate-500">
          View and manage the core inventory for Inverter units.
        </p>
      </div>

      <DataTable
        title="Inverters"
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        searchPlaceholder="Search Inverters..."
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
      />
    </div>
  );
}
