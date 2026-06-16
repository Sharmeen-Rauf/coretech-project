"use client";

import React from "react";
import SalesPage from "@/components/SalesPage";

export default function SalesTransferPage() {
  return (
    <SalesPage
      type="transfer"
      title="Sales Transfer"
      buttonLabel="Create New Transfer"
      stIdPrefix="TR-"
    />
  );
}
