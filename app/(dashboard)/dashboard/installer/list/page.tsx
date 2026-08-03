"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import UserModal from "@/components/UserModal";
import toast from "react-hot-toast";
import { deleteUserAction, updateRecordAction } from "@/app/actions/users";
import { getLocalItems } from "@/lib/supabaseLocalFallback";
import { Clock, Check, X, Eye, UserCheck, Calendar } from "lucide-react";

interface InstallerProfile {
  id: string;
  first_name: string;
  last_name: string;
  designation: string;
  contact: string;
  group_name: string;
  status: string;
  role: string;
  created_at: string;
}

export default function InstallerListPage() {
  const supabase = createClientComponentClient();

  const [installers, setInstallers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("approved");
  const [editingUser, setEditingUser] = useState<any>(undefined);
  const [selectedInstaller, setSelectedInstaller] = useState<any>(null);
  const [userLookup, setUserLookup] = useState<Record<string, string>>({});
  const [verifierName, setVerifierName] = useState("");
  const [approverName, setApproverName] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const perPage = 10;

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
    const fetchAuditUserNames = async () => {
      setVerifierName("");
      setApproverName("");
      if (!selectedInstaller) return;

      if (selectedInstaller.verified_by) {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", selectedInstaller.verified_by)
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

      if (selectedInstaller.approved_by) {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", selectedInstaller.approved_by)
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
  }, [selectedInstaller]);

  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  useEffect(() => {
    const initPageData = async () => {
      try {
        const [profilesRes, sessionRes] = await Promise.all([
          supabase.from("profiles").select("id, first_name, last_name"),
          supabase.auth.getSession()
        ]);

        if (profilesRes.data) {
          const lookup: Record<string, string> = {};
          profilesRes.data.forEach((u) => {
            lookup[u.id] = `${u.first_name} ${u.last_name || ""}`.trim();
          });
          setUserLookup(lookup);
        }

        const session = sessionRes.data?.session;
        if (session) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          if (prof) setCurrentUserProfile(prof);
        }
      } catch (e) {
        console.warn("Failed to initialize installer list page data:", e);
      }
    };
    initPageData();
  }, []);

  const fetchInstallers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "installer")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((prof: any) => ({
        ...prof,
        installer_id: (prof.id || "").substring(0, 8).toUpperCase(), // readable installer ID prefix
        installer_name: `${prof.first_name || ""} ${prof.last_name || ""}`.trim() || "Installer",
      }));

      // Merge local storage profiles fallback
      const localProfiles = getLocalItems("profiles") || [];
      const localInstallers = localProfiles.filter((p: any) => p && p.role === "installer");

      let merged = [...formatted];
      localInstallers.forEach((local) => {
        if (local && local.id && !merged.some(db => db.id === local.id)) {
          merged.push({
            ...local,
            installer_id: (local.id || "").substring(0, 8).toUpperCase(),
            installer_name: `${local.first_name || ""} ${local.last_name || ""}`.trim() || "Installer",
          });
        }
      });

      // Strict Regional Data Isolation for RSM Users
      const isRsmUser = currentUserProfile && (currentUserProfile.role === "rsm" || currentUserProfile.group_name === "rsm");
      if (isRsmUser && currentUserProfile.region) {
        const rsmRegionLower = currentUserProfile.region.toLowerCase().trim();
        merged = merged.filter((item: any) => {
          const itemRegionLower = (getInstallerField(item, "region") || item.region || "").toLowerCase().trim();
          return !itemRegionLower || itemRegionLower === rsmRegionLower;
        });
      }

      setInstallers(merged);
    } catch (err: any) {
      toast.error(err.message || "Failed to load installers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallers();
  }, []);

  const handleVerifyInstaller = async (instId: string) => {
    try {
      const updateData = {
        status: "pending_approval",
        verified_by: currentUserProfile?.id || null,
        verified_at: new Date().toISOString(),
        verification_note: "Credentials and documents verified by Retail Manager."
      };
      const res = await updateRecordAction("profiles", instId, updateData);
      if (!res.success) throw new Error(res.error);

      const localProfiles = getLocalItems("profiles") || [];
      const index = localProfiles.findIndex((p: any) => p.id === instId);
      if (index > -1) {
        Object.assign(localProfiles[index], updateData);
        localStorage.setItem("profiles", JSON.stringify(localProfiles));
      }

      toast.success("Installer credentials verified! Passed to Country Head for final approval.");
      setSelectedInstaller(null);
      fetchInstallers();
    } catch (err: any) {
      toast.error(err.message || "Failed to verify installer");
    }
  };

  const handleApproveInstaller = async (instId: string) => {
    try {
      const updateData = {
        status: "active",
        approved_by: currentUserProfile?.id || null,
        approved_at: new Date().toISOString(),
        approval_note: "Final approval granted by Country Head."
      };
      const res = await updateRecordAction("profiles", instId, updateData);
      if (!res.success) throw new Error(res.error);

      const localProfiles = getLocalItems("profiles") || [];
      const index = localProfiles.findIndex((p: any) => p.id === instId);
      if (index > -1) {
        Object.assign(localProfiles[index], updateData);
        localStorage.setItem("profiles", JSON.stringify(localProfiles));
      }

      toast.success("Installer approved & activated successfully!");
      setSelectedInstaller(null);
      fetchInstallers();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve installer");
    }
  };

  const handleRejectInstaller = async (instId: string) => {
    if (!window.confirm("Are you sure you want to reject this installer registration?")) return;
    try {
      const res = await deleteUserAction(instId);
      if (!res.success) throw new Error(res.error);

      const localProfiles = getLocalItems("profiles") || [];
      const updated = localProfiles.filter((p: any) => p.id !== instId);
      localStorage.setItem("profiles", JSON.stringify(updated));

      toast.success("Installer registration rejected and removed.");
      setSelectedInstaller(null);
      fetchInstallers();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject installer");
    }
  };

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (user: any) => {
    if (window.confirm(`Are you sure you want to delete installer ${user.installer_name}?`)) {
      const res = await deleteUserAction(user.id);
      if (res.success) {
        toast.success(res.message || "Installer deleted successfully");
        fetchInstallers();
      } else {
        toast.error(res.error || "Failed to delete user");
      }
    }
  };

  const filtered = installers.filter((item) => {
    if (statusFilter) {
      if (statusFilter === "active" || statusFilter === "approved") {
        if (item.status !== "active" && item.status !== "approved") return false;
      } else if (statusFilter === "pending_approval" || statusFilter === "verified") {
        if (item.status !== "pending_approval" && item.status !== "verified") return false;
      } else if (statusFilter === "pending_verification" || statusFilter === "pending") {
        if (item.status !== "pending_verification" && item.status !== "pending") return false;
      } else if (item.status !== statusFilter) {
        return false;
      }
    }
    if (startDate) {
      const startVal = new Date(startDate).getTime();
      const itemVal = new Date(item.created_at).getTime();
      if (itemVal < startVal) return false;
    }
    if (endDate) {
      const endVal = new Date(endDate + "T23:59:59.999Z").getTime();
      const itemVal = new Date(item.created_at).getTime();
      if (itemVal > endVal) return false;
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.installer_name.toLowerCase().includes(q) ||
      item.installer_id.toLowerCase().includes(q) ||
      item.contact.includes(q)
    );
  });

  const paginated = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  const parseInstallerMetadata = (metadataStr: string) => {
    if (!metadataStr) return {};
    
    const extractJson = (str: string): any => {
      if (!str || typeof str !== "string") return {};
      let s = str.trim();
      if (s.includes("[DISTRIBUTOR_METADATA]")) {
        s = s.replace("[DISTRIBUTOR_METADATA]", "").trim();
      }
      if (s.includes("[INSTALLER_METADATA]")) {
        s = s.replace("[INSTALLER_METADATA]", "").trim();
      }
      try {
        const parsed = JSON.parse(s);
        let nested: any = {};
        if (parsed.designation && typeof parsed.designation === "string" && (parsed.designation.includes("{") || parsed.designation.includes("["))) {
          nested = extractJson(parsed.designation);
        }
        return { ...parsed, ...nested };
      } catch (e) {
        return {};
      }
    };

    return extractJson(metadataStr);
  };

  const getInstallerField = (installer: any, fieldKey: string) => {
    if (!installer) return "-";
    // 1. Direct property check on profile row
    if (installer[fieldKey] && String(installer[fieldKey]).trim() !== "") return installer[fieldKey];
    
    // 2. Parsed JSON metadata check
    const meta = parseInstallerMetadata(installer.designation);
    if (meta && meta[fieldKey] && String(meta[fieldKey]).trim() !== "") return meta[fieldKey];
    
    return "-";
  };

  const columns = [
    { key: "installer_id", label: "Installer ID" },
    {
      key: "installer_name",
      label: "Installer Name",
      render: (val: string) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#F0FAFE] text-[#00B4D8] font-bold text-[10px] flex items-center justify-center border border-[#00B4D8]/20">
            {val.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-slate-700">{val}</span>
        </div>
      ),
    },
    { 
      key: "designation", 
      label: "Designation",
      render: (val: string, row: any) => {
        let cleanText = "Installer";
        if (val) {
          if (val.includes("INSTALLER_METADATA")) {
            // Remove outer wrapper distributor metadata prefix if it wraps it
            const cleanVal = val.replace("[DISTRIBUTOR_METADATA]", "");
            try {
              const outer = JSON.parse(cleanVal);
              const innerVal = outer.designation || "";
              
              if (innerVal.startsWith("[INSTALLER_METADATA]")) {
                const innerParsed = JSON.parse(innerVal.replace("[INSTALLER_METADATA]", ""));
                cleanText = `Installer (${innerParsed.marital_status || "Active"})`;
              } else if (outer.marital_status) {
                cleanText = `Installer (${outer.marital_status})`;
              }
            } catch (e) {
              cleanText = "Installer (Active)";
            }
          } else if (val.startsWith("[DISTRIBUTOR_METADATA]")) {
            try {
              const parsed = JSON.parse(val.replace("[DISTRIBUTOR_METADATA]", ""));
              cleanText = parsed.designation || "Installer";
            } catch(e) {}
          } else {
            cleanText = val;
          }
        }
        return <span className="text-slate-650 font-semibold">{cleanText}</span>;
      }
    },
    { key: "contact", label: "Contact Phone" },
    { 
      key: "status", 
      label: "Status",
      render: (status: string, row: any) => (
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
            status === "approved" || status === "active" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
            status === "pending_verification" || status === "pending" ? "bg-amber-50 text-amber-500 border-amber-100" :
            status === "pending_approval" || status === "verified" ? "bg-sky-50 text-sky-600 border-sky-100" :
            status === "rejected" ? "bg-rose-50 text-rose-500 border-rose-100" :
            "bg-slate-50 text-slate-500 border-slate-200"
          }`}>
            {status === "pending_verification" || status === "pending" ? "Pending RM" :
             status === "pending_approval" || status === "verified" ? "Pending CH" :
             status === "approved" || status === "active" ? "ACTIVE" :
             status}
          </span>
        </div>
      )
    },
    {
      key: "audit_summary",
      label: "Audit History Log",
      render: (_: string, row: any) => {
        const verifier = row.verified_by ? (userLookup[row.verified_by] || "Retail Manager") : null;
        const approver = row.approved_by ? (userLookup[row.approved_by] || "Country Head") : null;
        
        if (row.status === "pending" || row.status === "pending_verification") {
          return (
            <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Stage 1: Awaiting Retail Manager verification
            </span>
          );
        }

        if (row.status === "verified" || row.status === "pending_approval") {
          return (
            <span className="text-[10px] text-sky-600 font-semibold">
              ✓ Verified by <strong className="text-slate-800">{verifier}</strong>
              <span className="text-slate-700 block text-[9px] mt-0.5">
                Stage 2: Awaiting Country Head final decision
              </span>
            </span>
          );
        }

        if (row.status === "approved" || row.status === "active") {
          return (
            <span className="text-[10px] text-emerald-600 font-semibold">
              ✓ Stage 1: Verified by <strong className="text-slate-800">{verifier || "RM"}</strong>
              <span className="text-emerald-700 block text-[9px] mt-0.5">
                ✓ Stage 2: Approved by <strong className="text-slate-800">{approver || "CH"}</strong>
              </span>
            </span>
          );
        }

        if (row.status === "rejected") {
          return (
            <span className="text-[10px] text-rose-600 font-semibold">
              ✗ Rejected by <strong className="text-slate-800">{approver || verifier || "Auditor"}</strong>
              {(row.approval_note || row.verification_note) && (
                <span className="text-slate-700 block text-[9px] truncate max-w-xs mt-0.5 italic font-bold">
                  "{row.approval_note || row.verification_note}"
                </span>
              )}
            </span>
          );
        }

        return <span className="text-[10px] text-slate-700 font-semibold italic">No history</span>;
      }
    },
    {
      key: "id",
      label: "Audit Logs",
      render: (_: string, row: any) => (
        <button
          onClick={() => setSelectedInstaller(row)}
          className="flex items-center gap-1.5 px-3 py-1 hover:bg-[#F0FAFE] hover:text-[#00B4D8] border border-slate-200 text-slate-650 rounded-[4px] text-[11px] font-bold transition-all"
        >
          <UserCheck className="w-3.5 h-3.5" />
          Audit Trail
        </button>
      )
    }
  ];

  // Compute metrics based on date range & 2-stage approval workflow
  const registeredCount = installers.filter(item => {
    if (!startDate && !endDate) return true;
    return isInDateRange(item.created_at);
  }).length;

  const pendingRmCount = installers.filter(item => {
    if (item.status === "pending_verification" || item.status === "pending") {
      if (!startDate && !endDate) return true;
      return isInDateRange(item.created_at);
    }
    return false;
  }).length;

  const pendingChCount = installers.filter(item => {
    if ((item.status === "pending_approval" || item.status === "verified") && item.status !== "active" && item.status !== "approved") {
      if (!startDate && !endDate) return true;
      return isInDateRange(item.verified_at || item.created_at);
    }
    return false;
  }).length;

  const approvedCount = installers.filter(item => {
    if (item.status === "active" || item.status === "approved") {
      if (!startDate && !endDate) return true;
      return isInDateRange(item.approved_at || item.created_at);
    }
    return false;
  }).length;

  return (
    <div className="space-y-6 select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Installers</h1>
          <p className="text-xs text-slate-500">
            Monitor registration, designation and active status for installation field staff.
          </p>
        </div>

        {/* Floating Custom Date Range Picker */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-[8px] text-xs font-bold shadow-sm transition-all"
          >
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>
              {startDate || endDate
                ? `Date: ${startDate ? new Date(startDate).toLocaleDateString() : ""} - ${endDate ? new Date(endDate).toLocaleDateString() : ""}`
                : "Select Date Range"}
            </span>
          </button>

          {isDatePickerOpen && (
            <div className="absolute right-0 mt-2 z-50 bg-white border border-slate-200 rounded-[12px] shadow-xl p-4 w-64 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
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
      </div>

      {/* KPI summaries row with interactive filtering */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter("")}
          className={`bg-white border rounded-[12px] p-4 shadow-sm flex items-center gap-3.5 cursor-pointer hover:border-[#00B4D8] transition-all ${
            !statusFilter ? "border-[#00B4D8] bg-[#F0FAFE]/40 ring-2 ring-[#00B4D8]/20" : "border-slate-200"
          }`}
        >
          <div className="p-2.5 bg-[#F0FAFE] text-[#00B4D8] rounded-[8px]">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Total Registered</p>
            <p className="text-base font-extrabold text-slate-800">{registeredCount} Installer(s)</p>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("pending_verification")}
          className={`bg-white border rounded-[12px] p-4 shadow-sm flex items-center gap-3.5 cursor-pointer hover:border-amber-400 transition-all ${
            statusFilter === "pending_verification" ? "border-amber-400 bg-amber-50/40 ring-2 ring-amber-400/20" : "border-slate-200"
          }`}
        >
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-[8px]">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Stage 1: Pending RM</p>
            <p className="text-base font-extrabold text-slate-800">{pendingRmCount} Installer(s)</p>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("pending_approval")}
          className={`bg-white border rounded-[12px] p-4 shadow-sm flex items-center gap-3.5 cursor-pointer hover:border-sky-400 transition-all ${
            statusFilter === "pending_approval" || statusFilter === "verified" ? "border-sky-400 bg-sky-50/40 ring-2 ring-sky-400/20" : "border-slate-200"
          }`}
        >
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-[8px]">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Stage 2: Pending CH</p>
            <p className="text-base font-extrabold text-slate-800">{pendingChCount} Installer(s)</p>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("active")}
          className={`bg-white border rounded-[12px] p-4 shadow-sm flex items-center gap-3.5 cursor-pointer hover:border-emerald-400 transition-all ${
            statusFilter === "active" || statusFilter === "approved" ? "border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-400/20" : "border-slate-200"
          }`}
        >
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-[8px]">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Active Approved</p>
            <p className="text-base font-extrabold text-slate-800">{approvedCount} Installer(s)</p>
          </div>
        </div>
      </div>

      <DataTable allData={filtered}
        title="Installers Register"
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        searchPlaceholder="Search Installer ID or Name..."
        onSearch={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        filters={[
          {
            label: "Status",
            options: ["active", "approved", "pending_verification", "pending_approval", "rejected"],
            value: statusFilter,
            onChange: (val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }
          }
        ]}
        pagination={{
          current: currentPage,
          total: filtered.length,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
        actionButton={{
          label: "Add Installer",
          onClick: () => {
            setEditingUser(undefined);
            setIsModalOpen(true);
          }
        }}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        role="Installer"
        onSuccess={fetchInstallers}
        editingUser={editingUser}
      />

      {/* Installer Audit Log Details Modal */}
      {selectedInstaller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setSelectedInstaller(null)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-md border border-slate-100 rounded-[12px] shadow-2xl p-5 flex flex-col max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4 bg-slate-50/50 -m-5 p-5 rounded-t-[12px]">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Installer Credentials Audit Trail
                </h3>
                <p className="text-[9px] text-slate-700 font-bold mt-0.5">ID: #{selectedInstaller.installer_id}</p>
              </div>
              <button
                onClick={() => setSelectedInstaller(null)}
                className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-655 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50/50 border border-slate-100 rounded-[8px] p-3.5">
                <div>
                  <p className="text-[9px] font-extrabold text-slate-700 uppercase">First Name</p>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedInstaller.first_name}</p>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold text-slate-700 uppercase">Last Name</p>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedInstaller.last_name || "-"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold text-slate-700 uppercase">Contact Number</p>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedInstaller.contact || "-"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold text-slate-700 uppercase">CNIC (National ID)</p>
                  <p className="font-bold text-slate-900 mt-0.5">{getInstallerField(selectedInstaller, "cnic")}</p>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold text-slate-700 uppercase">City</p>
                  <p className="font-bold text-slate-900 mt-0.5">{getInstallerField(selectedInstaller, "city")}</p>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold text-slate-700 uppercase">State</p>
                  <p className="font-bold text-slate-900 mt-0.5">{getInstallerField(selectedInstaller, "state")}</p>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold text-slate-700 uppercase">Marital Status</p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {parseInstallerMetadata(selectedInstaller.designation).marital_status || "Single"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold text-slate-700 uppercase">EasyPaisa / JazzCash No.</p>
                  <p className="font-bold text-emerald-700 mt-0.5">
                    {parseInstallerMetadata(selectedInstaller.designation).easypaisa_jazzcash_no || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold text-slate-700 uppercase">Gmail / Email Address</p>
                  <p className="font-bold text-[#0077B6] mt-0.5">
                    {parseInstallerMetadata(selectedInstaller.designation).email || selectedInstaller.email || "-"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[9px] font-extrabold text-slate-700 uppercase">Street Address</p>
                  <p className="font-bold text-slate-900 mt-0.5">{getInstallerField(selectedInstaller, "address")}</p>
                </div>
              </div>

              {/* Audit Timeline */}
              <div className="border border-slate-100 rounded-[8px] p-3 bg-slate-50 space-y-3 mt-4">
                <p className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">Approval Progress Timeline</p>
                <div className="flex gap-2.5 items-start">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 text-[9px] font-bold">✓</span>
                  <div>
                    <p className="font-bold text-slate-800">Submitted Registration</p>
                    <p className="text-[10px] text-slate-800 font-bold">{selectedInstaller.created_at ? new Date(selectedInstaller.created_at).toLocaleString() : ""}</p>
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
                    <p className="font-bold text-slate-800">Stage 1: Retail Manager Verification</p>
                    {selectedInstaller.verified_at ? (
                      <p className="text-[10px] text-slate-800 font-bold">Verified by <span className="font-extrabold text-slate-900">{verifierName}</span> on {new Date(selectedInstaller.verified_at).toLocaleString()}</p>
                    ) : (
                      <p className="text-[10px] text-slate-700 font-bold">Awaiting credentials audit.</p>
                    )}
                    {selectedInstaller.verification_note && (
                      <p className="text-[10px] italic text-slate-800 font-bold mt-1 bg-white border border-slate-100 rounded p-1.5">
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
                    <p className="font-bold text-slate-800">Stage 2: Country Head Approval</p>
                    {selectedInstaller.approved_at ? (
                      <p className="text-[10px] text-slate-800 font-bold">
                        {selectedInstaller.status === "rejected" ? "Rejected" : "Approved"} by <span className="font-extrabold text-slate-900">{approverName}</span> on {new Date(selectedInstaller.approved_at).toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-700 font-bold">Awaiting final approval decision.</p>
                    )}
                    {selectedInstaller.approval_note && (
                      <p className="text-[10px] italic text-slate-800 font-bold mt-1 bg-white border border-slate-100 rounded p-1.5">
                        "{selectedInstaller.approval_note}"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer with Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-6">
                <div className="flex items-center gap-2">
                  {(selectedInstaller.status === "pending_verification" || selectedInstaller.status === "pending") && (
                    <button
                      onClick={() => handleVerifyInstaller(selectedInstaller.id)}
                      className="h-9 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-[6px] shadow transition-colors flex items-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Verify Credentials (Stage 1)
                    </button>
                  )}

                  {(selectedInstaller.status === "pending_approval" || selectedInstaller.status === "verified") && (
                    <button
                      onClick={() => handleApproveInstaller(selectedInstaller.id)}
                      className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] shadow transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approve & Activate (Stage 2)
                    </button>
                  )}

                  {selectedInstaller.status !== "active" && selectedInstaller.status !== "approved" && (
                    <button
                      onClick={() => handleRejectInstaller(selectedInstaller.id)}
                      className="h-9 px-3.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-[6px] border border-rose-200 transition-colors"
                    >
                      Reject
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSelectedInstaller(null)}
                  className="h-9 px-5 text-xs font-bold bg-[#00B4D8] hover:bg-[#0077B6] text-white rounded-[6px] shadow transition-colors"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
