"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { Loader2, Check, X, FileText, Plus, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

interface OrderApprovalRow {
  id: string;
  order_code: string;
  user_name: string;
  product_name: string;
  distributor_name: string;
  status: string;
  created_at: string;
}

interface GatePassRow {
  id: string;
  pass_code: string;
  order_code: string;
  driver_name: string;
  vehicle_no: string;
  status: string;
  created_at: string;
}

export default function ApprovalsPage() {
  const supabase = createClientComponentClient();
  const [activeTab, setActiveTab] = useState<"orders" | "gatepasses">("orders");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [orders, setOrders] = useState<OrderApprovalRow[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePassRow[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);

  // Modal states
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch pending orders for approval
  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_code,
          status,
          created_at,
          user:profiles!user_id(first_name, last_name),
          product:products(name),
          distributor:profiles!distributor_id(first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted: OrderApprovalRow[] = (data || []).map((row: any) => ({
        id: row.id,
        order_code: row.order_code || "-",
        user_name: row.user ? `${row.user.first_name} ${row.user.last_name || ""}`.trim() : "Unknown",
        product_name: row.product?.name || "-",
        distributor_name: row.distributor ? `${row.distributor.first_name} ${row.distributor.last_name || ""}`.trim() : "-",
        status: row.status,
        created_at: row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
      }));

      setOrders(formatted);
      // Collect approved/completed orders for gate pass options
      setCompletedOrders((data || []).filter((o: any) => o.status === "complete"));
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch orders");
    }
  };

  // Fetch gate passes
  const fetchGatePasses = async () => {
    try {
      const { data, error } = await supabase
        .from("gate_passes")
        .select(`
          id,
          pass_code,
          driver_name,
          vehicle_no,
          status,
          created_at,
          order:orders(order_code)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted: GatePassRow[] = (data || []).map((row: any) => ({
        id: row.id,
        pass_code: row.pass_code,
        order_code: row.order?.order_code || "-",
        driver_name: row.driver_name,
        vehicle_no: row.vehicle_no,
        status: row.status,
        created_at: row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
      }));

      setGatePasses(formatted);
    } catch (err: any) {
      console.error("Failed to fetch gate passes. Running local fallback.", err.message);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([fetchOrders(), fetchGatePasses()]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update order status (Approve / Decline)
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      // Log activity
      const targetOrder = orders.find((o) => o.id === orderId);
      await supabase.from("activity_logs").insert({
        action: "Order Status Update",
        details: `Order ${targetOrder?.order_code} was ${newStatus}d`,
      });

      toast.success(`Order successfully ${newStatus}d!`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to update order status");
    }
  };

  // Update gate pass status
  const handleUpdatePassStatus = async (passId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("gate_passes")
        .update({ status: newStatus })
        .eq("id", passId);

      if (error) throw error;

      // Log activity
      const targetPass = gatePasses.find((p) => p.id === passId);
      await supabase.from("activity_logs").insert({
        action: "Gate Pass Update",
        details: `Gate Pass ${targetPass?.pass_code} was ${newStatus}d`,
      });

      toast.success(`Gate pass ${newStatus}d successfully!`);
      fetchGatePasses();
    } catch (err: any) {
      toast.error(err.message || "Failed to update gate pass status");
    }
  };

  // Issue gate pass
  const handleCreateGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || !driverName.trim() || !vehicleNo.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const passCode = `#GP${randomDigits}`;

      const { error } = await supabase.from("gate_passes").insert({
        pass_code: passCode,
        order_id: selectedOrderId,
        driver_name: driverName,
        vehicle_no: vehicleNo,
        status: "pending",
      });

      if (error) throw error;

      toast.success(`Gate pass ${passCode} issued successfully!`);
      setIsPassModalOpen(false);
      setSelectedOrderId("");
      setDriverName("");
      setVehicleNo("");
      fetchGatePasses();
    } catch (err: any) {
      toast.error(err.message || "Failed to create gate pass");
    } finally {
      setIsSubmitting(false);
    }
  };

  const orderColumns = [
    { key: "order_code", label: "Order ID" },
    { key: "user_name", label: "Customer" },
    { key: "product_name", label: "Product" },
    { key: "distributor_name", label: "Distributor" },
    { key: "created_at", label: "Date" },
    {
      key: "status",
      label: "Status",
      render: (val: string) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          val === "complete" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
          val === "declined" ? "bg-rose-50 text-rose-600 border border-rose-200" :
          "bg-amber-50 text-amber-600 border border-amber-200"
        }`}>
          {val}
        </span>
      ),
    },
    {
      key: "id",
      label: "Actions",
      render: (val: string, row: any) => {
        if (row.status !== "pending") return <span className="text-slate-400 text-xs">Closed</span>;
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleUpdateOrderStatus(val, "complete")}
              className="p-1 hover:bg-emerald-50 text-emerald-600 rounded border border-emerald-100 transition-colors"
              title="Approve Order"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleUpdateOrderStatus(val, "declined")}
              className="p-1 hover:bg-rose-50 text-rose-600 rounded border border-rose-100 transition-colors"
              title="Decline Order"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const passColumns = [
    { key: "pass_code", label: "Pass Code" },
    { key: "order_code", label: "Order ID" },
    { key: "driver_name", label: "Driver" },
    { key: "vehicle_no", label: "Vehicle Number" },
    { key: "created_at", label: "Date" },
    {
      key: "status",
      label: "Status",
      render: (val: string) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          val === "approved" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
          val === "rejected" ? "bg-rose-50 text-rose-600 border border-rose-200" :
          "bg-slate-50 text-slate-600 border border-slate-200"
        }`}>
          {val}
        </span>
      ),
    },
    {
      key: "id",
      label: "Actions",
      render: (val: string, row: any) => {
        if (row.status !== "pending") return <span className="text-slate-400 text-xs">Closed</span>;
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleUpdatePassStatus(val, "approved")}
              className="p-1 hover:bg-emerald-50 text-emerald-600 rounded border border-emerald-100 transition-colors"
              title="Approve Gate Pass"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleUpdatePassStatus(val, "rejected")}
              className="p-1 hover:bg-rose-50 text-rose-600 rounded border border-rose-100 transition-colors"
              title="Reject Gate Pass"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 select-none">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Approvals & Gate Passes</h1>
          <p className="text-xs text-slate-500">
            Process Buzzcart order approvals and issue active warehouse gate passes.
          </p>
        </div>

        {activeTab === "gatepasses" && (
          <button
            onClick={() => setIsPassModalOpen(true)}
            className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Issue Gate Pass
          </button>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => {
            setActiveTab("orders");
            setCurrentPage(1);
          }}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 -mb-px ${
            activeTab === "orders" ? "border-[#00B4D8] text-[#00B4D8]" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Order Approvals ({orders.filter((o) => o.status === "pending").length} Pending)
        </button>
        <button
          onClick={() => {
            setActiveTab("gatepasses");
            setCurrentPage(1);
          }}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 -mb-px ${
            activeTab === "gatepasses" ? "border-[#00B4D8] text-[#00B4D8]" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Gate Passes ({gatePasses.filter((g) => g.status === "pending").length} Pending)
        </button>
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : activeTab === "orders" ? (
        <DataTable
          title="Orders Approval Ledger"
          columns={orderColumns}
          data={orders.slice((currentPage - 1) * perPage, currentPage * perPage)}
          isLoading={false}
          searchPlaceholder="Search Orders..."
          pagination={{
            current: currentPage,
            total: orders.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
        />
      ) : (
        <DataTable
          title="Gate Passes Registry"
          columns={passColumns}
          data={gatePasses.slice((currentPage - 1) * perPage, currentPage * perPage)}
          isLoading={false}
          searchPlaceholder="Search Gate Passes..."
          pagination={{
            current: currentPage,
            total: gatePasses.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
        />
      )}

      {/* Issue Gate Pass Modal */}
      {isPassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsPassModalOpen(false)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Issue Gate Pass
              </h3>
              <button
                onClick={() => setIsPassModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGatePass} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Select Complete Order*
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
                  required
                >
                  <option value="">Select Order</option>
                  {completedOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_code} ({o.product?.name})
                    </option>
                  ))}
                </select>
                {completedOrders.length === 0 && (
                  <div className="flex items-center gap-1.5 mt-1 text-[9px] text-amber-600 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>No approved orders found to release</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Driver Name*
                </label>
                <input
                  type="text"
                  placeholder="Enter Driver Name"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Vehicle Number*
                </label>
                <input
                  type="text"
                  placeholder="e.g. LES-1234"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsPassModalOpen(false)}
                  className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-100 rounded-[6px] text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || completedOrders.length === 0}
                  className="h-9 px-4 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Release Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
