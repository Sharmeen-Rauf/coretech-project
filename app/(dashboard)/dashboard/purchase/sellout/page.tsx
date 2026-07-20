"use client";

import React, { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import toast from "react-hot-toast";
import { fetchSellOutAction } from "@/app/actions/products";
import { fetchRecordsAction } from "@/app/actions/users";
import { getLocalItems } from "@/lib/supabaseLocalFallback";
import { Eye, X, Calendar, Clipboard, MapPin, User } from "lucide-react";

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
  raw: any;
}

export default function SellOutPage() {
  const [sellOuts, setSellOuts] = useState<SellOutItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInstallation, setSelectedInstallation] = useState<any>(null);
  const [isLoadingJob, setIsLoadingJob] = useState(false);
  const perPage = 10;

  const fetchSellOuts = async () => {
    setIsLoading(true);
    try {
      const res = await fetchSellOutAction();
      if (!res.success) {
        throw new Error(res.error);
      }

      // Fetch regions list to resolve warehouse names
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
        const installerName = installer 
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
          site_address: row.deployment_site_address || "-",
          sold_out_date: row.sold_out_at ? new Date(row.sold_out_at).toLocaleDateString() : "-",
          installation_id: row.installation_id,
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

  const handleViewInstallation = async (row: SellOutItem) => {
    if (!row.installation_id) {
      toast.error("No installation record associated with this item.");
      return;
    }

    setIsLoadingJob(true);
    try {
      // Query the specific installer job
      const { createClientComponentClient } = require("@/lib/supabase");
      const supabase = createClientComponentClient();
      const { data, error } = await supabase
        .from("installer_jobs")
        .select(`
          *,
          installer:profiles!installer_id (
            first_name,
            last_name,
            email,
            phone
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
      item.installation_project.toLowerCase().includes(q)
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
    { key: "warehouse_name", label: "Warehouse (Origin)" },
    { key: "installer_name", label: "Installer Name" },
    { key: "installation_project", label: "Installation Project" },
    { key: "site_address", label: "Site Address" },
    { key: "sold_out_date", label: "Sold Out Date" },
  ];

  return (
    <div className="space-y-6 select-none">
      <div className="flex items-center justify-between border-b pb-4 border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sell Out</h1>
          <p className="text-xs text-slate-500">
            Track warehouse units that have been successfully deployed and sold out by installers.
          </p>
        </div>
      </div>

      <DataTable 
        allData={filtered}
        title="Sell Out Products Ledger"
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        searchPlaceholder="Search product, serial number, installer or project..."
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
        rowActions={(row: SellOutItem) => (
          <button
            onClick={() => handleViewInstallation(row)}
            className="p-1 hover:bg-sky-50 text-sky-600 hover:text-sky-700 rounded-full transition-colors"
            title="View Associated Installation"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
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
