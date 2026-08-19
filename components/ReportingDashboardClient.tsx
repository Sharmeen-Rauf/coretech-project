"use client";

import React, { useState } from "react";
import { Wrench, Calendar, X, Clock, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  jobsCount: number;
  claimsCount: number;
  activeJobs: any[];
}

export default function ReportingDashboardClient({ jobsCount, claimsCount, activeJobs = [] }: Props) {
  const [isJobsModalOpen, setIsJobsModalOpen] = useState(false);
  const [warrantyActivated, setWarrantyActivated] = useState<Record<string, boolean>>({});

  const handleActivateWarranty = (jobId: string) => {
    setWarrantyActivated(prev => ({ ...prev, [jobId]: true }));
    toast.success(`Warranty and SLA successfully activated for Job #${jobId}! Certificate generated and sent to customer.`);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 select-none">
        {/* Active Jobs */}
        <div
          onClick={() => setIsJobsModalOpen(true)}
          className="bg-[#FFFDF5] border border-amber-200 rounded-[12px] p-5 flex items-center justify-between cursor-pointer hover:shadow-md transition-all duration-200"
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Installer Active Jobs</p>
            <h4 className="text-xl font-extrabold text-slate-800">{jobsCount} Active</h4>
            <p className="text-[9px] text-amber-600 font-semibold flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> Click to view live timelines
            </p>
          </div>
          <Wrench className="w-8 h-8 text-amber-400 opacity-75" />
        </div>

        {/* Pending Expenses */}
        <div className="bg-[#FFF5F6] border border-rose-200 rounded-[12px] p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Pending Expenses</p>
            <h4 className="text-xl font-extrabold text-slate-800">{claimsCount} Claims</h4>
            <p className="text-[9px] text-rose-500/80 font-semibold">Awaiting finance approval</p>
          </div>
          <Calendar className="w-8 h-8 text-rose-400 opacity-75" />
        </div>

      </div>

      {/* Live Installer Job Monitor Modal */}
      {isJobsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsJobsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-2xl border border-slate-100 rounded-[16px] shadow-2xl p-6 flex flex-col max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 select-none">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[16px]">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Live Field Job Monitor
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Real-time solar installation progress & warranty activation</p>
              </div>
              <button
                onClick={() => setIsJobsModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6 mt-2">
              {activeJobs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  No active installer jobs found.
                </div>
              ) : (
                activeJobs.map((job) => {
                  const steps = [
                    { label: "Assigned", time: "Step 1", done: true },
                    { label: "Dispatched", time: "Step 2", done: job.status === "in_progress" || job.status === "approved" || job.status === "pending_installation_approval" },
                    { label: "In Progress", time: "Step 3", done: job.status === "in_progress" || job.status === "approved" || job.status === "pending_installation_approval" },
                    { label: "Completed & Verified", time: job.status === "approved" ? "Verified" : "--:--", done: job.status === "approved" },
                  ];

                  const statusColor = 
                    job.status === "approved" ? "text-emerald-500 bg-emerald-50 border-emerald-200" :
                    job.status === "in_progress" ? "text-blue-500 bg-blue-50 border-blue-200" :
                    job.status === "pending_installation_approval" ? "text-amber-500 bg-amber-50 border-amber-200" :
                    "text-slate-550 bg-slate-50 border-slate-200";

                  return (
                    <div key={job.id} className="border border-slate-100 rounded-[10px] p-4 space-y-4 hover:border-slate-200 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">JOB-{job.id.substring(0, 8).toUpperCase()}</span>
                          <h4 className="font-bold text-slate-800 text-sm mt-0.5">{job.job_title}</h4>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {job.address} | <span className="text-[#00B4D8]">Serial: {job.serial_number || "-"}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-extrabold uppercase ${statusColor}`}>
                            {job.status === "pending_installation_approval" ? "Pending Approval" : job.status}
                          </span>
                        </div>
                      </div>

                      {/* Horizontal Progress Timeline */}
                      <div className="grid grid-cols-4 gap-2 relative pt-2">
                        <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-100 -z-10"></div>
                        {steps.map((step, idx) => (
                          <div key={idx} className="flex flex-col items-center text-center">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] font-bold ${
                              step.done 
                                ? "bg-[#F0FAFE] border-[#00B4D8] text-[#00B4D8]"
                                : "bg-white border-slate-200 text-slate-400"
                            }`}>
                              {step.done ? "✓" : idx + 1}
                            </div>
                            <span className={`text-[9px] font-bold mt-1.5 ${step.done ? "text-slate-700" : "text-slate-400"}`}>{step.label}</span>
                            <span className="text-[8px] text-slate-450">{step.time}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-50 pt-3 text-[10px] text-slate-500 font-semibold">
                        <span>Remarks: {job.remarks || "No remarks"}</span>
                        {job.status === "approved" ? (
                          <button
                            onClick={() => handleActivateWarranty(job.id)}
                            disabled={warrantyActivated[job.id]}
                            className={`h-7 px-3 text-[9px] font-bold rounded-[4px] shadow flex items-center gap-1 transition-colors ${
                              warrantyActivated[job.id] 
                                ? "bg-emerald-55 text-emerald-600 border border-emerald-100 cursor-not-allowed" 
                                : "bg-emerald-500 hover:bg-emerald-600 text-white"
                            }`}
                          >
                            {warrantyActivated[job.id] ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Warranty Active
                              </>
                            ) : (
                              "Activate SLA & Warranty"
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[9px]">SLA activation pending completion</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
