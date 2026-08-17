"use client";

import React, { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { X, Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import {
  fetchWarehousesAction,
  createWarehouseAction,
  updateWarehouseAction,
  deleteWarehouseAction,
} from "@/app/actions/warehouses";
import { getMyScopeAction } from "@/app/actions/roles";

interface WarehouseRow {
  id: string;
  name: string;
  created_at: string;
}

export default function WarehousePage() {
  const [warehousesList, setWarehousesList] = useState<WarehouseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canWrite, setCanWrite] = useState(false); // deny-until-resolved, same as other scoped pages

  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRow | undefined>(undefined);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isModalOpen && editingWarehouse) {
      setName(editingWarehouse.name || "");
    } else if (isModalOpen) {
      setName("");
    }
    setError("");
  }, [isModalOpen, editingWarehouse]);

  const fetchWarehouses = async () => {
    setIsLoading(true);
    try {
      const writeRes = await getMyScopeAction("purchase.warehouse");
      setCanWrite(writeRes.canWrite);
    } catch (writeErr) {
      console.warn("Failed to resolve write access", writeErr);
    }
    const res = await fetchWarehousesAction();
    if (res.success) {
      setWarehousesList(res.data as WarehouseRow[]);
    } else {
      toast.error(res.error || "Failed to load warehouses");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Warehouse name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = editingWarehouse
        ? await updateWarehouseAction(editingWarehouse.id, name)
        : await createWarehouseAction(name);

      if (!res.success) {
        toast.error(res.error || "Failed to save warehouse");
        return;
      }

      toast.success(res.message || "Warehouse saved");
      setIsModalOpen(false);
      setEditingWarehouse(undefined);
      setName("");
      fetchWarehouses();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWarehouse = async (row: WarehouseRow) => {
    if (!window.confirm(`Are you sure you want to delete warehouse "${row.name}"?`)) return;
    const res = await deleteWarehouseAction(row.id);
    if (res.success) {
      toast.success(res.message || "Warehouse deleted successfully!");
      fetchWarehouses();
    } else {
      toast.error(res.error || "Failed to delete warehouse");
    }
  };

  const columns = [
    { key: "name", label: "Warehouse Name" },
    {
      key: "created_at",
      label: "Created Date",
      render: (val: string) => (val ? new Date(val).toLocaleDateString() : "-"),
    },
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const paginated = warehousesList.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-6 select-none">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Warehouses</h1>
          <p className="text-xs text-slate-500">
            Manage your company's physical stock depots. Regions pick from this list — a warehouse is only ever created here.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => {
              setEditingWarehouse(undefined);
              setIsModalOpen(true);
            }}
            className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Warehouse
          </button>
        )}
      </div>

      <DataTable
        allData={warehousesList}
        title="Fulfillment Depots"
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        pagination={{
          current: currentPage,
          total: warehousesList.length,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
        onEditClick={canWrite ? (row) => {
          setEditingWarehouse(row as WarehouseRow);
          setIsModalOpen(true);
        } : undefined}
        onDeleteClick={canWrite ? (row) => handleDeleteWarehouse(row as WarehouseRow) : undefined}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => {
              setIsModalOpen(false);
              setEditingWarehouse(undefined);
            }}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
              <h3 className="text-sm font-bold text-slate-800">
                {editingWarehouse ? "Edit Warehouse" : "Add New Warehouse"}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingWarehouse(undefined);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Warehouse Name*
                </label>
                <input
                  type="text"
                  placeholder="e.g. Islamabad Depot"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                    error ? "border-rose-500" : "border-slate-200"
                  }`}
                  required
                />
                {error && <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{error}</p>}
                {editingWarehouse && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Renaming updates every region and stock item currently using this warehouse.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-100 rounded-[6px] text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-4 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingWarehouse ? "Save Changes" : "Register Warehouse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
