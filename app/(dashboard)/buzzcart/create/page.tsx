"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import { Loader2, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

export default function CreateOrderPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, role");

        if (profileData) {
          setUsers(profileData.filter((p: any) => p.role !== "installer"));
          setDistributors(profileData.filter((p: any) => p.role === "distributor"));
          setCoordinators(profileData.filter((p: any) => p.role === "employee" || p.role === "admin"));
        }

        const { data: prodData } = await supabase
          .from("products")
          .select("id, name, model");
        if (prodData) setProducts(prodData);
      } catch (err: any) {
        toast.error("Failed to load select parameters");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOptions();
  }, [supabase]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!userId) errs.userId = "Customer selection is required";
    if (!productId) errs.productId = "Product selection is required";
    if (!distributorId) errs.distributorId = "Distributor is required";
    if (!coordinatorId) errs.coordinatorId = "Sales coordinator is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const orderCode = `#CM${randomDigits}`;

      const { error } = await supabase.from("orders").insert({
        order_code: orderCode,
        user_id: userId,
        product_id: productId,
        distributor_id: distributorId,
        sales_coordinator_id: coordinatorId,
        status,
      });

      if (error) throw error;

      toast.success(`Order ${orderCode} created successfully!`);
      router.push("/dashboard/buzzcart/orders");
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none max-w-2xl mx-auto">
      {/* Back Button & Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/buzzcart/orders"
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Create Order</h1>
          <p className="text-xs text-slate-500">
            Submit a new Buzzcart purchase order into the network.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-[8px] p-6 shadow-sm space-y-5"
      >
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Customer / User*
          </label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={`w-full h-10 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${
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
            className={`w-full h-10 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${
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
            className={`w-full h-10 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${
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
            className={`w-full h-10 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${
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
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full h-10 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
          >
            <option value="pending">Pending</option>
            <option value="complete">Complete</option>
            <option value="declined">Declined</option>
            <option value="purchase_invoice_pending">Purchase Invoice Pending</option>
            <option value="contract_created">Contract Created</option>
          </select>
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 px-6 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-colors ml-auto"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Submit Order
          </button>
        </div>
      </form>
    </div>
  );
}
