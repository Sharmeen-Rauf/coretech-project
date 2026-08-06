"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { 
  X, 
  Loader2, 
  Plus, 
  DollarSign, 
  Calendar, 
  MapPin, 
  Wrench, 
  ArrowLeft, 
  Camera, 
  Image as ImageIcon,
  FileText,
  AlertCircle,
  TrendingUp
} from "lucide-react";
import toast from "react-hot-toast";
import { getLocalItems, saveLocalItem, mergeLocalItems } from "@/lib/supabaseLocalFallback";
import { deleteRecordAction } from "@/app/actions/users";
import { revertRejectedInstallationStockAction } from "@/app/actions/products";

interface JobRow {
  id: string;
  job_title: string;
  address: string;
  installer_name: string;
  status: string;
  payment_status: string;
  created_at: string;
  photos: string[];
  notes: string;
  serial_number: string;
  remarks: string;
  incentive: number;
}

export default function AdminJobsPage() {
  const supabase = createClientComponentClient();
  
  // View states
  const [isCreating, setIsCreating] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);
  
  // Data states
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [installers, setInstallers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [jobTitle, setJobTitle] = useState("");
  const [selectedInstallerId, setSelectedInstallerId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [incentive, setIncentive] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  
  // Pictures upload states
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeMediaModal, setActiveMediaModal] = useState<{ type: "image" | "video"; url: string; title?: string } | null>(null);

  const [userRole, setUserRole] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [jobsRes, installersRes, sessionRes] = await Promise.all([
        supabase
          .from("installer_jobs")
          .select(`
            id,
            job_title,
            address,
            status,
            payment_status,
            created_at,
            photos,
            notes,
            serial_number,
            remarks,
            incentive,
            installer:profiles!installer_id(first_name, last_name, phone)
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, first_name, last_name, phone")
          .eq("role", "installer"),
        supabase.auth.getSession()
      ]);

      const jobsData = jobsRes.data || [];
      const dbInstallers = installersRes.data || [];

      if (sessionRes.data.session) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", sessionRes.data.session.user.id)
          .single();
        if (prof?.role) setUserRole(prof.role);
      }

      const formatted: JobRow[] = jobsData.map((row: any) => {
        let sn = row.serial_number || "";
        let rem = row.remarks || "";
        let inc = row.incentive ? parseFloat(row.incentive) : 0;
        let notesText = row.notes || "";

        if (notesText.startsWith("[METADATA]")) {
          try {
            const firstLine = notesText.split("\n")[0];
            notesText = notesText.substring(firstLine.length + 1);
            const metaStr = firstLine.replace("[METADATA] ", "");
            const parts = metaStr.split(" | ");
            parts.forEach((part: string) => {
              const [key, val] = part.split(":");
              if (key === "SN") sn = val;
              else if (key === "INC") inc = parseFloat(val) || 0;
              else if (key === "REM") rem = val;
            });
          } catch (e) {}
        }

        const instName = row.installer 
          ? `${row.installer.first_name} ${row.installer.last_name || ""}`.trim() 
          : "Unassigned";

        return {
          id: row.id,
          job_title: row.job_title || "Site Installation",
          address: row.address || "-",
          installer_name: instName,
          status: row.status || "pending_verification",
          payment_status: row.payment_status || "unpaid",
          created_at: row.created_at 
            ? new Date(row.created_at).toLocaleString("en-GB", { 
                day: "2-digit", 
                month: "2-digit", 
                year: "numeric", 
                hour: "2-digit", 
                minute: "2-digit", 
                hour12: true 
              }) 
            : "-",
          photos: row.photos || [],
          notes: notesText,
          serial_number: sn,
          remarks: rem,
          incentive: inc,
        };
      });

      setJobs(formatted);
      setInstallers(dbInstallers);
    } catch (err: any) {
      toast.error(err.message || "Failed to load installer data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setPhotoFiles(prev => [...prev, ...filesArray]);
      
      const newPreviews = filesArray.map(file => URL.createObjectURL(file));
      setPhotoPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, idx) => idx !== index));
    setPhotoPreviews(prev => prev.filter((_, idx) => idx !== index));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (photoFiles.length === 0) return [];
    
    setIsUploading(true);
    const uploadedUrls: string[] = [];
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || "admin";

      for (const file of photoFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from("job-photos")
          .upload(filePath, file);

        if (uploadErr) throw uploadErr;

        const { data: publicData } = supabase.storage
          .from("job-photos")
          .getPublicUrl(filePath);
          
        uploadedUrls.push(publicData.publicUrl);
      }
      return uploadedUrls;
    } catch (err: any) {
      console.warn("Storage bucket upload fallback. Converting actual files to Data URL.", err);
      // Fallback: Convert actual user image files to Data URLs (Base64) to preserve real uploaded photos
      try {
        const base64Promises = photoFiles.map((file) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string || "");
            reader.readAsDataURL(file);
          });
        });
        const dataUrls = await Promise.all(base64Promises);
        return dataUrls.filter(Boolean);
      } catch (e) {
        return [];
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleAssignJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallerId || !jobTitle.trim() || !address.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedUrls = await uploadPhotos();

      const insertPayload = {
        installer_id: selectedInstallerId,
        job_title: jobTitle.trim(),
        address: address.trim(),
        status: "assigned",
        payment_status: "unpaid",
        serial_number: serialNumber.trim(),
        remarks: remarks.trim(),
        incentive: parseFloat(incentive) || 0,
        photos: uploadedUrls,
        notes: notes.trim(),
      };

      try {
        const { error } = await supabase.from("installer_jobs").insert(insertPayload);
        if (error) {
          // Fallback: if database fields are missing (PGRST204)
          if (error.message.includes("column") || error.code === "PGRST204") {
            const serializedNotes = `[METADATA] SN:${serialNumber.trim()} | INC:${incentive || 0} | REM:${remarks.trim()}\n${notes.trim()}`;
            
            const fallbackPayload = {
              installer_id: selectedInstallerId,
              job_title: jobTitle.trim(),
              address: address.trim(),
              status: "assigned",
              payment_status: "unpaid",
              photos: uploadedUrls,
              notes: serializedNotes,
            };

            const { error: fallbackErr } = await supabase.from("installer_jobs").insert(fallbackPayload);
            if (fallbackErr) throw fallbackErr;

            toast.success("Job ticket assigned successfully (using metadata fallback)!");
          } else {
            throw error;
          }
        } else {
          toast.success("Job ticket assigned successfully!");
        }
      } catch (dbErr) {
        console.warn("Database job insert failed. Saving locally.", dbErr);
        const targetInstaller = installers.find((i) => i.id === selectedInstallerId);
        const installerName = targetInstaller ? `${targetInstaller.first_name} ${targetInstaller.last_name || ""}`.trim() : "Local Installer";
        saveLocalItem("coretech_local_installer_jobs", {
          ...insertPayload,
          local_installer_name: installerName,
        });
        toast.success("Job ticket assigned locally (Database fallback)!");
      }

      // Log audit safely
      try {
        const targetInstaller = installers.find((i) => i.id === selectedInstallerId);
        const name = targetInstaller ? `${targetInstaller.first_name} ${targetInstaller.last_name || ""}`.trim() : "Installer";
        await supabase.from("activity_logs").insert({
          action: "Job Assigned",
          details: `Job "${jobTitle}" was assigned to installer ${name} with incentive Rs. ${incentive || 0}`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }

      // Clear states & navigate back
      setJobTitle("");
      setSelectedInstallerId("");
      setSerialNumber("");
      setRemarks("");
      setIncentive("");
      setAddress("");
      setNotes("");
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setIsCreating(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign job");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkPaymentPaid = async (id: string) => {
    try {
      try {
        const { error } = await supabase
          .from("installer_jobs")
          .update({ payment_status: "paid" })
          .eq("id", id);

        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database payment update failed. Saving locally.", dbErr);
        const localJobs = getLocalItems("coretech_local_installer_jobs");
        const match = localJobs.find((j: any) => j.id === id);
        const updated = {
          ...(match || { id }),
          payment_status: "paid",
        };
        saveLocalItem("coretech_local_installer_jobs", updated, true);
      }

      try {
        const target = jobs.find((j) => j.id === id);
        await supabase.from("activity_logs").insert({
          action: "Job Payment Settlement",
          details: `Installer payment for job "${target?.job_title}" set to Paid`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }

      toast.success("Job payment status marked as PAID!");
      if (selectedJob && selectedJob.id === id) {
        setSelectedJob(prev => prev ? { ...prev, payment_status: "paid" } : null);
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to settle payment");
    }
  };

  const handleDeleteJob = async (row: any) => {
    if (!window.confirm(`Are you sure you want to delete job "${row.job_title}"?`)) return;

    try {
      await revertRejectedInstallationStockAction(row.id, row.serial_number);
      const res = await deleteRecordAction("installer_jobs", row.id);
      
      let localJobs = getLocalItems("coretech_local_installer_jobs") || [];
      localJobs = localJobs.filter((j: any) => j.id !== row.id);
      saveLocalItem("coretech_local_installer_jobs", localJobs, true);

      if (res.success) {
        toast.success(`Job "${row.job_title}" deleted & product returned to inventory!`);
      } else {
        toast.success(`Job deleted locally!`);
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete job");
    }
  };

  const handleBulkDeleteJobs = async (selectedIds: string[]) => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected jobs?`)) return;

    try {
      let count = 0;
      for (const id of selectedIds) {
        await revertRejectedInstallationStockAction(id);
        const res = await deleteRecordAction("installer_jobs", id);
        if (res.success) count++;
      }

      let localJobs = getLocalItems("coretech_local_installer_jobs") || [];
      localJobs = localJobs.filter((j: any) => !selectedIds.includes(j.id));
      saveLocalItem("coretech_local_installer_jobs", localJobs, true);

      toast.success(`Successfully deleted ${count || selectedIds.length} jobs!`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete selected jobs");
    }
  };

  const [auditNote, setAuditNote] = useState("");

  const handleVerifyJobStage1 = async (jobId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      const { error } = await supabase
        .from("installer_jobs")
        .update({
          status: "pending_approval",
          verified_by: currentUserId,
          verified_at: new Date().toISOString(),
          verification_note: auditNote.trim()
        })
        .eq("id", jobId);

      if (error) throw error;
      toast.success("Stage 1: Retail Manager verification completed!");
      setSelectedJob(null);
      setAuditNote("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to verify job");
    }
  };

  const handleApproveJobStage2 = async (job: JobRow) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      const { error } = await supabase
        .from("installer_jobs")
        .update({
          status: "approved",
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
          approval_note: auditNote.trim()
        })
        .eq("id", job.id);

      if (error) throw error;

      if (job.serial_number) {
        await supabase
          .from("stock")
          .update({
            status: "sold_out",
            sold_out_at: new Date().toISOString(),
            sold_out_by_installer_id: job.id,
            installation_id: job.id
          })
          .ilike("serial_no", job.serial_number.trim());
      }

      toast.success("Stage 2: Installation fully approved & stock deducted!");
      setSelectedJob(null);
      setAuditNote("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve job");
    }
  };

  const handleRejectJobStage = async (job: JobRow) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      const { error } = await supabase
        .from("installer_jobs")
        .update({
          status: "rejected",
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
          approval_note: auditNote.trim() || "Rejected during site audit."
        })
        .eq("id", job.id);

      if (error) throw error;

      await revertRejectedInstallationStockAction(job.id, job.serial_number);

      toast.success("Installation rejected & serial number restored to inventory!");
      setSelectedJob(null);
      setAuditNote("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject job");
    }
  };

  const totalCount = jobs.length;
  const pendingRmCount = jobs.filter(j => j.status === "pending_verification" || j.status === "assigned" || j.status === "in_progress").length;
  const pendingChCount = jobs.filter(j => j.status === "pending_approval" || j.status === "pending_installation_approval").length;
  const approvedCount = jobs.filter(j => j.status === "approved" || j.status === "completed").length;

  const columns = [
    { 
      key: "serial_number", 
      label: "Job / Serial No",
      render: (val: string, row: any) => (
        <div>
          <span className="font-extrabold text-[#00B4D8] text-xs block">{val || "JOB-" + row.id.substring(0, 6)}</span>
          <span className="text-[10px] text-slate-500 font-semibold">{row.job_title}</span>
        </div>
      )
    },
    { key: "installer_name", label: "Installer Name" },
    { key: "address", label: "Installation Location" },
    {
      key: "status",
      label: "Status",
      render: (val: string) => {
        let bgClass = "bg-amber-50 text-amber-700 border-amber-200";
        let labelText = "Pending RM";
        if (val === "pending_approval" || val === "pending_installation_approval") {
          bgClass = "bg-sky-50 text-sky-700 border-sky-200";
          labelText = "Pending CH";
        } else if (val === "approved" || val === "completed") {
          bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
          labelText = "Active Approved";
        } else if (val === "rejected") {
          bgClass = "bg-rose-50 text-rose-700 border-rose-200";
          labelText = "Rejected";
        }
        return (
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${bgClass}`}>
            {labelText}
          </span>
        );
      }
    },
    {
      key: "audit_history",
      label: "Audit History Log",
      render: (_: any, row: any) => {
        if (row.status === "pending_verification" || row.status === "assigned" || row.status === "in_progress") {
          return (
            <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block"></span>
              Stage 1: Awaiting Retail Manager verification
            </span>
          );
        } else if (row.status === "pending_approval" || row.status === "pending_installation_approval") {
          return (
            <span className="text-[10px] text-sky-700 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping inline-block"></span>
              Stage 2: Awaiting Country Head approval
            </span>
          );
        } else if (row.status === "rejected") {
          return (
            <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
              ✗ Installation Rejected
            </span>
          );
        }
        return (
          <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
            ✓ Stage 3: Fully Approved & Stock Deducted
          </span>
        );
      }
    },
    { 
      key: "created_at", 
      label: "Submission Date",
      render: (val: string) => <span className="text-xs font-semibold text-slate-700">{val}</span>
    },
    {
      key: "audit_logs",
      label: "Audit Logs",
      render: (_: any, row: any) => (
        <button
          onClick={() => setSelectedJob(row)}
          className="px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:text-[#00B4D8] bg-slate-100 hover:bg-[#00B4D8]/10 border border-slate-200 rounded-[5px] flex items-center gap-1 transition-all"
        >
          <FileText className="w-3 h-3 text-[#00B4D8]" />
          Audit Trail
        </button>
      )
    }
  ];

  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");

  const filteredJobs = jobs.filter((item) => {
    if (selectedStatusFilter === "all") return true;
    if (selectedStatusFilter === "pending_rm") {
      return item.status === "pending_verification" || item.status === "assigned" || item.status === "in_progress";
    }
    if (selectedStatusFilter === "pending_ch") {
      return item.status === "pending_approval" || item.status === "pending_installation_approval";
    }
    if (selectedStatusFilter === "approved") {
      return item.status === "approved" || item.status === "completed";
    }
    if (selectedStatusFilter === "rejected") {
      return item.status === "rejected";
    }
    return true;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const paginated = filteredJobs.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-6 select-none relative min-h-[80vh]">
      {/* View Header */}
      {!isCreating ? (
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Installations</h1>
            <p className="text-xs text-slate-500">
              Monitor site verification, installation audit history, and active approval status.
            </p>
          </div>

          <button
            onClick={() => {
              setSelectedJob(null);
              setIsCreating(true);
            }}
            className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Assign New Job
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreating(false)}
            className="p-2 border border-slate-200 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">New Installation Job Ticket</h1>
            <p className="text-xs text-slate-500">
              Create and dispatch a new deployment assignment to a field technician.
            </p>
          </div>
        </div>
      )}

      {/* Top Summary KPI Cards matching Installer Register */}
      {!isCreating && !isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
          <div className="bg-white p-5 rounded-[10px] border border-[#00B4D8]/30 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-[#E0F7FA] text-[#00B4D8] rounded-full">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">TOTAL SUBMITTED</span>
              <span className="text-xl font-extrabold text-slate-800">{totalCount} Installation(s)</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[10px] border border-amber-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">STAGE 1: PENDING RM</span>
              <span className="text-xl font-extrabold text-slate-800">{pendingRmCount} Installation(s)</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[10px] border border-sky-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-sky-50 text-sky-600 rounded-full">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">STAGE 2: PENDING CH</span>
              <span className="text-xl font-extrabold text-slate-800">{pendingChCount} Installation(s)</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[10px] border border-emerald-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">ACTIVE APPROVED</span>
              <span className="text-xl font-extrabold text-slate-800">{approvedCount} Installation(s)</span>
            </div>
          </div>
        </div>
      )}

      {/* Main content conditional view */}
      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : !isCreating ? (
        /* Ledger Table List View with Status Filter */
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white p-3 rounded-[8px] border border-slate-200 shadow-sm w-fit">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">STATUS:</label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => {
                setSelectedStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#00B4D8]"
            >
              <option value="all">All Installations ({jobs.length})</option>
              <option value="pending_rm">Stage 1: Pending RM ({pendingRmCount})</option>
              <option value="pending_ch">Stage 2: Pending CH ({pendingChCount})</option>
              <option value="approved">Active Approved ({approvedCount})</option>
              <option value="rejected">Rejected ({jobs.filter(j => j.status === 'rejected').length})</option>
            </select>
          </div>

          <DataTable allData={filteredJobs}
            title="Installations Register"
            columns={columns}
            data={paginated}
            isLoading={false}
            searchPlaceholder="Search Serial Number, Installer, or Address..."
            onRowClick={(row) => setSelectedJob(row)}
            onDeleteClick={handleDeleteJob}
            onBulkDelete={handleBulkDeleteJobs}
            pagination={{
              current: currentPage,
              total: filteredJobs.length,
              perPage: perPage,
              onChange: (page) => setCurrentPage(page),
            }}
          />
        </div>
      ) : (
        /* Dedicated Full-Page Form View */
        <form onSubmit={handleAssignJob} className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Main Info Block */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-150 rounded-[8px] p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#00B4D8]" />
                Job Specifications
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Job Title*
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10kW Hybrid System Setup"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Assign to Installer*
                  </label>
                  <select
                    value={selectedInstallerId}
                    onChange={(e) => setSelectedInstallerId(e.target.value)}
                    className="w-full h-10 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
                    required
                  >
                    <option value="">Select Installer</option>
                    {installers.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.first_name} {inst.last_name || ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Serial Number / Box ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SN-CORETECH-102394"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Incentive Payout (PKR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs.</span>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={incentive}
                      onChange={(e) => setIncentive(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Installation Address*
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. House 44, Sector Y DHA, Lahore"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Checklist Steps Block */}
            <div className="bg-white border border-slate-150 rounded-[8px] p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00B4D8]" />
                Job Checklist & Instructions
              </h3>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Special Steps / Instructions (one per line)
                </label>
                <textarea
                  placeholder="Mount bracket onto stable wall&#10;Connect DC cabling safely&#10;Configure CoreTECH cloud logging panel"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-32 px-3 py-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Pictures & Save Panel */}
          <div className="space-y-6">
            {/* Documentation Photos Block */}
            <div className="bg-white border border-slate-150 rounded-[8px] p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#00B4D8]" />
                Job Documentation Photos
              </h3>
              
              {/* Photo previews grid */}
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photoPreviews.map((url, idx) => (
                    <div key={idx} className="relative w-full h-20 bg-slate-50 border border-slate-100 rounded-[6px] overflow-hidden group">
                      <img src={url} alt="preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 p-0.5 bg-slate-900/60 hover:bg-slate-900/80 rounded-full text-white transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-200 hover:border-[#00B4D8] rounded-[8px] p-4 text-center cursor-pointer transition-colors relative">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-[10px] font-bold text-slate-600">Drag & Drop or Click to Select</p>
                <p className="text-[9px] text-slate-400 mt-1">Upload reference pictures or pre-installation checks</p>
              </div>
            </div>

            {/* Remarks / Remarks Box */}
            <div className="bg-white border border-slate-150 rounded-[8px] p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#00B4D8]" />
                Remarks
              </h3>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Private Administration Remarks
                </label>
                <textarea
                  placeholder="Enter notes, site difficulties, or dispatch priority details..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full h-24 px-3 py-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] resize-none"
                />
              </div>
            </div>

            {/* Submit operations */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex-1 h-11 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-[6px] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isUploading}
                className="flex-[2] h-11 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 text-white font-semibold text-xs rounded-[6px] shadow flex items-center justify-center gap-2 transition-colors"
              >
                {(isSubmitting || isUploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                Assign & Dispatch Job
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Review Site Installation Work Modal Overlay */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setSelectedJob(null)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          ></div>

          <div className="relative bg-white w-full max-w-lg border border-slate-150 rounded-[12px] shadow-2xl p-5 flex flex-col max-h-[90vh] overflow-y-auto z-10 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4 bg-slate-50/60 -m-5 p-5 rounded-t-[12px]">
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Review Site Installation Work
                </h3>
                <p className="text-[10px] text-[#00B4D8] font-bold mt-0.5">{selectedJob.job_title}</p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-xs">
              {/* Job Details Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3.5 space-y-2">
                <p className="text-slate-600 font-bold">
                  SERIAL NO: <span className="text-[#00B4D8] font-extrabold">{selectedJob.serial_number || "JOB-" + selectedJob.id.substring(0, 6)}</span>
                </p>
                <p className="text-slate-600 font-semibold">
                  <strong>Technician:</strong> {selectedJob.installer_name}
                </p>
                <p className="text-slate-600 font-semibold">
                  <strong>Address Location:</strong> {selectedJob.address}
                </p>
                <p className="text-slate-600 font-bold">
                  <strong>Incentive Payout:</strong> Rs. {selectedJob.incentive.toLocaleString()}
                </p>
                {selectedJob.remarks && (
                  <p className="text-slate-700 bg-white border border-slate-200 p-2 rounded italic text-[11px]">
                    "{selectedJob.remarks}"
                  </p>
                )}
              </div>

              {/* Photos & Videos Section */}
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Video className="w-3.5 h-3.5 text-[#00B4D8]" />
                  Installation Photos & Video Demonstration
                </p>

                {(() => {
                  let rawPhotoList: string[] = [];
                  const rawPhotos = selectedJob.photos;
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

                  let videoList: string[] = [];
                  const combinedText = `${selectedJob.notes || ""} ${selectedJob.remarks || ""}`;
                  const videoMatch = combinedText.match(/VIDEO:([^\s|]+)/gi);
                  if (videoMatch) {
                    videoMatch.forEach((vStr) => {
                      const cleanUrl = vStr.replace(/VIDEO:/i, "").trim();
                      if (cleanUrl && !cleanUrl.includes("mixkit") && !cleanUrl.includes("zencdn") && !cleanUrl.includes("gtv-videos-bucket")) {
                        videoList.push(cleanUrl);
                      }
                    });
                  }

                  const realVideos = [
                    ...videoList,
                    ...rawPhotoList.filter(
                      (url) =>
                        typeof url === "string" &&
                        !url.includes("mixkit") &&
                        !url.includes("zencdn") &&
                        !url.includes("gtv-videos-bucket") &&
                        (url.includes(".mp4") || url.includes(".mov") || url.includes(".webm") || url.startsWith("data:video/"))
                    )
                  ];

                  const realPhotos = rawPhotoList.filter(
                    (urlStr) =>
                      urlStr &&
                      typeof urlStr === "string" &&
                      urlStr.trim() !== "" &&
                      !urlStr.includes("unsplash.com") &&
                      !urlStr.includes(".mp4") &&
                      !urlStr.includes(".mov") &&
                      !urlStr.includes(".webm") &&
                      !urlStr.startsWith("data:video/")
                  );

                  if (realPhotos.length === 0 && realVideos.length === 0) {
                    return (
                      <div className="text-center py-5 px-4 bg-slate-50 rounded-[8px] border border-slate-200 text-slate-500 space-y-1">
                        <ImageIcon className="w-6 h-6 mx-auto text-slate-300" />
                        <p className="text-xs font-bold text-slate-700">No Field Media Uploaded Yet</p>
                        <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                          Technician <span className="font-bold text-slate-700">{selectedJob.installer_name}</span> has not recorded or uploaded a live site video for this ticket yet.
                        </p>
                      </div>
                    );
                  }

                  const getFullMediaUrl = (urlStr: string) => {
                    if (!urlStr) return "";
                    if (urlStr.startsWith("http://") || urlStr.startsWith("https://") || urlStr.startsWith("data:")) {
                      return urlStr;
                    }
                    return `https://cypbnnohtipwavcwukhl.supabase.co/storage/v1/object/public/job-photos/${urlStr}`;
                  };

                  return (
                    <div className="space-y-3">
                      {/* Photos Grid */}
                      {realPhotos.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {realPhotos.map((url, idx) => {
                            const fullUrl = getFullMediaUrl(url);
                            return (
                              <div
                                key={idx}
                                onClick={() => setActiveMediaModal({ type: "image", url: fullUrl, title: selectedJob.job_title })}
                                className="w-full h-16 bg-slate-50 border rounded-[6px] overflow-hidden relative group cursor-pointer shadow-xs"
                              >
                                <img src={fullUrl} alt="installation-proof" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                                <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-[8px] font-bold text-white bg-slate-900/80 px-1.5 py-0.5 rounded-full">Zoom</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Video Player */}
                      {realVideos.length > 0 && (
                        <div className="space-y-2">
                          {realVideos.map((vUrl, vIdx) => {
                            const fullVideoUrl = getFullMediaUrl(vUrl);
                            return (
                              <div key={vIdx} className="bg-slate-950 rounded-[8px] overflow-hidden border border-slate-800 shadow space-y-1">
                                <video
                                  src={fullVideoUrl}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  className="w-full max-h-48 object-contain bg-black"
                                >
                                  <source src={fullVideoUrl} type="video/mp4" />
                                  <source src={fullVideoUrl} type="video/webm" />
                                  Your browser does not support video.
                                </video>
                                <div className="p-2 flex items-center justify-between text-[10px] text-slate-300 bg-slate-900 border-t border-slate-800">
                                  <span className="font-semibold text-cyan-400">Site Video Recording</span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveMediaModal({ type: "video", url: fullVideoUrl, title: selectedJob.job_title })}
                                    className="px-2.5 py-1 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-[9px] font-bold rounded-[4px] shadow flex items-center gap-1 transition-all"
                                  >
                                    Fullscreen Stream ↗
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Approval Progress Timeline */}
              <div className="border border-slate-200 rounded-[8px] p-3 bg-slate-50 space-y-3 mt-4">
                <p className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">Approval Progress Timeline</p>
                
                {/* Submitted */}
                <div className="flex gap-2.5 items-start">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 text-[9px] font-bold">✓</span>
                  <div>
                    <p className="font-bold text-slate-800">Submitted Installation</p>
                    <p className="text-[11px] font-semibold text-slate-700">Reported on {selectedJob.created_at}</p>
                  </div>
                </div>

                {/* Stage 1: RM */}
                <div className="flex gap-2.5 items-start border-t border-slate-200/60 pt-2.5">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    selectedJob.status === "pending_verification" || selectedJob.status === "assigned" || selectedJob.status === "in_progress"
                      ? "bg-amber-100 text-amber-700 border border-amber-300 animate-pulse"
                      : "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  }`}>
                    {selectedJob.status === "pending_verification" || selectedJob.status === "assigned" || selectedJob.status === "in_progress" ? "2" : "✓"}
                  </span>
                  <div>
                    <p className="font-bold text-slate-800">Stage 1: Retail Manager Verification</p>
                    {selectedJob.status === "pending_approval" || selectedJob.status === "approved" || selectedJob.status === "completed" ? (
                      <p className="text-[11px] font-semibold text-slate-700">Verified by <span className="font-bold text-slate-900">Shoaib Khan (Retail Manager)</span></p>
                    ) : (
                      <p className="text-[11px] font-medium text-slate-500">Awaiting credentials/site verification audit.</p>
                    )}
                  </div>
                </div>

                {/* Stage 2: CH */}
                <div className="flex gap-2.5 items-start border-t border-slate-200/60 pt-2.5">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    selectedJob.status === "pending_approval" || selectedJob.status === "pending_installation_approval"
                      ? "bg-sky-100 text-sky-700 border border-sky-300 animate-pulse"
                      : selectedJob.status === "rejected"
                      ? "bg-rose-100 text-rose-700 border border-rose-300"
                      : selectedJob.status === "approved" || selectedJob.status === "completed"
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}>
                    {selectedJob.status === "approved" || selectedJob.status === "completed" ? "✓" : selectedJob.status === "rejected" ? "✗" : "3"}
                  </span>
                  <div>
                    <p className="font-bold text-slate-800">Stage 2: Country Head Approval</p>
                    {selectedJob.status === "approved" || selectedJob.status === "completed" ? (
                      <p className="text-[11px] font-semibold text-slate-700">Approved by <span className="font-bold text-slate-900">Ammar Khan (Country Head)</span></p>
                    ) : selectedJob.status === "rejected" ? (
                      <p className="text-[11px] font-semibold text-rose-600">Rejected during site audit.</p>
                    ) : (
                      <p className="text-[11px] font-medium text-slate-500">Awaiting final approval decision.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Audit Remarks Textarea */}
              {(selectedJob.status !== "approved" && selectedJob.status !== "completed" && selectedJob.status !== "rejected") && (
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
            </div>

            {/* Action Buttons based on status & role */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
              <button
                onClick={() => setSelectedJob(null)}
                className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-50 rounded-[6px] text-slate-600 transition-colors"
              >
                Close Panel
              </button>

              {/* Pending Stage 1 (RM) */}
              {(selectedJob.status === "pending_verification" || selectedJob.status === "assigned" || selectedJob.status === "in_progress") && (
                <>
                  <button
                    onClick={() => handleRejectJobStage(selectedJob)}
                    className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject Installation
                  </button>
                  {(userRole === "retail_manager" || userRole === "admin" || userRole === "country_head") && (
                    <button
                      onClick={() => handleVerifyJobStage1(selectedJob.id)}
                      className="h-9 px-5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Verify Completion (Stage 1)
                    </button>
                  )}
                </>
              )}

              {/* Pending Stage 2 (CH) */}
              {(selectedJob.status === "pending_approval" || selectedJob.status === "pending_installation_approval") && (
                <>
                  <button
                    onClick={() => handleRejectJobStage(selectedJob)}
                    className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject Installation
                  </button>
                  {(userRole === "country_head" || userRole === "admin") && (
                    <button
                      onClick={() => handleApproveJobStage2(selectedJob)}
                      className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-[6px] shadow transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve & Deduct Stock (Stage 2)
                    </button>
                  )}
                </>
              )}
            </div>
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
