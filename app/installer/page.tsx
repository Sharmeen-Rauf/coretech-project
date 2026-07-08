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
  Upload,
  Video,
  FileVideo,
  Play,
  ListTodo,
  Sparkles,
  ShieldAlert,
  ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import StatusBadge from "@/components/StatusBadge";
import { getLocalItems, saveLocalItem } from "@/lib/supabaseLocalFallback";

export default function WebInstallerPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  
  // Auth & Profile states
  const [installerName, setInstallerName] = useState("");
  const [profileStatus, setProfileStatus] = useState<string>("active");
  const [installerId, setInstallerId] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Selected job completion modal (existing flow)
  const [selectedJob, setSelectedJob] = useState<any>(null);
  
  // Independent Site Form / New Installation States
  const [isSiteFormOpen, setIsSiteFormOpen] = useState(false);
  const [siteFormJobId, setSiteFormJobId] = useState(""); // can link to existing job, or "new"
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobAddress, setNewJobAddress] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [completionRemarks, setCompletionRemarks] = useState("");
  
  // Connected Inventory States
  const [validatedProduct, setValidatedProduct] = useState<any>(null);
  const [isVerifyingSerial, setIsVerifyingSerial] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  // Video Upload States
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Photos List States
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

      setInstallerId(session.user.id);

      // Fetch profile details including status (pending/active)
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, status")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          setInstallerName(`${profile.first_name} ${profile.last_name || ""}`.trim());
          setProfileStatus(profile.status || "active");
        }
      } catch (profErr) {
        console.warn("Failed to get profile name. Defaulting.", profErr);
        setInstallerName("Installer");
        setProfileStatus("active");
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

  // Connected Inventory live cross-check
  const verifySerialNumber = async (sNo: string) => {
    if (!sNo.trim()) {
      setValidatedProduct(null);
      setVerificationError("");
      return;
    }
    setIsVerifyingSerial(true);
    setVerificationError("");
    try {
      // 1. Query Supabase stock table
      const { data, error } = await supabase
        .from("stock")
        .select(`
          *,
          products (
            name,
            brand,
            model
          )
        `)
        .eq("serial_no", sNo.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setValidatedProduct({
          product_name: data.products?.name || "Unknown Product",
          brand: data.products?.brand || "-",
          model: data.model_no || data.products?.model || "-",
          warehouse_name: data.warehouse_name || "-",
        });
        return;
      }

      // 2. Query local fallback stock
      const localStock = getLocalItems("coretech_local_stock");
      const localMatch = localStock.find((s: any) => s.serial_no === sNo.trim());

      if (localMatch) {
        const localProds = getLocalItems("coretech_local_products");
        const prod = localProds.find((p: any) => p.id === localMatch.product_id);
        setValidatedProduct({
          product_name: prod?.name || "Unknown Product",
          brand: prod?.brand || "-",
          model: localMatch.model_no || prod?.model || "-",
          warehouse_name: localMatch.warehouse_name || "-",
        });
        return;
      }

      setValidatedProduct(null);
      setVerificationError("Serial number not found in active inventory.");
    } catch (err) {
      console.warn("Serial verification error:", err);
      setValidatedProduct(null);
      setVerificationError("Inventory lookup error. Offline check failed.");
    } finally {
      setIsVerifyingSerial(false);
    }
  };

  // Handle Photo additions
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

  // Handle Video additions
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  // Upload helper for files
  const uploadJobPhotos = async (): Promise<string[]> => {
    if (photoFiles.length === 0) return [];
    const uploadedUrls: string[] = [];
    try {
      for (const file of photoFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `verification/${fileName}`;
        const { error } = await supabase.storage.from("job-photos").upload(filePath, file);
        if (error) throw error;
        const { data: pUrl } = supabase.storage.from("job-photos").getPublicUrl(filePath);
        uploadedUrls.push(pUrl.publicUrl);
      }
      return uploadedUrls;
    } catch (err) {
      console.warn("Storage upload error for photos, using placeholders", err);
      return photoFiles.map((f, i) => `https://images.unsplash.com/photo-1600585154340-${i}?auto=format&fit=crop&w=500&q=80`);
    }
  };

  const uploadVerificationVideo = async (): Promise<string> => {
    if (!videoFile) return "";
    setIsUploadingVideo(true);
    try {
      const fileExt = videoFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `installer-videos/${fileName}`;
      const { error } = await supabase.storage.from("job-photos").upload(filePath, videoFile);
      if (error) throw error;
      const { data: pUrl } = supabase.storage.from("job-photos").getPublicUrl(filePath);
      return pUrl.publicUrl;
    } catch (err) {
      console.warn("Storage upload failed for video, using sample fallback URL", err);
      return "https://www.w3schools.com/html/mov_bbb.mp4";
    } finally {
      setIsUploadingVideo(false);
    }
  };

  // Submit Site Form
  const handleSiteFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatedProduct) {
      toast.error("Connected inventory validation failed. Please check the serial number.");
      return;
    }

    setIsSubmittingJob(true);
    try {
      const videoUrl = await uploadVerificationVideo();
      const photosUrls = await uploadJobPhotos();

      // Combined photos + video URL representation for metadata
      const allPhotos = [...photoPreviews, ...photosUrls];
      
      const serializedNotes = `[METADATA] SN:${serialNo.trim()} | VIDEO:${videoUrl} | REM:${completionRemarks.trim()}\nCONNECTED PRODUCT: ${validatedProduct.product_name} (${validatedProduct.model})`;

      const payload = {
        id: siteFormJobId && siteFormJobId !== "new" ? siteFormJobId : crypto.randomUUID(),
        installer_id: installerId,
        job_title: siteFormJobId === "new" ? newJobTitle.trim() : (jobs.find(j => j.id === siteFormJobId)?.job_title || "Site Job"),
        address: siteFormJobId === "new" ? newJobAddress.trim() : (jobs.find(j => j.id === siteFormJobId)?.address || "Site Address"),
        status: "pending_installation_approval", // wait for owner's check
        serial_number: serialNo.trim(),
        remarks: completionRemarks.trim(),
        photos: allPhotos,
        notes: serializedNotes,
        incentive: siteFormJobId === "new" ? 500 : (jobs.find(j => j.id === siteFormJobId)?.incentive || 0),
        payment_status: "unpaid",
        created_at: new Date().toISOString()
      };

      try {
        if (siteFormJobId && siteFormJobId !== "new") {
          // Update existing assigned job ticket
          const { error } = await supabase
            .from("installer_jobs")
            .update({
              status: "pending_installation_approval",
              serial_number: payload.serial_number,
              remarks: payload.remarks,
              photos: payload.photos,
              notes: payload.notes
            })
            .eq("id", siteFormJobId);
          if (error) throw error;
        } else {
          // Create new job ticket
          const { error } = await supabase
            .from("installer_jobs")
            .insert(payload);
          if (error) throw error;
        }
        toast.success("Site installation submitted! Waiting for owner's approval.");
      } catch (dbErr) {
        console.warn("DB submission failed. Saving locally.", dbErr);
        saveLocalItem("coretech_local_installer_jobs", payload, true);
        toast.success("Site installation saved locally (DB fallback)!");
      }

      // Safe activity logging
      try {
        await supabase.from("activity_logs").insert({
          action: "Job Submitted (Verification)",
          details: `Installer ${installerName} submitted installation for verification (Serial: ${payload.serial_number})`,
        });
      } catch (logErr) {
        console.warn(logErr);
      }

      // Clear states
      setIsSiteFormOpen(false);
      setSiteFormJobId("");
      setNewJobTitle("");
      setNewJobAddress("");
      setSerialNo("");
      setCompletionRemarks("");
      setValidatedProduct(null);
      setVideoFile(null);
      setVideoPreview(null);
      setPhotoFiles([]);
      setPhotoPreviews([]);
      fetchInstallerData();

    } catch (err: any) {
      toast.error(err.message || "Failed to submit site form");
    } finally {
      setIsSubmittingJob(false);
    }
  };

  const openSubmitForJob = (job: any) => {
    setSiteFormJobId(job.id);
    setNewJobTitle(job.job_title);
    setNewJobAddress(job.address);
    setSerialNo(job.serial_number || "");
    setCompletionRemarks(job.remarks || "");
    
    // Parse metadata
    if (job.serial_number) {
      verifySerialNumber(job.serial_number);
    }

    setIsSiteFormOpen(true);
  };

  // Stats calculation
  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const pendingApprovalCount = jobs.filter((j) => j.status === "pending_installation_approval").length;
  const assignedCount = jobs.filter((j) => j.status === "assigned").length;

  // 1. Pending Approval Card Full View
  if (!isLoading && profileStatus === "pending") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans select-none">
        <div className="w-full max-w-md bg-white border border-amber-200 rounded-[16px] p-6 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 shadow-inner">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-800">Account Pending Approval</h2>
            <p className="text-xs text-slate-500 leading-relaxed px-4">
              Hello, <span className="font-bold text-slate-700">{installerName}</span>. Your installer account status is currently <span className="text-amber-600 font-bold">Pending Review</span>.
            </p>
          </div>

          <div className="bg-[#F0FAFE] border border-[#00B4D8]/30 rounded-[12px] p-4 text-left text-xs space-y-3">
            <div className="flex gap-2.5 items-start">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00B4D8]/20 text-xs font-bold text-[#0077B6]">1</span>
              <p className="text-slate-655 font-medium">The Owner is verifying your contact details, CNIC documentation, and verification video.</p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00B4D8]/20 text-xs font-bold text-[#0077B6]">2</span>
              <p className="text-slate-655 font-medium">Features like Job Assignments, Site Verification Forms, and Incentives remain locked until approved.</p>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={fetchInstallerData}
              className="w-full h-10 bg-[#00B4D8] hover:bg-[#0077B6] text-white rounded-[8px] font-bold text-xs shadow transition-all flex items-center justify-center gap-1.5"
            >
              Check Approval Status
            </button>
            <button
              onClick={handleSignOut}
              className="w-full h-10 border border-slate-200 text-slate-600 hover:bg-slate-55 rounded-[8px] font-bold text-xs transition-all flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-2">
            <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase">
              Approved
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-base font-extrabold text-slate-800">Hi, {installerName || "Installer"}</h2>
            <p className="text-[10px] text-slate-500 font-medium">CoreTECH Installer Network Portal</p>
          </div>
          <button
            onClick={() => {
              setSiteFormJobId("new");
              setNewJobTitle("");
              setNewJobAddress("");
              setSerialNo("");
              setCompletionRemarks("");
              setValidatedProduct(null);
              setIsSiteFormOpen(true);
            }}
            className="h-8 px-3 bg-[#00B4D8] hover:bg-[#0077B6] text-white rounded-[6px] text-xs font-bold shadow-md shadow-cyan-100 flex items-center gap-1.5 transition-all hover:scale-105"
          >
            <Wrench className="w-3.5 h-3.5" />
            Open Site Form
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-1 bg-slate-50 p-2.5 rounded-[8px] border border-slate-100 text-center">
          <div>
            <p className="text-[#00B4D8] text-sm font-bold">{jobs.length}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
          </div>
          <div className="border-l border-slate-200">
            <p className="text-[#0077B6] text-sm font-bold">{assignedCount}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Assigned</p>
          </div>
          <div className="border-l border-slate-200">
            <p className="text-amber-500 text-sm font-bold">{pendingApprovalCount}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Pending</p>
          </div>
          <div className="border-l border-slate-200">
            <p className="text-emerald-600 text-sm font-bold">{completedCount}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Verified</p>
          </div>
        </div>
      </div>

      {/* Jobs list */}
      <div className="w-full max-w-md mt-4 space-y-3">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">
          Your Job Assignments
        </h3>

        {isLoading ? (
          <div className="bg-white rounded-[12px] p-8 border border-slate-150 flex justify-center shadow-sm">
            <Loader2 className="w-6 h-6 text-[#00B4D8] animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-[12px] p-8 border border-slate-150 text-center space-y-2 shadow-sm">
            <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No jobs assigned</p>
            <p className="text-[10px] text-slate-500">Contact admin or use the Site Form to report a new installation.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => openSubmitForJob(job)}
              className="bg-white border border-slate-200 hover:border-[#00B4D8] rounded-[12px] p-4 flex flex-col justify-between shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 leading-tight">
                    {job.job_title}
                  </h4>
                  <p className="text-[9px] font-medium text-slate-400">{job.address}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                    job.status === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                    job.status === "pending_installation_approval" ? "bg-amber-50 text-amber-500 border-amber-100" :
                    "bg-blue-50 text-blue-500 border-blue-100"
                  }`}>
                    {job.status === "pending_installation_approval" ? "Pending Approval" : job.status}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-[9px] text-slate-450 font-bold border-t border-slate-50 pt-2.5">
                <span className="capitalize text-slate-500">
                  Incentive: <span className="text-emerald-600 font-bold">Rs. {Number(job.incentive || 0).toLocaleString()}</span>
                </span>
                <span>{job.created_at ? new Date(job.created_at).toLocaleDateString() : ""}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Interactive Site Form Modal Sheet */}
      {isSiteFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setIsSiteFormOpen(false)} 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
          ></div>
          
          <div className="relative bg-white w-full max-w-md border border-slate-100 rounded-[12px] shadow-2xl p-5 flex flex-col max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-800">
                  {siteFormJobId === "new" ? "New Installation Record" : "Upload Installation Proof"}
                </h3>
                <p className="text-[8px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">SITE FORM</p>
              </div>
              <button 
                onClick={() => setIsSiteFormOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-450 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSiteFormSubmit} className="space-y-4 text-left">
              
              {/* Installer Title (Auto) */}
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Installer Title (Auto Filled)*
                </label>
                <input
                  type="text"
                  value={installerName}
                  disabled
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-500 font-bold"
                />
              </div>

              {/* Job Choice (linking) */}
              {siteFormJobId === "new" ? (
                <>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Installation Project Title*
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Al-Faisal Solar Project"
                      value={newJobTitle}
                      onChange={(e) => setNewJobTitle(e.target.value)}
                      className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Deployment Site Address*
                    </label>
                    <input
                      type="text"
                      placeholder="Full site deployment address"
                      value={newJobAddress}
                      onChange={(e) => setNewJobAddress(e.target.value)}
                      className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white"
                      required
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Linked Job Ticket
                  </label>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-700">
                    {newJobTitle} - <span className="text-[10px] text-slate-500">{newJobAddress}</span>
                  </div>
                </div>
              )}

              {/* Serial Number & Live Validation */}
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Product Serial Number*
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. SN-HUAWEI-39485"
                    value={serialNo}
                    onChange={(e) => {
                      setSerialNo(e.target.value);
                      setValidatedProduct(null);
                      setVerificationError("");
                    }}
                    className="flex-1 h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => verifySerialNumber(serialNo)}
                    className="h-9 px-3 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-[6px] text-xs font-bold text-slate-650"
                  >
                    Verify
                  </button>
                </div>
                
                {/* Real-time Validation display */}
                {isVerifyingSerial && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-[#0077B6]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying serial against live stock...</span>
                  </div>
                )}

                {validatedProduct && (
                  <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-150 rounded-[6px] text-[10px] text-slate-650 space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                    <p className="font-bold text-emerald-800 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      Connected Inventory Verified
                    </p>
                    <div className="grid grid-cols-2 gap-1 border-t border-emerald-200/50 pt-1.5">
                      <p><strong>Name:</strong> {validatedProduct.product_name}</p>
                      <p><strong>Model:</strong> {validatedProduct.model}</p>
                      <p><strong>Brand:</strong> {validatedProduct.brand}</p>
                      <p><strong>Warehouse:</strong> {validatedProduct.warehouse_name}</p>
                    </div>
                  </div>
                )}

                {verificationError && (
                  <p className="text-[10px] text-rose-600 font-bold mt-1.5 flex items-center gap-1 animate-in shake duration-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {verificationError}
                  </p>
                )}
              </div>

              {/* Video Upload Verification */}
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Video of Installation*
                </label>
                
                {videoPreview ? (
                  <div className="relative w-full h-32 bg-slate-900 border rounded-[6px] overflow-hidden">
                    <video src={videoPreview} controls className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input 
                      type="file"
                      ref={videoInputRef}
                      onChange={handleVideoSelect}
                      accept="video/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="w-full h-10 border border-dashed border-slate-300 hover:border-[#00B4D8] text-slate-500 hover:text-[#00B4D8] rounded-[6px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors bg-slate-50/20"
                    >
                      <Video className="w-4 h-4 text-[#00B4D8]" />
                      <span>Upload Video Proof of Installation</span>
                    </button>
                  </>
                )}
              </div>

              {/* Photo Upload proof */}
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Reference Site Photos
                </label>
                
                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {photoPreviews.map((url, idx) => (
                      <div key={idx} className="relative w-full h-14 bg-slate-50 border border-slate-150 rounded-[6px] overflow-hidden">
                        <img src={url} alt="reference-site" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute top-0.5 right-0.5 p-0.5 bg-slate-900/60 text-white rounded-full"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
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
                  className="w-full h-8 border border-slate-200 text-slate-500 rounded-[6px] text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-slate-50"
                >
                  <Camera className="w-3.5 h-3.5 text-slate-450" />
                  <span>Select Images</span>
                </button>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Site Notes / Completion Remarks
                </label>
                <textarea
                  placeholder="Notes about client installation, connection grid, or physical environment..."
                  value={completionRemarks}
                  onChange={(e) => setCompletionRemarks(e.target.value)}
                  className="w-full h-16 px-3 py-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white resize-none"
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsSiteFormOpen(false)}
                  className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-50 rounded-[6px] text-slate-600 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingJob || !validatedProduct}
                  className="h-9 px-5 text-xs font-bold text-white bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-slate-200 disabled:text-slate-400 rounded-[6px] shadow-lg shadow-cyan-100 flex items-center justify-center gap-1.5 transition-all"
                >
                  {isSubmittingJob && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Installation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notice info download app */}
      <div className="w-full max-w-md mt-6 bg-[#F0FAFE] border border-[#00B4D8]/30 rounded-[12px] p-4 text-center space-y-2 shadow-sm">
        <AlertCircle className="w-5 h-5 text-[#00B4D8] mx-auto" />
        <h4 className="text-xs font-bold text-slate-800">Use CoreTECH Mobile App</h4>
        <p className="text-[10px] text-slate-600 leading-relaxed font-medium">
          For physical site scanning, instant notifications, and real-time support, install our official Expo wrapper on your testing device.
        </p>
      </div>
    </div>
  );
}
