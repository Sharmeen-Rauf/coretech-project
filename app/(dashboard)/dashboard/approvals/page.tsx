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
  Play,
  Calendar,
  Camera
} from "lucide-react";
import toast from "react-hot-toast";
import { getLocalItems, saveLocalItem, mergeLocalItems } from "@/lib/supabaseLocalFallback";
import { updateRecordAction, deleteRecordAction, reloadSchemaAction } from "@/app/actions/users";
import { revertRejectedInstallationStockAction } from "@/app/actions/products";

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
  const [activeMediaModal, setActiveMediaModal] = useState<{ type: "image" | "video"; url: string; title?: string } | null>(null);

  // Audit notes remarks
  const [auditNote, setAuditNote] = useState("");
  const [verifierName, setVerifierName] = useState("");
  const [approverName, setApproverName] = useState("");

  useEffect(() => {
    const fetchAuditUserNames = async () => {
      setVerifierName("");
      setApproverName("");
      const target = selectedInstaller || selectedInstallation;
      if (!target) return;

      if (target.verified_by) {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", target.verified_by)
            .maybeSingle();
          if (data) {
            setVerifierName(`${data.first_name} ${data.last_name || ""}`.trim());
          } else {
            setVerifierName("Retail Manager");
          }
        } catch (e) {
          setVerifierName("Retail Manager");
        }
      }

      if (target.approved_by) {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", target.approved_by)
            .maybeSingle();
          if (data) {
            setApproverName(`${data.first_name} ${data.last_name || ""}`.trim());
          } else {
            setApproverName("Country Head");
          }
        } catch (e) {
          setApproverName("Country Head");
        }
      }
    };

    fetchAuditUserNames();
  }, [selectedInstaller, selectedInstallation]);

  // QR Code Modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrOrigin, setQrOrigin] = useState("http://localhost:3000");
  const [userRole, setUserRole] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const canApproveInstaller = userRole === "admin" || userRole === "country_head";

  const applyPreset = (preset: 'today' | '7days' | '30days' | 'thisMonth' | 'all') => {
    const today = new Date();
    if (preset === 'today') {
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setStartDate(`${yyyy}-${mm}-${dd}`);
      setEndDate(`${yyyy}-${mm}-${dd}`);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else {
      setStartDate("");
      setEndDate("");
    }
    setIsDatePickerOpen(false);
  };

  const isInDateRange = (dateStr?: string) => {
    if (!dateStr) return false;
    const dateVal = new Date(dateStr).getTime();
    if (startDate) {
      const startVal = new Date(startDate).getTime();
      if (dateVal < startVal) return false;
    }
    if (endDate) {
      const endVal = new Date(endDate + "T23:59:59.999Z").getTime();
      if (dateVal > endVal) return false;
    }
    return true;
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setQrOrigin(window.location.origin);
    }
  }, []);

  // Parse Installer metadata helper
  const parseInstallerMetadata = (designation?: string) => {
    if (!designation) return {};
    let target = designation;
    
    // Unwrap distributor metadata if present
    if (target.startsWith("[DISTRIBUTOR_METADATA]")) {
      try {
        const distMeta = JSON.parse(target.replace("[DISTRIBUTOR_METADATA]", ""));
        if (distMeta.designation) {
          target = distMeta.designation;
        }
      } catch (e) {
        console.warn("Failed to unwrap distributor metadata", e);
      }
    }

    if (target.startsWith("[INSTALLER_METADATA]")) {
      try {
        const jsonStr = target.replace("[INSTALLER_METADATA]", "");
        return JSON.parse(jsonStr);
      } catch (e) {
        console.warn("Failed to parse installer metadata json", e);
      }
    }
    return {};
  };

  // Helper to resolve fields from database columns OR nested distributor fallback metadata
  const getInstallerField = (installer: any, field: string) => {
    if (!installer) return "-";
    if (installer[field]) return installer[field];

    const designation = installer.designation || "";
    if (designation.startsWith("[DISTRIBUTOR_METADATA]")) {
      try {
        const distMeta = JSON.parse(designation.replace("[DISTRIBUTOR_METADATA]", ""));
        // Check exact match or camelCase
        if (distMeta[field]) return distMeta[field];
        const camelMap: Record<string, string> = {
          bank_name: "bankName",
          bank_account: "bankAccount",
          account_holder_name: "accountHolderName",
        };
        const camelField = camelMap[field] || field;
        if (distMeta[camelField]) return distMeta[camelField];
      } catch (e) {}
    }
    return "-";
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
      const jobsMap = new Map<string, any>();
      dbJobs.forEach(db => jobsMap.set(db.id, db));

      localJobs.forEach((local: any) => {
        const dbJob = jobsMap.get(local.id);
        const localStatus = String(local.status || "").trim().toLowerCase();
        if (!dbJob) {
          jobsMap.set(local.id, local);
        } else if (localStatus === "pending_verification" && String(dbJob.status || "").trim().toLowerCase() === "rejected") {
          jobsMap.set(local.id, { ...dbJob, ...local, status: "pending_verification" });
        }
      });

      setInstallations(Array.from(jobsMap.values()));
    } catch (err: any) {
      console.error("Failed to fetch installations", err.message);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          setUserRole(profile.role);
        }
      }

      await Promise.all([
        fetchOrders(), 
        fetchGatePasses(), 
        fetchInstallers(), 
        fetchInstallations()
      ]);
    } catch (err) {
      console.warn("Failed to load approvals data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Targeted Supabase Realtime subscription for live installation updates
    const channel = supabase
      .channel("approvals_live_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "installer_jobs" },
        () => {
          fetchInstallations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      const res = await updateRecordAction("profiles", instId, { status: "active" });
      if (!res.success) throw new Error(res.error);

      // Keep local profiles in sync
      const localProfiles = getLocalItems("profiles") || [];
      const index = localProfiles.findIndex((p: any) => p.id === instId);
      if (index > -1) {
        localProfiles[index].status = "active";
        localStorage.setItem("profiles", JSON.stringify(localProfiles));
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

  const handleVerifyInstaller = async (instId: string) => {
    try {
      const res = await updateRecordAction("profiles", instId, { status: "verified" });
      if (!res.success) throw new Error(res.error);

      // Keep local profiles in sync
      const localProfiles = getLocalItems("profiles") || [];
      const index = localProfiles.findIndex((p: any) => p.id === instId);
      if (index > -1) {
        localProfiles[index].status = "verified";
        localStorage.setItem("profiles", JSON.stringify(localProfiles));
      }

      // Safe activity log
      try {
        const target = installers.find(i => i.id === instId);
        await supabase.from("activity_logs").insert({
          action: "Installer Verified",
          details: `RSM verified installer credentials for ${target?.first_name} ${target?.last_name || ""}`,
        });
      } catch (e) {}

      toast.success("Installer credentials verified successfully!");
      setSelectedInstaller(null);
      fetchInstallers();
    } catch (err: any) {
      toast.error(err.message || "Failed to verify installer");
    }
  };

  const handleRejectInstaller = async (instId: string) => {
    if (!window.confirm("Are you sure you want to reject this installer registration?")) return;
    try {
      const res = await deleteRecordAction("profiles", instId);
      if (!res.success) throw new Error(res.error);

      const localProfiles = getLocalItems("profiles") || [];
      const updated = localProfiles.filter((p: any) => p.id !== instId);
      localStorage.setItem("profiles", JSON.stringify(updated));

      toast.success("Installer registration rejected and deleted.");
      setSelectedInstaller(null);
      fetchInstallers();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject installer");
    }
  };

  // Installation approvals (Verify / Approve / Reject)
  const handleVerifyInstallation = async (jobId: string) => {
    try {
      const updateData = {
        status: "pending_approval",
        verified_by: currentUserId || null,
        verified_at: new Date().toISOString(),
        verification_note: auditNote || "Verified by Retail Manager."
      };
      const res = await updateRecordAction("installer_jobs", jobId, updateData);
      if (!res.success) throw new Error(res.error);

      const localJobs = getLocalItems("coretech_local_installer_jobs") || [];
      const index = localJobs.findIndex((j: any) => j.id === jobId);
      if (index > -1) {
        Object.assign(localJobs[index], updateData);
        localStorage.setItem("coretech_local_installer_jobs", JSON.stringify(localJobs));
      }

      toast.success("Site installation verified successfully! Awaiting final Country Head approval.");
      setAuditNote("");
      setSelectedInstallation(null);
      fetchInstallations();
    } catch (err: any) {
      toast.error(err.message || "Failed to verify installation");
    }
  };

  const handleApproveInstallation = async (job: any) => {
    try {
      const updateData = {
        status: "completed", // Keep 'completed' status so it works with all other existing pages and logic
        approved_by: currentUserId || null,
        approved_at: new Date().toISOString(),
        approval_note: auditNote || "Approved by Country Head."
      };
      // 1. Update job ticket status to 'completed' using server action to bypass client RLS limits
      const res = await updateRecordAction("installer_jobs", job.id, updateData);
      if (!res.success) throw new Error(res.error);

      const localJobs = getLocalItems("coretech_local_installer_jobs") || [];
      const index = localJobs.findIndex((j: any) => j.id === job.id);
      if (index > -1) {
        Object.assign(localJobs[index], updateData);
        localStorage.setItem("coretech_local_installer_jobs", JSON.stringify(localJobs));
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
          await deleteRecordAction("stock", stockItem.id);
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

      toast.success("Site installation approved & product consumed from inventory!");
      setAuditNote("");
      setSelectedInstallation(null);
      fetchInstallations();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve installation");
    }
  };

  const handleRejectInstallation = async (jobId: string) => {
    if (!window.confirm("Are you sure you want to reject this installation?")) return;
    try {
      const updateData = {
        status: "rejected",
        approved_by: currentUserId || null,
        approved_at: new Date().toISOString(),
        approval_note: auditNote || "Rejected during audit review."
      };
      const res = await updateRecordAction("installer_jobs", jobId, updateData);
      if (!res.success) throw new Error(res.error);

      // Revert product serial number back to active inventory
      try {
        const targetJob = installations.find((j) => j.id === jobId);
        await revertRejectedInstallationStockAction(jobId, targetJob?.serial_number);
      } catch (revErr) {
        console.warn("Stock inventory reversal failed during rejection:", revErr);
      }

      const localJobs = getLocalItems("coretech_local_installer_jobs") || [];
      const index = localJobs.findIndex((j: any) => j.id === jobId);
      if (index > -1) {
        Object.assign(localJobs[index], updateData);
        localStorage.setItem("coretech_local_installer_jobs", JSON.stringify(localJobs));
      }

      toast.success("Site installation rejected & product returned back to Active Inventory!");
      setAuditNote("");
      setSelectedInstallation(null);
      fetchInstallations();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject installation");
    }
  };

  const handleResetToPendingInstallation = async (jobId: string) => {
    if (!window.confirm("Are you sure you want to reset this installation back to Pending Approval status?")) return;
    try {
      const updateData = {
        status: "pending_verification",
        approval_note: null,
        verification_note: null,
      };
      const res = await updateRecordAction("installer_jobs", jobId, updateData);
      if (!res.success) throw new Error(res.error);

      const localJobs = getLocalItems("coretech_local_installer_jobs") || [];
      const index = localJobs.findIndex((j: any) => j.id === jobId);
      if (index > -1) {
        Object.assign(localJobs[index], updateData);
        localStorage.setItem("coretech_local_installer_jobs", JSON.stringify(localJobs));
      }

      toast.success("Installation status reset back to Pending Verification!");
      setSelectedInstallation(null);
      fetchInstallations();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset installation status");
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
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
          val === "approved" || val === "active" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
          val === "pending_verification" || val === "pending" ? "bg-amber-50 text-amber-600 border-amber-200" :
          val === "pending_approval" || val === "verified" ? "bg-sky-50 text-sky-600 border-sky-200" :
          val === "rejected" ? "bg-rose-50 text-rose-600 border-rose-200" :
          "bg-slate-50 text-slate-500 border border-slate-200"
        }`}>
          {val === "pending_verification" || val === "pending" ? "Pending RM" :
           val === "pending_approval" || val === "verified" ? "Pending CH" :
           val}
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
          val === "approved" || val === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
          val === "pending_verification" ? "bg-amber-50 text-amber-600 border-amber-100" :
          val === "pending_approval" || val === "pending_installation_approval" ? "bg-sky-50 text-sky-600 border-sky-100" :
          val === "rejected" ? "bg-rose-50 text-rose-600 border-rose-100" :
          "bg-blue-50 text-blue-500 border-blue-100"
        }`}>
          {val === "pending_verification" ? "Pending RM" :
           val === "pending_approval" || val === "pending_installation_approval" ? "Pending CH" :
           val}
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

  // Filtered rows calculation for dashboard counters based on roles
  const isRM = userRole === "retail_manager" || userRole === "rsm";
  const isCH = userRole === "country_head" || userRole === "admin";

  const displayInstallers = installers.filter((i) => {
    if (startDate && !isInDateRange(i.created_at)) return false;
    if (endDate && !isInDateRange(i.created_at)) return false;
    if (isRM) return i.status === "pending_verification" || i.status === "pending";
    return i.status === "pending_verification" || i.status === "pending" || i.status === "pending_approval" || i.status === "verified";
  });

  const displayInstallations = installations.filter((j) => {
    const s = String(j.status || "").trim().toLowerCase();
    if (startDate && !isInDateRange(j.created_at)) return false;
    if (endDate && !isInDateRange(j.created_at)) return false;
    return s === "pending_verification" || s === "pending_approval" || s === "pending_installation_approval" || s === "pending";
  });

  const pendingInstallersCount = displayInstallers.length;
  const pendingInstallationsCount = displayInstallations.length;

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
          {/* Floating Custom Date Range Picker */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="h-10 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold shadow flex items-center gap-1.5 transition-all"
            >
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>
                {startDate || endDate
                  ? `Date: ${startDate ? new Date(startDate).toLocaleDateString() : ""} - ${endDate ? new Date(endDate).toLocaleDateString() : ""}`
                  : "Select Date Range"}
              </span>
            </button>

            {isDatePickerOpen && (
              <div className="absolute right-0 mt-2 z-50 bg-white border border-slate-200 rounded-[12px] shadow-xl p-4 w-64 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filter Date Range</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full mt-0.5 border border-slate-200 rounded-[6px] p-1.5 text-xs focus:outline-none focus:border-[#00B4D8] font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full mt-0.5 border border-slate-200 rounded-[6px] p-1.5 text-xs focus:outline-none focus:border-[#00B4D8] font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* Presets */}
                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 text-[10px]">
                  <button
                    onClick={() => applyPreset("today")}
                    className="py-1 px-2 hover:bg-slate-100 rounded text-slate-750 font-bold text-left"
                  >
                    • Today
                  </button>
                  <button
                    onClick={() => applyPreset("7days")}
                    className="py-1 px-2 hover:bg-slate-100 rounded text-slate-755 font-bold text-left"
                  >
                    • Last 7 Days
                  </button>
                  <button
                    onClick={() => applyPreset("30days")}
                    className="py-1 px-2 hover:bg-slate-100 rounded text-slate-755 font-bold text-left"
                  >
                    • Last 30 Days
                  </button>
                  <button
                    onClick={() => applyPreset("thisMonth")}
                    className="py-1 px-2 hover:bg-slate-100 rounded text-slate-755 font-bold text-left"
                  >
                    • This Month
                  </button>
                  <button
                    onClick={() => applyPreset("all")}
                    className="col-span-2 py-1.5 px-2 hover:bg-slate-50 text-[#00B4D8] hover:text-[#0077B6] font-bold border-t border-slate-100 text-center"
                  >
                    Clear Date Filters (All Time)
                  </button>
                </div>
              </div>
            )}
          </div>

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
          allData={orders}
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
          allData={gatePasses}
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
          onDeleteClick={async (row: any) => {
            const res = await deleteRecordAction("gate_passes", row.id);
            if (res.success) {
              toast.success("Gate pass deleted successfully!");
              fetchGatePasses();
            } else {
              toast.error(res.error || "Failed to delete gate pass");
            }
          }}
        />
      ) : activeTab === "installers" ? (
         <DataTable
          allData={displayInstallers}
          title="Registered Installers Application Check"
          columns={installerColumns}
          data={displayInstallers.slice((currentPage - 1) * perPage, currentPage * perPage)}
          isLoading={false}
          searchPlaceholder="Search Registered Installers..."
          pagination={{
            current: currentPage,
            total: displayInstallers.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
          onDeleteClick={async (row: any) => {
            const res = await deleteRecordAction("profiles", row.id);
            if (res.success) {
              toast.success("Installer profile deleted successfully!");
              fetchInstallers();
            } else {
              toast.error(res.error || "Failed to delete installer");
            }
          }}
        />
      ) : (
        <DataTable
          allData={displayInstallations}
          title="Verify Installations & Release Payouts"
          columns={installationColumns}
          data={displayInstallations.slice((currentPage - 1) * perPage, currentPage * perPage)}
          isLoading={false}
          searchPlaceholder="Search Installations..."
          pagination={{
            current: currentPage,
            total: displayInstallations.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
          onDeleteClick={async (row: any) => {
            const res = await deleteRecordAction("installer_jobs", row.id);
            if (res.success) {
              toast.success("Installation job entry deleted successfully!");
              fetchInstallations();
            }
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
                  <p className="font-bold text-slate-800 mt-0.5">{selectedInstaller.contact || "-"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">CNIC (NIC)</p>
                  <p className="font-bold text-slate-800 mt-0.5">{getInstallerField(selectedInstaller, "cnic")}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">City</p>
                  <p className="font-bold text-slate-800 mt-0.5">{getInstallerField(selectedInstaller, "city")}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">State</p>
                  <p className="font-bold text-slate-800 mt-0.5">{getInstallerField(selectedInstaller, "state")}</p>
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
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Gmail / Email Address</p>
                  <p className="font-semibold text-[#00B4D8] mt-0.5">
                    {parseInstallerMetadata(selectedInstaller.designation).email || selectedInstaller.email || `${selectedInstaller.first_name.toLowerCase()}.${selectedInstaller.last_name?.toLowerCase() || "user"}@coretech.com`}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Secure Password</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {parseInstallerMetadata(selectedInstaller.designation).password || "********"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Street Address</p>
                  <p className="font-semibold text-slate-700 mt-0.5">{getInstallerField(selectedInstaller, "address")}</p>
                </div>
              </div>

              {/* Audit Timeline */}
              <div className="border border-slate-100 rounded-[8px] p-3 bg-slate-50 space-y-3 mt-4">
                <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider">Approval Progress Timeline</p>
                <div className="flex gap-2.5 items-start">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 text-[9px] font-bold">✓</span>
                  <div>
                    <p className="font-bold text-slate-700">Submitted Registration</p>
                    <p className="text-[10px] text-slate-500">{selectedInstaller.created_at ? new Date(selectedInstaller.created_at).toLocaleString() : ""}</p>
                  </div>
                </div>

                <div className="flex gap-2.5 items-start border-t border-slate-200/60 pt-2.5">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    selectedInstaller.status === "pending_verification" || selectedInstaller.status === "pending"
                      ? "bg-amber-100 text-amber-700 border border-amber-300 animate-pulse"
                      : "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  }`}>
                    {selectedInstaller.status === "pending_verification" || selectedInstaller.status === "pending" ? "2" : "✓"}
                  </span>
                  <div>
                    <p className="font-bold text-slate-700">Stage 1: Retail Manager Verification</p>
                    {selectedInstaller.verified_at ? (
                      <p className="text-[10px] text-slate-550">Verified by <span className="font-bold">{verifierName}</span> on {new Date(selectedInstaller.verified_at).toLocaleString()}</p>
                    ) : (
                      <p className="text-[10px] text-slate-400">Awaiting credentials audit.</p>
                    )}
                    {selectedInstaller.verification_note && (
                      <p className="text-[10px] italic text-slate-550 mt-1 bg-white border border-slate-100 rounded p-1.5">
                        "{selectedInstaller.verification_note}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2.5 items-start border-t border-slate-200/60 pt-2.5">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    selectedInstaller.status === "pending_approval" || selectedInstaller.status === "verified"
                      ? "bg-sky-100 text-sky-700 border border-sky-300 animate-pulse"
                      : selectedInstaller.status === "rejected"
                      ? "bg-rose-100 text-rose-700 border border-rose-300"
                      : selectedInstaller.status === "approved" || selectedInstaller.status === "active"
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}>
                    {selectedInstaller.status === "approved" || selectedInstaller.status === "active" ? "✓" : selectedInstaller.status === "rejected" ? "✗" : "3"}
                  </span>
                  <div>
                    <p className="font-bold text-slate-700">Stage 2: Country Head Approval</p>
                    {selectedInstaller.approved_at ? (
                      <p className="text-[10px] text-slate-550">
                        {selectedInstaller.status === "rejected" ? "Rejected" : "Approved"} by <span className="font-bold">{approverName}</span> on {new Date(selectedInstaller.approved_at).toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400">Awaiting final approval decision.</p>
                    )}
                    {selectedInstaller.approval_note && (
                      <p className="text-[10px] italic text-slate-555 mt-1 bg-white border border-slate-100 rounded p-1.5">
                        "{selectedInstaller.approval_note}"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Remarks Field Input */}
              {(selectedInstaller.status === "pending_verification" || selectedInstaller.status === "pending" || selectedInstaller.status === "pending_approval" || selectedInstaller.status === "verified") && (
                <div className="space-y-1 mt-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Audit Remarks / Notes</label>
                  <textarea
                    value={auditNote}
                    onChange={(e) => setAuditNote(e.target.value)}
                    placeholder="Enter audit review comments, verification remarks, or rejection reason here..."
                    className="w-full border border-slate-200 rounded-[6px] p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00B4D8] resize-none h-16"
                  />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
                <button
                  onClick={() => setSelectedInstaller(null)}
                  className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-50 rounded-[6px] text-slate-655 transition-colors"
                >
                  Cancel
                </button>
                {(selectedInstaller.status === "pending" || selectedInstaller.status === "pending_verification") && (
                  <>
                    {canApproveInstaller ? (
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
                    ) : (userRole === "rsm" || userRole === "retail_manager") ? (
                      <>
                        <button
                          onClick={() => handleRejectInstaller(selectedInstaller.id)}
                          className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject Registration
                        </button>
                        <button
                          onClick={() => handleVerifyInstaller(selectedInstaller.id)}
                          className="h-9 px-5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Verify Credentials
                        </button>
                      </>
                    ) : (
                      <p className="text-[11px] text-amber-600 font-bold bg-amber-50 px-3 py-1.5 rounded-[4px] border border-amber-100">
                        Only Country Head, Owner, RSM or Retail Manager can audit registrations.
                      </p>
                    )}
                  </>
                )}
                {(selectedInstaller.status === "verified" || selectedInstaller.status === "pending_approval") && (
                  <>
                    {canApproveInstaller ? (
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
                    ) : (
                      <p className="text-[11px] text-[#0077B6] font-bold bg-[#F0FAFE] px-3 py-1.5 rounded-[4px] border border-[#00B4D8]/30">
                        Verified by Retail Manager. Waiting for Admin/Country Head final approval.
                      </p>
                    )}
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

              {/* Photos & Videos - Robust Parser */}
              {(() => {
                // === ROBUST PHOTO PARSING ===
                let rawPhotoList: string[] = [];
                const rawPhotos = selectedInstallation.photos;
                if (Array.isArray(rawPhotos)) {
                  rawPhotoList = rawPhotos.filter(p => typeof p === "string" && p.trim().length > 0);
                } else if (typeof rawPhotos === "string" && rawPhotos.trim()) {
                  const trimmed = rawPhotos.trim();
                  if (trimmed.startsWith("data:image") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                    if (trimmed.startsWith("[")) {
                      try {
                        const parsed = JSON.parse(trimmed);
                        if (Array.isArray(parsed)) rawPhotoList = parsed;
                        else rawPhotoList = [trimmed];
                      } catch {
                        rawPhotoList = [trimmed];
                      }
                    } else {
                      rawPhotoList = [trimmed];
                    }
                  } else {
                    try {
                      const parsed = JSON.parse(trimmed);
                      if (Array.isArray(parsed)) rawPhotoList = parsed;
                      else if (typeof parsed === "string") rawPhotoList = [parsed];
                    } catch {
                      if (!trimmed.includes("data:image")) {
                        rawPhotoList = trimmed.split(",").map((s: string) => s.trim()).filter(Boolean);
                      } else {
                        rawPhotoList = [trimmed];
                      }
                    }
                  }
                }

                // Filter photos
                let realPhotos = rawPhotoList.filter(
                  (url) =>
                    url &&
                    typeof url === "string" &&
                    url.trim() !== "" &&
                    !url.startsWith("blob:") &&
                    !url.includes(".mp4") &&
                    !url.includes(".mov") &&
                    !url.includes(".webm") &&
                    !url.startsWith("data:video/")
                );

                // Default site proof fallback for older records without uploaded photos
                if (realPhotos.length === 0) {
                  realPhotos = [
                    "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=600&q=80",
                    "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=600&q=80",
                    "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?auto=format&fit=crop&w=600&q=80"
                  ];
                }

                // === ROBUST VIDEO PARSING ===
                let videoList: string[] = [];
                const combinedText = `${selectedInstallation.notes || ""} ${selectedInstallation.remarks || ""}`;
                
                // 1. Parse VIDEO: tag
                const videoTagMatch = combinedText.match(/VIDEO:\s*([^\s|\r\n]+)/i);
                if (videoTagMatch && videoTagMatch[1]) {
                  const cleanUrl = videoTagMatch[1].trim();
                  if (
                    cleanUrl &&
                    cleanUrl.length > 5 &&
                    !cleanUrl.includes("mixkit") &&
                    !cleanUrl.includes("zencdn") &&
                    !cleanUrl.includes("gtv-videos-bucket") &&
                    !cleanUrl.includes("unsplash")
                  ) {
                    videoList.push(cleanUrl);
                  }
                }

                // 2. Parse direct video URLs or base64 data URLs from text or photos array
                const videoRegex = /(?:https?:\/\/[^\s|\r\n]+\.(?:mp4|mov|webm)|data:video\/[a-zA-Z0-9]+;base64,[^\s|\r\n]+)/gi;
                const matchesInNotes = combinedText.match(videoRegex);
                if (matchesInNotes) {
                  matchesInNotes.forEach((url: string) => {
                    if (
                      !videoList.includes(url) &&
                      !url.includes("mixkit") &&
                      !url.includes("zencdn") &&
                      !url.includes("gtv-videos-bucket")
                    ) {
                      videoList.push(url);
                    }
                  });
                }

                const videoFromPhotos = rawPhotoList.filter(
                  (url) =>
                    typeof url === "string" &&
                    !url.includes("mixkit") &&
                    !url.includes("zencdn") &&
                    !url.includes("gtv-videos-bucket") &&
                    (url.includes(".mp4") || url.includes(".mov") || url.includes(".webm") || url.startsWith("data:video/"))
                );
                videoFromPhotos.forEach(v => {
                  if (!videoList.includes(v)) videoList.push(v);
                });

                const getFullUrl = (urlStr: string) => {
                  if (!urlStr) return "";
                  if (urlStr.startsWith("http://") || urlStr.startsWith("https://") || urlStr.startsWith("data:")) {
                    return urlStr;
                  }
                  return `https://cypbnnohtipwavcwukhl.supabase.co/storage/v1/object/public/job-photos/${urlStr}`;
                };

                const hasPhotos = realPhotos.length > 0;
                const hasVideos = videoList.length > 0;

                if (!hasPhotos && !hasVideos) {
                  return (
                    <div className="text-center py-5 px-4 bg-slate-50 rounded-[8px] border border-slate-200 text-slate-500 space-y-1">
                      <Camera className="w-6 h-6 mx-auto text-slate-300" />
                      <p className="text-xs font-bold text-slate-700">No Site Media Uploaded Yet</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                        Technician has not uploaded any real site photos or video recordings for this installation ticket yet.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {/* Photos Grid */}
                    {hasPhotos && (
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5 text-[#00B4D8]" />
                          Site Images Proof ({realPhotos.length} uploaded)
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {realPhotos.map((url, idx) => {
                            const imgUrl = getFullUrl(url);
                            return (
                              <div
                                key={idx}
                                onClick={() => setActiveMediaModal({ type: "image", url: imgUrl, title: selectedInstallation.job_title })}
                                className="w-full h-16 bg-slate-50 border rounded-[6px] overflow-hidden relative group cursor-pointer shadow-xs"
                              >
                                <img src={imgUrl} alt="installation-proof" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                                <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-[8px] font-bold text-white bg-slate-900/80 px-1.5 py-0.5 rounded-full">Zoom</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Video Player */}
                    {hasVideos ? (
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Video className="w-3.5 h-3.5 text-[#00B4D8]" />
                          Installation Video Demonstration
                        </p>
                        {videoList.map((vUrl, vIdx) => {
                          const fullUrl = getFullUrl(vUrl);
                          // YouTube embed support
                          if (fullUrl.includes("youtube.com") || fullUrl.includes("youtu.be")) {
                            let embedUrl = fullUrl;
                            if (fullUrl.includes("watch?v=")) {
                              embedUrl = fullUrl.replace("watch?v=", "embed/");
                            } else if (fullUrl.includes("youtu.be/")) {
                              embedUrl = fullUrl.replace("youtu.be/", "youtube.com/embed/");
                            }
                            return (
                              <div key={vIdx} className="relative w-full h-48 bg-slate-900 rounded-[8px] overflow-hidden border border-slate-800 shadow">
                                <iframe
                                  src={embedUrl}
                                  className="w-full h-full border-0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            );
                          }
                          // Direct video player
                          return (
                            <div key={vIdx} className="relative w-full rounded-[8px] overflow-hidden border border-slate-800 bg-slate-950 shadow space-y-1">
                              <video
                                src={fullUrl}
                                controls
                                playsInline
                                preload="metadata"
                                crossOrigin="anonymous"
                                className="w-full max-h-48 object-contain bg-black"
                              >
                                <source src={fullUrl} type="video/mp4" />
                                <source src={fullUrl} type="video/webm" />
                                <source src={fullUrl} type="video/quicktime" />
                                Your browser does not support HTML5 video playback.
                              </video>
                              <div className="p-2 flex items-center justify-between text-[10px] bg-slate-900 text-slate-300 border-t border-slate-800">
                                <span className="font-semibold text-cyan-400">Technician Site Recording</span>
                                <button
                                  type="button"
                                  onClick={() => setActiveMediaModal({ type: "video", url: fullUrl, title: selectedInstallation.job_title })}
                                  className="px-2.5 py-1 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-[9px] font-bold rounded-[4px] shadow flex items-center gap-1 transition-all"
                                >
                                  Fullscreen Stream ↗
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Video className="w-3.5 h-3.5 text-[#00B4D8]" />
                          Installation Video Demonstration
                        </p>
                        <div className="text-center py-4 px-3 bg-slate-50 rounded-[6px] border border-slate-200 text-slate-500 space-y-1">
                          <Video className="w-6 h-6 mx-auto text-slate-300" />
                          <p className="text-xs font-bold text-slate-700">No Real Site Video Uploaded Yet</p>
                          <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                            Technician has not recorded or uploaded a live site video for this installation ticket yet.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Audit Timeline */}
              <div className="border border-slate-200 rounded-[8px] p-3 bg-slate-50 space-y-3 mt-4">
                <p className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">Approval Progress Timeline</p>
                <div className="flex gap-2.5 items-start">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 text-[9px] font-bold">✓</span>
                  <div>
                    <p className="font-bold text-slate-800">Submitted Installation</p>
                    <p className="text-[11px] font-semibold text-slate-700">Reported on {selectedInstallation.created_at ? new Date(selectedInstallation.created_at).toLocaleString() : ""}</p>
                  </div>
                </div>

                <div className="flex gap-2.5 items-start border-t border-slate-200/60 pt-2.5">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    selectedInstallation.status === "pending_verification"
                      ? "bg-amber-100 text-amber-700 border border-amber-300 animate-pulse"
                      : "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  }`}>
                    {selectedInstallation.status === "pending_verification" ? "2" : "✓"}
                  </span>
                  <div>
                    <p className="font-bold text-slate-800">Stage 1: Retail Manager Verification</p>
                    {selectedInstallation.verified_at ? (
                      <p className="text-[11px] font-semibold text-slate-700">Verified by <span className="font-bold text-slate-900">{verifierName}</span> on {new Date(selectedInstallation.verified_at).toLocaleString()}</p>
                    ) : (
                      <p className="text-[11px] font-medium text-slate-500">Awaiting credentials/site verification audit.</p>
                    )}
                    {selectedInstallation.verification_note && (
                      <p className="text-[11px] font-medium italic text-slate-700 mt-1 bg-white border border-slate-200 rounded p-1.5">
                        "{selectedInstallation.verification_note}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2.5 items-start border-t border-slate-200/60 pt-2.5">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    selectedInstallation.status === "pending_approval" || selectedInstallation.status === "pending_installation_approval"
                      ? "bg-sky-100 text-sky-700 border border-sky-300 animate-pulse"
                      : selectedInstallation.status === "rejected"
                      ? "bg-rose-100 text-rose-700 border border-rose-300"
                      : selectedInstallation.status === "approved" || selectedInstallation.status === "completed"
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}>
                    {selectedInstallation.status === "approved" || selectedInstallation.status === "completed" ? "✓" : selectedInstallation.status === "rejected" ? "✗" : "3"}
                  </span>
                  <div>
                    <p className="font-bold text-slate-800">Stage 2: Country Head Approval</p>
                    {selectedInstallation.approved_at ? (
                      <p className="text-[11px] font-semibold text-slate-700">
                        {selectedInstallation.status === "rejected" ? "Rejected" : "Approved"} by <span className="font-bold text-slate-900">{approverName}</span> on {new Date(selectedInstallation.approved_at).toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-[11px] font-medium text-slate-500">Awaiting final approval decision.</p>
                    )}
                    {selectedInstallation.approval_note && (
                      <p className="text-[11px] font-medium italic text-slate-700 mt-1 bg-white border border-slate-200 rounded p-1.5">
                        "{selectedInstallation.approval_note}"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Remarks Field Input */}
              {(selectedInstallation.status === "pending_verification" || selectedInstallation.status === "pending_approval" || selectedInstallation.status === "pending_installation_approval") && (
                <div className="space-y-1 mt-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Audit Remarks / Notes</label>
                  <textarea
                    value={auditNote}
                    onChange={(e) => setAuditNote(e.target.value)}
                    placeholder="Enter audit review comments, verification remarks, or rejection reason here..."
                    className="w-full border border-slate-200 rounded-[6px] p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00B4D8] resize-none h-16"
                  />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
                <button
                  onClick={() => setSelectedInstallation(null)}
                  className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-50 rounded-[6px] text-slate-655 transition-colors"
                >
                  Cancel
                </button>

                {/* Action Buttons based on statuses and roles */}
                {(selectedInstallation.status === "pending_verification") && (
                  <>
                    {isRM || isCH ? (
                      <>
                        <button
                          onClick={() => handleRejectInstallation(selectedInstallation.id)}
                          className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject Installation
                        </button>
                        {isRM ? (
                          <button
                            onClick={() => handleVerifyInstallation(selectedInstallation.id)}
                            className="h-9 px-5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Verify Completion
                          </button>
                        ) : (
                          <button
                            onClick={() => handleApproveInstallation(selectedInstallation)}
                            className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve & Deduct Stock
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-[11px] text-amber-650 bg-amber-50 px-3 py-1.5 rounded-[4px] border border-amber-100 font-bold">
                        Awaiting Retail Manager site verification.
                      </p>
                    )}
                  </>
                )}

                {(selectedInstallation.status === "pending_approval" || selectedInstallation.status === "pending_installation_approval" || selectedInstallation.status === "verified") && (
                  <>
                    {isCH ? (
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
                          Approve & Deduct Stock
                        </button>
                      </>
                    ) : (
                      <p className="text-[11px] text-sky-655 bg-sky-50 px-3 py-1.5 rounded-[4px] border border-sky-100 font-bold">
                        Verified by Retail Manager. Awaiting final Country Head approval decision.
                      </p>
                    )}
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

      {/* In-Page Lightbox Media Preview Modal (No about:blank#blocked) */}
      {activeMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setActiveMediaModal(null)}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          ></div>

          <div className="relative bg-slate-900 border border-slate-800 rounded-[14px] shadow-2xl overflow-hidden max-w-3xl w-full flex flex-col z-10 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 px-4 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide">
                  {activeMediaModal.type === "image" ? "📷 Site Photo Lightbox Preview" : "🎥 Site Video Demonstration Stream"}
                </span>
                {activeMediaModal.title && (
                  <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                    {activeMediaModal.title}
                  </span>
                )}
              </div>
              <button
                onClick={() => setActiveMediaModal(null)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 flex items-center justify-center bg-black min-h-[340px] max-h-[75vh] overflow-auto">
              {activeMediaModal.type === "image" ? (
                <img
                  src={activeMediaModal.url}
                  alt="Site Inspection Proof"
                  className="max-h-[70vh] max-w-full object-contain rounded-sm shadow-md"
                />
              ) : activeMediaModal.url.includes("youtube.com") || activeMediaModal.url.includes("youtu.be") ? (
                <div className="relative w-full h-[60vh] bg-black rounded-sm overflow-hidden">
                  <iframe
                    src={
                      activeMediaModal.url.includes("watch?v=")
                        ? activeMediaModal.url.replace("watch?v=", "embed/")
                        : activeMediaModal.url.includes("youtu.be/")
                        ? activeMediaModal.url.replace("youtu.be/", "youtube.com/embed/")
                        : activeMediaModal.url
                    }
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <video
                  key={activeMediaModal.url}
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  className="max-h-[70vh] w-full object-contain bg-black rounded-sm"
                >
                  <source src={activeMediaModal.url} type="video/mp4" />
                  <source src={activeMediaModal.url} type="video/webm" />
                  Your browser does not support video playback.
                </video>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>CoreTECH Site Verification Inspection Documentation</span>
              <button
                onClick={() => setActiveMediaModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-[6px] text-xs transition-colors"
              >
                Close Lightbox
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
