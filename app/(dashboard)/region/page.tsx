"use client";

import React, { useState } from "react";
import DataTable from "@/components/DataTable";

export default function RegionPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const data = [
    { id: "1", region_code: "PK-LHR", name: "Lahore Hub", warehouse: "Lahore Central", distributors: 8, sub_dealers: 22, status: "active" },
    { id: "2", region_code: "PK-KHI", name: "Karachi South", warehouse: "Port Qasim Storage", distributors: 12, sub_dealers: 35, status: "active" },
    { id: "3", region_code: "PK-ISB", name: "Islamabad Capital", warehouse: "I-9 Industrial Area", distributors: 6, sub_dealers: 18, status: "active" },
    { id: "4", region_code: "PK-PEW", name: "Peshawar Northwest", warehouse: "Hayatabad Depot", distributors: 4, sub_dealers: 11, status: "active" },
    { id: "5", region_code: "PK-MUX", name: "Multan Central", warehouse: "Multan Bypass Yard", distributors: 3, sub_dealers: 9, status: "active" },
  ];

  const columns = [
    { key: "region_code", label: "Region Code" },
    { key: "name", label: "Region Name" },
    { key: "warehouse", label: "Primary Warehouse" },
    { key: "distributors", label: "Distributors Count" },
    { key: "sub_dealers", label: "Sub Dealers Count" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Regions</h1>
        <p className="text-xs text-slate-500">
          Geographic hubs and distribution hubs across Pakistan.
        </p>
      </div>

      <DataTable
        title="Active Regions"
        columns={columns}
        data={data}
        isLoading={false}
        pagination={{
          current: currentPage,
          total: data.length,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
      />
    </div>
  );
}
