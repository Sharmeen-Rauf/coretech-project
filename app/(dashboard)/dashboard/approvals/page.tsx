"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { 
  Loader2, 
  Check, 
  X, 
  FileText, 
  Plus, 
  AlertCircle, 
  Edit, 
  Eye, 
  QrCode, 
  Video, 
  UserCheck, 
  Wrench,
  CheckCircle,
  Play
} from "lucide-react";
import toast from "react-hot-toast";
import { getLocalItems, saveLocalItem, mergeLocalItems } from "@/lib/supabaseLocalFallback";

interface OrderApprovalRow {
  id: string;
  order_code: string;
  user_name: string;
  product_name: string;
  distributor_name: string;
  coordinator_name: string;
  status: string;
  created_at: string;
  items: any[];
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
  const [activeTab, setActiveTab] = useState<"orders" | "gatepasses" | "installers" | "installations">("orders");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [orders, setOrders] = useState<OrderApprovalRow[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePassRow[]>([]);
  const [installers, setInstallers] = useState<any[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);

  // Modal states
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Order Review/Edit Modal states
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<OrderApprovalRow | null>(null);
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  // Installer Detail Modal States
  const [selectedInstaller, setSelectedInstaller] = useState<any>(null);
  
  // Installation Detail Modal States
  const [selectedInstallation, setSelectedInstallation] = useState<any>(null);

  // QR Code Modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrOrigin, setQrOrigin] = useState("http://localhost:3000");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setQrOrigin(window.location.origin);
    }
  }, []);

  // Parse Installer metadata helper
  const parseInstallerMetadata = (designation?: string) => {
    if (!designation) return {};
    if (designation.startsWith("[INSTALLER_METADATA]")) {
      try {
        const jsonStr = designation.replace("[INSTALLER_METADATA]", "");
        return JSON.parse(jsonStr);
      } catch (e) {
        console.warn("Failed to parse installer metadata json", e);
      }
    }
    return {};
  };

  // Fetch pending orders for approval
  const fetchOrders = async () => {
    try {
      let dbData: any[] = [];
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(`
            id,
            order_code,
            status,
            created_at,
            items,
            product_id,
            user:profiles!user_id(first_name, last_name),
            product:products(name, model, price),
            distributor:profiles!distributor_id(first_name, last_name),
            coordinator:profiles!sales_coordinator_id(first_name, last_name)
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;
        dbData = data || [];
      } catch (dbErr) {
        console.warn("Failed to fetch orders from Supabase. Using local fallback.", dbErr);
      }

      const merged = mergeLocalItems(dbData, "coretech_local_orders");

      const formatted: OrderApprovalRow[] = merged.map((row: any) => {
        const items = row.items || [
          {
            productId: row.product_id || "legacy",
            productName: row.product?.name || row.local_product_name || "Generic Product",
            model: row.product?.model || row.local_product_model || "Generic",
            quantity: 1,
            price: row.product?.price || row.local_product_price || 0,
          }
        ];

        return {
          id: row.id,
          order_code: row.order_code || "-",
          user_name: row.user 
            ? `${row.user.first_name} ${row.user.last_name || ""}`.trim() 
            : (row.local_user_name || "Unknown"),
          product_name: row.product?.name || row.local_product_name || "-",
          distributor_name: row.distributor 
            ? `${row.distributor.first_name} ${row.distributor.last_name || ""}`.trim() 
            : (row.local_distributor_name || "-"),
          coordinator_name: row.coordinator 
            ? `${row.coordinator.first_name} ${row.coordinator.last_name || ""}`.trim() 
            : (row.local_coordinator_name || "-"),
          status: row.status,
          created_at: row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
          items,
        };
      });

      setOrders(formatted);
      setCompletedOrders(formatted.filter((o: any) => o.status !== "pending" && o.status !== "declined"));
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch orders");
    }
  };

  // Fetch gate passes
  const fetchGatePasses = async () => {
    try {
      let dbData: any[] = [];
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
        dbData = data || [];
      } catch (dbErr) {
        console.warn("Failed to fetch gate passes from Supabase. Using local fallback.", dbErr);
      }

      const merged = mergeLocalItems(dbData, "coretech_local_gate_passes");

      const formatted: GatePassRow[] = merged.map((row: any) => ({
        id: row.id,
        pass_code: row.pass_code,
        order_code: row.order?.order_code || row.local_order_code || "-",
        driver_name: row.driver_name,
        vehicle_no: row.vehicle_no,
        status: row.status,
        created_at: row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
      }));

      setGatePasses(formatted);
    } catch (err: any) {
      console.error("Failed to fetch gate passes.", err.message);
    }
  };

  // Fetch registered pending installers
  const fetchInstallers = async () => {
    try {
      let dbData: any[] = [];
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("role", "installer")
          .order("created_at", { ascending: false });

        if (error) throw error;
        dbData = data || [];
      } catch (dbErr) {
        console.warn("Failed to fetch profiles.", dbErr);
      }

      const localProfiles = getLocalItems("profiles") || [];
      const localInstallers = localProfiles.filter((p: any) => p.role === "installer");

      const merged = [...dbData];
      localInstallers.forEach((local) => {
        if (!merged.some(db => db.id === local.id)) {
          merged.push(local);
        }
      });

      setInstallers(merged);
    } catch (err: any) {
      console.error("Failed to fetch installers", err.message);
    }
  };

  // Fetch pending installation approvals
  const fetchInstallations = async () => {
    try {
      let dbJobs: any[] = [];
      try {
        const { data, error } = await supabase
          .from("installer_jobs")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        dbJobs = data || [];
      } catch (dbErr) {
        console.warn("Failed to fetch installer jobs.", dbErr);
      }

      const localJobs = getLocalItems("coretech_local_installer_jobs") || [];
      const merged = [...dbJobs];
      localJobs.forEach((local) => {
        if (!merged.some(db => db.id === local.id)) {
          merged.push(local);
        }
      });

      // Filter for installation job lists or verify completions
      setInstallations(merged);
    } catch (err: any) {
      console.error("Failed to fetch installations", err.message);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchOrders(), 
      fetchGatePasses(), 
      fetchInstallers(), 
      fetchInstallations()
    ]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenReviewModal = (order: OrderApprovalRow) => {
    setReviewOrder(order);
    setEditableItems(
      order.items.map(item => ({
        ...item,
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0,
      }))
    );
    setIsReviewModalOpen(true);
  };

  const handleItemQtyChange = (idx: number, val: string) => {
    const qty = Math.max(0, parseInt(val) || 0);
    setEditableItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], quantity: qty };
      return copy;
    });
  };

  const handleItemPriceChange = (idx: number, val: string) => {
    const prc = Math.max(0, parseFloat(val) || 0);
    setEditableItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], price: prc };
      return copy;
    });
  };

  // Order approval
  const handleApproveWithEdits = async () => {
    if (!reviewOrder) return;
    const itemsToSave = editableItems.filter(item => item.quantity > 0);
    if (itemsToSave.length === 0) {
      toast.error("Please ensure at least one item has a quantity > 0");
      return;
    }

    setIsUpdatingOrder(true);
    try {
      try {
        const { error } = await supabase
          .from("orders")
          .update({
            items: itemsToSave,
            status: "approved"
          })
          .eq("id", reviewOrder.id);

        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database order update failed. Saving locally.", dbErr);
        const localOrders = getLocalItems("coretech_local_orders");
        const match = localOrders.find((o: any) => o.id === reviewOrder.id);
        const updated = {
          ...(match || reviewOrder),
          items: itemsToSave,
          status: "approved",
          approved_at: new Date().toISOString(),
        };
        saveLocalItem("coretech_local_orders", updated, true);
      }

      try {
        await supabase.from("activity_logs").insert({
          action: "Order Approved (Edits)",
          details: `NSM approved order ${reviewOrder.order_code} with modified item counts/prices.`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }

      toast.success("Order approved successfully!");
      setIsReviewModalOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve order");
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const handleDeclineOrder = async (orderId: string) => {
    setIsUpdatingOrder(true);
    try {
      try {
        const { error } = await supabase
          .from("orders")
          .update({ status: "declined" })
          .eq("id", orderId);

        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database decline update failed. Saving locally.", dbErr);
        const localOrders = getLocalItems("coretech_local_orders");
        const match = localOrders.find((o: any) => o.id === orderId);
        const updated = {
          ...(match || { id: orderId }),
          status: "declined",
        };
        saveLocalItem("coretech_local_orders", updated, true);
      }

      try {
        const orderCode = reviewOrder?.order_code || orders.find(o => o.id === orderId)?.order_code || "";
        await supabase.from("activity_logs").insert({
          action: "Order Declined",
          details: `NSM declined order ${orderCode}.`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }

      toast.success("Order declined.");
      setIsReviewModalOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to decline order");
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  // Gate pass status
  const handleUpdatePassStatus = async (passId: string, newStatus: string) => {
    try {
      try {
        const { error } = await supabase
          .from("gate_passes")
          .update({ status: newStatus })
          .eq("id", passId);

        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database gatepass update failed. Saving locally.", dbErr);
        const localGPs = getLocalItems("coretech_local_gate_passes");
        const match = localGPs.find((p: any) => p.id === passId);
        const updated = {
          ...(match || { id: passId }),
          status: newStatus,
        };
        saveLocalItem("coretech_local_gate_passes", updated, true);
      }

      try {
        const targetPass = gatePasses.find((p) => p.id === passId);
        await supabase.from("activity_logs").insert({
          action: "Gate Pass Update",
          details: `Gate Pass ${targetPass?.pass_code} was ${newStatus}d`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }

      toast.success(`Gate pass ${newStatus}d successfully!`);
      fetchGatePasses();
    } catch (err: any) {
      toast.error(err.message || "Failed to update gate pass status");
    }
  };

  // Create gate pass
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

      const matchedOrder = completedOrders.find(o => o.id === selectedOrderId);
      const orderCode = matchedOrder?.order_code || "-";

      const insertPayload = {
        pass_code: passCode,
        order_id: selectedOrderId,
        driver_name: driverName.trim(),
        vehicle_no: vehicleNo.trim(),
        status: "pending",
      };

      try {
        const { error } = await supabase.from("gate_passes").insert(insertPayload);
        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database gatepass insert failed. Saving locally.", dbErr);
        saveLocalItem("coretech_local_gate_passes", {
          ...insertPayload,
          local_order_code: orderCode,
        });
      }

      try {
        await supabase.from("activity_logs").insert({
          action: "Gate Pass Issue",
          details: `Gate pass ${passCode} released for order ${orderCode}`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }

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

  // Installer approvals (Approve / Reject)
  const handleApproveInstaller = async (instId: string) => {
    try {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ status: "active" })
          .eq("id", instId);
        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database update failed. Saving locally.", dbErr);
        const localProfiles = getLocalItems("profiles") || [];
        const index = localProfiles.findIndex((p: any) => p.id === instId);
        if (index > -1) {
          localProfiles[index].status = "active";
          localStorage.setItem("profiles", JSON.stringify(localProfiles));
        }
      }

      // Safe activity log
      try {
        const target = installers.find(i => i.id === instId);
        await supabase.from("activity_logs").insert({
          action: "Installer Approved",
          details: `Owner approved installer ${target?.first_name} ${target?.last_name || ""}`,
        });
      } catch (e) {}

      toast.success("Installer approved successfully!");
      setSelectedInstaller(null);
      fetchInstallers();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve installer");
    }
  };

  const handleRejectInstaller = async (instId: string) => {
    if (!window.confirm("Are you sure you want to reject this installer registration?")) return;
    try {
      try {
        const { error } = await supabase
          .from("profiles")
          .delete()
          .eq("id", instId);
        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database delete failed. Removing locally.", dbErr);
        const localProfiles = getLocalItems("profiles") || [];
        const updated = localProfiles.filter((p: any) => p.id !== instId);
        localStorage.setItem("profiles", JSON.stringify(updated));
      }

      toast.success("Installer registration rejected and deleted.");
      setSelectedInstaller(null);
      fetchInstallers();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject installer");
    }
  };

  // Installation approvals (Approve / Reject)
  const handleApproveInstallation = async (job: any) => {
    try {
      // 1. Update job ticket status to 'completed'
      try {
        const { error } = await supabase
          .from("installer_jobs")
          .update({ status: "completed" })
          .eq("id", job.id);
        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database job update failed. Saving locally.", dbErr);
        const localJobs = getLocalItems("coretech_local_installer_jobs") || [];
        const index = localJobs.findIndex((j: any) => j.id === job.id);
        if (index > -1) {
          localJobs[index].status = "completed";
          localStorage.setItem("coretech_local_installer_jobs", JSON.stringify(localJobs));
        }
      }

      // 2. Consume/Deduct product from active stock inventory
      try {
        // Query database to find stock item by serial number
        const { data: stockItem, error: fetchStockErr } = await supabase
          .from("stock")
          .select("id")
          .eq("serial_no", job.serial_number)
          .maybeSingle();

        if (!fetchStockErr && stockItem) {
          // Delete stock row representing consumption of item
          await supabase.from("stock").delete().eq("id", stockItem.id);
        } else {
          // If not found in DB, check local stock fallback
          const localStock = getLocalItems("coretech_local_stock") || [];
          const updatedStock = localStock.filter((s: any) => s.serial_no !== job.serial_number);
          localStorage.setItem("coretech_local_stock", JSON.stringify(updatedStock));
        }
      } catch (invErr) {
        console.warn("Failed to consume serial number from inventory", invErr);
      }

      // 3. Activity Logging
      try {
        await supabase.from("activity_logs").insert({
          action: "Installation Approved",
          details: `Owner approved installation job "${job.job_title}" (Serial: ${job.serial_number}). Deducted from warehouse stock.`,
        });
      } catch (e) {}

      toast.success("Installation approved & product consumed from inventory!");
      setSelectedInstallation(null);
      fetchInstallations();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve installation");
    }
  };

  const handleRejectInstallation = async (jobId: string) => {
    if (!window.confirm("Are you sure you want to reject this installation? It will go back to Assigned status for the installer.")) return;
    try {
      try {
        const { error } = await supabase
          .from("installer_jobs")
          .update({ status: "assigned" })
          .eq("id", jobId);
        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database job update failed. Saving locally.", dbErr);
        const localJobs = getLocalItems("coretech_local_installer_jobs") || [];
        const index = localJobs.findIndex((j: any) => j.id === jobId);
        if (index > -1) {
          localJobs[index].status = "assigned";
          localStorage.setItem("coretech_local_installer_jobs", JSON.stringify(localJobs));
        }
      }

      toast.success("Installation rejected and reverted to assigned state.");
      setSelectedInstallation(null);
      fetchInstallations();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject installation");
    }
  };

  // Columns specifications
  const orderColumns = [
    { key: "order_code", label: "Order ID" },
    { key: "coordinator_name", label: "RSM Placed" },
    { key: "user_name", label: "Dealer" },
    {
      key: "items",
      label: "Models Ordered",
      render: (items: any[]) => {
        return (
          <span className="font-semibold text-slate-650 truncate max-w-[200px] block">
            {items.map(i => `${i.model || "Generic"} (x${i.quantity || 1})`).join(", ")}
          </span>
        );
      }
    },
    {
      key: "pieces",
      label: "Total pieces",
      render: (_: any, row: any) => {
        const total = row.items?.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0) || 0;
        return <span className="font-bold text-slate-700">{total} Pcs</span>;
      }
    },
    { key: "created_at", label: "Date" },
    {
      key: "status",
      label: "Status",
      render: (val: string) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
          val === "approved" || val === "complete" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
          val === "declined" ? "bg-rose-50 text-rose-600 border-rose-200" :
          "bg-amber-50 text-amber-600 border-amber-200"
        }`}>
          {val}
        </span>
      ),
    },
    {
      key: "id",
      label: "Review",
      render: (_: string, row: any) => {
        return (
          <button
            onClick={() => handleOpenReviewModal(row)}
            className="flex items-center gap-1.5 px-3 py-1 hover:bg-[#F0FAFE] hover:text-[#00B4D8] border border-slate-200 text-slate-600 rounded-[4px] text-[11px] font-bold transition-all"
          >
            {row.status === "pending" ? (
              <>
                <Edit className="w-3 h-3" />
                Audit
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                View
              </>
            )}
          </button>
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

  // Installer columns
  const installerColumns = [
    {
      key: "first_name",
      label: "Installer Name",
      render: (_: string, row: any) => (
        <span className="font-bold text-slate-800">{row.first_name} {row.last_name || ""}</span>
      )
    },
    { key: "contact", label: "Contact No." },
    { key: "cnic", label: "CNIC Number" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    {
      key: "status",
      label: "Status",
      render: (val: string) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          val === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
          val === "pending" ? "bg-amber-50 text-amber-600 border border-amber-200" :
          "bg-slate-50 text-slate-500 border border-slate-200"
        }`}>
          {val}
        </span>
      )
    },
    {
      key: "id",
      label: "Audit Details",
      render: (_: string, row: any) => (
        <button
          onClick={() => setSelectedInstaller(row)}
          className="flex items-center gap-1.5 px-3 py-1 hover:bg-[#F0FAFE] hover:text-[#00B4D8] border border-slate-200 text-slate-650 rounded-[4px] text-[11px] font-bold transition-all"
        >
          <UserCheck className="w-3.5 h-3.5" />
          Verify Credentials
        </button>
      )
    }
  ];

  // Installations columns
  const installationColumns = [
    { key: "job_title", label: "Job Title" },
    { key: "serial_number", label: "Serial Number" },
    { key: "address", label: "Site Location" },
    {
      key: "incentive",
      label: "Incentive",
      render: (val: number) => (
        <span className="font-bold text-slate-850">Rs. {Number(val || 0).toLocaleString()}</span>
      )
    },
    {
      key: "status",
      label: "Status",
      render: (val: string) => (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
          val === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
          val === "pending_installation_approval" ? "bg-amber-50 text-amber-600 border-amber-100" :
          "bg-blue-50 text-blue-500 border-blue-100"
        }`}>
          {val === "pending_installation_approval" ? "Pending Approval" : val}
        </span>
      )
    },
    {
      key: "id",
      label: "Verify Completion",
      render: (_: string, row: any) => (
        <button
          onClick={() => setSelectedInstallation(row)}
          className="flex items-center gap-1.5 px-3 py-1 hover:bg-[#F0FAFE] hover:text-[#00B4D8] border border-slate-200 text-slate-650 rounded-[4px] text-[11px] font-bold transition-all"
        >
          <Wrench className="w-3.5 h-3.5" />
          Review Work
        </button>
      )
    }
  ];

  // Filtered rows calculation for dashboard counters
  const pendingInstallersCount = installers.filter((i) => i.status === "pending").length;
  const pendingInstallationsCount = installations.filter((j) => j.status === "pending_installation_approval").length;

  return (
    <div className="space-y-6 select-none font-sans">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Approvals & Gate Passes</h1>
          <p className="text-xs text-slate-500">
            Process orders, releases, pending installer accounts, and verify site installations.
          </p>
        </div>

        <div className="flex gap-2">
          {/* QR Code trigger */}
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="h-10 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
          >
            <QrCode className="w-4 h-4 text-[#00B4D8]" />
            Installer QR Code
          </button>

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
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab("orders");
            setCurrentPage(1);
          }}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 -mb-px shrink-0 ${
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
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 -mb-px shrink-0 ${
            activeTab === "gatepasses" ? "border-[#00B4D8] text-[#00B4D8]" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Gate Passes ({gatePasses.filter((g) => g.status === "pending").length} Pending)
        </button>

        <button
          onClick={() => {
            setActiveTab("installers");
            setCurrentPage(1);
          }}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 -mb-px shrink-0 ${
            activeTab === "installers" ? "border-[#00B4D8] text-[#00B4D8]" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Installer Registrations ({pendingInstallersCount} Pending)
        </button>

        <button
          onClick={() => {
            setActiveTab("installations");
            setCurrentPage(1);
          }}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 -mb-px shrink-0 ${
            activeTab === "installations" ? "border-[#00B4D8] text-[#00B4D8]" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Installation Approvals ({pendingInstallationsCount} Pending)
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
      ) : activeTab === "gatepasses" ? (
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
      ) : activeTab === "installers" ? (
        <DataTable
          title="Registered Installers Application Check"
          columns={installerColumns}
          data={installers.slice((currentPage - 1) * perPage, currentPage * perPage)}
          isLoading={false}
          searchPlaceholder="Search Registered Installers..."
          pagination={{
            current: currentPage,
            total: installers.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
        />
      ) : (
        <DataTable
          title="Verify Installations & Release Payouts"
          columns={installationColumns}
          data={installations.slice((currentPage - 1) * perPage, currentPage * perPage)}
          isLoading={false}
          searchPlaceholder="Search Installations..."
          pagination={{
            current: currentPage,
            total: installations.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
        />
      )}

      {/* Review & Edit Order Modal */}
      {isReviewModalOpen && reviewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsReviewModalOpen(false)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-2xl border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Review Order: {reviewOrder.order_code}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 font-bold">
                  Status: {reviewOrder.status.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-5">
              <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-[6px] border border-slate-100 text-xs">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">RSM Placed</p>
                  <p className="font-semibold text-slate-700 mt-0.5">{reviewOrder.coordinator_name}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Dealer (Buyer)</p>
                  <p className="font-semibold text-slate-700 mt-0.5">{reviewOrder.user_name}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Routing Distributor</p>
                  <p className="font-semibold text-slate-700 mt-0.5">{reviewOrder.distributor_name}</p>
                </div>
              </div>

              <div className="border border-slate-150 rounded-[6px] overflow-hidden">
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/20">
                      <th className="px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider">Model Name</th>
                      <th className="px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider w-28">Approved Qty</th>
                      <th className="px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider w-36">Approved Price (PKR)</th>
                      <th className="px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {editableItems.map((item, idx) => {
                      const subtotal = item.quantity * item.price;
                      return (
                        <tr key={idx} className="hover:bg-slate-55/10">
                          <td className="px-4 py-2.5 font-bold text-slate-800">
                            {item.productName}
                            <span className="block text-[9px] text-slate-400 font-normal">{item.model || "Generic"}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            {reviewOrder.status === "pending" ? (
                              <input
                                type="number"
                                min="0"
                                value={item.quantity}
                                onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                                className="w-20 h-7 border border-slate-200 rounded px-1.5 focus:outline-none focus:border-[#00B4D8] text-center"
                              />
                            ) : (
                              <span className="font-bold">{item.quantity} Pcs</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {reviewOrder.status === "pending" ? (
                              <input
                                type="number"
                                min="0"
                                value={item.price}
                                onChange={(e) => handleItemPriceChange(idx, e.target.value)}
                                className="w-28 h-7 border border-slate-200 rounded px-1.5 focus:outline-none focus:border-[#00B4D8]"
                              />
                            ) : (
                              <span>PKR {item.price.toLocaleString()}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-700">
                            PKR {subtotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center py-4 border-t border-slate-100 mt-4">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Grand Total</p>
                <p className="text-lg font-extrabold text-[#00B4D8] mt-0.5">
                  PKR {editableItems.reduce((sum, item) => sum + (item.quantity * item.price), 0).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="h-9 px-4 border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-[6px] transition-all"
                >
                  Close
                </button>

                {reviewOrder.status === "pending" && (
                  <>
                    <button
                      type="button"
                      disabled={isUpdatingOrder}
                      onClick={() => handleDeclineOrder(reviewOrder.id)}
                      className="h-9 px-4 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold rounded-[6px] flex items-center gap-1.5 transition-all shadow"
                    >
                      {isUpdatingOrder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingOrder}
                      onClick={handleApproveWithEdits}
                      className="h-9 px-5 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 text-white text-xs font-bold rounded-[6px] flex items-center gap-1.5 transition-all shadow"
                    >
                      {isUpdatingOrder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Approve & Save
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Installer Verification Modal */}
      {selectedInstaller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setSelectedInstaller(null)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-md border border-slate-100 rounded-[12px] shadow-2xl p-5 flex flex-col max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4 bg-slate-50/50 -m-5 p-5 rounded-t-[12px]">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Installer Credentials Verification
              </h3>
              <button
                onClick={() => setSelectedInstaller(null)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-655 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-[8px] border border-slate-100">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">First Name</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedInstaller.first_name}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Last Name</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedInstaller.last_name || "-"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Contact</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedInstaller.contact}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">CNIC (NIC)</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedInstaller.cnic || "-"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">City</p>
                  <p className="font-bold text-slate-850 mt-0.5">{selectedInstaller.city || "-"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">State</p>
                  <p className="font-bold text-slate-850 mt-0.5">{selectedInstaller.state || "-"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Marital Status</p>
                  <p className="font-semibold text-slate-700 mt-0.5">
                    {parseInstallerMetadata(selectedInstaller.designation).marital_status || "Single"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">EasyPaisa / JazzCash No.</p>
                  <p className="font-semibold text-emerald-600 mt-0.5">
                    {parseInstallerMetadata(selectedInstaller.designation).easypaisa_jazzcash_no || "-"}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
                <button
                  onClick={() => setSelectedInstaller(null)}
                  className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-50 rounded-[6px] text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                {selectedInstaller.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleRejectInstaller(selectedInstaller.id)}
                      className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject Registration
                    </button>
                    <button
                      onClick={() => handleApproveInstaller(selectedInstaller.id)}
                      className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve Active
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Installation Verification Modal */}
      {selectedInstallation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setSelectedInstallation(null)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-md border border-slate-100 rounded-[12px] shadow-2xl p-5 flex flex-col max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4 bg-slate-50/50 -m-5 p-5 rounded-t-[12px]">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Review Site Installation Work
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">{selectedInstallation.job_title}</p>
              </div>
              <button
                onClick={() => setSelectedInstallation(null)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-655 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3.5 space-y-2">
                <p className="text-slate-500 font-bold">SERIAL NO: <span className="text-[#00B4D8] font-extrabold">{selectedInstallation.serial_number}</span></p>
                <p className="text-slate-500"><strong>Address Location:</strong> {selectedInstallation.address}</p>
                <p className="text-slate-500 font-bold"><strong>Incentive Payout:</strong> Rs. {Number(selectedInstallation.incentive || 0).toLocaleString()}</p>
                {selectedInstallation.remarks && <p className="text-slate-650 bg-white border border-slate-150 p-2 rounded italic">"{selectedInstallation.remarks}"</p>}
              </div>

              {/* Photos */}
              {selectedInstallation.photos && selectedInstallation.photos.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Site Images Proof</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedInstallation.photos.map((url: string, idx: number) => (
                      <div key={idx} className="w-full h-16 bg-slate-50 border rounded-[6px] overflow-hidden">
                        <img src={url} alt="installation-proof" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Video Proof */}
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Video className="w-3.5 h-3.5 text-[#00B4D8]" />
                  Installation Video Demonstration
                </p>
                {/* Parse video url from notes metadata */}
                {(() => {
                  const notesStr = selectedInstallation.notes || "";
                  const match = notesStr.match(/VIDEO:([^\s|]+)/);
                  const videoUrl = match ? match[1] : null;
                  
                  if (videoUrl) {
                    return (
                      <div className="relative w-full h-44 bg-slate-900 rounded-[8px] overflow-hidden border">
                        <video src={videoUrl} controls className="w-full h-full object-contain" />
                      </div>
                    );
                  }
                  return <p className="text-slate-400 italic bg-slate-55 py-3 rounded text-center">No installation video uploaded.</p>;
                })()}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
                <button
                  onClick={() => setSelectedInstallation(null)}
                  className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-50 rounded-[6px] text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                {selectedInstallation.status === "pending_installation_approval" && (
                  <>
                    <button
                      onClick={() => handleRejectInstallation(selectedInstallation.id)}
                      className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject Installation
                    </button>
                    <button
                      onClick={() => handleApproveInstallation(selectedInstallation)}
                      className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve & Consume Stock
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Share Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsQrModalOpen(false)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center w-full pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Installer Registration QR Code
              </h3>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-[12px] p-4 mx-auto flex items-center justify-center shadow-inner">
                {/* Generate live QR code targeting installer register path */}
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrOrigin + "/installer/register")}`} 
                  alt="installer-registration-qr" 
                  className="w-40 h-40 object-contain"
                />
              </div>
              
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800">Scan to Circulate Pakistan Form</p>
                <p className="text-[10px] text-slate-500 leading-relaxed px-4">
                  Let the new installer scan this QR code on their mobile device to open the verification form.
                </p>
              </div>

              <div className="bg-slate-50 border rounded-[8px] p-2 text-[10px] text-slate-600 font-mono break-all select-all">
                {qrOrigin}/installer/register
              </div>
            </div>

            <button
              onClick={() => setIsQrModalOpen(false)}
              className="mt-6 w-full h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-[6px]"
            >
              Done
            </button>
          </div>
        </div>
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
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-655 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGatePass} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Select Order*
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
                      {o.order_code} ({o.user_name})
                    </option>
                  ))}
                </select>
                {completedOrders.length === 0 && (
                  <div className="flex items-center gap-1.5 mt-1 text-[9px] text-amber-600 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>No approved/active orders found to release</span>
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
                  className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-100 rounded-[6px] text-slate-650 transition-colors"
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
