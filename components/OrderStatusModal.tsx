"use client";

import React, { useState, useEffect } from "react";
import { X, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  approveOrderAction,
  declineOrderAction,
  markInvoiceGeneratedAction,
  markGatePassGeneratedAction,
  revertOrderStageAction,
} from "@/app/actions/orders";

interface OrderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onSuccess: () => void;
  callerRole?: string;
}

export default function OrderStatusModal({
  isOpen,
  onClose,
  order: initialOrder,
  onSuccess,
  callerRole,
}: OrderStatusModalProps) {
  const [order, setOrder] = useState<any>(initialOrder);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  if (!isOpen || !order) return null;

  const canApprove = callerRole === "country_head" || callerRole === "admin";
  const canInvoiceOrGatepass = callerRole === "admin";

  // Date formatter matching Figma "at 4:00 pm on 12th Jan 2026"
  const formatFigmaDate = (dateStr?: string) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) return "";

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12;

    const day = d.getDate();
    let suffix = "th";
    if (day === 1 || day === 21 || day === 31) suffix = "st";
    else if (day === 2 || day === 22) suffix = "nd";
    else if (day === 3 || day === 23) suffix = "rd";

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const monthStr = months[d.getMonth()];
    const year = d.getFullYear();

    return `at ${hours}:${minutes} ${ampm} on ${day}${suffix} ${monthStr} ${year}`;
  };

  const currentStatus = order.status || "pending";

  const runAction = async (action: () => Promise<{ success: boolean; error?: string; message?: string }>, patch: any) => {
    setIsUpdating(true);
    try {
      const res = await action();
      if (!res.success) {
        toast.error(res.error || "Failed to update order");
        return;
      }
      toast.success(res.message || "Order updated");
      setOrder((prev: any) => ({ ...prev, ...patch }));
      onSuccess();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = () => runAction(() => approveOrderAction(order.id), { status: "approved", approved_at: new Date().toISOString() });
  const handleDecline = () => runAction(() => declineOrderAction(order.id), { status: "declined" });
  const handleCreateInvoice = () => runAction(() => markInvoiceGeneratedAction(order.id), { status: "invoice_generated", invoice_created_at: new Date().toISOString() });
  const handleCreateGatepass = () => runAction(() => markGatePassGeneratedAction(order.id), { status: "delivered", gate_pass_created_at: new Date().toISOString() });
  const handleRevertToPending = () => runAction(() => revertOrderStageAction(order.id, "pending"), { status: "pending" });
  const handleRevertToApproved = () => runAction(() => revertOrderStageAction(order.id, "approved"), { status: "approved" });

  // Determine state of milestones
  const isApproved = currentStatus !== "pending" && currentStatus !== "declined";
  const isDeclined = currentStatus === "declined";
  const isInvoiceCreated = currentStatus === "invoice_generated" || currentStatus === "delivered";
  const isGatepassCreated = currentStatus === "delivered";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with Glassmorphism */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
      ></div>

      {/* Modal Card */}
      <div className="relative bg-white w-full max-w-lg border border-slate-100 rounded-[12px] shadow-2xl p-7 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <h3 className="text-center text-slate-800 font-extrabold text-lg mb-8 tracking-tight">
          Order{order.order_code ? `#${order.order_code.replace("#", "")}` : ""} Status
        </h3>

        {/* Vertical Timeline */}
        <div className="relative pl-12 pr-4 py-2 space-y-8 select-none">
          {/* Vertical line indicator */}
          <div className="absolute left-6 top-3 bottom-3 w-0.5 border-l-2 border-dashed border-slate-200 z-0"></div>

          {/* Milestone 1: Order Placed */}
          <div className="relative flex flex-col items-start gap-1 z-10">
            <div className="absolute -left-9 top-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-100 border border-emerald-500">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800">Order Placed</span>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">{formatFigmaDate(order.created_at)}</p>
            </div>
          </div>

          {/* Milestone 2: Country Head / Admin Approval */}
          <div className="relative flex flex-col items-start gap-1 z-10">
            <div
              className={`absolute -left-9 top-0 w-6 h-6 rounded-full flex items-center justify-center border shadow-md transition-all duration-300 ${
                isApproved
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-emerald-100"
                  : isDeclined
                  ? "bg-rose-500 text-white border-rose-500 shadow-rose-100"
                  : "bg-white border-slate-300 text-slate-400"
              }`}
            >
              {isApproved ? <Check className="w-3.5 h-3.5" /> : isDeclined ? <X className="w-3.5 h-3.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>}
            </div>
            <div className="flex items-center justify-between w-full">
              <div>
                <span className="text-xs font-bold text-slate-800">Approval Status:</span>
                {isApproved && <p className="text-[10px] text-slate-400 font-bold mt-0.5">{formatFigmaDate(order.approved_at || order.created_at)}</p>}
                {isDeclined && <p className="text-[10px] text-rose-400 font-bold mt-0.5">Declined</p>}
              </div>

              {currentStatus === "pending" && canApprove && (
                <div className="flex gap-2">
                  <button disabled={isUpdating} onClick={handleApprove} className="px-4 py-1.5 bg-[#52C41A] hover:bg-[#40a9ff] text-white text-[10px] font-extrabold rounded-[4px] shadow transition-all duration-200 hover:scale-105">
                    Approved
                  </button>
                  <button disabled={isUpdating} onClick={handleDecline} className="px-4 py-1.5 bg-[#FF4D4F] hover:bg-rose-600 text-white text-[10px] font-extrabold rounded-[4px] shadow transition-all duration-200 hover:scale-105">
                    Decline
                  </button>
                </div>
              )}

              {isApproved && <span className="px-3 py-1 bg-[#52C41A] text-white text-[10px] font-bold rounded-[4px]">Approved</span>}
              {isDeclined && <span className="px-3 py-1 bg-[#FF4D4F] text-white text-[10px] font-bold rounded-[4px]">Declined</span>}
            </div>
          </div>

          {/* Milestone 3: Invoice (generated externally, admin confirms here) */}
          <div className="relative flex flex-col items-start gap-1 z-10">
            <div
              className={`absolute -left-9 top-0 w-6 h-6 rounded-full flex items-center justify-center border shadow-md transition-all duration-300 ${
                isInvoiceCreated
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-emerald-100"
                  : isApproved
                  ? "bg-white border-slate-400 text-slate-500"
                  : "bg-white border-slate-200 border-dashed text-slate-300"
              }`}
            >
              {isInvoiceCreated ? <Check className="w-3.5 h-3.5" /> : <span className={`w-1.5 h-1.5 rounded-full ${isApproved ? "bg-slate-450" : "bg-slate-200"}`}></span>}
            </div>
            <div className="flex items-center justify-between w-full">
              <div className={isApproved ? "" : "opacity-40"}>
                <span className="text-xs font-bold text-slate-800 font-sans">Invoice Generated:</span>
                {isInvoiceCreated && <p className="text-[10px] text-slate-400 font-bold mt-0.5">{formatFigmaDate(order.invoice_created_at || order.created_at)}</p>}
              </div>

              {currentStatus === "approved" && canInvoiceOrGatepass && (
                <div className="flex gap-2">
                  <button disabled={isUpdating} onClick={handleCreateInvoice} className="px-4 py-1.5 bg-[#A8E6CF] hover:bg-emerald-400 text-emerald-800 hover:text-white text-[10px] font-extrabold rounded-[4px] transition-all duration-200 hover:scale-105">
                    Yes
                  </button>
                  <button disabled={isUpdating} onClick={handleRevertToPending} className="px-4 py-1.5 bg-[#FFD3B6] hover:bg-amber-400 text-amber-900 hover:text-white text-[10px] font-extrabold rounded-[4px] transition-all duration-200 hover:scale-105">
                    No
                  </button>
                </div>
              )}

              {isInvoiceCreated && <span className="px-3 py-1 bg-[#A8E6CF] text-emerald-800 text-[10px] font-extrabold rounded-[4px]">Yes</span>}
            </div>
          </div>

          {/* Milestone 4: Gate Pass (issued externally, admin confirms here) */}
          <div className="relative flex flex-col items-start gap-1 z-10">
            <div
              className={`absolute -left-9 top-0 w-6 h-6 rounded-full flex items-center justify-center border shadow-md transition-all duration-300 ${
                isGatepassCreated
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-emerald-100"
                  : isInvoiceCreated
                  ? "bg-white border-slate-400 text-slate-500"
                  : "bg-white border-slate-200 border-dashed text-slate-300"
              }`}
            >
              {isGatepassCreated ? <Check className="w-3.5 h-3.5" /> : <span className={`w-1.5 h-1.5 rounded-full ${isInvoiceCreated ? "bg-slate-450" : "bg-slate-200"}`}></span>}
            </div>
            <div className="flex items-center justify-between w-full">
              <div className={isInvoiceCreated ? "" : "opacity-40"}>
                <span className="text-xs font-bold text-slate-800">Gate Pass Issued:</span>
                {isGatepassCreated && <p className="text-[10px] text-slate-400 font-bold mt-0.5">{formatFigmaDate(order.gate_pass_created_at || order.created_at)}</p>}
              </div>

              {currentStatus === "invoice_generated" && canInvoiceOrGatepass && (
                <div className="flex gap-2">
                  <button disabled={isUpdating} onClick={handleCreateGatepass} className="px-4 py-1.5 bg-[#A8E6CF] hover:bg-emerald-400 text-emerald-800 hover:text-white text-[10px] font-extrabold rounded-[4px] transition-all duration-200 hover:scale-105">
                    Yes
                  </button>
                  <button disabled={isUpdating} onClick={handleRevertToApproved} className="px-4 py-1.5 bg-[#FFD3B6] hover:bg-amber-400 text-amber-900 hover:text-white text-[10px] font-extrabold rounded-[4px] transition-all duration-200 hover:scale-105">
                    No
                  </button>
                </div>
              )}

              {isGatepassCreated && <span className="px-3 py-1 bg-[#A8E6CF] text-emerald-800 text-[10px] font-extrabold rounded-[4px]">Yes</span>}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end mt-8 pt-4 border-t border-slate-100">
          {isUpdating && (
            <div className="flex items-center gap-1.5 mr-auto text-slate-400 text-xs font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Updating status...</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-bold rounded-[6px] transition-all shadow-md shadow-cyan-100 hover:scale-105"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
