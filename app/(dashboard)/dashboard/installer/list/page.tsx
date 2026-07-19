"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import UserModal from "@/components/UserModal";
import toast from "react-hot-toast";
import { deleteUserAction, updateRecordAction } from "@/app/actions/users";
import { getLocalItems } from "@/lib/supabaseLocalFallback";
import { Clock, Check, X, Eye, UserCheck } from "lucide-react";

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
  const perPage = 10;

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

  const fetchUserLookup = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name");
      if (data) {
        const lookup: Record<string, string> = {};
        data.forEach((u) => {
          lookup[u.id] = `${u.first_name} ${u.last_name || ""}`.trim();
        });
        setUserLookup(lookup);
      }
    } catch (e) {
      console.warn("Failed to fetch user lookup:", e);
    }
  };

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
        installer_id: prof.id.substring(0, 8).toUpperCase(), // readable installer ID prefix
        installer_name: `${prof.first_name} ${prof.last_name || ""}`.trim(),
      }));

      // Merge local storage profiles fallback
      const localProfiles = getLocalItems("profiles") || [];
      const localInstallers = localProfiles.filter((p: any) => p.role === "installer");

      const merged = [...formatted];
      localInstallers.forEach((local) => {
        if (!merged.some(db => db.id === local.id)) {
          merged.push({
            ...local,
            installer_id: local.id.substring(0, 8).toUpperCase(),
            installer_name: `${local.first_name} ${local.last_name || ""}`.trim(),
          });
        }
      });

      setInstallers(merged);
    } catch (err: any) {
      toast.error(err.message || "Failed to load installers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserLookup();
    fetchInstallers();
  }, []);

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

      toast.success("Installer approved successfully!");
      fetchInstallers();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve installer");
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
    if (statusFilter && item.status !== statusFilter) {
      return false;
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
    let clean = metadataStr;
    if (clean.includes("INSTALLER_METADATA")) {
      clean = clean.replace("[DISTRIBUTOR_METADATA]", "");
      try {
        const outer = JSON.parse(clean);
        const inner = outer.designation || "";
        if (inner.startsWith("[INSTALLER_METADATA]")) {
          return JSON.parse(inner.replace("[INSTALLER_METADATA]", ""));
        }
        return outer;
      } catch (e) {
        return {};
      }
    }
    if (clean.startsWith("[DISTRIBUTOR_METADATA]")) {
      try {
        return JSON.parse(clean.replace("[DISTRIBUTOR_METADATA]", ""));
      } catch (e) {
        return {};
      }
    }
    return { designation: metadataStr };
  };

  const getInstallerField = (installer: any, fieldKey: string) => {
    if (!installer) return "-";
    const meta = parseInstallerMetadata(installer.designation);
    if (meta[fieldKey]) return meta[fieldKey];
    if (installer[fieldKey]) return installer[fieldKey];
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
              ✓ Verified by <strong className="text-slate-700">{verifier}</strong>
              <span className="text-slate-400 block text-[9px] mt-0.5">
                Stage 2: Awaiting Country Head final decision
              </span>
            </span>
          );
        }

        if (row.status === "approved" || row.status === "active") {
          return (
            <span className="text-[10px] text-emerald-600 font-semibold">
              ✓ Stage 1: Verified by <strong className="text-slate-700">{verifier || "RM"}</strong>
              <span className="text-emerald-700 block text-[9px] mt-0.5">
                ✓ Stage 2: Approved by <strong className="text-slate-700">{approver || "CH"}</strong>
              </span>
            </span>
          );
        }

        if (row.status === "rejected") {
          return (
            <span className="text-[10px] text-rose-600 font-semibold">
              ✗ Rejected by <strong className="text-slate-700">{approver || verifier || "Auditor"}</strong>
              {(row.approval_note || row.verification_note) && (
                <span className="text-slate-500 block text-[9px] truncate max-w-xs mt-0.5 italic">
                  "{row.approval_note || row.verification_note}"
                </span>
              )}
            </span>
          );
        }

        return <span className="text-[10px] text-slate-400 italic">No history</span>;
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

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Installers</h1>
        <p className="text-xs text-slate-500">
          Monitor registration, designation and active status for installation field staff.
        </p>
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
            options: ["approved", "pending_verification", "pending_approval", "rejected"],
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
                <p className="text-[9px] text-slate-400 mt-0.5">ID: #{selectedInstaller.installer_id}</p>
              </div>
              <button
                onClick={() => setSelectedInstaller(null)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-655 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50/50 border border-slate-100 rounded-[8px] p-3.5">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">First Name</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedInstaller.first_name}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Last Name</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedInstaller.last_name || "-"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Contact Number</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedInstaller.contact || "-"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">CNIC (National ID)</p>
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
                    {parseInstallerMetadata(selectedInstaller.designation).email || selectedInstaller.email || "-"}
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
                    <p className="text-[10px] text-slate-550">{selectedInstaller.created_at ? new Date(selectedInstaller.created_at).toLocaleString() : ""}</p>
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
                      : selectedInstaller.status === "approved"
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}>
                    {selectedInstaller.status === "approved" ? "✓" : selectedInstaller.status === "rejected" ? "✗" : "3"}
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

              {/* Footer */}
              <div className="flex items-center justify-end pt-4 border-t border-slate-100 mt-6">
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
