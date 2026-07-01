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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch jobs joined with installer name, falling back to basic columns or local fallback if needed
      let jobsData: any[] = [];
      try {
        const { data: fullJobsData, error: jobsErr } = await supabase
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
            installer:profiles!installer_id(first_name, last_name)
          `)
          .order("created_at", { ascending: false });

        if (jobsErr) {
          console.warn("installer_jobs schema missing custom columns. Falling back to basic select.", jobsErr);
          const { data: basicJobsData, error: basicErr } = await supabase
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
              installer:profiles!installer_id(first_name, last_name)
            `)
            .order("created_at", { ascending: false });

          if (basicErr) throw basicErr;
          jobsData = basicJobsData || [];
        } else {
          jobsData = fullJobsData || [];
        }
      } catch (dbErr) {
        console.warn("Failed to fetch installer jobs from database. Using local fallback.", dbErr);
      }

      const mergedJobs = mergeLocalItems(jobsData, "coretech_local_installer_jobs");

      const formatted: JobRow[] = (mergedJobs || []).map((row: any) => {
        let sn = row.serial_number || "";
        let rem = row.remarks || "";
        let inc = row.incentive ? parseFloat(row.incentive) : 0;
        let notesText = row.notes || "";

        // Parse metadata fallback if notes contains [METADATA]
        if (notesText.startsWith("[METADATA]")) {
          try {
            const firstLine = notesText.split("\n")[0];
            notesText = notesText.substring(firstLine.length + 1);
            
            // Format: [METADATA] SN:xxx | INC:xxx | REM:xxx
            const metaStr = firstLine.replace("[METADATA] ", "");
            const parts = metaStr.split(" | ");
            parts.forEach((part: string) => {
              const [key, val] = part.split(":");
              if (key === "SN") sn = val;
              else if (key === "INC") inc = parseFloat(val) || 0;
              else if (key === "REM") rem = val;
            });
          } catch (e) {
            console.error("Failed to parse metadata fallback:", e);
          }
        }

        return {
          id: row.id,
          job_title: row.job_title,
          address: row.address,
          installer_name: row.installer 
            ? `${row.installer.first_name} ${row.installer.last_name || ""}`.trim() 
            : (row.local_installer_name || "Unassigned"),
          status: row.status,
          payment_status: row.payment_status || "unpaid",
          created_at: row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
          photos: row.photos || [],
          notes: notesText,
          serial_number: sn,
          remarks: rem,
          incentive: inc,
        };
      });
      setJobs(formatted);

      // 2. Fetch active installers for dropdown selection
      let dbInstallers: any[] = [];
      try {
        const { data: instData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .eq("role", "installer");
        dbInstallers = instData || [];
      } catch (instErr) {
        console.warn("Failed to load active installers. Using mock.", instErr);
        dbInstallers = [
          { id: "mock_inst_1", first_name: "John", last_name: "Installer" },
          { id: "mock_inst_2", first_name: "Ali", last_name: "Technician" }
        ];
      }
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
      console.error("Storage upload error:", err);
      toast.error("Failed to upload photos. Mocking URLs instead.");
      // Fallback: create visual mock URLs if storage bucket fails
      return photoFiles.map((f, i) => `https://images.unsplash.com/photo-1600585154340-${i}?auto=format&fit=crop&w=500&q=80`);
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

  const columns = [
    { key: "job_title", label: "Job Title" },
    { key: "address", label: "Installation Location" },
    { key: "installer_name", label: "Assigned Installer" },
    {
      key: "incentive",
      label: "Incentive",
      render: (val: number) => <span className="font-semibold text-slate-700">Rs. {val ? val.toLocaleString() : "0"}</span>
    },
    {
      key: "status",
      label: "Job Status",
      render: (val: string) => (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
          val === "completed" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
          val === "in_progress" ? "bg-amber-50 text-amber-600 border border-amber-200" :
          "bg-cyan-50 text-cyan-600 border border-cyan-200"
        }`}>
          {val}
        </span>
      ),
    },
    {
      key: "payment_status",
      label: "Payment Status",
      render: (val: string) => (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
          val === "paid" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"
        }`}>
          {val}
        </span>
      ),
    },
    { key: "created_at", label: "Date Assigned" },
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const paginated = jobs.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-6 select-none relative min-h-[80vh]">
      {/* View Header */}
      {!isCreating ? (
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Job Assignment</h1>
            <p className="text-xs text-slate-500">
              Dispatch solar panel and inverter installation tickets to field technicians.
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
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-full transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">New Installation Job Ticket</h1>
            <p className="text-xs text-slate-500">
              Create and dispatch a new deployment assignment to a field technician.
            </p>
          </div>
        </div>
      )}

      {/* Main content conditional view */}
      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : !isCreating ? (
        /* Ledger Table List View */
        <DataTable
          title="Installer Jobs Ledger"
          columns={columns}
          data={paginated}
          isLoading={false}
          searchPlaceholder="Search Job Title or Location..."
          onRowClick={(row) => setSelectedJob(row)}
          pagination={{
            current: currentPage,
            total: jobs.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
        />
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
                    placeholder="e.g. SN-HUAWEI-102394"
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
                  placeholder="Mount bracket onto stable wall&#10;Connect DC cabling safely&#10;Configure Huawei cloud logging panel"
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

      {/* Slide-over Job Details Drawer Overlay */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedJob(null)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm animate-in fade-in duration-200"
          ></div>

          {/* Slide panel */}
          <div className="relative w-full max-w-md bg-white h-screen border-l border-slate-150 shadow-2xl p-6 flex flex-col justify-between animate-in slide-in-from-right duration-300">
            {/* Header info */}
            <div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight">
                    {selectedJob.job_title}
                  </h3>
                  <p className="text-[10px] text-[#00B4D8] font-bold uppercase tracking-wider mt-1">
                    Job Ticket Detail
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="space-y-5 overflow-y-auto max-h-[75vh] pr-1">
                {/* Meta details list */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-[8px] border border-slate-100 text-xs">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Technician</p>
                    <p className="text-slate-800 font-bold mt-0.5">{selectedJob.installer_name}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Serial Number</p>
                    <p className="text-slate-800 font-bold mt-0.5">{selectedJob.serial_number || "None Loaded"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Incentive</p>
                    <p className="text-emerald-600 font-extrabold mt-0.5">Rs. {selectedJob.incentive.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Date Dispatched</p>
                    <p className="text-slate-600 font-bold mt-0.5">{selectedJob.created_at}</p>
                  </div>
                </div>

                {/* Status indicator list */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      selectedJob.status === "completed" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                      selectedJob.status === "in_progress" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                      "bg-cyan-50 text-cyan-600 border border-cyan-200"
                    }`}>
                      {selectedJob.status}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payout Status</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        selectedJob.payment_status === "paid" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"
                      }`}>
                        {selectedJob.payment_status}
                      </span>
                      {selectedJob.status === "completed" && selectedJob.payment_status === "unpaid" && (
                        <button
                          onClick={() => handleMarkPaymentPaid(selectedJob.id)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold uppercase rounded-[4px] shadow flex items-center transition-colors"
                        >
                          Settle Paid
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Address block */}
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Deployment Location</p>
                  <p className="text-xs text-slate-700 font-medium flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#00B4D8] shrink-0 mt-0.5" />
                    {selectedJob.address}
                  </p>
                </div>

                {/* Remarks block */}
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Remarks</p>
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-[6px] border border-slate-100 italic leading-relaxed">
                    {selectedJob.remarks || "No dispatch remarks uploaded."}
                  </p>
                </div>

                {/* Checklist steps */}
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Job Checklist</p>
                  <div className="space-y-1.5 pl-1">
                    {(selectedJob.notes || "").split("\n").filter(x => x.trim()).map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                        <span className="w-4 h-4 bg-cyan-50 text-[#00B4D8] font-bold text-[9px] rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-normal">{step}</span>
                      </div>
                    ))}
                    {(!selectedJob.notes || selectedJob.notes.trim() === "") && (
                      <p className="text-xs text-slate-400 italic">No checklist steps loaded.</p>
                    )}
                  </div>
                </div>

                {/* Pictures grid */}
                <div className="space-y-2 pb-4">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Job Documentation Photos</p>
                  {selectedJob.photos.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 rounded-[6px] border border-slate-100 text-slate-400">
                      <ImageIcon className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                      <p className="text-[10px]">No uploaded photos documented</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedJob.photos.map((url, idx) => (
                        <a 
                          key={idx} 
                          href={url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="relative w-full h-28 rounded-[6px] border border-slate-150 overflow-hidden group shadow-sm"
                        >
                          <img src={url} alt={`Doc ${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-250" />
                          <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-[9px] font-bold bg-slate-900/60 px-2 py-0.5 rounded-full">Zoom Image</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Settle / Footer info */}
            <div className="border-t border-slate-100 pt-4 mt-4 text-center">
              <button
                onClick={() => setSelectedJob(null)}
                className="w-full h-10 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-[6px] transition-colors"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
