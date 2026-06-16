"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface SalesPageProps {
  type: "ST1" | "ST2" | "return" | "transfer";
  title: string;
  buttonLabel: string;
  stIdPrefix: string;
}

export default function SalesPage({ type, title, buttonLabel, stIdPrefix }: SalesPageProps) {
  const supabase = createClientComponentClient();

  // Data states
  const [sales, setSales] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [selectedDistributor, setSelectedDistributor] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [date, setDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filter states
  const [filterDistributor, setFilterDistributor] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  // Fetch initial sales records & distributors
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch sales joined with distributor profile
      const { data: salesData, error: salesErr } = await supabase
        .from("sales")
        .select(`
          *,
          distributor:profiles!distributor_id(first_name, last_name)
        `)
        .eq("type", type)
        .order("created_at", { ascending: false });

      if (salesErr) throw salesErr;

      // 2. Fetch distributors for dropdown
      const { data: distData, error: distErr } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("role", "distributor");

      if (distErr) throw distErr;

      const formattedSales = (salesData || []).map((row, idx) => ({
        ...row,
        sno: String(idx + 1).padStart(2, "0"),
        distributor_name: row.distributor
          ? `${row.distributor.first_name} ${row.distributor.last_name || ""}`.trim()
          : "-",
      }));

      setSales(formattedSales);
      setDistributors(distData || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [type]);

  const handleOpenModal = () => {
    setSelectedDistributor("");
    setWarehouse("");
    // Default to today's date
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!selectedDistributor) errs.distributor = "Distributor selection is required";
    if (!warehouse.trim()) errs.warehouse = "Warehouse is required";
    if (!date) errs.date = "Date is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateSales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Auto-generate ST ID suffix sequentially
      const nextIdNum = 12 + sales.length;
      const stId = `${stIdPrefix}${nextIdNum}`;

      const { error } = await supabase.from("sales").insert({
        type,
        distributor_id: selectedDistributor,
        warehouse,
        st_id: stId,
        date,
      });

      if (error) throw error;

      toast.success(`${title} transaction successfully created!`);
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter operations
  const filtered = sales.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = q
      ? item.st_id?.toLowerCase().includes(q) ||
        item.warehouse?.toLowerCase().includes(q) ||
        item.distributor_name?.toLowerCase().includes(q)
      : true;

    const matchesDistributor = filterDistributor
      ? item.distributor_name === filterDistributor
      : true;

    const matchesWarehouse = filterWarehouse
      ? item.warehouse === filterWarehouse
      : true;

    return matchesSearch && matchesDistributor && matchesWarehouse;
  });

  const paginated = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  const columns = [
    { key: "sno", label: "S.No" },
    { key: "date", label: "Date" },
    { key: "distributor_name", label: "Distributor" },
    { key: "warehouse", label: "Warehouse" },
    { key: "st_id", label: `${type.toUpperCase()} ID` },
  ];

  // Extract unique warehouses and distributors for table filtering
  const uniqueWarehouses = Array.from(new Set(sales.map((s) => s.warehouse).filter(Boolean)));
  const uniqueDistributorNames = Array.from(new Set(sales.map((s) => s.distributor_name).filter(Boolean)));

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        <p className="text-xs text-slate-500">
          Manage and track details for your {title} transactions.
        </p>
      </div>

      <DataTable
        title={`${title} Ledger`}
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        searchPlaceholder={`Search ${type.toUpperCase()} ID or warehouse...`}
        onSearch={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        filters={[
          {
            label: "Distributor",
            options: uniqueDistributorNames,
            value: filterDistributor,
            onChange: (val) => {
              setFilterDistributor(val);
              setCurrentPage(1);
            },
          },
          {
            label: "Warehouse",
            options: uniqueWarehouses,
            value: filterWarehouse,
            onChange: (val) => {
              setFilterWarehouse(val);
              setCurrentPage(1);
            },
          },
        ]}
        actionButton={{
          label: buttonLabel,
          onClick: handleOpenModal,
        }}
        pagination={{
          current: currentPage,
          total: filtered.length,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
      />

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {buttonLabel}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSales} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Distributor*
                </label>
                <select
                  value={selectedDistributor}
                  onChange={(e) => setSelectedDistributor(e.target.value)}
                  className={`w-full h-9 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${
                    errors.distributor ? "border-rose-500" : "border-slate-200"
                  }`}
                >
                  <option value="">Select Distributor</option>
                  {distributors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.first_name} {d.last_name || ""}
                    </option>
                  ))}
                </select>
                {errors.distributor && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-0.5">
                    {errors.distributor}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Warehouse*
                </label>
                <input
                  type="text"
                  placeholder="Enter warehouse name"
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                    errors.warehouse ? "border-rose-500" : "border-slate-200"
                  }`}
                />
                {errors.warehouse && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-0.5">
                    {errors.warehouse}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Date*
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                    errors.date ? "border-rose-500" : "border-slate-200"
                  }`}
                />
                {errors.date && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-0.5">
                    {errors.date}
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
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
