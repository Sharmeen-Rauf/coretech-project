"use client";
 
import React, { useEffect, useState, useRef } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import { 
  LogOut, 
  Wrench, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Loader2, 
  MapPin, 
  DollarSign, 
  Check, 
  Camera, 
  X, 
  CheckSquare, 
  Square,
  Upload
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import StatusBadge from "@/components/StatusBadge";
import { getLocalItems, saveLocalItem } from "@/lib/supabaseLocalFallback";
 
export default function WebInstallerPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [installerName, setInstallerName] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  
  // Job Completion Modal Form States
  const [serialNo, setSerialNo] = useState("");
  const [completionRemarks, setCompletionRemarks] = useState("");
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
 
  const fetchInstallerData = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
 
      // Fetch profile details
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", session.user.id)
          .single();
 
        if (profile) {
          setInstallerName(`${profile.first_name} ${profile.last_name || ""}`.trim());
        }
      } catch (profErr) {
        console.warn("Failed to get profile name. Defaulting.", profErr);
        setInstallerName("Installer");
      }
 
      // Fetch jobs
      let jobsList: any[] = [];
      try {
        const { data: jobsData, error } = await supabase
          .from("installer_jobs")
          .select("*")
          .eq("installer_id", session.user.id)
          .order("created_at", { ascending: false });
 
        if (error) throw error;
        jobsList = jobsData || [];
      } catch (err: any) {
        console.warn("Failed to fetch installer jobs from database. Checking local storage fallback.", err);
      }
 
      const localJobs = getLocalItems("coretech_local_installer_jobs");
      const filteredLocal = localJobs.filter((j: any) => j.installer_id === session.user.id);
 
      // Merge
      const merged = [...jobsList];
      filteredLocal.forEach((local) => {
        const exists = jobsList.some((db) => db.id === local.id);
        if (!exists) {
          merged.push(local);
        }
      });
 
      setJobs(merged);
    } catch (err: any) {
      toast.error("Failed to load installer dashboard");
    } finally {
      setIsLoading(false);
    }
  };
 
  useEffect(() => {
    fetchInstallerData();
  }, [supabase, router]);
 
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };
 
  // Handle photo selection
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
 
  // Parse instructions from notes
  const getJobInstructions = (jobNotes?: string) => {
    if (!jobNotes) return [];
    const lines = jobNotes.split("\n");
    // Filter out [METADATA] line if present
    return lines
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith("[METADATA]"));
  };
 
  const openJobSubmit = (job: any) => {
    setSelectedJob(job);
    setSerialNo(job.serial_number || "");
    setCompletionRemarks(job.remarks || "");
    setPhotoPreviews(job.photos || []);
    setPhotoFiles([]);
    
    // Initialize checked steps
    const steps = getJobInstructions(job.notes);
    const initialChecked: Record<number, boolean> = {};
    steps.forEach((_, idx) => {
      initialChecked[idx] = job.status === "completed";
    });
    setCheckedSteps(initialChecked);
  };
 
  const toggleStep = (idx: number) => {
    if (selectedJob.status === "completed") return; // Read-only once completed
    setCheckedSteps(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };
 
  const handleSubmitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedJob.status === "completed") return;
 
    setIsSubmittingJob(true);
    try {
      // Simulate photo uploads if there are new files
      const uploadedUrls = [...photoPreviews];
      if (photoFiles.length > 0) {
        photoFiles.forEach((_, i) => {
          uploadedUrls.push(`https://images.unsplash.com/photo-1600585154340-${i}?auto=format&fit=crop&w=500&q=80`);
        });
      }
 
      const updates = {
        status: "completed",
        serial_number: serialNo.trim(),
        remarks: completionRemarks.trim(),
        photos: uploadedUrls,
      };
 
      try {
        const { error } = await supabase
          .from("installer_jobs")
          .update(updates)
          .eq("id", selectedJob.id);
        
        if (error) throw error;
        toast.success("Job details verified and submitted successfully!");
      } catch (dbErr) {
        console.warn("Database job update failed. Saving locally.", dbErr);
        saveLocalItem("coretech_local_installer_jobs", { ...selectedJob, ...updates }, true);
        toast.success("Job details submitted locally (Database fallback)!");
      }
 
      // Safe audit logging
      try {
        await supabase.from("activity_logs").insert({
          action: "Job Completed",
          details: `Installer ${installerName} completed job "${selectedJob.job_title}" (Serial: ${updates.serial_number})`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }
 
      setSelectedJob(null);
      fetchInstallerData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit job documentation");
    } finally {
      setIsSubmittingJob(false);
    }
  };
 
  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const pendingCount = jobs.filter((j) => j.status !== "completed").length;
 
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center select-none font-sans p-4 relative">
      {/* Mobile-first Header container */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[12px] p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0077B6] to-[#00B4D8] flex items-center justify-center text-white font-extrabold text-sm shadow">
              CT
            </div>
            <span className="text-base font-bold text-slate-800 tracking-tight">
              Core<span className="text-[#00B4D8]">TECH</span>
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
 
        <div>
          <h2 className="text-lg font-bold text-slate-800">Hi, {installerName || "Installer"}</h2>
          <p className="text-xs text-slate-500">Welcome to your mobile-first installer panel.</p>
        </div>
 
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-[8px] border border-slate-100 text-center">
          <div>
            <p className="text-[#00B4D8] text-base font-bold">{jobs.length}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
          </div>
          <div className="border-x border-slate-200">
            <p className="text-emerald-600 text-base font-bold">{completedCount}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Completed</p>
          </div>
          <div>
            <p className="text-amber-500 text-base font-bold">{pendingCount}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pending</p>
          </div>
        </div>
      </div>
 
      {/* Jobs list */}
      <div className="w-full max-w-md mt-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
          Active Jobs List
        </h3>
 
        {isLoading ? (
          <div className="bg-white rounded-[12px] p-8 border border-slate-150 flex justify-center shadow-sm">
            <Loader2 className="w-6 h-6 text-[#00B4D8] animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-[12px] p-8 border border-slate-150 text-center space-y-2 shadow-sm">
            <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No jobs assigned</p>
            <p className="text-[10px] text-slate-500">Contact admin to receive job tickets.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => openJobSubmit(job)}
              className="bg-white border border-slate-200 hover:border-[#00B4D8] rounded-[12px] p-4 flex flex-col justify-between shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 leading-tight">
                    {job.job_title}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{job.address}</p>
                </div>
                <StatusBadge status={job.status} />
              </div>
 
              <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 font-bold border-t border-slate-50 pt-3">
                <span className="capitalize text-slate-500">Payment: <span className={job.payment_status === "paid" ? "text-emerald-600" : "text-amber-600"}>{job.payment_status}</span></span>
                <span>{job.created_at ? new Date(job.created_at).toLocaleDateString() : ""}</span>
              </div>
            </div>
          ))
        )}
      </div>
 
      {/* Interactive Job detail modal sheet */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setSelectedJob(null)} 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
          ></div>
          
          <div className="relative bg-white w-full max-w-md border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">{selectedJob.job_title}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">Job Verification Form</p>
              </div>
              <button 
                onClick={() => setSelectedJob(null)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
 
            {/* Location & Incentive Details */}
            <div className="bg-slate-50 border border-slate-100 rounded-[8px] p-3 space-y-2 mb-4 text-xs">
              <div className="flex items-start gap-1.5 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-[#00B4D8] shrink-0 mt-0.5" />
                <span>{selectedJob.address}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 pt-1 border-t border-slate-200/60">
                <span className="flex items-center text-emerald-600"><DollarSign className="w-3 h-3" /> Incentive: Rs. {Number(selectedJob.incentive || 0).toLocaleString()}</span>
                <span className="capitalize">Payout: {selectedJob.payment_status}</span>
              </div>
            </div>
 
            <form onSubmit={handleSubmitJob} className="space-y-4">
              {/* Step-by-Step checklist details */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Installation Steps Checklist
                </label>
                <div className="space-y-2">
                  {getJobInstructions(selectedJob.notes).map((step, idx) => {
                    const isChecked = checkedSteps[idx] || false;
                    return (
                      <div 
                        key={idx}
                        onClick={() => toggleStep(idx)}
                        className={`flex items-start gap-2.5 p-2 rounded-[6px] border text-xs cursor-pointer select-none transition-colors ${
                          isChecked 
                            ? "bg-emerald-50/50 border-emerald-100 text-slate-700" 
                            : "bg-white border-slate-150 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        )}
                        <span className={isChecked ? "line-through text-slate-400" : ""}>{step}</span>
                      </div>
                    );
                  })}
                  {getJobInstructions(selectedJob.notes).length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-2 bg-slate-50 rounded">No step-by-step instructions loaded.</p>
                  )}
                </div>
              </div>
 
              {/* Box ID / Serial Number */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Box Serial Number / Inverter ID*
                </label>
                <input
                  type="text"
                  placeholder="e.g. SN-HUAWEI-109283"
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white disabled:bg-slate-50"
                  required
                  disabled={selectedJob.status === "completed"}
                />
              </div>
 
              {/* Photo Upload & Document List */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Installation Documentation Photos
                </label>
                
                {/* Photo Previews Grid */}
                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2 animate-in fade-in duration-200">
                    {photoPreviews.map((url, idx) => (
                      <div key={idx} className="relative w-full h-16 bg-slate-50 border border-slate-150 rounded-[6px] overflow-hidden group">
                        <img src={url} alt="job-doc" className="w-full h-full object-cover" />
                        {selectedJob.status !== "completed" && (
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-slate-900/60 text-white rounded-full hover:bg-slate-900/80 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
 
                {/* Hidden File Input Trigger */}
                {selectedJob.status !== "completed" && (
                  <>
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoSelect}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-9 border border-dashed border-slate-300 hover:border-[#00B4D8] text-slate-500 hover:text-[#00B4D8] rounded-[6px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors bg-slate-50/20"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take or Select Installation Photos</span>
                    </button>
                  </>
                )}
              </div>
 
              {/* Installer Remarks */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Deployment Notes / Remarks
                </label>
                <textarea
                  placeholder="Provide any completion details, site difficulties, or customer feedback..."
                  value={completionRemarks}
                  onChange={(e) => setCompletionRemarks(e.target.value)}
                  className="w-full h-20 px-3 py-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white resize-none disabled:bg-slate-50"
                  disabled={selectedJob.status === "completed"}
                />
              </div>
 
              {/* Footer Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-5">
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-150 rounded-[6px] text-slate-600 transition-colors"
                >
                  Close
                </button>
                {selectedJob.status !== "completed" && (
                  <button
                    type="submit"
                    disabled={isSubmittingJob}
                    className="h-9 px-5 text-xs font-extrabold text-white bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 rounded-[6px] shadow-lg shadow-cyan-100 flex items-center justify-center gap-1.5 transition-all hover:scale-105"
                  >
                    {isSubmittingJob && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Verify & Submit Job
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
 
      {/* Notice info download app */}
      <div className="w-full max-w-md mt-6 bg-[#F0FAFE] border border-[#00B4D8]/30 rounded-[12px] p-4 text-center space-y-2 shadow-sm">
        <AlertCircle className="w-5 h-5 text-[#00B4D8] mx-auto" />
        <h4 className="text-xs font-bold text-slate-800">Use CoreTECH Mobile App</h4>
        <p className="text-[10px] text-slate-600 leading-relaxed">
          For photo uploads, step-by-step guidance, and real-time navigation, please install our native Expo client on your mobile device.
        </p>
      </div>
    </div>
  );
}
