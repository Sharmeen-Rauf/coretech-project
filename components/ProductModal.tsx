"use client";
 
import React, { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createClientComponentClient } from "@/lib/supabase";
import { createProductAction, updateProductAction } from "@/app/actions/products";
import toast from "react-hot-toast";
 
interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: string; // 'inverter' | 'battery' | 'aio'
  onSuccess: () => void;
  editingProduct?: any;
}
 
export default function ProductModal({
  isOpen,
  onClose,
  category,
  onSuccess,
  editingProduct,
}: ProductModalProps) {
  const supabase = createClientComponentClient();
  const isEdit = !!editingProduct;
 
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [code, setCode] = useState("");
  const [prodCategory, setProdCategory] = useState("inverter");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [alertQuantity, setAlertQuantity] = useState("5");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
 
  useEffect(() => {
    if (isOpen) {
      if (editingProduct) {
        setBrand(editingProduct.brand || "");
        setName(editingProduct.name || "");
        setModel(editingProduct.model || "");
        setCode(editingProduct.code || "");
        setProdCategory(editingProduct.category || category || "inverter");
        setPrice(editingProduct.price ? String(editingProduct.price) : "");
        setCost(editingProduct.cost ? String(editingProduct.cost) : "");
        setAlertQuantity(editingProduct.alert_quantity ? String(editingProduct.alert_quantity) : "5");
      } else {
        setBrand("");
        setName("");
        setModel("");
        setCode("");
        setProdCategory(category || "inverter");
        setPrice("");
        setCost("");
        setAlertQuantity("5");
      }
      setErrors({});
    }
  }, [isOpen, editingProduct, category]);
 
  if (!isOpen) return null;
 
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!brand.trim()) errs.brand = "Brand is required";
    if (!name.trim()) errs.name = "Product name is required";
    if (!model.trim()) errs.model = "Model is required";
    if (!code.trim()) errs.code = "Product code is required";
    if (!price || parseFloat(price) <= 0) errs.price = "Valid price is required";
    if (!cost || parseFloat(cost) <= 0) errs.cost = "Valid cost is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
 
    setIsLoading(true);
    const data = {
      brand: brand.trim(),
      name: name.trim(),
      model: model.trim(),
      code: code.trim().toUpperCase(),
      category: prodCategory,
      price: parseFloat(price),
      cost: parseFloat(cost),
      alert_quantity: parseInt(alertQuantity) || 0,
    };
 
    try {
      let res;
      if (isEdit) {
        res = await updateProductAction(editingProduct.id, data);
      } else {
        res = await createProductAction(data);
      }
 
      if (!res.success) {
        throw new Error(res.error || "Operation failed");
      }
 
      toast.success(isEdit ? "Product updated successfully!" : "Product created successfully!");
      
      // Log activity
      await supabase.from("activity_logs").insert({
        action: isEdit ? "Product Updated" : "Product Created",
        details: `Product "${data.name}" (${data.code}) was ${isEdit ? "modified" : "registered"}`,
      }).catch((e: any) => console.warn("Activity log insert failed:", e));
 
      onSuccess();
      onClose();
    } catch (err: any) {
      console.warn("Supabase product operation failed. Falling back to local storage.", err);
      try {
        const { saveLocalItem } = require("@/lib/supabaseLocalFallback");
        const fallbackItem = {
          ...data,
          id: isEdit ? editingProduct.id : undefined,
        };
        saveLocalItem("coretech_local_products", fallbackItem, isEdit);
        toast.success(isEdit ? "Product updated locally (Database fallback)!" : "Product registered locally (Database fallback)!");
        onSuccess();
        onClose();
      } catch (fallbackErr) {
        console.error("Local storage fallback failed:", fallbackErr);
        toast.error(err.message || "Operation failed");
      }
    } finally {
      setIsLoading(false);
    }
  };
 
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
      ></div>
 
      {/* Card Body */}
      <div className="relative bg-white w-full max-w-md border border-slate-100 rounded-[12px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800">
            {isEdit ? "Edit Product" : "Add Product"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
 
        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Brand*
              </label>
              <input
                type="text"
                placeholder="e.g. Huawei"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.brand ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.brand && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.brand}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Model*
              </label>
              <input
                type="text"
                placeholder="e.g. SUN2000"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.model ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.model && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.model}</p>
              )}
            </div>
          </div>
 
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Product Name*
            </label>
            <input
              type="text"
              placeholder="e.g. Huawei 10kW Smart Inverter"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                errors.name ? "border-rose-500" : "border-slate-200"
              }`}
            />
            {errors.name && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.name}</p>
            )}
          </div>
 
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Product Code / SKU*
              </label>
              <input
                type="text"
                placeholder="e.g. HW-10KW-INV"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.code ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.code && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.code}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={prodCategory}
                onChange={(e) => setProdCategory(e.target.value)}
                className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
              >
                <option value="inverter">Inverter</option>
                <option value="battery">Battery</option>
                <option value="aio">AIO (All in One)</option>
              </select>
            </div>
          </div>
 
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Cost Price*
              </label>
              <input
                type="number"
                placeholder="Cost"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className={`w-full h-9 px-2 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.cost ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.cost && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.cost}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Sale Price*
              </label>
              <input
                type="number"
                placeholder="Price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`w-full h-9 px-2 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.price ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.price && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.price}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Alert Qty
              </label>
              <input
                type="number"
                value={alertQuantity}
                onChange={(e) => setAlertQuantity(e.target.value)}
                className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
              />
            </div>
          </div>
        </form>
 
        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-100 rounded-[6px] text-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="h-9 px-4 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
