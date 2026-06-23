"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import { 
  Loader2, 
  ArrowLeft, 
  Check, 
  AlertCircle, 
  ShoppingBag, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Plus 
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { getLocalItems, saveLocalItem, mergeLocalItems } from "@/lib/supabaseLocalFallback";

interface Product {
  id: string;
  name: string;
  model: string;
  price: number;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  rsm_id?: string;
  warehouse?: string;
}

interface Stock {
  product_id: string;
  quantity: number;
  warehouse_name: string;
}

interface OrderItemInput {
  productId: string;
  productName: string;
  model: string;
  quantity: number;
  price: number;
}

export default function CreateOrderPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Loaded DB data
  const [currentRsm, setCurrentRsm] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [distributors, setDistributors] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockData, setStockData] = useState<Stock[]>([]);

  // Form selections
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedDistributorId, setSelectedDistributorId] = useState("");
  const [orderItems, setOrderItems] = useState<Record<string, { quantity: number; price: number }>>({});
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Custom Dropdown Open States
  const [isDistributorOpen, setIsDistributorOpen] = useState(false);
  const distributorRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (distributorRef.current && !distributorRef.current.contains(event.target as Node)) {
        setIsDistributorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        // 1. Get logged in user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error("Not authenticated");
          router.push("/login");
          return;
        }
        const currentUserId = session.user.id;

        // 2. Fetch profiles with resilient fallback
        let profileData: any[] = [];
        try {
          const { data: fullProfileData, error: profileErr } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, role, rsm_id, warehouse");

          if (profileErr) throw profileErr;
          profileData = fullProfileData || [];
        } catch (profileErr) {
          console.warn("Profiles schema missing columns. Falling back to metadata extraction.", profileErr);
          try {
            const { data: basicProfileData, error: basicErr } = await supabase
              .from("profiles")
              .select("id, first_name, last_name, role, designation");
            
            if (basicErr) throw basicErr;
            profileData = (basicProfileData || []).map((p: any) => {
              let rsmId: string | undefined = undefined;
              let wh: string | undefined = undefined;

              if (p.designation && p.designation.startsWith("[DISTRIBUTOR_METADATA]")) {
                try {
                  const meta = JSON.parse(p.designation.substring(22));
                  wh = meta.warehouse;
                  rsmId = meta.rsmId || meta.rsm_id;
                } catch (e) {
                  // Ignore
                }
              }

              return {
                id: p.id,
                first_name: p.first_name,
                last_name: p.last_name,
                role: p.role,
                rsm_id: rsmId,
                warehouse: wh,
              };
            });
          } catch (basicErr) {
            console.error("Failed to read profiles from Supabase. Defaulting to mock.", basicErr);
          }
        }

        const profiles: Profile[] = profileData;

        // Identify current user's profile
        const activeProfile = profiles.find(p => p.id === currentUserId) || null;
        setCurrentRsm(activeProfile);

        // Filter employees (role === "employee" || role === "admin")
        const emps = profiles.filter(
          p => p.role === "employee" || p.role === "admin"
        );
        setEmployees(emps);

        // Filter distributors
        const dists = profiles.filter(p => p.role === "distributor");
        setDistributors(dists);

        // 3. Fetch products
        let dbProds: any[] = [];
        try {
          const { data: prodData, error: prodErr } = await supabase
            .from("products")
            .select("id, name, model, price");
          if (prodErr) throw prodErr;
          dbProds = prodData || [];
        } catch (dbErr) {
          console.warn("Failed to fetch products. Using local fallback.", dbErr);
        }
        
        const mergedProds = mergeLocalItems(dbProds, "coretech_local_products");
        setProducts(mergedProds);

        // Initialize default prices for items
        const initialItems: Record<string, { quantity: number; price: number }> = {};
        mergedProds.forEach(p => {
          initialItems[p.id] = { quantity: 0, price: p.price || 0 };
        });
        setOrderItems(initialItems);

        // 4. Fetch stock
        let dbStock: any[] = [];
        try {
          const { data: stockList, error: stockErr } = await supabase
            .from("stock")
            .select("product_id, quantity, warehouse_name");
          if (stockErr) throw stockErr;
          dbStock = stockList || [];
        } catch (dbErr) {
          console.warn("Failed to fetch stock. Using local fallback.", dbErr);
        }
        const localStock = getLocalItems("coretech_local_stock");
        const mergedStock = [...dbStock, ...localStock];
        setStockData(mergedStock);

      } catch (err: any) {
        console.error(err);
        toast.error("Failed to load select parameters");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOptions();
  }, [supabase, router]);

  // Determine if a product is in stock based on the logged in user's warehouse or general stock
  const checkStockStatus = (productId: string) => {
    let filtered = stockData;

    if (currentRsm?.warehouse) {
      filtered = stockData.filter(
        s => s.warehouse_name?.toLowerCase() === currentRsm.warehouse?.toLowerCase()
      );
    }

    const totalQty = filtered
      .filter(s => s.product_id === productId)
      .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

    return totalQty > 0;
  };

  const handleQtyChange = (productId: string, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setOrderItems(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        quantity: num
      }
    }));
  };

  const handlePriceChange = (productId: string, val: string) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setOrderItems(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        price: num
      }
    }));
  };

  // Get distributors list padded to 16 for exact Figma duplication layout
  const getDisplayDistributors = () => {
    const list = [...distributors];
    // Fill up to 16 mock entries if database is empty/sparse
    for (let i = list.length + 1; i <= 16; i++) {
      list.push({
        id: `mock_dist_${i}`,
        first_name: `Distributer`,
        last_name: String(i).padStart(2, "0"),
        role: "distributor",
      });
    }
    return list;
  };

  // Add product to selections
  const handleAddProduct = (prodId: string) => {
    if (!prodId) return;
    if (!selectedProductIds.includes(prodId)) {
      setSelectedProductIds(prev => [...prev, prodId]);
      setOrderItems(prev => ({
        ...prev,
        [prodId]: {
          ...prev[prodId],
          quantity: 1, // Start with 1 qty when explicitly added
        }
      }));
    }
  };

  const handleRemoveProduct = (prodId: string) => {
    setSelectedProductIds(prev => prev.filter(id => id !== prodId));
    setOrderItems(prev => ({
      ...prev,
      [prodId]: {
        ...prev[prodId],
        quantity: 0,
      }
    }));
  };

  const getSubmittableItems = (): OrderItemInput[] => {
    const items: OrderItemInput[] = [];
    selectedProductIds.forEach(id => {
      const p = products.find(x => x.id === id);
      const entry = orderItems[id];
      if (p && entry && entry.quantity > 0) {
        items.push({
          productId: p.id,
          productName: p.name,
          model: p.model,
          quantity: entry.quantity,
          price: entry.price
        });
      }
    });
    return items;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmployeeId) {
      toast.error("Please select an Employee / RSM");
      return;
    }
    if (!selectedDistributorId) {
      toast.error("Please select a Distributor");
      return;
    }

    const submittable = getSubmittableItems();
    if (submittable.length === 0) {
      toast.error("Please add at least one product with quantity > 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const orderCode = `#CM${randomDigits}`;
      const totalAmount = submittable.reduce((sum, item) => sum + (item.quantity * item.price), 0);

      // Selected distributor label
      const activeDist = getDisplayDistributors().find(d => d.id === selectedDistributorId);
      const distName = activeDist ? `${activeDist.first_name} ${activeDist.last_name || ""}`.trim() : "";

      // Selected employee label
      const activeEmp = employees.find(emp => emp.id === selectedEmployeeId);
      const empName = activeEmp ? `${activeEmp.first_name} ${activeEmp.last_name || ""}`.trim() : "";

      const payload = {
        order_code: orderCode,
        user_id: currentRsm?.id || null,
        product_id: submittable[0].productId,
        distributor_id: selectedDistributorId.startsWith("mock_") ? null : selectedDistributorId,
        sales_coordinator_id: selectedEmployeeId.startsWith("mock_") ? null : selectedEmployeeId,
        status: "pending",
        items: submittable,
        local_user_name: currentRsm ? `${currentRsm.first_name} ${currentRsm.last_name || ""}`.trim() : "",
        local_product_name: submittable[0].productName,
        local_distributor_name: distName,
        local_coordinator_name: empName,
      };

      try {
        const { error } = await supabase.from("orders").insert(payload);
        if (error) throw error;
        toast.success(`Order ${orderCode} created successfully!`);
      } catch (dbErr) {
        console.warn("Supabase order insert failed. Saving locally.", dbErr);
        saveLocalItem("coretech_local_orders", payload);
        toast.success(`Order ${orderCode} created locally (Database fallback)!`);
      }

      try {
        await supabase.from("activity_logs").insert({
          action: "Create Buzzcart Order",
          details: `User ${currentRsm?.first_name} created order ${orderCode} assigned to RSM ${empName}. Total PKR ${totalAmount.toLocaleString()}`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }

      router.push("/dashboard/buzzcart/orders");
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedItems = getSubmittableItems();
  const totalPieces = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = selectedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const displayDistributorsList = getDisplayDistributors();
  const activeDistributor = displayDistributorsList.find(d => d.id === selectedDistributorId);
  const distributorLabel = activeDistributor 
    ? `${activeDistributor.first_name} ${activeDistributor.last_name || ""}`.trim() 
    : "Distributer";

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Figma Breadcrumbs and Navigation header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/buzzcart/orders"
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Buzzcart</span>
              <span className="text-[8px] font-normal">/</span>
              <span className="text-[#00B4D8]">Create Orders</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight mt-1">
              Buzzcart-Create Orders
            </h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Figma 3-Column Dropdowns Container */}
        <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-20">
          
          {/* 1. Employee Select (Business Requirement) */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              Select Employee / RSM*
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#00B4D8] cursor-pointer"
              required
            >
              <option value="">Select Employee / RSM</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name || ""} {emp.warehouse ? `(${emp.warehouse})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Distributor Custom 2-Column Dropdown (Figma Mockup) */}
          <div className="flex-1 min-w-[220px]" ref={distributorRef}>
            <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              Distributer*
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDistributorOpen(prev => !prev)}
                className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-700 bg-white flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer"
              >
                <span className={selectedDistributorId ? "text-slate-800" : "text-slate-400"}>
                  {distributorLabel}
                </span>
                {isDistributorOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {/* Figma-compliant 2-column dropdown body */}
              {isDistributorOpen && (
                <div className="absolute left-0 mt-1.5 w-[380px] bg-white border border-slate-150 rounded-[12px] shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {displayDistributorsList.map((d) => {
                      const labelText = `${d.first_name} ${d.last_name || ""}`.trim();
                      const isSelected = selectedDistributorId === d.id;
                      return (
                        <div
                          key={d.id}
                          onClick={() => {
                            setSelectedDistributorId(d.id);
                            setIsDistributorOpen(false);
                          }}
                          className={`px-3 py-2 text-[11px] font-bold rounded-[6px] transition-all cursor-pointer ${
                            isSelected 
                              ? "bg-[#00B4D8] text-white" 
                              : "text-slate-600 hover:bg-[#F0FAFE] hover:text-[#00B4D8]"
                          }`}
                        >
                          {labelText}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Product Dropdown Selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              Add Product
            </label>
            <select
              value=""
              onChange={(e) => handleAddProduct(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#00B4D8] cursor-pointer"
            >
              <option value="">Choose Model to Add</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.model || "Generic"})
                </option>
              ))}
            </select>
          </div>

          {/* 4. Action Button (Figma solid cyan layout) */}
          <div className="md:pt-4">
            <button
              type="submit"
              disabled={isSubmitting || selectedItems.length === 0}
              className="h-10 px-6 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-slate-100 disabled:text-slate-400 text-white font-extrabold text-xs rounded-[6px] shadow-lg shadow-cyan-100 flex items-center justify-center gap-1.5 transition-all hover:scale-[1.03] duration-200 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Order
            </button>
          </div>
        </div>

        {/* Selected Products Input Ledger */}
        {selectedProductIds.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-[12px] overflow-hidden shadow-sm animate-in slide-in-from-bottom-2 duration-300 relative z-10">
            <div className="p-4 border-b border-slate-100 bg-slate-50/20 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Selected Products Specifications
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold uppercase">
                {selectedProductIds.length} Added
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs select-none">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/10">
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Model Name</th>
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider w-28">Stock Status</th>
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider w-32">Order Qty (Pcs)</th>
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider w-40">Suggested Price (PKR)</th>
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-right">Subtotal</th>
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-center w-16">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {selectedProductIds.map((id) => {
                    const p = products.find(x => x.id === id);
                    if (!p) return null;
                    const isInStock = checkStockStatus(p.id);
                    const entry = orderItems[p.id] || { quantity: 1, price: p.price || 0 };
                    const subtotal = entry.quantity * entry.price;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-5 py-3 font-bold text-slate-800">
                          {p.name}
                          <p className="text-[10px] text-slate-400 font-normal">{p.model || "Generic"}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                            isInStock 
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                              : "bg-rose-50 text-rose-600 border-rose-100"
                          }`}>
                            {isInStock ? "In Stock" : "Out of Stock"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="number"
                            min="1"
                            placeholder="1"
                            value={entry.quantity || ""}
                            onChange={(e) => handleQtyChange(p.id, e.target.value)}
                            className="w-24 h-8 px-2.5 border border-slate-200 rounded-[6px] text-xs font-semibold focus:outline-none focus:border-[#00B4D8] text-center"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="number"
                            min="0"
                            placeholder={String(p.price || 0)}
                            value={entry.price || ""}
                            onChange={(e) => handlePriceChange(p.id, e.target.value)}
                            className="w-32 h-8 px-2.5 border border-slate-200 rounded-[6px] text-xs font-semibold focus:outline-none focus:border-[#00B4D8]"
                          />
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-slate-800">
                          PKR {subtotal.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveProduct(p.id)}
                            className="p-1 hover:bg-rose-50 text-rose-500 rounded border border-rose-100 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Estimated Summary Bar */}
            <div className="bg-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex gap-6">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Pieces</p>
                  <p className="text-xl font-extrabold text-white mt-0.5">{totalPieces} Pcs</p>
                </div>
                <div className="border-l border-slate-800 pl-6">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Estimated Order Value</p>
                  <p className="text-xl font-extrabold text-[#00B4D8] mt-0.5">PKR {totalValue.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/buzzcart/orders")}
                  className="h-9 px-4 text-xs font-semibold hover:bg-slate-800 text-slate-400 hover:text-white rounded-[6px] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || totalPieces === 0}
                  className="h-9 px-5 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-xs rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-all hover:scale-105 duration-200 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Order Request
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State Warning matching Figma */
          <div className="bg-white border border-slate-200 rounded-[12px] p-12 text-center shadow-sm space-y-3 animate-in fade-in duration-300">
            <div className="w-12 h-12 rounded-full bg-[#F0FAFE] text-[#00B4D8] flex items-center justify-center mx-auto border border-[#00B4D8]/20">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">No Products Selected</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                Choose a product model from the dropdown above to add it to your order details ledger.
              </p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
