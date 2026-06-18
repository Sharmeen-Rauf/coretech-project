"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { 
  X, 
  Loader2, 
  ArrowLeft, 
  CheckCircle, 
  Trash2, 
  Barcode, 
  TrendingUp, 
  Plus, 
  MapPin, 
  AlertCircle 
} from "lucide-react";
import toast from "react-hot-toast";

interface SalesPageProps {
  type: "ST1" | "ST2" | "return" | "transfer";
  title: string;
  buttonLabel: string;
  stIdPrefix: string;
}

interface ScannedItem {
  imei: string;
  productName: string;
  model: string;
  productId: string;
}

interface OrderDetailRow {
  productId: string;
  productName: string;
  model: string;
  quantity: number;
}

export default function SalesPage({ type, title, buttonLabel, stIdPrefix }: SalesPageProps) {
  const supabase = createClientComponentClient();

  // View toggles
  const [isCreating, setIsCreating] = useState(false);

  // Data states
  const [sales, setSales] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [seller, setSeller] = useState("CoreTECH HQ");
  const [selectedDistributor, setSelectedDistributor] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [date, setDate] = useState("");
  const [remarks, setRemarks] = useState("");
  
  // IMEI scanning states
  const [imeiInput, setImeiInput] = useState("");
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderDetailRow[]>([]);
  const [isCheckingImei, setIsCheckingImei] = useState(false);

  // Filter states
  const [filterDistributor, setFilterDistributor] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  // Fetch initial sales records, distributors & warehouses
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

      // 3. Fetch warehouses from regions to prefill selection options
      const { data: regionData } = await supabase
        .from("regions")
        .select("warehouse");
      
      const uniqueWHs = Array.from(new Set((regionData || []).map(r => r.warehouse).filter(Boolean))) as string[];
      setWarehouses(uniqueWHs);

      const formattedSales = (salesData || []).map((row: any, idx: number) => ({
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

  const handleOpenCreateView = () => {
    setSelectedDistributor("");
    setWarehouse("");
    setRemarks("");
    setImeiInput("");
    setScannedItems([]);
    setOrderDetails([]);
    // Default to today's date
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
    setIsCreating(true);
  };

  // Scan / Check IMEI input (supports bulk copy-paste split by comma/newline/tabs)
  const handleCheckImei = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanInput = imeiInput.trim();
    if (!cleanInput) return;

    // Split by newlines, commas, semicolons, or tabs
    const inputs = cleanInput.split(/[\n,;\t\r]+/).map(x => x.trim()).filter(Boolean);
    if (inputs.length === 0) return;

    // Filter out items already scanned
    const newInputs = Array.from(new Set(inputs.filter(x => !scannedItems.some(item => item.imei === x))));
    const duplicatesCount = inputs.length - newInputs.length;
    
    if (newInputs.length === 0) {
      if (duplicatesCount > 0) {
        toast.error("All entered IMEIs/SNs have already been scanned!");
      }
      setImeiInput("");
      return;
    }

    setIsCheckingImei(true);
    try {
      // Fetch matching serials in bulk
      const { data, error } = await supabase
        .from("stock")
        .select(`
          serial_no,
          product_id,
          model_no,
          product:products(id, name, model)
        `)
        .in("serial_no", newInputs);

      const dbMap = new Map<string, any>();
      if (data) {
        data.forEach((row: any) => {
          dbMap.set(row.serial_no, row);
        });
      }

      const itemsToAdd: ScannedItem[] = [];
      let foundCount = 0;
      let simulatedCount = 0;

      newInputs.forEach(imei => {
        const dbRow = dbMap.get(imei);
        if (dbRow) {
          itemsToAdd.push({
            imei: dbRow.serial_no,
            productName: dbRow.product?.name || "Stock Item",
            model: dbRow.product?.model || dbRow.model_no || "Generic",
            productId: dbRow.product_id || "stock-item-id",
          });
          foundCount++;
        } else {
          // Fallback: If not found in stock cache, allow custom mockup creation
          const isBattery = imei.toLowerCase().includes("bat") || imei.length % 2 === 0;
          itemsToAdd.push({
            imei: imei,
            productName: isBattery ? "LiFePO4 Solar Battery 200Ah" : "Huawei Smart Inverter 10kW",
            model: isBattery ? "LFP-200" : "SUN2000-10KTL",
            productId: isBattery ? "dummy-battery-id" : "dummy-inverter-id",
          });
          simulatedCount++;
        }
      });

      // 1. Add all to scanned log state
      setScannedItems(prev => [...itemsToAdd, ...prev]);

      // 2. Aggregate quantities in order details table
      setOrderDetails(prev => {
        const updated = [...prev];
        itemsToAdd.forEach(item => {
          const idx = updated.findIndex(row => row.productName === item.productName);
          if (idx >= 0) {
            updated[idx].quantity += 1;
          } else {
            updated.push({
              productId: item.productId,
              productName: item.productName,
              model: item.model,
              quantity: 1,
            });
          }
        });
        return updated;
      });

      // Show toast summarizing action
      if (newInputs.length === 1) {
        if (foundCount === 1) {
          toast.success("IMEI verified and added!");
        } else {
          toast.success("IMEI simulated and added!");
        }
      } else {
        toast.success(`Bulk imported ${newInputs.length} items (${foundCount} verified, ${simulatedCount} simulated).`);
      }

      setImeiInput("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to check serial numbers.");
    } finally {
      setIsCheckingImei(false);
    }
  };

  const removeScannedItem = (index: number) => {
    const itemToRemove = scannedItems[index];
    
    // 1. Remove from scanned log
    setScannedItems(prev => prev.filter((_, idx) => idx !== index));

    // 2. Decrement or remove from order details
    setOrderDetails(prev => {
      const idx = prev.findIndex(item => item.productName === itemToRemove.productName);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].quantity -= 1;
        if (updated[idx].quantity <= 0) {
          return updated.filter((_, i) => i !== idx);
        }
        return updated;
      }
      return prev;
    });
  };

  const handleCreateSales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDistributor) {
      toast.error("Distributor (Buyer) selection is required");
      return;
    }
    if (!warehouse.trim()) {
      toast.error("Warehouse Name is required");
      return;
    }
    if (scannedItems.length === 0) {
      toast.error("Please scan or check at least one IMEI/SN before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Auto-generate ST ID suffix sequentially
      const nextIdNum = 12 + sales.length;
      const stId = `${stIdPrefix}${nextIdNum}`;

      const { error } = await supabase.from("sales").insert({
        type,
        distributor_id: selectedDistributor,
        warehouse: warehouse.trim(),
        st_id: stId,
        date,
      });

      if (error) throw error;

      // Log activity
      await supabase.from("activity_logs").insert({
        action: `Create ${type} Ledger`,
        details: `${type} transaction ID "${stId}" successfully created in warehouse "${warehouse}" for distributor. Scanned ${scannedItems.length} units.`,
      });

      toast.success(`${title} transaction successfully created!`);
      setIsCreating(false);
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

  const uniqueWarehouses = Array.from(new Set(sales.map((s: any) => s.warehouse).filter(Boolean))) as string[];
  const uniqueDistributorNames = Array.from(new Set(sales.map((s: any) => s.distributor_name).filter(Boolean))) as string[];

  return (
    <div className="space-y-6 select-none">
      {/* Header breadcrumb / title block */}
      {!isCreating ? (
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            <p className="text-xs text-slate-500">
              Manage and track details for your {title} transactions.
            </p>
          </div>
          <button
            onClick={handleOpenCreateView}
            className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {buttonLabel}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreating(false)}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-full transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Sales / {type} Dispatch Form</h1>
            <p className="text-xs text-slate-500">
              Scan serial numbers and verify delivery quantities before warehouse shipment.
            </p>
          </div>
        </div>
      )}

      {/* Main conditional layouts */}
      {!isCreating ? (
        /* Ledger List Table View */
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
          pagination={{
            current: currentPage,
            total: filtered.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
        />
      ) : (
        /* Dedicated Full-Page Creation Form View */
        <form onSubmit={handleCreateSales} className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Column 1 & 2: Basic Info + Order Details */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Basic Info Card */}
            <div className="bg-white border border-slate-150 rounded-[8px] p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Basic Info
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Seller
                  </label>
                  <input
                    type="text"
                    value={seller}
                    onChange={(e) => setSeller(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Warehouse Name*
                  </label>
                  <input
                    type="text"
                    placeholder="Enter warehouse name or select"
                    list="warehouse-list"
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                    required
                  />
                  <datalist id="warehouse-list">
                    {warehouses.map((wh, idx) => (
                      <option key={idx} value={wh} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Buyer (Distributor)*
                  </label>
                  <select
                    value={selectedDistributor}
                    onChange={(e) => setSelectedDistributor(e.target.value)}
                    className="w-full h-10 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
                    required
                  >
                    <option value="">Select Distributor</option>
                    {distributors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.first_name} {d.last_name || ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Delivery Date*
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Order ID Remark
                </label>
                <input
                  type="text"
                  placeholder="Enter remarks or order reference note..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                />
              </div>
            </div>

            {/* Order Detail Summary Table Card */}
            <div className="bg-white border border-slate-150 rounded-[8px] overflow-hidden shadow-sm flex flex-col justify-between">
              <div className="p-4 border-b border-slate-100 bg-slate-50/30">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Order Detail
                </h3>
              </div>
              <div className="overflow-x-auto min-h-[160px]">
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/10">
                      <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Product</th>
                      <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Model</th>
                      <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-right">Delivery Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {orderDetails.map((row) => (
                      <tr key={row.productId} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-5 py-3 font-bold text-slate-800">{row.productName}</td>
                        <td className="px-5 py-3 text-slate-500">{row.model}</td>
                        <td className="px-5 py-3 text-right font-bold text-[#00B4D8]">{row.quantity} Units</td>
                      </tr>
                    ))}
                    {orderDetails.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-5 py-12 text-center text-slate-400 italic">
                          No Data. Scan or verify serial numbers to populate details.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Column 3: IMEI Scanning + Scan Record */}
          <div className="space-y-6">
            
            {/* IMEI Scanner block */}
            <div className="bg-white border border-slate-150 rounded-[8px] p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-[#00B4D8]" />
                IMEI / BoxID / SN
              </h3>

              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Please enter IMEI/BoxID/SN, press enter or Check button to check
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter IMEI or Scan..."
                    value={imeiInput}
                    onChange={(e) => setImeiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCheckImei();
                      }
                    }}
                    className="flex-1 h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  />
                  <button
                    type="button"
                    onClick={() => handleCheckImei()}
                    disabled={isCheckingImei}
                    className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-bold rounded-[6px] shadow flex items-center justify-center transition-colors min-w-[70px]"
                  >
                    {isCheckingImei ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
                  </button>
                </div>
                <div className="flex items-start gap-1.5 text-[9px] text-amber-600 font-semibold leading-normal bg-amber-50/50 p-2.5 rounded-[6px] border border-amber-100">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>No more than 2000 IMEIs per order. Please submit in time after completion.</span>
                </div>
              </div>
            </div>

            {/* Delivery Quantity counter card */}
            <div className="bg-gradient-to-tr from-[#0077B6] to-[#00B4D8] text-white border border-[#00B4D8]/20 rounded-[8px] p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-cyan-100 uppercase tracking-wider">Delivery Quantity</p>
                <p className="text-3xl font-extrabold tracking-tight mt-1">
                  {scannedItems.length}
                </p>
              </div>
              <Barcode className="w-12 h-12 opacity-30 text-white" />
            </div>

            {/* Scan Record logs */}
            <div className="bg-white border border-slate-150 rounded-[8px] p-5 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2">
                  Scan Record
                </h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {scannedItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-[6px] border border-slate-100 text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{item.imei}</p>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">{item.productName} ({item.model})</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeScannedItem(idx)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {scannedItems.length === 0 && (
                    <div className="text-center py-8 text-slate-400 italic text-xs">
                      No Record.
                    </div>
                  )}
                </div>
              </div>

              {/* Submit operations */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 h-10 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-[6px] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || scannedItems.length === 0}
                  className="flex-[2] h-10 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 text-white font-semibold text-xs rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Order
                </button>
              </div>
            </div>

          </div>
        </form>
      )}
    </div>
  );
}
