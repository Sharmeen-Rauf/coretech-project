"use client";

import React from "react";

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = (status || "").toLowerCase().trim();

  let styles = "bg-slate-100 text-slate-600";
  let label = status || "Unknown";

  switch (normalized) {
    case "active":
    case "complete":
      styles = "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      label = normalized === "active" ? "Active" : "Complete";
      break;
    case "pending":
      styles = "bg-slate-100 text-slate-600 border border-slate-200/50";
      label = "Pending";
      break;
    case "declined":
    case "subtotal_deleted":
      styles = "bg-rose-50 text-rose-700 border border-rose-200/50";
      label = normalized === "declined" ? "Declined" : "Subtotal Deleted";
      break;
    case "purchase_invoice_pending":
      styles = "bg-amber-50 text-amber-700 border border-amber-200/50";
      label = "Purchase Invoice Pending";
      break;
    case "contract_created":
      styles = "bg-sky-50 text-sky-700 border border-sky-200/50";
      label = "Contract Created";
      break;
    case "assigned":
      styles = "bg-cyan-50 text-cyan-700 border border-[#00B4D8]/20";
      label = "Assigned";
      break;
    case "in_progress":
      styles = "bg-yellow-50 text-yellow-700 border border-yellow-200";
      label = "In Progress";
      break;
    default:
      // Leave as default styles
      break;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide select-none capitalize ${styles}`}>
      {label}
    </span>
  );
}
