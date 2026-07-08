"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { X, Loader2, Plus, Home } from "lucide-react";
import toast from "react-hot-toast";
import { getLocalItems, saveLocalItem, mergeLocalItems, deleteLocalItem } from "@/lib/supabaseLocalFallback";
import { deleteRecordAction, fetchRecordsAction, updateRecordAction } from "@/app/actions/users";

interface WarehouseRow {
  id: string;
  region_code: string;
  name: string;
  warehouse: string;
  status: string;
  created_at: string;
}

export default function WarehousePage() {
  const supabase = createClientComponentClient();

  const [warehousesList, setWarehousesList] = useState<WarehouseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRow | undefined>(undefined);

  // Form states
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isModalOpen && editingWarehouse) {
      setCode(editingWarehouse.region_code || "");
      setName(editingWarehouse.name || "");
      setWarehouse(editingWarehouse.warehouse || "");
    } else if (isModalOpen) {
      setCode("");
      setName("");
      setWarehouse("");
    }
  }, [isModalOpen, editingWarehouse]);

  const fetchWarehouses = async () => {
    setIsLoading(true);
    let dbData: any[] = [];
    try {
      // Use server action to bypass RLS
      const res = await fetchRecordsAction("regions", undefined, "created_at");
      if (res.success) {
        dbData = res.data || [];
      } else {
        console.warn("Failed to fetch warehouses from server action.", res.error);
      }
    } catch (err: any) {
      console.warn("Failed to fetch warehouses/regions from database.", err);
    }

    const merged = mergeLocalItems(dbData, "coretech_local_regions");
    const formatted = merged.map((w: any, idx: number) => ({
      ...w,
      id: w.id || w.region_code || `local-${idx}`,
    }));
    setWarehousesList(formatted);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!code.trim()) errs.code = "Warehouse code is required (e.g. WH-LHR-02)";
    if (!warehouse.trim()) errs.warehouse = "Warehouse name is required";
    if (!name.trim()) errs.name = "Region/Location association is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const data: any = {
        region_code: code.trim().toUpperCase(),
        name: name.trim(),
        warehouse: warehouse.trim(),
        status: "active",
      };

      if (editingWarehouse && editingWarehouse.id) {
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        if (isUUID(editingWarehouse.id)) {
          const res = await updateRecordAction("regions", editingWarehouse.id, data);
          if (!res.success) throw new Error(res.error || "Failed to update warehouse in database");
          toast.success(`Warehouse ${data.warehouse} successfully updated!`);
        } else {
          saveLocalItem("coretech_local_regions", { ...editingWarehouse, ...data }, true);
          toast.success(`Warehouse ${data.warehouse} updated locally!`);
        }
      } else {
        try {
          const { error } = await supabase.from("regions").insert(data);
          if (error) throw error;
          toast.success(`Warehouse ${data.warehouse} successfully registered!`);
        } catch (dbErr) {
          console.warn("Database warehouse insert failed. Saving locally.", dbErr);
          saveLocalItem("coretech_local_regions", data);
          toast.success(`Warehouse ${data.warehouse} registered locally (Database fallback)`);
        }
      }

      // Log audit activity safely
      try {
        await supabase.from("activity_logs").insert({
          action: editingWarehouse ? "Warehouse Updated" : "Warehouse Registered",
          details: `Warehouse "${data.warehouse}" (${data.region_code}) was ${editingWarehouse ? "updated" : "registered"} under region "${data.name}"`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }

      setIsModalOpen(false);
      setEditingWarehouse(undefined);
      setCode("");
      setName("");
      setWarehouse("");
      fetchWarehouses();
    } catch (err: any) {
      toast.error(err.message || "Failed to save warehouse");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWarehouse = async (row: any) => {
    if (!window.confirm(`Are you sure you want to delete warehouse ${row.warehouse}?`)) return;

    try {
      let dbDeleteOk = false;
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      if (row.id && isUUID(row.id)) {
        const res = await deleteRecordAction("regions", row.id);
        if (res.success) {
          dbDeleteOk = true;
        } else {
          console.warn("DB delete failed:", res.error);
        }
      }
      
      // Also remove from local storage
      deleteLocalItem("coretech_local_regions", row.id || row.region_code, row.id ? "id" : "region_code");
      if (row.region_code) {
        deleteLocalItem("coretech_local_regions", row.region_code, "region_code");
      }
      
      if (dbDeleteOk) {
        toast.success(`Warehouse "${row.warehouse}" deleted successfully!`);
      } else if (row.id && isUUID(row.id)) {
        toast.error(`Failed to delete warehouse from database. It may not exist.`);
      } else {
        toast.success(`Warehouse "${row.warehouse}" deleted successfully!`);
      }
      fetchWarehouses();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete warehouse");
    }
  };

  const handleBulkDeleteWarehouses = async (selectedIds: string[]) => {
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected warehouses?`)) return;

    try {
      let deletedCount = 0;
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      for (const id of selectedIds) {
        if (isUUID(id)) {
          const res = await deleteRecordAction("regions", id);
          if (res.success) {
            deletedCount++;
          }
        }
        deleteLocalItem("coretech_local_regions", id, "id");
        
        const whObj = warehousesList.find(w => w.id === id);
        if (whObj && whObj.region_code) {
          deleteLocalItem("coretech_local_regions", whObj.region_code, "region_code");
        }
      }

      toast.success(`Successfully deleted ${selectedIds.length} warehouses!`);
      fetchWarehouses();
    } catch (err: any) {
      toast.error(err.message || "Failed to perform bulk deletion");
    }
  };

  const columns = [
    { key: "region_code", label: "Warehouse Code" },
    { key: "warehouse", label: "Warehouse Name" },
    { key: "name", label: "Region / Location" },
    {
      key: "status",
      label: "Status",
      render: (val: string) => (
        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold uppercase">
          {val}
        </span>
      ),
    },
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
            Manage your company stock depots and fulfillment warehouses.
          </p>
        </div>

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
    </div>

    <DataTable
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
      onEditClick={(row) => {
        setEditingWarehouse(row);
        setIsModalOpen(true);
      }}
      onDeleteClick={handleDeleteWarehouse}
      onBulkDelete={handleBulkDeleteWarehouses}
    />

    {/* Create Warehouse Modal */}
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

            <form onSubmit={handleCreateWarehouse} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Warehouse Code (e.g. WH-LHR-02)*
                </label>
                <input
                  type="text"
                  placeholder="WH-LHR-02"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                    errors.code ? "border-rose-500" : "border-slate-200"
                  }`}
                  required
                />
                {errors.code && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.code}</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Warehouse Name*
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lahore Central Warehouse 2"
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                    errors.warehouse ? "border-rose-500" : "border-slate-200"
                  }`}
                  required
                />
                {errors.warehouse && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.warehouse}</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Region / Location Association*
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lahore Central"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                    errors.name ? "border-rose-500" : "border-slate-200"
                  }`}
                  required
                />
                {errors.name && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.name}</p>
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
                  Register Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
