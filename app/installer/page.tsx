"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import { LogOut, Wrench, CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import StatusBadge from "@/components/StatusBadge";
import { getLocalItems } from "@/lib/supabaseLocalFallback";

export default function WebInstallerPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [installerName, setInstallerName] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkUserAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Fetch name
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
      try {
        const { data: jobsData, error } = await supabase
          .from("installer_jobs")
          .select("*")
          .eq("installer_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setJobs(jobsData || []);
      } catch (err: any) {
        console.warn("Failed to fetch installer jobs from database. Using local fallback.", err);
        const localJobs = getLocalItems("coretech_local_installer_jobs");
        const filtered = localJobs.filter((j: any) => j.installer_id === session.user.id);
        setJobs(filtered);
      }
      setIsLoading(false);
    };

    checkUserAndFetch();
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const pendingCount = jobs.filter((j) => j.status !== "completed").length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center select-none font-sans p-4">
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
              className="bg-white border border-slate-200 rounded-[12px] p-4 flex flex-col justify-between shadow-sm relative overflow-hidden"
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
                <span className="capitalize">Payment: {job.payment_status}</span>
                <span>{job.created_at ? new Date(job.created_at).toLocaleDateString() : ""}</span>
              </div>
            </div>
          ))
        )}
      </div>

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
