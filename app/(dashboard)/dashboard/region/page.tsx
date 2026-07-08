"use client";
 
import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { X, Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { getLocalItems, saveLocalItem, mergeLocalItems, deleteLocalItem } from "@/lib/supabaseLocalFallback";
import { deleteRecordAction, fetchRecordsAction } from "@/app/actions/users";
 
interface RegionRow {
  id: string;
  region_code: string;
  name: string;
  warehouse: string;
  distributors: number;
  sub_dealers: number;
  status: string;
}
 
export default function RegionPage() {
  const supabase = createClientComponentClient();
 
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
 
  // Form states
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
 
  const fetchRegions = async () => {
    setIsLoading(true);
    let dbData: any[] = [];
    try {
      // Use server action to bypass RLS
      const res = await fetchRecordsAction("regions", undefined, "created_at");
      if (res.success) {
        dbData = res.data || [];
      } else {
        console.warn("Failed to fetch regions from server action.", res.error);
      }
    } catch (err: any) {
      console.warn("Regions fetch failed.", err);
    }
 
    // Merge database items with local storage custom items
    const merged = mergeLocalItems(dbData, "coretech_local_regions");
    setRegions(merged);
    setIsLoading(false);
  };
 
  useEffect(() => {
    fetchRegions();
  }, []);
 
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!code.trim()) errs.code = "Region code is required (e.g. PK-LHR)";
    if (!name.trim()) errs.name = "Region name is required";
    if (!warehouse.trim()) errs.warehouse = "Warehouse name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };
 
  const handleCreateRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
 
    setIsSubmitting(true);
    try {
      const newRegion = {
        region_code: code.trim().toUpperCase(),
        name: name.trim(),
        warehouse: warehouse.trim(),
        distributors: 0,
        sub_dealers: 0,
        status: "active",
      };
 
      try {
        const { error } = await supabase.from("regions").insert(newRegion);
        if (error) throw error;
        toast.success(`Region ${newRegion.region_code} successfully registered!`);
      } catch (dbErr) {
        console.warn("Database region insert failed. Saving locally.", dbErr);
        saveLocalItem("coretech_local_regions", newRegion);
        toast.success(`Region ${newRegion.region_code} registered locally (Database fallback)`);
      }
 
      // Log audit activity safely
      try {
        await supabase.from("activity_logs").insert({
          action: "Region Registered",
          details: `Region Hub "${newRegion.name}" (${newRegion.region_code}) was registered`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }
 
      setIsModalOpen(false);
      setCode("");
      setName("");
      setWarehouse("");
      fetchRegions();
    } catch (err: any) {
      toast.error(err.message || "Failed to create region");
    } finally {
      setIsSubmitting(false);
    }
  };
 
  const handleDeleteRegion = async (row: any) => {
    if (!window.confirm(`Are you sure you want to delete region ${row.region_code}?`)) return;

    try {
      // Assuming row.id exists for DB records
      if (row.id) {
        const res = await deleteRecordAction("regions", row.id);
        if (!res.success) {
          console.warn("DB delete failed, attempting local delete", res.error);
        }
      }
      
      // Also remove locally to be safe or if it was only a local record
      deleteLocalItem("coretech_local_regions", row.id || row.region_code, row.id ? "id" : "region_code");
      
      toast.success(`Region ${row.region_code} deleted successfully!`);
      
      // Log audit activity safely
      try {
        await supabase.from("activity_logs").insert({
          action: "Region Deleted",
          details: `Region Hub "${row.name}" (${row.region_code}) was deleted`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }

      fetchRegions();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete region");
    }
  };

  const columns = [
    { key: "region_code", label: "Region Code" },
    { key: "name", label: "Region Name" },
    { key: "warehouse", label: "Primary Warehouse" },
    { key: "distributors", label: "Distributors Count" },
    { key: "sub_dealers", label: "Sub Dealers Count" },
    {
      key: "status",
      label: "Status",
      render: (val: string) => (
        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold uppercase">
          {val}
        </span>
      ),
    },
  ];
 
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const paginated = regions.slice((currentPage - 1) * perPage, currentPage * perPage);
 
  return (
    <div className="space-y-6 select-none">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Regions</h1>
          <p className="text-xs text-slate-500">
            Geographic hubs and distribution hubs across Pakistan.
          </p>
        </div>
 
        <button
          onClick={() => setIsModalOpen(true)}
          className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Region
        </button>
      </div>
 
      <DataTable
        title="Active Regions"
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        pagination={{
          current: currentPage,
          total: regions.length,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
        onDeleteClick={handleDeleteRegion}
      />
 
      {/* Create Region Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>
 
          <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Add Region Hub
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
 
            <form onSubmit={handleCreateRegion} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Region Code (e.g. PK-LHR)*
                </label>
                <input
                  type="text"
                  placeholder="PK-PEW"
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
                  Region Name*
                </label>
                <input
                  type="text"
                  placeholder="e.g. Peshawar Northwest Hub"
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
 
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Primary Warehouse*
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hayatabad Depot"
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
                  Register Hub
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
