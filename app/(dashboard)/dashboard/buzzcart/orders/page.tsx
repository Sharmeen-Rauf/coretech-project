"use client";
 
import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import OrderModal from "@/components/OrderModal";
import Link from "next/link";
import OrderStatusModal from "@/components/OrderStatusModal";
import toast from "react-hot-toast";
import { deleteRecordAction } from "@/app/actions/users";
 
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
  const [userRole, setUserRole] = useState<string>("");
  const [selectedStatusOrder, setSelectedStatusOrder] = useState<any>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
 
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
 
      let roleStr = "sub_dealer";
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) roleStr = profile.role;
      } catch (profileErr) {
        console.warn("Failed to fetch user role. Defaulting to sub_dealer.", profileErr);
      }
      setUserRole(roleStr);
 
      let dbData: any[] = [];
      try {
        let query = supabase
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
          `);
 
        if (roleStr === "distributor") {
          query = query.eq("distributor_id", session.user.id);
        } else if (roleStr === "employee") {
          query = query.eq("sales_coordinator_id", session.user.id);
        } else if (roleStr === "sub_dealer") {
          query = query.eq("user_id", session.user.id);
        }
 
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        dbData = data || [];
      } catch (dbErr) {
        console.warn("Failed to fetch orders from Supabase. Using local fallback.", dbErr);
      }

      const { mergeLocalItems } = require("@/lib/supabaseLocalFallback");
      const merged = mergeLocalItems(dbData, "coretech_local_orders");
 
      const formatted = merged.map((row: any) => ({
        id: row.id,
        order_code: row.order_code || "-",
        user_name: row.user
          ? `${row.user.first_name} ${row.user.last_name || ""}`.trim()
          : (row.local_user_name || "Unknown User"),
        product_name: row.product?.name || row.local_product_name || "-",
        distributor_name: row.distributor
          ? `${row.distributor.first_name} ${row.distributor.last_name || ""}`.trim()
          : (row.local_distributor_name || "-"),
        coordinator_name: row.coordinator
          ? `${row.coordinator.first_name} ${row.coordinator.last_name || ""}`.trim()
          : (row.local_coordinator_name || "-"),
        date: row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
        status: row.status || "pending",
        rawOrder: row,
      }));
 
      setOrders(formatted);
 
      // Collect unique options for filter dropdowns
      const dists = Array.from(new Set(formatted.map((o: any) => o.distributor_name).filter(Boolean))) as string[];
      const prods = Array.from(new Set(formatted.map((o: any) => o.product_name).filter(Boolean))) as string[];
      setDistributors(dists);
      setProducts(prods);
    } catch (err: any) {
      console.error("fetchOrders error:", err);
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

  const handleDeleteOrder = async (row: any) => {
    if (!window.confirm(`Are you sure you want to delete order ${row.order_code}?`)) return;

    try {
      if (row.id) {
        const res = await deleteRecordAction("orders", row.id);
        if (!res.success) {
          console.warn("DB delete failed, attempting local delete", res.error);
        }
      }
      
      const { deleteLocalItem } = require("@/lib/supabaseLocalFallback");
      deleteLocalItem("coretech_local_orders", row.id || row.order_code, row.id ? "id" : "order_code");
      
      toast.success(`Order deleted successfully!`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete order");
    }
  };

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
    {
      key: "order_code",
      label: "Order ID",
      render: (val: string, row: any) => (
        <Link
          href={`/dashboard/buzzcart/orders/${row.id}`}
          className="font-bold text-[#00B4D8] hover:underline"
        >
          {val}
        </Link>
      ),
    },
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
    {
      key: "status",
      label: "Status",
      render: (val: string, row: any) => {
        const normalized = (val || "").toLowerCase().trim();
        let dotColor = "bg-[#0284C7]"; // default blue
        let textColor = "text-[#0284C7]";
        let label = "Pending";

        if (normalized === "complete" || normalized === "delivered") {
          dotColor = "bg-[#16A34A]"; // green
          textColor = "text-[#16A34A]";
          label = "Complete";
        } else if (normalized === "declined") {
          dotColor = "bg-[#64748B]"; // grey
          textColor = "text-[#64748B]";
          label = "Declined";
        } else if (normalized === "purchase_invoice_pending") {
          dotColor = "bg-[#0284C7]"; // blue
          textColor = "text-[#0284C7]";
          label = "Purchase Invoice Pending";
        } else if (normalized === "gatepass_created" || normalized === "invoice_generated" || normalized === "delivery_order_created" || normalized === "payment_logged") {
          dotColor = "bg-[#D97706]"; // orange
          textColor = "text-[#D97706]";
          label = normalized === "gatepass_created" ? "Gatepass Created" :
                  normalized === "invoice_generated" ? "Gatepass Created" :
                  normalized === "payment_logged" ? "Payment Logged" : "DO Created";
        } else if (normalized === "approved") {
          dotColor = "bg-[#0284C7]"; // blue
          textColor = "text-[#0284C7]";
          label = "Approved";
        } else {
          dotColor = "bg-[#0284C7]"; // blue
          textColor = "text-[#0284C7]";
          label = val.charAt(0).toUpperCase() + val.slice(1);
        }

        return (
          <button
            onClick={() => {
              setSelectedStatusOrder(row.rawOrder);
              setIsStatusModalOpen(true);
            }}
            className={`flex items-center gap-1.5 font-bold ${textColor} hover:scale-105 transition-all cursor-pointer`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
            <span>{label}</span>
          </button>
        );
      },
    },
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
        onDeleteClick={handleDeleteOrder}
      />

      <OrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchOrders}
      />

      {selectedStatusOrder && (
        <OrderStatusModal
          isOpen={isStatusModalOpen}
          onClose={() => {
            setIsStatusModalOpen(false);
            setSelectedStatusOrder(null);
          }}
          order={selectedStatusOrder}
          onSuccess={fetchOrders}
        />
      )}
    </div>
  );
}
