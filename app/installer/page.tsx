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
import { reloadSchemaAction } from "@/app/actions/users";
import { verifySerialNumberAction, submitInstallationAction } from "@/app/actions/products";

export default function WebInstallerPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  // Auth & Profile states
  const [installerName, setInstallerName] = useState("");
  const [profileStatus, setProfileStatus] = useState<string>("approved");
  const [verificationNote, setVerificationNote] = useState<string>("");
  const [approvalNote, setApprovalNote] = useState<string>("");
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
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);

  // Site Form validation errors
  const [siteFormErrors, setSiteFormErrors] = useState<Record<string, string>>({});
  const MIN_PHOTOS = 3;
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
          .select("first_name, last_name, status, verification_note, approval_note")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          setInstallerName(`${profile.first_name} ${profile.last_name || ""}`.trim());
          setProfileStatus(profile.status || "approved");
          setVerificationNote(profile.verification_note || "");
          setApprovalNote(profile.approval_note || "");
          document.cookie = "user_role=installer; path=/; max-age=2592000; SameSite=Lax";
          document.cookie = `user_status=${profile.status || "approved"}; path=/; max-age=2592000; SameSite=Lax`;
        }
      } catch (profErr) {
        console.warn("Failed to get profile name. Defaulting.", profErr);
        setInstallerName("Installer");
        setProfileStatus("approved");
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

      const localJobs = getLocalItems("coretech_local_installer_jobs") || [];
      const filteredLocal = localJobs.filter((j: any) => j.installer_id === session.user.id);

      // Automatic Sync local jobs to database if database connection is active
      const syncedIds: string[] = [];
      const BLOCKED_SYNC = ["unsplash.com", "mixkit.co", "picsum.photos", "placeholder.com", "zencdn", "gtv-videos-bucket", "lorem.space", "placehold.co"];
      const isFakeSyncUrl = (url: string) => !url || typeof url !== "string" || !url.trim() || BLOCKED_SYNC.some(d => url.toLowerCase().includes(d));

      if (filteredLocal.length > 0) {
        // Try uploading each local job
        for (const localJob of filteredLocal) {
          const matchingDbJob = jobsList.find((dbJob) => dbJob.id === localJob.id);
          if (matchingDbJob) {
            const dbStatus = String(matchingDbJob.status || "").toLowerCase();
            const localStatus = String(localJob.status || "").toLowerCase();
            
            if (dbStatus === "rejected" && localStatus === "pending_verification") {
              // Re-submitted rejected job needs to be synced (updated in DB)
              try {
                const res = await submitInstallationAction(localJob, localJob.id);
                if (res.success) {
                  syncedIds.push(localJob.id);
                  // Update status in jobsList so it shows as pending in UI
                  matchingDbJob.status = "pending_verification";
                  matchingDbJob.remarks = localJob.remarks;
                  matchingDbJob.photos = localJob.photos;
                  matchingDbJob.notes = localJob.notes;
                  matchingDbJob.is_resubmitted = true;
                }
              } catch (e) {
                console.warn("Failed to sync local re-submission to database:", e);
              }
            } else {
              // Otherwise it is already synced (e.g. status matches or database is newer)
              syncedIds.push(localJob.id);
            }
            continue;
          }

          try {
            const uploadJob = { ...localJob };
            // Sanitize ID: If it's not a valid UUID, delete it so PostgreSQL generates a valid UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(uploadJob.id)) {
              delete uploadJob.id;
            }

            // Sanitize photos: remove ALL fake/placeholder URLs before sync
            if (Array.isArray(uploadJob.photos)) {
              uploadJob.photos = uploadJob.photos.filter((url: string) => !isFakeSyncUrl(url));
            }
            // Sanitize notes: remove fake video URLs
            if (typeof uploadJob.notes === "string") {
              uploadJob.notes = uploadJob.notes.replace(
                /VIDEO:https?:\/\/[^\s|]*(?:mixkit|zencdn|gtv-videos-bucket|unsplash)[^\s|]*/gi,
                "VIDEO:"
              );
            }

            const { error: insertErr } = await supabase
              .from("installer_jobs")
              .insert(uploadJob);
            if (!insertErr) {
              syncedIds.push(localJob.id);
              // Add to jobsList so it displays as a DB job
              if (!jobsList.some(j => j.id === localJob.id)) {
                jobsList.push(localJob);
              }
            } else if (insertErr.code === "23505") {
              // Unique constraint violation (already in DB)
              syncedIds.push(localJob.id);
            }
          } catch (e) {
            console.warn("Failed to sync local job to database:", e);
          }
        }

        // Clean up synced jobs from local storage
        if (syncedIds.length > 0) {
          const updatedLocal = localJobs.filter((j: any) => !syncedIds.includes(j.id));
          localStorage.setItem("coretech_local_installer_jobs", JSON.stringify(updatedLocal));
        }
      }

      // Merge remaining local jobs and sync local storage with DB job statuses
      const remainingLocal = (getLocalItems("coretech_local_installer_jobs") || []).filter((j: any) => j.installer_id === session.user.id);
      const jobsMap = new Map<string, any>();
      jobsList.forEach((dbJob) => jobsMap.set(dbJob.id, dbJob));
      
      let localUpdated = false;
      remainingLocal.forEach((local) => {
        const dbJob = jobsMap.get(local.id);
        if (!dbJob) {
          jobsMap.set(local.id, local);
        } else {
          const dbStatus = String(dbJob.status || "").toLowerCase();
          const localStatus = String(local.status || "").toLowerCase();
          if (localStatus === "pending_verification" && dbStatus === "rejected") {
            jobsMap.set(local.id, { ...dbJob, ...local, status: "pending_verification" });
          } else if (dbStatus === "rejected" && localStatus !== "rejected") {
            local.status = "rejected";
            local.approval_note = dbJob.approval_note;
            local.verification_note = dbJob.verification_note;
            localUpdated = true;
          }
        }
      });

      if (localUpdated) {
        localStorage.setItem("coretech_local_installer_jobs", JSON.stringify(remainingLocal));
      }

      setJobs(Array.from(jobsMap.values()));
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
  const verifySerialNumber = async (sNo: string, jobIdOverride?: string) => {
    if (!sNo.trim()) {
      setValidatedProduct(null);
      setVerificationError("");
      return;
    }
    setIsVerifyingSerial(true);
    setVerificationError("");
    try {
      const cleanSNo = sNo.trim().toLowerCase();
      const targetJobId = jobIdOverride !== undefined ? jobIdOverride : siteFormJobId;

      // 1. Query Server Action (authoritative live database check) — always re-verify,
      // including on resubmission of a previously rejected job. No shortcuts: a rejection
      // is often specifically because the typed serial didn't match the photo, so this
      // check must run for real every time.
      const res = await verifySerialNumberAction(sNo, targetJobId);

      if (res) {
        if (res.success && res.product) {
          setValidatedProduct(res.product);
          setVerificationError("");
          return;
        } else if (res.error) {
          setValidatedProduct(null);
          setVerificationError(res.error);
          return;
        }
      }

      // 2. Offline Fallback (only if server action is unreachable)
      const localStock = getLocalItems("coretech_local_stock") || [];
      const localMatch = localStock.find((s: any) => String(s.serial_no || s.serial_number || "").trim().toLowerCase() === cleanSNo);

      if (localMatch) {
        const localProds = getLocalItems("coretech_local_products") || [];
        const prod = localProds.find((p: any) => p.id === localMatch.product_id);

        const localJobs = getLocalItems("coretech_local_installer_jobs") || [];
        const localDuplicate = localJobs.find((j: any) =>
          j.id !== siteFormJobId &&
          j.status !== "rejected" &&
          String(j.serial_number || "").trim().toLowerCase() === cleanSNo
        );

        if (localDuplicate) {
          setValidatedProduct(null);
          setVerificationError(`Serial number is already registered in offline job: "${localDuplicate.job_title}".`);
          return;
        }

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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Upload helper for files
  const uploadJobPhotos = async (): Promise<string[]> => {
    if (photoFiles.length === 0) return [];
    setIsUploadingPhotos(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of photoFiles) {
        try {
          const fileExt = file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `verification/${fileName}`;
          const { error } = await supabase.storage.from("job-photos").upload(filePath, file);
          if (error) throw error;
          const { data: pUrl } = supabase.storage.from("job-photos").getPublicUrl(filePath);
          uploadedUrls.push(pUrl.publicUrl);
        } catch (err) {
          console.error("Storage upload failed for photo:", err);
          throw new Error("Failed to upload photo proof to cloud storage. Please check your network connection and try again.");
        }
      }
      return uploadedUrls;
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const uploadVerificationVideo = async (): Promise<string> => {
    if (!videoFile) return "";
    setIsUploadingVideo(true);
    try {
      const fileExt = videoFile.name.split(".").pop() || "mp4";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `installer-videos/${fileName}`;
      const { error } = await supabase.storage.from("job-photos").upload(filePath, videoFile, {
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw error;
      const { data: pUrl } = supabase.storage.from("job-photos").getPublicUrl(filePath);
      return pUrl.publicUrl;
    } catch (err) {
      console.error("Storage upload failed for video:", err);
      throw new Error("Failed to upload video proof to cloud storage. Please check your network connection and try again.");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  // Validation: required for both a brand-new submission and a resubmission of a
  // rejected job — no exemptions either way.
  const validateSiteForm = () => {
    const errs: Record<string, string> = {};
    const isNew = siteFormJobId === "new";

    if (isNew) {
      if (!newJobTitle.trim()) errs.newJobTitle = "Installation project title is required";
      if (!newJobAddress.trim()) errs.newJobAddress = "Deployment site address is required";
    } else {
      // Read-only on resubmission, but still guard against a ticket missing this data.
      if (!newJobTitle.trim()) errs.newJobTitle = "Job title is missing on this ticket — contact admin";
      if (!newJobAddress.trim()) errs.newJobAddress = "Site address is missing on this ticket — contact admin";
    }

    if (!serialNo.trim()) {
      errs.serialNo = "Product serial number is required";
    } else if (isVerifyingSerial) {
      errs.serialNo = "Please wait for serial verification to finish";
    } else if (!validatedProduct) {
      errs.serialNo = "Serial number must be verified against inventory (tap Verify) before submitting";
    }

    if (!videoFile) {
      errs.video = "A video of the installation is required";
    }

    if (photoPreviews.length < MIN_PHOTOS) {
      errs.photos = `At least ${MIN_PHOTOS} site photos are required (currently ${photoPreviews.length})`;
    }

    setSiteFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Site Form
  const handleSiteFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateSiteForm()) {
      toast.error("Please complete all required fields before submitting");
      return;
    }

    const activeProduct = validatedProduct;

    const existingPhotoUrls = photoPreviews.filter(
      (p) => typeof p === "string" && (p.startsWith("http") || p.startsWith("data:"))
    );

    setIsSubmittingJob(true);
    try {
      // Execute video and photos upload in PARALLEL for 50% FASTER submission speed
      const [videoUrl, photosUrls] = await Promise.all([
        uploadVerificationVideo(),
        uploadJobPhotos(),
      ]);

      const allPhotos = [...existingPhotoUrls, ...photosUrls];

      const serializedNotes = `[METADATA] SN:${serialNo.trim()} | VIDEO:${videoUrl} | REM:${completionRemarks.trim()}\nCONNECTED PRODUCT: ${activeProduct.product_name} (${activeProduct.model})`;

      const isNew = siteFormJobId === "new";
      const payload = {
        id: isNew ? crypto.randomUUID() : siteFormJobId,
        installer_id: installerId,
        job_title: isNew ? newJobTitle.trim() : (jobs.find(j => j.id === siteFormJobId)?.job_title || "Site Job"),
        address: isNew ? newJobAddress.trim() : (jobs.find(j => j.id === siteFormJobId)?.address || "Site Address"),
        status: "pending_verification", // wait for two-stage audit
        serial_number: serialNo.trim(),
        remarks: completionRemarks.trim(),
        photos: allPhotos,
        notes: serializedNotes,
        incentive: 5000,
        payment_status: "unpaid",
        created_at: new Date().toISOString()
      };

      try {
        const res = await submitInstallationAction(payload, siteFormJobId);
        if (!res.success) throw new Error(res.error);
        
        // Save/Update local storage copy with pending_verification so UI updates instantly
        const localJobs = getLocalItems("coretech_local_installer_jobs") || [];
        const index = localJobs.findIndex((j: any) => j.id === payload.id || j.id === siteFormJobId);
        const isResubmit = siteFormJobId && siteFormJobId !== "new";
        const updatedJob = { ...payload, status: "pending_verification", approval_note: null, verification_note: null, is_resubmitted: isResubmit };
        if (index > -1) {
          localJobs[index] = updatedJob;
        } else {
          localJobs.push(updatedJob);
        }
        localStorage.setItem("coretech_local_installer_jobs", JSON.stringify(localJobs));
        toast.success("Site installation submitted! Waiting for verification & approval.");
      } catch (dbErr: any) {
        console.warn("DB submission failed. Saving locally.", dbErr);
        const isResubmit = siteFormJobId && siteFormJobId !== "new";
        const localPayload = { ...payload, is_resubmitted: isResubmit };
        saveLocalItem("coretech_local_installer_jobs", localPayload, true);
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
    if (!job) return;
    const st = String(job.status || "").trim().toLowerCase();
    if (st === "approved") {
      return; // DO NOTHING ON APPROVED JOBS
    }

    setSiteFormErrors({});
    setSiteFormJobId(job.id);
    setNewJobTitle(job.job_title);
    setNewJobAddress(job.address);
    setSerialNo(job.serial_number || "");
    setCompletionRemarks(job.remarks || "");
    setVideoFile(null);
    setVideoPreview(null);

    // Pre-populate existing photo URLs if available
    let existingPhotos: string[] = [];
    if (Array.isArray(job.photos)) {
      existingPhotos = job.photos;
    } else if (typeof job.photos === "string" && job.photos.trim()) {
      try {
        const parsed = JSON.parse(job.photos);
        if (Array.isArray(parsed)) existingPhotos = parsed;
      } catch {
        existingPhotos = [job.photos];
      }
    }
    setPhotoFiles([]);
    setPhotoPreviews(existingPhotos);

    // Parse metadata
    if (job.serial_number) {
      verifySerialNumber(job.serial_number, job.id);
    }

    setIsSiteFormOpen(true);
  };

  // Stats calculation
  const completedCount = jobs.filter((j) => {
    const s = String(j.status || "").toLowerCase();
    return s === "approved";
  }).length;
  const pendingApprovalCount = jobs.filter((j) => {
    const s = String(j.status || "").toLowerCase();
    return s === "pending_verification" || s === "pending_approval" || s === "pending_installation_approval" || s === "pending";
  }).length;
  const assignedCount = jobs.filter((j) => {
    const s = String(j.status || "").toLowerCase();
    return s === "assigned" || s === "in_progress";
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center select-none font-sans p-4 relative space-y-3">

      {/* Top Rejection Alert Banner if any job is rejected */}
      {jobs.some((j) => String(j.status || "").toLowerCase() === "rejected") && (
        <div className="w-full max-w-md bg-rose-50 border border-rose-200 rounded-[12px] p-3.5 shadow-sm space-y-2 text-left animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Installation Rejected — Action Required</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Your installation ticket was rejected during audit review. Click below to update photos, video, serial number, or remarks and re-submit for verification.
          </p>
          {jobs.find((j) => String(j.status || "").toLowerCase() === "rejected") && (
            <button
              type="button"
              onClick={() => openSubmitForJob(jobs.find((j) => String(j.status || "").toLowerCase() === "rejected"))}
              className="w-full h-8 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-[6px] flex items-center justify-center gap-1.5 shadow transition-all"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Edit & Re-submit Rejected Ticket Now</span>
            </button>
          )}
        </div>
      )}

      {/* Mobile-first Header container */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[12px] p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0077B6] to-[#00B4D8] flex items-center justify-center text-white font-extrabold text-sm shadow">
              CT
            </div>
            <span className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
              Core<span className="text-[#00B4D8]">TECH</span>
              <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded border border-slate-200 font-bold">v2.2.0</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`border rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${(profileStatus === "active" || profileStatus === "approved")
                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                : profileStatus === "rejected" || jobs.some((j) => j.status === "rejected")
                ? "bg-rose-50 text-rose-600 border-rose-100"
                : "bg-amber-50 text-amber-600 border-amber-100"
              }`}>
              {(profileStatus === "active" || profileStatus === "approved")
                ? "Approved"
                : profileStatus === "rejected" || jobs.some((j) => j.status === "rejected")
                ? "Rejected (Action Required)"
                : "Pending Review"}
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
              setSiteFormErrors({});
              setSiteFormJobId("new");
              setNewJobTitle("");
              setNewJobAddress("");
              setSerialNo("");
              setCompletionRemarks("");
              setValidatedProduct(null);
              setVideoFile(null);
              setVideoPreview(null);
              setPhotoFiles([]);
              setPhotoPreviews([]);
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
          jobs.map((job) => {
            const st = String(job.status || "").trim().toLowerCase();
            const isApproved = st === "approved";
            const isPending = st === "pending_verification" || st === "pending_approval" || st === "pending_installation_approval" || st === "pending";
            const isRejected = st === "rejected" || st === "declined";

            return (
              <div
                key={job.id}
                className={`bg-white border rounded-[12px] p-4 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all ${
                  isRejected ? "border-rose-300 bg-rose-50/20" : "border-slate-200"
                }`}
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
                      isApproved ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      isPending ? "bg-amber-50 text-amber-600 border-amber-200" :
                      isRejected ? "bg-rose-50 text-rose-600 border-rose-200" :
                      "bg-blue-50 text-blue-500 border-blue-100"
                    }`}>
                      {isApproved ? "Approved" :
                       isPending ? "Pending Verification" :
                       isRejected ? "Rejected" :
                       job.status}
                    </span>
                  </div>
                </div>

                {/* Pending Verification Banner */}
                {isPending && (
                  <div className="mt-2.5 p-2.5 bg-amber-50/80 border border-amber-200 rounded-[8px] space-y-1 text-left">
                    <p className="text-[10px] text-amber-700 font-bold flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Submitted — Waiting for Verification & Audit Review</span>
                    </p>
                    <p className="text-[9px] text-slate-500 font-medium">
                      Your installation details have been sent to Retail Manager & Country Head.
                    </p>
                  </div>
                )}

                {/* Rejected Card Simple Static Banner with Re-submit Button */}
                {isRejected && (
                  <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-[8px] space-y-2 text-left">
                    <p className="text-[10px] text-rose-700 font-bold leading-tight">
                      <span className="font-extrabold uppercase">Rejection Reason:</span> {job.approval_note || job.verification_note || job.remarks || "Rejected during audit review."}
                    </p>
                    <button
                      type="button"
                      onClick={() => openSubmitForJob(job)}
                      className="w-full h-8 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.01]"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Re-submit / Edit Installation</span>
                    </button>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-[9px] text-slate-450 font-bold border-t border-slate-50 pt-2">
                  <span className="capitalize text-slate-500">
                    Incentive: <span className="text-emerald-600 font-bold">Rs. {Number(job.incentive || 0).toLocaleString()}</span>
                  </span>
                  <span>{job.created_at ? new Date(job.created_at).toLocaleDateString() : ""}</span>
                </div>
              </div>
            );
          })
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
                  {siteFormJobId === "new"
                    ? "New Installation Record"
                    : jobs.find((j) => j.id === siteFormJobId)?.status === "rejected"
                    ? "Edit & Re-submit Rejected Installation"
                    : "Upload Installation Proof"}
                </h3>
                <p className="text-[8px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">
                  {siteFormJobId !== "new" && jobs.find((j) => j.id === siteFormJobId)?.status === "rejected"
                    ? "RE-SUBMISSION FORM"
                    : "SITE FORM"}
                </p>
              </div>
              <button
                onClick={() => setIsSiteFormOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-450 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Re-submission Alert Banner */}
            {siteFormJobId !== "new" && jobs.find((j) => j.id === siteFormJobId)?.status === "rejected" && (
              <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-[8px] text-[10px] text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  Editing Rejected Installation Ticket
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Update any photos, video, serial number, or remarks and click <strong>"Re-submit Installation"</strong> below to send this ticket back for Stage 1 RM verification.
                </p>
              </div>
            )}

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
                      className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                        siteFormErrors.newJobTitle ? "border-rose-500" : "border-slate-200"
                      }`}
                      required
                    />
                    {siteFormErrors.newJobTitle && <p className="text-[9px] text-rose-500 mt-1 font-bold">{siteFormErrors.newJobTitle}</p>}
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
                      className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                        siteFormErrors.newJobAddress ? "border-rose-500" : "border-slate-200"
                      }`}
                      required
                    />
                    {siteFormErrors.newJobAddress && <p className="text-[9px] text-rose-500 mt-1 font-bold">{siteFormErrors.newJobAddress}</p>}
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
                  {(siteFormErrors.newJobTitle || siteFormErrors.newJobAddress) && (
                    <p className="text-[9px] text-rose-500 mt-1 font-bold">
                      {siteFormErrors.newJobTitle || siteFormErrors.newJobAddress}
                    </p>
                  )}
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
                    placeholder="e.g. SN-CORETECH-39485"
                    value={serialNo}
                    onChange={(e) => {
                      setSerialNo(e.target.value);
                      setValidatedProduct(null);
                      setVerificationError("");
                    }}
                    className={`flex-1 h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                      siteFormErrors.serialNo ? "border-rose-500" : "border-slate-200"
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => verifySerialNumber(serialNo)}
                    className="h-9 px-3 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-[6px] text-xs font-bold text-slate-700"
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

                {siteFormErrors.serialNo && !isVerifyingSerial && (
                  <p className="text-[9px] text-rose-500 mt-1 font-bold">{siteFormErrors.serialNo}</p>
                )}

                {validatedProduct && (
                  <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-[6px] text-[10px] text-slate-700 space-y-1.5 animate-in slide-in-from-top-1 duration-150">
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
                    {isUploadingVideo && (
                      <div className="absolute inset-0 bg-slate-900/70 flex flex-col items-center justify-center gap-1.5 text-white">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-[10px] font-bold">Uploading video...</span>
                      </div>
                    )}
                    {!isUploadingVideo && (
                      <button
                        type="button"
                        onClick={removeVideo}
                        className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
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
                      className={`w-full h-10 border border-dashed rounded-[6px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors bg-slate-50/20 ${
                        siteFormErrors.video ? "border-rose-400 text-rose-500" : "border-slate-300 hover:border-[#00B4D8] text-slate-500 hover:text-[#00B4D8]"
                      }`}
                    >
                      <Video className="w-4 h-4 text-[#00B4D8]" />
                      <span>Upload Video Proof of Installation</span>
                    </button>
                  </>
                )}
                {siteFormErrors.video && <p className="text-[9px] text-rose-500 mt-1 font-bold">{siteFormErrors.video}</p>}
              </div>

              {/* Photo Upload proof */}
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Reference Site Photos* <span className="normal-case text-slate-400">(minimum {MIN_PHOTOS})</span>
                </label>

                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {photoPreviews.map((url, idx) => (
                      <div key={idx} className="relative w-full h-14 bg-slate-50 border border-slate-150 rounded-[6px] overflow-hidden">
                        <img src={url} alt="reference-site" className="w-full h-full object-cover" />
                        {!isUploadingPhotos && (
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-slate-900/60 text-white rounded-full"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isUploadingPhotos && (
                  <div className="flex items-center gap-1.5 mb-2 text-[10px] text-[#0077B6]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading photos...</span>
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
                  className={`w-full h-8 border rounded-[6px] text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-slate-50 ${
                    siteFormErrors.photos ? "border-rose-400 text-rose-500" : "border-slate-200 text-slate-500"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5 text-slate-450" />
                  <span>Select Images ({photoPreviews.length}/{MIN_PHOTOS} minimum)</span>
                </button>
                {siteFormErrors.photos && <p className="text-[9px] text-rose-500 mt-1 font-bold">{siteFormErrors.photos}</p>}
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
                  disabled={isSubmittingJob}
                  className="h-9 px-5 text-xs font-bold text-white bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-slate-200 disabled:text-slate-400 rounded-[6px] shadow-lg shadow-cyan-100 flex items-center justify-center gap-1.5 transition-all"
                >
                  {isSubmittingJob && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isUploadingVideo
                    ? "Uploading video..."
                    : isUploadingPhotos
                    ? "Uploading photos..."
                    : isSubmittingJob
                    ? "Saving installation..."
                    : "Submit Installation"}
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
