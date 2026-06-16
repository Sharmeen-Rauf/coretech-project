"use client";

import React, { useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import { Download, UploadCloud, FileText, Loader2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

export default function ImportStockPage() {
  const supabase = createClientComponentClient();

  // Form states
  const [file, setFile] = useState<File | null>(null);
  const [importDate, setImportDate] = useState("");
  const [modelNo, setModelNo] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    const headers = "Name,Code,Barcode,Brand,Category Code,Model,Price,Cost,Alert Quantity\n";
    const sampleRows = 
      'ASOS Ridley High Waist,ASOS-RD1,882347102,ASOS,battery,AR-100,79.49,50.00,10\n' +
      'Marco Lightweight Shirt,MARCO-SH1,882347103,Marco,inverter,M-50,128.50,90.00,5\n';
    
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
    if (!file) errs.file = "CSV file is required";
    if (!importDate) errs.importDate = "Import date is required";
    if (!modelNo.trim()) errs.modelNo = "Model number is required";
    if (!serialNo.trim()) errs.serialNo = "Serial number is required";
    if (!warehouseName.trim()) errs.warehouseName = "Warehouse name is required";
    
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsImporting(true);
    try {
      const text = await file!.text();
      // Split lines and parse CSV
      const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length <= 1) {
        throw new Error("CSV file is empty or only contains headers");
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      
      let successCount = 0;

      // Loop rows (skipping header)
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(",").map((cell) => cell.replace(/^["']|["']$/g, "").trim());
        if (row.length < headers.length) continue;

        // Map cells (Name, Code, Barcode, Brand, Category, Model, Price, Cost, AlertQty)
        const name = row[0];
        const code = row[1];
        const brand = row[3];
        let category = row[4]?.toLowerCase() || "inverter";
        if (!["inverter", "battery", "aio"].includes(category)) {
          category = "inverter"; // Fallback to schema constraint
        }
        const model = row[5];
        const price = parseFloat(row[6]) || 0;
        const cost = parseFloat(row[7]) || 0;
        const alertQuantity = parseInt(row[8]) || 0;

        if (!name) continue;

        // 1. Resolve or create product in Supabase
        let productId;
        const { data: existingProd } = await supabase
          .from("products")
          .select("id")
          .eq("code", code)
          .maybeSingle();

        if (existingProd) {
          productId = existingProd.id;
        } else {
          // Insert new product
          const { data: newProd, error: prodErr } = await supabase
            .from("products")
            .insert({
              name,
              code,
              brand,
              category,
              model,
              price,
              cost,
              alert_quantity: alertQuantity,
            })
            .select("id")
            .single();

          if (prodErr) throw prodErr;
          productId = newProd.id;
        }

        // 2. Insert Stock entry linked to the product
        const { error: stockErr } = await supabase
          .from("stock")
          .insert({
            product_id: productId,
            model_no: modelNo,
            serial_no: `${serialNo}-${i}`, // append index for uniqueness
            warehouse_name: warehouseName,
            import_date: importDate,
            quantity: alertQuantity || 1, // Default quantity
          });

        if (stockErr) throw stockErr;
        successCount++;
      }

      toast.success(`Import completed successfully! Registered ${successCount} stock entries.`);
      setFile(null);
      setModelNo("");
      setSerialNo("");
      setWarehouseName("");
    } catch (err: any) {
      toast.error(err.message || "Failed to process CSV import");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 select-none max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Import Stock</h1>
        <p className="text-xs text-slate-500">
          Upload products CSV inventory files and associate them to warehouses.
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
            <li>The correct column order is: <span className="font-bold text-[#00B4D8]">Name, Code, Barcode, Brand, Category Code, Model, Price, Cost, Alert Quantity</span></li>
            <li>Ensure the category code is one of: <span className="font-bold">inverter, battery, aio</span></li>
            <li>Ensure files are UTF-8 encoded and images are pre-loaded to uploads.</li>
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
              Model No*
            </label>
            <input
              type="text"
              placeholder="e.g. M-100X"
              value={modelNo}
              onChange={(e) => setModelNo(e.target.value)}
              className={`w-full h-10 px-3 border rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00B4D8] ${
                errors.modelNo ? "border-rose-500" : "border-slate-200"
              }`}
            />
            {errors.modelNo && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.modelNo}</p>
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
              onChange={(e) => setSerialNo(e.target.value)}
              className={`w-full h-10 px-3 border rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00B4D8] ${
                errors.serialNo ? "border-rose-500" : "border-slate-200"
              }`}
            />
            {errors.serialNo && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.serialNo}</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Warehouse Name*
            </label>
            <input
              type="text"
              placeholder="e.g. Lahore Central"
              value={warehouseName}
              onChange={(e) => setWarehouseName(e.target.value)}
              className={`w-full h-10 px-3 border rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00B4D8] ${
                errors.warehouseName ? "border-rose-500" : "border-slate-200"
              }`}
            />
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
            className="h-10 px-6 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-colors ml-auto"
          >
            {isImporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Import
          </button>
        </div>
      </form>
    </div>
  );
}
