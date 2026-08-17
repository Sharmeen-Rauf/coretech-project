"use client";

import React, { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import toast from "react-hot-toast";
import { fetchSellOutAction, revertStockBySerialAction } from "@/app/actions/products";
import { fetchRecordsAction, deleteRecordAction } from "@/app/actions/users";
import { getLocalItems } from "@/lib/supabaseLocalFallback";
import { Eye, X, Calendar, Clipboard, MapPin, User, Trash2, Plus } from "lucide-react";
import ManualSelloutModal from "@/components/ManualSelloutModal";

interface SellOutItem {
  id: string;
  sno: string;
  product_name: string;
  brand: string;
  model: string;
  serial_no: string;
  warehouse_name: string;
  installer_name: string;
  installation_project: string;
  site_address: string;
  sold_out_date: string;
  installation_id: string;
  consumer_name: string;
  consumer_phone: string;
  raw: any;
}

export default function SellOutPage() {
  const [sellOuts, setSellOuts] = useState<SellOutItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInstallation, setSelectedInstallation] = useState<any>(null);
  const [isLoadingJob, setIsLoadingJob] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [canWrite, setCanWrite] = useState(false); // deny-until-resolved, same as SalesPage.tsx
  const perPage = 10;

  const fetchSellOuts = async () => {
    setIsLoading(true);
    try {
      const [res, regRes] = await Promise.all([
        fetchSellOutAction().catch(() => ({ success: false, data: [] })),
        fetchRecordsAction("regions").catch(() => ({ success: false, data: [] })),
      ]) as [any, any];

      if (!res.success) {
        throw new Error(res.error || "Failed to fetch sell outs");
      }
      setCanWrite(!!res.canWrite);

      let regionsList: any[] = [];
      if (regRes.success && regRes.data) {
        regionsList = regRes.data;
      }
      const localRegions = getLocalItems("coretech_local_regions") || [];
      const allRegions = [...regionsList, ...localRegions];

      const formatted = (res.data || []).map((row: any, idx: number) => {
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

        const installer = row.installer;
        const isManualEntry = !!row.consumer;
        const installerName = isManualEntry
          ? "Manual Entry"
          : installer
          ? `${installer.first_name || ""} ${installer.last_name || ""}`.trim()
          : "System Admin";

        return {
          id: row.id,
          sno: String(idx + 1).padStart(2, "0"),
          product_name: row.products?.name || "Unknown Product",
          brand: row.products?.brand || "-",
          model: row.model_no || row.products?.model || "-",
          serial_no: row.serial_no || "-",
          warehouse_name: resolvedWh,
          installer_name: installerName || "-",
          installation_project: row.installation_project_title || "-",
          site_address: row.deployment_site_address || row.consumer?.site_address || "-",
          sold_out_date: row.sold_out_at ? new Date(row.sold_out_at).toLocaleDateString() : "-",
          installation_id: row.installation_id,
          consumer_name: row.consumer?.consumer_name || "-",
          consumer_phone: row.consumer?.consumer_phone || "-",
          raw: row
        };
      });

      setSellOuts(formatted);
    } catch (err: any) {
      toast.error(err.message || "Failed to load sell out stock");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSellOuts();
  }, []);

  const handleDeleteSellOut = async (row: SellOutItem) => {
    if (window.confirm(`Are you sure you want to delete sell out record for Serial #${row.serial_no}? This will restore the product back to active inventory!`)) {
      try {
        if (row.serial_no && row.serial_no !== "-") {
          await revertStockBySerialAction(row.serial_no);
        } else if (row.id) {
          await deleteRecordAction("stock", row.id);
        }
        toast.success(`Sell out record deleted and Serial #${row.serial_no} restored to inventory!`);
        fetchSellOuts();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete sell out record");
      }
    }
  };

  const handleBulkDeleteSellOuts = async (selectedIds: string[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected sell out records? This will restore all these products back to active inventory!`)) {
      try {
        for (const id of selectedIds) {
          const item = sellOuts.find(s => s.id === id);
          if (item?.serial_no && item.serial_no !== "-") {
            await revertStockBySerialAction(item.serial_no);
          } else {
            await deleteRecordAction("stock", id);
          }
        }
        toast.success(`Successfully deleted ${selectedIds.length} sell out records and restored items to inventory!`);
        fetchSellOuts();
      } catch (err: any) {
        toast.error(err.message || "Failed bulk deletion");
      }
    }
  };

  const handleViewInstallation = async (row: SellOutItem) => {
    if (!row.installation_id) {
      toast.error("No installation record associated with this item.");
      return;
    }

    setIsLoadingJob(true);
    try {
      const { createClientComponentClient } = require("@/lib/supabase");
      const supabase = createClientComponentClient();
      const { data, error } = await supabase
        .from("installer_jobs")
        .select(`
          *,
          installer:profiles!installer_id (
            first_name,
            last_name
          )
        `)
        .eq("id", row.installation_id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error("Installation record could not be found in database.");
      }

      setSelectedInstallation(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch installation details");
    } finally {
      setIsLoadingJob(false);
    }
  };

  const filtered = sellOuts.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.product_name.toLowerCase().includes(q) ||
      item.serial_no.toLowerCase().includes(q) ||
      item.installer_name.toLowerCase().includes(q) ||
      item.installation_project.toLowerCase().includes(q) ||
      item.consumer_name.toLowerCase().includes(q) ||
      item.consumer_phone.toLowerCase().includes(q)
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
    { key: "serial_no", label: "Serial No" },
    { key: "warehouse_name", label: "Source" },
    { key: "installer_name", label: "Installer Name" },
    { key: "installation_project", label: "Installation Project" },
    { key: "consumer_name", label: "Consumer Name" },
    { key: "consumer_phone", label: "Consumer Phone" },
    { key: "site_address", label: "Site Address" },
    { key: "sold_out_date", label: "Sold Out Date" },
  ];

  const DynamicDataTable = DataTable as any;

  return (
    <div className="space-y-6 select-none">
      <div className="flex items-center justify-between border-b pb-4 border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sell Out</h1>
          <p className="text-xs text-slate-500">
            Track units that have been sold out - deployed by installers or sold manually to a consumer.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Manual Sell Out
          </button>
        )}
      </div>

      <DynamicDataTable
        allData={filtered}
        title="Sell Out Products Ledger"
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        searchPlaceholder="Search product, serial number, installer or project..."
        onSearch={(q: string) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        pagination={{
          current: currentPage,
          total: filtered.length,
          perPage: perPage,
          onChange: (page: number) => setCurrentPage(page),
        }}
        onDeleteClick={(row: SellOutItem) => handleDeleteSellOut(row)}
        onBulkDelete={handleBulkDeleteSellOuts}
        rowActions={(row: SellOutItem) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleViewInstallation(row)}
              className="p-1 hover:bg-sky-50 text-sky-600 hover:text-sky-700 rounded-full transition-colors"
              title="View Associated Installation"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteSellOut(row)}
              className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-full transition-colors"
              title="Delete Sell Out Record"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      />

      <ManualSelloutModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={fetchSellOuts}
      />

      {/* View Installation Detail Modal */}
      {selectedInstallation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative bg-white w-full max-w-md border border-slate-100 rounded-[12px] shadow-2xl p-5 flex flex-col max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4 bg-slate-50/50 -m-5 p-5 rounded-t-[12px]">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Associated Installation Details
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">{selectedInstallation.job_title}</p>
              </div>
              <button
                onClick={() => setSelectedInstallation(null)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs mt-3">
              <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-600">
                  <Clipboard className="w-4 h-4 text-[#00B4D8] shrink-0" />
                  <p><strong>Project Name:</strong> {selectedInstallation.job_title}</p>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-[#00B4D8] shrink-0" />
                  <p><strong>Deployment Site:</strong> {selectedInstallation.address}</p>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-4 h-4 text-[#00B4D8] shrink-0" />
                  <p>
                    <strong>Installer Name:</strong>{" "}
                    {selectedInstallation.installer 
                      ? `${selectedInstallation.installer.first_name} ${selectedInstallation.installer.last_name}` 
                      : "Unassigned"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4 text-[#00B4D8] shrink-0" />
                  <p><strong>Installation Date:</strong> {new Date(selectedInstallation.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Installer Remarks</p>
                <p className="text-slate-600 p-2.5 bg-slate-50 border border-slate-100 rounded italic">
                  "{selectedInstallation.remarks || "No remarks documented."}"
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setSelectedInstallation(null)}
                  className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-[6px] transition-colors"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
