"use client";

import React from "react";
import SalesPage from "@/components/SalesPage";

export default function SalesReturnPage() {
  return (
    <SalesPage
      type="return"
      title="Sales Return"
      buttonLabel="Create New Return"
      stIdPrefix="RT-"
    />
  );
}
