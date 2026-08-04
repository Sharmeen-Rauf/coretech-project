"use client";

import React, { Suspense } from "react";
import SalesPage from "@/components/SalesPage";

export default function SalesReturnPage() {
  return (
    <Suspense fallback={<div className="p-4 text-xs font-bold text-slate-500">Loading returns...</div>}>
      <SalesPage
        type="return"
        title="Sales Return"
        buttonLabel="Create New Return"
        stIdPrefix="RT-"
      />
    </Suspense>
  );
}
