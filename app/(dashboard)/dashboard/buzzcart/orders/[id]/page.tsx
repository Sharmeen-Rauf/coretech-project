"use client";
 
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import { Loader2, ArrowLeft, Calendar, User, Box, ShieldCheck, Check, X, FileText } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
 
export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();
 
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [linkedInvoice, setLinkedInvoice] = useState<any>(null);
  const [linkedGatePass, setLinkedGatePass] = useState<any>(null);
 
  const fetchOrderDetails = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
 
      // 1. Fetch user role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profile) setUserRole(profile.role);
 
      // 2. Fetch order data
      const { data: orderData, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_code,
          status,
          created_at,
          user:profiles!user_id(first_name, last_name, email, contact),
          product:products(*),
          distributor:profiles!distributor_id(first_name, last_name, contact),
          coordinator:profiles!sales_coordinator_id(first_name, last_name, contact)
        `)
        .eq("id", id)
        .single();
 
      if (error) throw error;
      setOrder(orderData);
 
      // 3. Fetch linked invoices
      const { data: invData } = await supabase
        .from("invoices")
        .select("invoice_code, payment_status, amount")
        .eq("order_id", id)
        .maybeSingle();
      setLinkedInvoice(invData);
 
      // 4. Fetch linked gate passes
      const { data: gpData } = await supabase
        .from("gate_passes")
        .select("pass_code, vehicle_no, driver_name, status")
        .eq("order_id", id)
        .maybeSingle();
      setLinkedGatePass(gpData);
 
    } catch (err: any) {
      toast.error(err.message || "Failed to load order detail");
      router.push("/dashboard/buzzcart/orders");
    } finally {
      setIsLoading(false);
    }
  };
 
  useEffect(() => {
    fetchOrderDetails();
  }, [id]);
 
  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", id);
 
      if (error) throw error;
 
      // Log audit trail
      await supabase.from("activity_logs").insert({
        action: "Order Status Updated",
        details: `Order ${order.order_code} status was set to ${newStatus}`,
      });
 
      toast.success(`Order status set to ${newStatus}!`);
      fetchOrderDetails();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };
 
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
      </div>
    );
  }
 
  if (!order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <p className="text-sm font-semibold text-slate-500">Order not found.</p>
        <Link href="/dashboard/buzzcart/orders" className="text-xs font-bold text-[#00B4D8] hover:underline">
          Back to List
        </Link>
      </div>
    );
  }
 
  const customerName = `${order.user?.first_name} ${order.user?.last_name || ""}`.trim();
  const distributorName = `${order.distributor?.first_name} ${order.distributor?.last_name || ""}`.trim();
  const coordinatorName = `${order.coordinator?.first_name} ${order.coordinator?.last_name || ""}`.trim();
 
  return (
    <div className="space-y-6 max-w-4xl mx-auto select-none">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/buzzcart/orders"
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Order Details</h1>
          <p className="text-xs text-slate-500">
            Audit, status updates and logs for Buzzcart Order {order.order_code}
          </p>
        </div>
      </div>
 
      {/* Master Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Detail Info Card */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-[12px] p-6 shadow-sm space-y-6">
          {/* Main Info */}
          <div className="flex justify-between items-start border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Order Reference
              </span>
              <h2 className="text-xl font-bold text-slate-800">{order.order_code}</h2>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 text-right">
                Current Status
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                order.status === "complete" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                order.status === "declined" ? "bg-rose-50 text-rose-600 border border-rose-200" :
                "bg-amber-50 text-amber-600 border border-amber-200"
              }`}>
                {order.status}
              </span>
            </div>
          </div>
 
          {/* Content Sections */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Customer Client
              </span>
              <p className="text-sm font-bold text-slate-800">{customerName}</p>
              <p className="text-xs text-slate-500">{order.user?.email}</p>
              <p className="text-xs text-slate-500">{order.user?.contact}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Box className="w-3.5 h-3.5" /> Product Item
              </span>
              <p className="text-sm font-bold text-slate-800">{order.product?.name || "Generic Product"}</p>
              <p className="text-xs text-slate-500">Model: {order.product?.model || "-"}</p>
              <p className="text-xs text-slate-500">Brand: {order.product?.brand || "-"}</p>
              <p className="text-xs font-bold text-[#00B4D8]">Rs. {Number(order.product?.price || 0).toLocaleString()}</p>
            </div>
          </div>
 
          <hr className="border-slate-100" />
 
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Distributor Hub
              </span>
              <p className="text-sm font-bold text-slate-800">{distributorName}</p>
              <p className="text-xs text-slate-500">Phone: {order.distributor?.contact || "-"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Sales Coordinator
              </span>
              <p className="text-sm font-bold text-slate-800">{coordinatorName}</p>
              <p className="text-xs text-slate-500">Phone: {order.coordinator?.contact || "-"}</p>
            </div>
          </div>
        </div>
 
        {/* Sidebar Actions & Linked items */}
        <div className="space-y-6">
          {/* Admin Workflow Controllers */}
          {userRole !== "distributor" && userRole !== "sub_dealer" && (
            <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Order Actions
              </h3>
              
              {isUpdating ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 text-[#00B4D8] animate-spin" />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {order.status !== "complete" && (
                    <button
                      onClick={() => handleUpdateStatus("complete")}
                      className="w-full h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve & Complete
                    </button>
                  )}
                  {order.status !== "declined" && (
                    <button
                      onClick={() => handleUpdateStatus("declined")}
                      className="w-full h-9 px-4 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 text-xs font-semibold rounded-[6px] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Decline Order
                    </button>
                  )}
                  
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Transition Steps
                    </span>
                    <button
                      onClick={() => handleUpdateStatus("purchase_invoice_pending")}
                      className="w-full text-left h-8 px-2.5 text-[11px] text-slate-600 hover:bg-slate-50 font-medium rounded transition-colors"
                    >
                      → Set Invoice Pending
                    </button>
                    <button
                      onClick={() => handleUpdateStatus("contract_created")}
                      className="w-full text-left h-8 px-2.5 text-[11px] text-slate-600 hover:bg-slate-50 font-medium rounded transition-colors"
                    >
                      → Set Contract Created
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
 
          {/* Linked Documents Card */}
          <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              Linked Logs
            </h3>
 
            <div className="space-y-3">
              {/* Linked Invoice */}
              <div className="flex items-start justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-700">Billing Invoice</p>
                  {linkedInvoice ? (
                    <p className="text-[10px] text-slate-400 font-bold">{linkedInvoice.invoice_code}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400">No invoice generated</p>
                  )}
                </div>
                {linkedInvoice && (
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    linkedInvoice.payment_status === "paid" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"
                  }`}>
                    {linkedInvoice.payment_status}
                  </span>
                )}
              </div>
 
              <hr className="border-slate-100" />
 
              {/* Linked Gate Pass */}
              <div className="flex items-start justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-700">Gate Pass Ticket</p>
                  {linkedGatePass ? (
                    <p className="text-[10px] text-slate-400 font-bold">{linkedGatePass.pass_code}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400">No gate pass issued</p>
                  )}
                </div>
                {linkedGatePass && (
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    linkedGatePass.status === "approved" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-amber-50 text-amber-600 border border-amber-200"
                  }`}>
                    {linkedGatePass.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
