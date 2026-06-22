"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import { Loader2, ArrowLeft, Calendar, User, Box, ShieldCheck, Check, X, FileText, CheckCircle2, ChevronRight, DollarSign } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface OrderItem {
  productId: string;
  productName: string;
  model: string;
  quantity: number;
  price: number;
}

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

  // Custom workflow states
  const [paymentAmount, setPaymentAmount] = useState("");
  const [showPaymentInput, setShowPaymentInput] = useState(false);

  const fetchOrderDetails = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
 
      // 1. Fetch user role
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile) setUserRole(profile.role);
      } catch (profileErr) {
        console.warn("Failed to fetch user role. Defaulting to employee.", profileErr);
        setUserRole("employee");
      }
 
      // 2. Fetch order data including items list
      let orderData: any = null;
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(`
            id,
            order_code,
            status,
            created_at,
            items,
            product_id,
            user_id,
            distributor_id,
            user:profiles!user_id(id, first_name, last_name, email, contact),
            product:products(*),
            distributor:profiles!distributor_id(id, first_name, last_name, contact),
            coordinator:profiles!sales_coordinator_id(id, first_name, last_name, contact)
          `)
          .eq("id", id)
          .single();
 
        if (error) throw error;
        orderData = data;
      } catch (dbErr) {
        console.warn("Failed to fetch order details from Supabase. Checking local storage fallback.", dbErr);
        const { getLocalItems } = require("@/lib/supabaseLocalFallback");
        const localOrders = getLocalItems("coretech_local_orders");
        const found = localOrders.find((x: any) => x.id === id);
        if (found) {
          orderData = {
            ...found,
            user: { id: found.user_id, first_name: found.local_user_name || "Local Dealer", last_name: "", email: "-", contact: "-" },
            distributor: { id: found.distributor_id, first_name: found.local_distributor_name || "Local Distributor", contact: "-" },
            coordinator: { id: found.sales_coordinator_id, first_name: found.local_coordinator_name || "Local RSM", contact: "-" }
          };
        }
      }

      if (!orderData) throw new Error("Order details not found");
      setOrder(orderData);

      // Initialize payment input to total amount
      const itemsList = orderData.items || [
        {
          productId: orderData.product_id,
          productName: orderData.product?.name || "Generic Product",
          model: orderData.product?.model || "Generic",
          quantity: 1,
          price: orderData.product?.price || 0
        }
      ];
      const totalAmount = itemsList.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);
      setPaymentAmount(String(totalAmount));

      // 3. Fetch linked invoices
      let invData: any = null;
      try {
        const { data } = await supabase
          .from("invoices")
          .select("invoice_code, payment_status, amount")
          .eq("order_id", id)
          .maybeSingle();
        invData = data;
      } catch (dbErr) {
        console.warn("Failed to fetch invoices from Supabase. Checking local storage fallback.", dbErr);
        const { getLocalItems } = require("@/lib/supabaseLocalFallback");
        const localInvoices = getLocalItems("coretech_local_invoices");
        invData = localInvoices.find((x: any) => x.order_id === id) || null;
      }
      setLinkedInvoice(invData);

      // 4. Fetch linked gate passes
      let gpData: any = null;
      try {
        const { data } = await supabase
          .from("gate_passes")
          .select("pass_code, vehicle_no, driver_name, status")
          .eq("order_id", id)
          .maybeSingle();
        gpData = data;
      } catch (dbErr) {
        console.warn("Failed to fetch gate passes from Supabase. Checking local storage fallback.", dbErr);
        const { getLocalItems } = require("@/lib/supabaseLocalFallback");
        const localGatePasses = getLocalItems("coretech_local_gate_passes");
        gpData = localGatePasses.find((x: any) => x.order_id === id) || null;
      }
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
      try {
        const { error } = await supabase
          .from("orders")
          .update({ status: newStatus })
          .eq("id", id);
        if (error) throw error;
      } catch (dbErr) {
        console.warn("Supabase order status update failed. Saving locally.", dbErr);
        const { saveLocalItem } = require("@/lib/supabaseLocalFallback");
        saveLocalItem("coretech_local_orders", { ...order, status: newStatus }, true);
      }
 
      // Log audit trail safely
      try {
        await supabase.from("activity_logs").insert({
          action: "Order Status Updated",
          details: `Order ${order.order_code} status was set to ${newStatus}`,
        });
      } catch (logErr) {
        console.warn("Activity log insert failed:", logErr);
      }
 
      toast.success(`Order status set to ${newStatus}!`);
      fetchOrderDetails();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };
 
  // Step 2: Log Payment Action
  const handleLogPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
 
    setIsUpdating(true);
    try {
      try {
        const { error: orderErr } = await supabase
          .from("orders")
          .update({ status: "payment_logged" })
          .eq("id", id);
        if (orderErr) throw orderErr;
      } catch (dbErr) {
        console.warn("Supabase order payment update failed. Saving locally.", dbErr);
        const { saveLocalItem } = require("@/lib/supabaseLocalFallback");
        saveLocalItem("coretech_local_orders", { ...order, status: "payment_logged" }, true);
      }
 
      // Log activity safely
      try {
        await supabase.from("activity_logs").insert({
          action: "Order Payment Logged",
          details: `Logged payment of PKR ${Number(paymentAmount).toLocaleString()} for order ${order.order_code}`,
        });
      } catch (logErr) {
        console.warn("Activity log insert failed:", logErr);
      }
 
      toast.success("Payment successfully logged!");
      setShowPaymentInput(false);
      fetchOrderDetails();
    } catch (err: any) {
      toast.error(err.message || "Failed to log payment");
    } finally {
      setIsUpdating(false);
    }
  };
 
  // Step 3: Generate Invoice Action
  const handleGenerateInvoice = async () => {
    setIsUpdating(true);
    try {
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const invoiceCode = `#INV${randomDigits}`;
 
      // Calculate total order amount
      const itemsList = order.items || [
        {
          productId: order.product_id,
          productName: order.product?.name || "Generic Product",
          model: order.product?.model || "Generic",
          quantity: 1,
          price: order.product?.price || 0
        }
      ];
      const totalAmount = itemsList.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);
 
      // Create invoice row linked to this order
      try {
        const { error: invErr } = await supabase
          .from("invoices")
          .insert({
            invoice_code: invoiceCode,
            order_id: order.id,
            distributor_id: order.distributor_id || order.distributor?.id,
            amount: totalAmount,
            due_date: new Date().toLocaleDateString('en-CA'),
            payment_status: "paid", // set to paid since payment is logged
          });
        if (invErr) throw invErr;
      } catch (dbErr) {
        console.warn("Supabase invoice insert failed. Saving locally.", dbErr);
        const { saveLocalItem } = require("@/lib/supabaseLocalFallback");
        saveLocalItem("coretech_local_invoices", {
          id: crypto.randomUUID(),
          invoice_code: invoiceCode,
          order_id: order.id,
          amount: totalAmount,
          payment_status: "paid",
        });
      }
 
      // Update order status
      try {
        const { error: orderErr } = await supabase
          .from("orders")
          .update({ status: "invoice_generated" })
          .eq("id", id);
        if (orderErr) throw orderErr;
      } catch (dbErr) {
        console.warn("Supabase order invoice status update failed. Saving locally.", dbErr);
        const { saveLocalItem } = require("@/lib/supabaseLocalFallback");
        saveLocalItem("coretech_local_orders", { ...order, status: "invoice_generated" }, true);
      }
 
      // Log activity safely
      try {
        await supabase.from("activity_logs").insert({
          action: "Invoice Generated",
          details: `Generated invoice ${invoiceCode} for order ${order.order_code}`,
        });
      } catch (logErr) {
        console.warn("Activity log insert failed:", logErr);
      }
 
      toast.success(`Invoice ${invoiceCode} successfully generated!`);
      fetchOrderDetails();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate invoice");
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

  // Parse items list
  const itemsList: OrderItem[] = order.items || [
    {
      productId: order.product_id || "legacy",
      productName: order.product?.name || "Generic Product",
      model: order.product?.model || "Generic",
      quantity: 1,
      price: order.product?.price || 0,
    }
  ];

  const totalQuantity = itemsList.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalOrderValue = itemsList.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  // Workflow Helper
  const getWorkflowStep = () => {
    switch (order.status) {
      case "pending": return 1;
      case "approved": return 2;
      case "delivery_order_created": return 3;
      case "payment_logged": return 4;
      case "invoice_generated": return 5;
      case "delivered": return 6;
      default: return 0;
    }
  };

  const workflowStep = getWorkflowStep();

  return (
    <div className="space-y-6 max-w-4xl mx-auto select-none animate-in fade-in duration-300">
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
            Track order lifecycle progression, model listings, and financial logs for order {order.order_code}.
          </p>
        </div>
      </div>

      {/* Visual Workflow Timeline */}
      {order.status !== "declined" && (
        <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-sm">
          <div className="flex items-center justify-between text-center relative max-w-3xl mx-auto">
            {/* Background line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-100 z-0"></div>
            
            {[
              { label: "Order Created", step: 1 },
              { label: "NSM Approved", step: 2 },
              { label: "DO Created", step: 3 },
              { label: "Payment Logged", step: 4 },
              { label: "Invoice Issued", step: 5 },
              { label: "Delivered", step: 6 },
            ].map((node) => {
              const active = workflowStep >= node.step;
              return (
                <div key={node.step} className="flex flex-col items-center z-10 relative flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all font-bold text-xs ${
                    active 
                      ? "bg-[#00B4D8] border-[#00B4D8] text-white shadow-md shadow-cyan-100" 
                      : "bg-white border-slate-200 text-slate-400"
                  }`}>
                    {workflowStep > node.step ? <Check className="w-4 h-4" /> : node.step}
                  </div>
                  <span className={`text-[10px] font-bold mt-2 ${
                    active ? "text-[#00B4D8]" : "text-slate-400"
                  }`}>
                    {node.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Master Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Detail Info Card */}
        <div className="md:col-span-2 space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-sm space-y-6">
            {/* Header info */}
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
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                  order.status === "delivered" || order.status === "complete" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                  order.status === "declined" ? "bg-rose-50 text-rose-600 border-rose-200" :
                  "bg-amber-50 text-amber-600 border-amber-200"
                }`}>
                  {order.status}
                </span>
              </div>
            </div>

            {/* Partner profiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Customer Client
                </span>
                <p className="text-xs font-bold text-slate-800">{customerName}</p>
                <p className="text-[10px] text-slate-400 font-bold">{order.user?.email}</p>
                <p className="text-[10px] text-slate-400 font-bold">{order.user?.contact}</p>
              </div>

              <div className="space-y-1 border-t md:border-t-0 md:border-l md:pl-6 border-slate-100 pt-4 md:pt-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Routing Distributor
                </span>
                <p className="text-xs font-bold text-slate-800">{distributorName}</p>
                <p className="text-[10px] text-slate-400 font-bold">Contact: {order.distributor?.contact || "-"}</p>
              </div>

              <div className="space-y-1 border-t md:border-t-0 md:border-l md:pl-6 border-slate-100 pt-4 md:pt-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Sales RSM
                </span>
                <p className="text-xs font-bold text-slate-800">{coordinatorName}</p>
                <p className="text-[10px] text-slate-400 font-bold">Contact: {order.coordinator?.contact || "-"}</p>
              </div>
            </div>
          </div>

          {/* Model items summary */}
          <div className="bg-white border border-slate-200 rounded-[12px] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50/20">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Order Models Ledger
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs select-none">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/10">
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Product Model</th>
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-right w-24">Quantity</th>
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-right w-36">Unit Price</th>
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {itemsList.map((item, idx) => {
                    const subtotal = item.quantity * item.price;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-5 py-3 font-bold text-slate-800">
                          {item.productName}
                          <p className="text-[10px] text-slate-400 font-normal">{item.model || "Generic"}</p>
                        </td>
                        <td className="px-5 py-3 text-right font-bold">{item.quantity} Units</td>
                        <td className="px-5 py-3 text-right">PKR {item.price.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-800">
                          PKR {subtotal.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500 uppercase tracking-wider">Grand Total ({totalQuantity} units)</span>
              <span className="text-base font-extrabold text-[#00B4D8]">PKR {totalOrderValue.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Sidebar Sequential Action Engine */}
        <div className="space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              Order Lifecycle Action
            </h3>

            {isUpdating ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 text-[#00B4D8] animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* 1. Pending Approval */}
                {order.status === "pending" && (
                  <div className="bg-amber-50 border border-amber-100 p-3 rounded-[6px] text-xs text-amber-700 leading-normal">
                    <p className="font-bold">Pending NSM Review</p>
                    <p className="mt-1 text-[10px]">
                      This order request is currently awaiting approval from an NSM. You can edit quantities and approve it from the <strong>Approvals</strong> page.
                    </p>
                  </div>
                )}

                {/* 2. Transition: approved -> delivery_order_created */}
                {order.status === "approved" && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Next Step: Release DO</p>
                    <button
                      onClick={() => handleUpdateStatus("delivery_order_created")}
                      className="w-full h-9 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Issue Delivery Order
                    </button>
                  </div>
                )}

                {/* 3. Transition: delivery_order_created -> payment_logged */}
                {order.status === "delivery_order_created" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Next Step: Log Payment</p>
                    {!showPaymentInput ? (
                      <button
                        onClick={() => setShowPaymentInput(true)}
                        className="w-full h-9 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <DollarSign className="w-4 h-4" /> Log Payment Details
                      </button>
                    ) : (
                      <form onSubmit={handleLogPayment} className="space-y-2.5 animate-in slide-in-from-top-1 duration-200">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Logged Payment Amount (PKR)*
                          </label>
                          <input
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:border-[#00B4D8]"
                            required
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowPaymentInput(false)}
                            className="flex-1 h-8 border border-slate-200 text-slate-500 rounded text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow"
                          >
                            Confirm
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* 4. Transition: payment_logged -> invoice_generated */}
                {order.status === "payment_logged" && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Next Step: Issue Invoice</p>
                    <button
                      onClick={handleGenerateInvoice}
                      className="w-full h-9 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileText className="w-4 h-4" /> Generate Billing Invoice
                    </button>
                  </div>
                )}

                {/* 5. Transition: invoice_generated -> delivered */}
                {order.status === "invoice_generated" && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Next Step: Final Delivery</p>
                    <button
                      onClick={() => handleUpdateStatus("delivered")}
                      className="w-full h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Check className="w-4 h-4" /> Mark Order Delivered
                    </button>
                  </div>
                )}

                {/* 6. Delivered Final State */}
                {order.status === "delivered" && (
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-[6px] text-xs text-emerald-700 leading-normal text-center">
                    <p className="font-extrabold flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Order Completed
                    </p>
                    <p className="mt-1 text-[10px] text-emerald-600 font-medium">
                      All sequential milestones (DO, Payment logging, Invoicing, and Delivery) are complete.
                    </p>
                  </div>
                )}

                {/* Declined State */}
                {order.status === "declined" && (
                  <div className="bg-rose-50 border border-rose-100 p-3 rounded-[6px] text-xs text-rose-700 leading-normal text-center">
                    <p className="font-extrabold flex items-center justify-center gap-1">
                      <X className="w-4 h-4 text-rose-600" /> Order Declined
                    </p>
                    <p className="mt-1 text-[10px] text-rose-600 font-medium">
                      This order was rejected and the transaction lifecycle has been terminated.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Linked Documents Registry */}
          <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              Linked Documents
            </h3>

            <div className="space-y-3">
              {/* Linked Invoice */}
              <div className="flex items-start justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-700">Billing Invoice</p>
                  {linkedInvoice ? (
                    <p className="text-[10px] text-slate-400 font-bold">{linkedInvoice.invoice_code}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium">No invoice generated</p>
                  )}
                </div>
                {linkedInvoice && (
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                    linkedInvoice.payment_status === "paid" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"
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
                    <p className="text-[10px] text-slate-400 font-medium">No gate pass issued</p>
                  )}
                </div>
                {linkedGatePass && (
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                    linkedGatePass.status === "approved" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"
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
