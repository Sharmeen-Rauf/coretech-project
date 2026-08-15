"use client";

import React, { useState, useEffect } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import { Download, UploadCloud, FileText, Loader2, Zap, CheckCircle2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { bulkImportStockAction } from "@/app/actions/products";
import { getLocalItems, mergeLocalItems } from "@/lib/supabaseLocalFallback";
import { fetchRecordsAction } from "@/app/actions/users";

export default function ImportStockPage() {
  const supabase = createClientComponentClient();

  // Form states
  const [file, setFile] = useState<File | null>(null);
  const [importDate, setImportDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [productCode, setProductCode] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [importSpeedInfo, setImportSpeedInfo] = useState("");
  const [importSkipped, setImportSkipped] = useState<{ serial_no?: string; code?: string; reason: string }[]>([]);
  const [warehousesList, setWarehousesList] = useState<string[]>([]);
  const [userRole, setUserRole] = useState("");

  const [allProductsList, setAllProductsList] = useState<any[]>([]);
  const [selectedProductDetails, setSelectedProductDetails] = useState<any | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
          if (profile?.role) {
            setUserRole(profile.role);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch user role", err);
      }

      try {
        let dbProds: any[] = [];
        try {
          const { data, error } = await supabase
            .from("products")
            .select("*")
            .order("model", { ascending: true });
          if (error) throw error;
          dbProds = data || [];
        } catch (dbErr) {
          console.warn("Failed to fetch products. Checking local products.", dbErr);
        }

        const localProds = getLocalItems("coretech_local_products");
        const allProds = [...dbProds, ...localProds];
        setAllProductsList(allProds);
      } catch (err: any) {
        console.error("Error fetching products:", err);
      }

      let dbData: any[] = [];
      try {
        const res = await fetchRecordsAction("regions");
        if (res.success && res.data) {
          dbData = res.data;
        }
      } catch (err) {
        console.warn("Error fetching warehouses:", err);
      }
      const merged = mergeLocalItems(dbData, "coretech_local_regions");
      const whs = Array.from(new Set(merged.map((r: any) => r.warehouse).filter(Boolean))) as string[];
      setWarehousesList(whs);
    };
    fetchModels();
  }, [supabase]);

  const handleProductChange = (code: string) => {
    setProductCode(code);
    if (!code) {
      setSelectedProductDetails(null);
      return;
    }
    const matched = allProductsList.find((p) => p.code === code);
    setSelectedProductDetails(matched || null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.name.endsWith(".csv")) {
        setFile(selected);
      } else {
        toast.error("Please select a valid CSV file (.csv)");
      }
    }
  };

  const downloadSampleFile = () => {
    const headers = "Name,Code,Serial Number,Brand,Category Code,Model,Price,Cost,Warehouse\n";
    const sampleRows = 
      'ASOS Ridley High Waist,ASOS-RD1,SN-BATT-001,ASOS,battery,AR-100,79.49,50.00,Lahore Central\n' +
      'Marco Lightweight Shirt,MARCO-SH1,SN-INV-001,Marco,inverter,M-50,128.50,90.00,Karachi Port\n';
    
    const blob = new Blob([headers + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "coretech_sample_import.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Sample file downloaded!");
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!importDate) errs.importDate = "Import date is required";

    // Only require manual details if no file is selected
    if (!file) {
      if (!productCode) errs.productCode = "Product is required";
      if (!serialNo.trim()) errs.serialNo = "Serial number is required";
      if (!warehouseName.trim()) errs.warehouseName = "Warehouse name is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsImporting(true);
    setProgressPercent(0);
    setProgressText("Initializing bulk import pipeline...");
    setImportSpeedInfo("");
    setImportSkipped([]);

    const startTime = Date.now();
    const allSkipped: { serial_no?: string; code?: string; reason: string }[] = [];

    try {
      if (file) {
        // Mode A: High-Speed CSV Bulk Import
        // CSV structure is unchanged (Name, Code, Serial Number, Brand, Category Code,
        // Model, Price, Cost, Warehouse) — only Code, Serial Number, and Warehouse are
        // actually used; the rest is parsed but ignored, since every row must map to an
        // already-registered Product Management record by Code.
        setProgressText("Reading & parsing CSV file...");
        const text = await file.text();
        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (lines.length <= 1) {
          throw new Error("CSV file is empty or only contains headers");
        }

        const parsedItems: any[] = [];

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",").map((cell) => cell.replace(/^["']|["']$/g, "").trim());
          if (row.length < 2) continue;

          const name = row[0];
          const code = row[1] || name;
          const serialNum = row[2] || "";
          const csvWarehouse = row[8] || warehouseName || "Main Warehouse (275)";

          if (!name && !code) continue;

          parsedItems.push({
            code,
            serial_no: serialNum,
            warehouse_name: csvWarehouse,
          });
        }

        const totalItems = parsedItems.length;
        if (totalItems === 0) {
          throw new Error("No valid data rows found in CSV file");
        }

        setProgressText(`Processing ${totalItems.toLocaleString()} items in bulk batches...`);

        // Execute in chunks of 3,000 items
        const chunkSize = 3000;
        let processedCount = 0;
        let totalInserted = 0;

        for (let i = 0; i < totalItems; i += chunkSize) {
          const chunk = parsedItems.slice(i, i + chunkSize);
          const currentBatchNumber = Math.floor(i / chunkSize) + 1;
          const totalBatches = Math.ceil(totalItems / chunkSize);

          setProgressText(`Importing batch ${currentBatchNumber} of ${totalBatches} (${processedCount.toLocaleString()} / ${totalItems.toLocaleString()} items)...`);

          const res = await bulkImportStockAction(chunk, importDate, warehouseName || "Main Warehouse (275)");
          if (!res.success) {
            throw new Error(res.error || `Bulk batch ${currentBatchNumber} failed`);
          }

          totalInserted += res.count || 0;
          if (res.skipped && res.skipped.length) allSkipped.push(...res.skipped);

          processedCount += chunk.length;
          const percent = Math.min(100, Math.round((processedCount / totalItems) * 100));
          setProgressPercent(percent);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const speedMsg = `Imported ${totalInserted.toLocaleString()} of ${totalItems.toLocaleString()} stock entries in ${duration}s${allSkipped.length ? ` — ${allSkipped.length} skipped` : ""}`;
        setImportSpeedInfo(speedMsg);
        if (allSkipped.length) {
          toast.error(`${allSkipped.length} row(s) skipped — see details below`);
        } else {
          toast.success(speedMsg);
        }
        setFile(null);
      } else {
        // Mode B: Fast Manual Stock Entry
        const finalSerial = serialNo.trim();
        setProgressText("Saving manual stock entry...");

        const manualItem = [{
          code: productCode,
          serial_no: finalSerial,
          warehouse_name: warehouseName || "Main Warehouse (275)",
        }];

        const res = await bulkImportStockAction(manualItem, importDate, warehouseName || "Main Warehouse (275)");
        if (!res.success) throw new Error(res.error || "Failed manual stock insert");

        if (res.skipped && res.skipped.length) allSkipped.push(...res.skipped);

        setProgressPercent(100);
        if (allSkipped.length) {
          toast.error(allSkipped[0].reason);
        } else {
          toast.success("Manual stock entry registered successfully!");
        }
      }

      setImportSkipped(allSkipped);
      setProductCode("");
      setSerialNo("");
      setWarehouseName("");
      setSelectedProductDetails(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save stock entry");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 select-none max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {userRole === "distributor" ? "Consignment Import" : "Import Stock"}
        </h1>
        <p className="text-xs text-slate-500">
          {userRole === "distributor" 
            ? "Upload consignment CSV inventory files and associate them to warehouses."
            : "Upload products CSV inventory files and associate them to warehouses."}
        </p>
      </div>

      {/* Info Warning Box */}
      <div className="bg-sky-50/50 border border-[#00B4D8]/30 rounded-[8px] p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1 text-xs text-slate-700 leading-relaxed max-w-xl">
          <p className="font-bold text-[#0077B6]">
            Please follow the structure constraints below:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-600 font-medium">
            <li>The CSV file structure should not be modified.</li>
            <li>The correct column order is: <span className="font-bold text-[#00B4D8]">Name, Code, Serial Number, Brand, Category Code, Model, Price, Cost, Warehouse</span></li>
            <li>Ensure the category code is one of: <span className="font-bold">inverter, battery, aio</span></li>
          </ul>
        </div>
        <button
          onClick={downloadSampleFile}
          className="md:self-start h-9 px-4 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] rounded-[6px] transition-colors flex items-center justify-center gap-1.5 shadow"
        >
          <Download className="w-3.5 h-3.5" />
          Download Sample File
        </button>
      </div>

      <form onSubmit={handleImportSubmit} className="space-y-6 bg-white border border-slate-200 rounded-[8px] p-6 shadow-sm">
        {/* Progress Bar & Performance Ticker */}
        {(isImporting || importSpeedInfo) && (
          <div className="p-4 rounded-[8px] bg-slate-900 text-white space-y-3 shadow-lg border border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-[#00B4D8]">
                {isImporting ? (
                  <>
                    <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
                    Ultra-Fast Bulk Importer Active
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Bulk Import Complete
                  </>
                )}
              </span>
              <span className="text-slate-300 font-mono">{progressPercent}%</span>
            </div>

            {/* Progress Bar Track */}
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div 
                className="bg-gradient-to-r from-[#00B4D8] to-emerald-400 h-full rounded-full transition-all duration-300 shadow"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium">
              <span>{progressText}</span>
              {importSpeedInfo && (
                <span className="font-mono text-emerald-400 font-bold">{importSpeedInfo}</span>
              )}
            </div>
          </div>
        )}

        {/* Skipped Rows Report */}
        {importSkipped.length > 0 && (
          <div className="p-4 rounded-[8px] bg-rose-50 border border-rose-200 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
              <AlertTriangle className="w-4 h-4" />
              {importSkipped.length} row(s) skipped — not added to inventory
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {importSkipped.map((s, idx) => (
                <div key={idx} className="text-[11px] text-rose-700 bg-white border border-rose-100 rounded-[4px] px-2 py-1">
                  {s.serial_no && <span className="font-mono font-bold">{s.serial_no}</span>}
                  {s.serial_no && s.code && " · "}
                  {s.code && <span className="font-mono">{s.code}</span>}
                  {(s.serial_no || s.code) && " — "}
                  {s.reason}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Field */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Upload File*
          </label>
          <div className={`border-2 border-dashed rounded-[8px] p-6 text-center transition-all ${
            file ? "border-[#00B4D8] bg-[#F0FAFE]/20" : "border-slate-300 hover:border-[#00B4D8]"
          }`}>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-file-picker"
            />
            {file ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <FileText className="w-10 h-10 text-[#00B4D8]" />
                <span className="text-xs font-semibold text-slate-800">{file.name}</span>
                <span className="text-[10px] text-slate-400 font-bold">{(file.size / 1024).toFixed(1)} KB</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-[10px] text-rose-500 font-bold hover:underline mt-1"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <label htmlFor="csv-file-picker" className="flex flex-col items-center justify-center gap-2 cursor-pointer">
                <UploadCloud className="w-10 h-10 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">
                  Drag and drop CSV here or click to <span className="text-[#00B4D8] hover:underline font-bold">Browse</span>
                </span>
                <span className="text-[10px] text-slate-400">CSV files only, max 5MB</span>
              </label>
            )}
          </div>
          {errors.file && (
            <p className="text-[10px] text-rose-500 font-semibold mt-1">{errors.file}</p>
          )}
        </div>

        {/* 2x2 Grid Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Import Date*
            </label>
            <input
              type="date"
              value={importDate}
              onChange={(e) => setImportDate(e.target.value)}
              className={`w-full h-10 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                errors.importDate ? "border-rose-500" : "border-slate-200"
              }`}
            />
            {errors.importDate && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.importDate}</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Product*
            </label>
            <select
              value={productCode}
              disabled={!!file}
              onChange={(e) => handleProductChange(e.target.value)}
              className={`w-full h-10 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${
                file ? "opacity-50 cursor-not-allowed bg-slate-50" : ""
              } ${
                errors.productCode ? "border-rose-500" : "border-slate-200"
              }`}
            >
              <option value="">Select Product</option>
              {allProductsList.map((p, idx) => (
                <option key={idx} value={p.code}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
            {errors.productCode && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.productCode}</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Serial No Prefix*
            </label>
            <input
              type="text"
              placeholder="e.g. SN-INV"
              value={serialNo}
              disabled={!!file}
              onChange={(e) => setSerialNo(e.target.value)}
              className={`w-full h-10 px-3 border rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00B4D8] ${
                file ? "opacity-50 cursor-not-allowed bg-slate-50" : ""
              } ${
                errors.serialNo ? "border-rose-500" : "border-slate-200"
              }`}
            />
            {errors.serialNo && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.serialNo}</p>
            )}
          </div>

          {selectedProductDetails && (
            <div className="md:col-span-2 bg-[#F0FAFE]/40 border border-[#00B4D8]/20 rounded-[8px] p-5 grid grid-cols-2 md:grid-cols-3 gap-4 animate-in slide-in-from-top-4 duration-300">
              <div className="col-span-2 md:col-span-3 pb-2 border-b border-[#00B4D8]/10 flex items-center justify-between">
                <span className="text-xs font-bold text-[#0077B6] uppercase tracking-wider">Auto-Fetched Product Details</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00B4D8]/10 text-[#0077B6] uppercase">
                  {selectedProductDetails.category || "General"}
                </span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Product Name</span>
                <span className="text-xs font-bold text-slate-700">{selectedProductDetails.name || "-"}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Product Code</span>
                <span className="text-xs font-bold text-slate-700">{selectedProductDetails.code || "-"}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Brand</span>
                <span className="text-xs font-bold text-slate-700">{selectedProductDetails.brand || "-"}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sale Price</span>
                <span className="text-xs font-bold text-emerald-600">Rs. {selectedProductDetails.price?.toLocaleString() || "0"}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cost Price</span>
                <span className="text-xs font-bold text-slate-500">Rs. {selectedProductDetails.cost?.toLocaleString() || "0"}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Warehouse Name*
            </label>
            <select
              value={warehouseName}
              disabled={!!file}
              onChange={(e) => setWarehouseName(e.target.value)}
              className={`w-full h-10 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${
                file ? "opacity-50 cursor-not-allowed bg-slate-50" : ""
              } ${
                errors.warehouseName ? "border-rose-500" : "border-slate-200"
              }`}
            >
              <option value="">Select Warehouse Name</option>
              {warehousesList.map((wh, idx) => (
                <option key={idx} value={wh}>
                  {wh}
                </option>
              ))}
            </select>
            {errors.warehouseName && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.warehouseName}</p>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={isImporting}
            className="h-10 px-6 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-colors ml-auto animate-in fade-in"
          >
            {isImporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isImporting ? `Importing (${progressPercent}%)...` : (file ? "Import CSV Stock File" : "Add Stock Manually")}
          </button>
        </div>
      </form>
    </div>
  );
}
