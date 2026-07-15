"use client";

import React, { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createClientComponentClient } from "@/lib/supabase";
import toast from "react-hot-toast";
import { getLocalItems, saveLocalItem, mergeLocalItems } from "@/lib/supabaseLocalFallback";

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OrderModal({ isOpen, onClose, onSuccess }: OrderModalProps) {
  const supabase = createClientComponentClient();

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [coordinators, setCoordinators] = useState<any[]>([]);

  // Form fields
  const [userId, setUserId] = useState("");
  const [productId, setProductId] = useState("");
  const [distributorId, setDistributorId] = useState("");
  const [coordinatorId, setCoordinatorId] = useState("");
  const [status, setStatus] = useState("pending");

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      // Fetch relational options
      const fetchOptions = async () => {
        try {
          // Fetch profiles (customers/users)
          let profiles: any[] = [];
          try {
            const { data: profileData, error: profileErr } = await supabase
              .from("profiles")
              .select("id, first_name, last_name, role");
            if (profileErr) throw profileErr;
            profiles = profileData || [];
          } catch (dbErr) {
            console.warn("Profiles query failed. Using mock profiles fallback.", dbErr);
            profiles = [
              { id: "mock_user_1", first_name: "Ali", last_name: "Dealer", role: "sub_dealer" },
              { id: "mock_user_2", first_name: "Fatima", last_name: "Dealer", role: "sub_dealer" },
              { id: "mock_dist_1", first_name: "Distributer", last_name: "01", role: "distributor" },
              { id: "mock_dist_2", first_name: "Distributer", last_name: "02", role: "distributor" },
              { id: "mock_coord_1", first_name: "Kamran", last_name: "RSM", role: "employee" },
              { id: "mock_coord_2", first_name: "Admin", last_name: "User", role: "admin" }
            ];
          }

          // Filter by roles appropriately
          setUsers(profiles.filter((p: any) => p.role !== "installer"));
          setDistributors(profiles.filter((p: any) => p.role === "distributor"));
          setCoordinators(profiles.filter((p: any) => p.role === "employee" || p.role === "admin"));

          // Fetch products
          let dbProds: any[] = [];
          try {
            const { data: prodData, error: prodErr } = await supabase
              .from("products")
              .select("id, name, model, price");
            if (prodErr) throw prodErr;
            dbProds = prodData || [];
          } catch (dbErr) {
            console.warn("Products query failed. Using local fallback.", dbErr);
          }
          const mergedProds = mergeLocalItems(dbProds, "coretech_local_products");
          if (mergedProds.length === 0) {
            // Guarantee at least some default products if fallback is empty too
            setProducts([
              { id: "default_prod_1", name: "Jinko 550W Solar Panel", model: "JKM550M-72HL4", price: 28000 },
              { id: "default_prod_2", name: "CoreTECH 10kW Inverter", model: "SUN2000-10KTL-M1", price: 290000 },
            ]);
          } else {
            setProducts(mergedProds);
          }
        } catch (err: any) {
          toast.error("Failed to fetch order configuration profiles");
        }
      };

      fetchOptions();
      setUserId("");
      setProductId("");
      setDistributorId("");
      setCoordinatorId("");
      setStatus("pending");
      setErrors({});
    }
  }, [isOpen, supabase]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!userId) errs.userId = "Customer selection is required";
    if (!productId) errs.productId = "Product selection is required";
    if (!distributorId) errs.distributorId = "Distributor is required";
    if (!coordinatorId) errs.coordinatorId = "Sales coordinator is required";
    if (!status) errs.status = "Status selection is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Generate order code like `#CM` + random 4 digits
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const orderCode = `#CM${randomDigits}`;

      const selectedProd = products.find(p => p.id === productId);
      const selectedUser = users.find(u => u.id === userId);
      const selectedDist = distributors.find(d => d.id === distributorId);
      const selectedCoord = coordinators.find(c => c.id === coordinatorId);

      const items = [{
        productId: productId,
        productName: selectedProd?.name || "Generic Product",
        model: selectedProd?.model || "Generic",
        quantity: 1,
        price: selectedProd?.price || 120000,
      }];

      const payload = {
        order_code: orderCode,
        user_id: userId.startsWith("mock_") ? null : userId,
        product_id: productId.startsWith("default_") ? null : productId,
        distributor_id: distributorId.startsWith("mock_") ? null : distributorId,
        sales_coordinator_id: coordinatorId.startsWith("mock_") ? null : coordinatorId,
        status,
        items,
        local_user_name: selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name || ""}`.trim() : "Unknown User",
        local_product_name: selectedProd?.name || "Generic Product",
        local_distributor_name: selectedDist ? `${selectedDist.first_name} ${selectedDist.last_name || ""}`.trim() : "Unknown Distributor",
        local_coordinator_name: selectedCoord ? `${selectedCoord.first_name} ${selectedCoord.last_name || ""}`.trim() : "Unknown Coordinator",
      };

      try {
        const { error } = await supabase.from("orders").insert(payload);
        if (error) throw error;
        toast.success(`Order ${orderCode} successfully created!`);
      } catch (dbErr) {
        console.warn("Supabase order insert failed. Saving locally.", dbErr);
        saveLocalItem("coretech_local_orders", payload);
        toast.success(`Order ${orderCode} created locally (Database fallback)!`);
      }

      // Log audit trail safely
      try {
        await supabase.from("activity_logs").insert({
          action: "Create Order Modal",
          details: `Created order ${orderCode} for customer. Status: ${status}`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
      ></div>

      <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Create Order
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Customer / User*
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className={`w-full h-9 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${
                errors.userId ? "border-rose-500" : "border-slate-200"
              }`}
            >
              <option value="">Select Customer</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name || ""} ({u.role})
                </option>
              ))}
            </select>
            {errors.userId && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.userId}</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Product*
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={`w-full h-9 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${
                errors.productId ? "border-rose-500" : "border-slate-200"
              }`}
            >
              <option value="">Select Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.model || "-"})
                </option>
              ))}
            </select>
            {errors.productId && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.productId}</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Distributor*
            </label>
            <select
              value={distributorId}
              onChange={(e) => setDistributorId(e.target.value)}
              className={`w-full h-9 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${
                errors.distributorId ? "border-rose-500" : "border-slate-200"
              }`}
            >
              <option value="">Select Distributor</option>
              {distributors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.first_name} {d.last_name || ""}
                </option>
              ))}
            </select>
            {errors.distributorId && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.distributorId}</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Sales Coordinator*
            </label>
            <select
              value={coordinatorId}
              onChange={(e) => setCoordinatorId(e.target.value)}
              className={`w-full h-9 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${
                errors.coordinatorId ? "border-rose-500" : "border-slate-200"
              }`}
            >
              <option value="">Select Employee</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name || ""}
                </option>
              ))}
            </select>
            {errors.coordinatorId && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.coordinatorId}</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Status*
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
            >
              <option value="pending">Pending</option>
              <option value="complete">Complete</option>
              <option value="declined">Declined</option>
              <option value="purchase_invoice_pending">Purchase Invoice Pending</option>
              <option value="contract_created">Contract Created</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
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
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
