"use client";

import React, { Suspense } from "react";
import SalesPage from "@/components/SalesPage";

export default function SalesTransferPage() {
  return (
    <Suspense fallback={<div className="p-4 text-xs font-bold text-slate-500">Loading transfers...</div>}>
      <SalesPage
        type="transfer"
        title="Sales Transfer"
        buttonLabel="Create New Transfer"
        stIdPrefix="TR-"
      />
    </Suspense>
  );
}
