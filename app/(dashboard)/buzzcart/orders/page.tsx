"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import OrderModal from "@/components/OrderModal";
import toast from "react-hot-toast";

interface OrderRow {
  id: string;
  order_code: string;
  user_name: string;
  product_name: string;
  distributor_name: string;
  coordinator_name: string;
  date: string;
  status: string;
}

export default function BuzzcartOrdersPage() {
  const supabase = createClientComponentClient();

  // Loading and modals
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const [distributors, setDistributors] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_code,
          created_at,
          status,
          user:profiles!user_id(first_name, last_name),
          product:products(name),
          distributor:profiles!distributor_id(first_name, last_name),
          coordinator:profiles!sales_coordinator_id(first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((row: any) => ({
        id: row.id,
        order_code: row.order_code || "-",
        user_name: row.user
          ? `${row.user.first_name} ${row.user.last_name || ""}`.trim()
          : "Unknown User",
        product_name: row.product?.name || "-",
        distributor_name: row.distributor
          ? `${row.distributor.first_name} ${row.distributor.last_name || ""}`.trim()
          : "-",
        coordinator_name: row.coordinator
          ? `${row.coordinator.first_name} ${row.coordinator.last_name || ""}`.trim()
          : "-",
        date: row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
        status: row.status || "pending",
      }));

      setOrders(formatted);

      // Collect unique options for filter dropdowns
      const dists = Array.from(new Set(formatted.map((o) => o.distributor_name).filter(Boolean)));
      const prods = Array.from(new Set(formatted.map((o) => o.product_name).filter(Boolean)));
      setDistributors(dists);
      setProducts(prods);
    } catch (err: any) {
      toast.error(err.message || "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Subscribe to realtime database updates
    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Filter logic
  const filtered = orders.filter((o) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = q ? o.order_code.toLowerCase().includes(q) : true;
    const matchesDistributor = selectedDistributor ? o.distributor_name === selectedDistributor : true;
    const matchesProduct = selectedProduct ? o.product_name === selectedProduct : true;

    return matchesSearch && matchesDistributor && matchesProduct;
  });

  const paginated = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  const columns = [
    { key: "order_code", label: "Order ID" },
    {
      key: "user_name",
      label: "User",
      render: (val: string) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#F0FAFE] text-[#00B4D8] font-bold text-[10px] flex items-center justify-center border border-[#00B4D8]/20">
            {val.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-slate-700">{val}</span>
        </div>
      ),
    },
    { key: "product_name", label: "Product" },
    { key: "distributor_name", label: "Distributor" },
    { key: "coordinator_name", label: "Sales Coordinator" },
    { key: "date", label: "Date" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Buzzcart-Orders</h1>
        <p className="text-xs text-slate-500">
          Track customer product orders, invoice status, and distribution agents.
        </p>
      </div>

      <DataTable
        title="Orders Ledger"
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        searchPlaceholder="Search Order ID (#CM...)"
        onSearch={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        filters={[
          {
            label: "Distributor",
            options: distributors,
            value: selectedDistributor,
            onChange: (val) => {
              setSelectedDistributor(val);
              setCurrentPage(1);
            },
          },
          {
            label: "Product",
            options: products,
            value: selectedProduct,
            onChange: (val) => {
              setSelectedProduct(val);
              setCurrentPage(1);
            },
          },
        ]}
        actionButton={{
          label: "Create Order",
          onClick: () => setIsModalOpen(true),
        }}
        pagination={{
          current: currentPage,
          total: filtered.length,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
      />

      <OrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchOrders}
      />
    </div>
  );
}
