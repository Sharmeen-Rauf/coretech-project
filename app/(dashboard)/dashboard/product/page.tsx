"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import ProductModal from "@/components/ProductModal";
import toast from "react-hot-toast";
import { deleteRecordAction } from "@/app/actions/users";
import { fetchProductsAction, updateProductAction } from "@/app/actions/products";
import { getMyScopeAction } from "@/app/actions/roles";

const CATEGORY_LABELS: Record<string, string> = {
  inverter: "Inverter",
  battery: "Battery",
  aio: "AIO",
};

export default function ProductManagementPage() {
  const supabase = createClientComponentClient();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const perPage = 10;

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(undefined);
  const [canWrite, setCanWrite] = useState(false); // deny-until-resolved, same as other scoped pages

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      try {
        const writeRes = await getMyScopeAction("product");
        setCanWrite(writeRes.canWrite);
      } catch (writeErr) {
        console.warn("Failed to resolve write access", writeErr);
      }

      // Use server action to bypass RLS — no category arg fetches every category at once
      const res = await fetchProductsAction();
      let dbData: any[] = [];
      if (res.success) {
        dbData = res.data || [];
      } else {
        console.warn("Failed to fetch products from server action.", res.error);
      }

      const { mergeLocalItems } = require("@/lib/supabaseLocalFallback");
      const merged = mergeLocalItems(dbData, "coretech_local_products");

      const formatted = merged.map((item: any, idx: number) => ({
        ...item,
        id: item.id || item.code || `local-${idx}`,
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

  const categoryFiltered = products.filter((p) =>
    categoryFilter === "all" ? true : p.category === categoryFilter
  );

  const filtered = categoryFiltered.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
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
    { key: "code", label: "Product Code" },
    {
      key: "category",
      label: "Category",
      render: (val: string) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#F0FAFE] text-[#00B4D8] border border-[#00B4D8]/20">
          {CATEGORY_LABELS[val] || val || "-"}
        </span>
      ),
    },
    {
      key: "price",
      label: "Sale Price",
      render: (val: number) => <span className="font-semibold text-slate-700">Rs. {val?.toLocaleString() || "0"}</span>,
    },
    {
      key: "is_active",
      label: "Status",
      excludeFromExport: true,
      render: (val: boolean, row: any) => {
        const active = val !== false;
        if (!canWrite) {
          return (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
              {active ? "Active" : "Disabled"}
            </span>
          );
        }
        return (
          <button
            onClick={() => handleToggleActive(row)}
            disabled={togglingId === row.id}
            title={active ? "Disable - hides this product from Buzzcart's create-order picker" : "Enable - shows this product in Buzzcart's create-order picker again"}
            className={`px-2.5 py-1 text-[9px] font-bold uppercase rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
            }`}
          >
            {togglingId === row.id ? "Saving..." : active ? "Active" : "Disabled"}
          </button>
        );
      },
    },
  ];

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleActive = async (prod: any) => {
    if (!prod.id) return; // local-fallback rows without a real DB id can't be toggled server-side
    setTogglingId(prod.id);
    try {
      const res = await updateProductAction(prod.id, { is_active: !prod.is_active });
      if (!res.success) throw new Error(res.error || "Failed to update product status");
      toast.success(prod.is_active ? `${prod.name} disabled` : `${prod.name} enabled`);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to update product status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleEditClick = (prod: any) => {
    setEditingProduct(prod);
    setIsModalOpen(true);
  };

  const handleDeleteProduct = async (prod: any) => {
    if (!window.confirm(`Are you sure you want to delete ${prod.name}?`)) return;

    try {
      if (prod.id) {
        const res = await deleteRecordAction("products", prod.id);
        if (!res.success) {
          console.warn("DB delete failed, attempting local delete", res.error);
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

  const handleBulkDeleteProducts = async (selectedIds: string[]) => {
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected products?`)) return;

    try {
      let successCount = 0;
      const { deleteLocalItem } = require("@/lib/supabaseLocalFallback");

      for (const id of selectedIds) {
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        if (isUUID(id)) {
          await deleteRecordAction("products", id);
        }
        deleteLocalItem("coretech_local_products", id, "id");

        const prodObj = products.find(p => p.id === id);
        if (prodObj && prodObj.code) {
          deleteLocalItem("coretech_local_products", prodObj.code, "code");
        }
        successCount++;
      }

      toast.success(`Successfully deleted ${successCount} products!`);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to perform bulk deletion");
    }
  };

  const countFor = (cat: string) =>
    cat === "all" ? products.length : products.filter((p) => p.category === cat).length;

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Product Catalog</h1>
        <p className="text-xs text-slate-500">
          View and manage the core inventory catalog across every product category.
        </p>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-[8px] border border-slate-200 shadow-sm w-fit">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">CATEGORY:</label>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="h-9 px-3 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#00B4D8]"
        >
          <option value="all">All Products ({countFor("all")})</option>
          <option value="inverter">Inverter ({countFor("inverter")})</option>
          <option value="battery">Battery ({countFor("battery")})</option>
          <option value="aio">AIO ({countFor("aio")})</option>
        </select>
      </div>

      <DataTable allData={filtered}
        title="Products"
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        searchPlaceholder="Search Products..."
        onSearch={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        actionButton={canWrite ? {
          label: "Add Product",
          onClick: () => {
            setEditingProduct(undefined);
            setIsModalOpen(true);
          },
        } : undefined}
        onEditClick={canWrite ? handleEditClick : undefined}
        pagination={{
          current: currentPage,
          total: filtered.length,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
        onDeleteClick={canWrite ? handleDeleteProduct : undefined}
        onBulkDelete={canWrite ? handleBulkDeleteProducts : undefined}
      />

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        category={categoryFilter !== "all" ? categoryFilter : "inverter"}
        onSuccess={fetchProducts}
        editingProduct={editingProduct}
      />
    </div>
  );
}
