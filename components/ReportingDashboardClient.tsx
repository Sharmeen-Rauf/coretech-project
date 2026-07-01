"use client";

import React, { useState } from "react";
import { Wrench, Calendar, MessageSquare, CreditCard, X, Clock, AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  jobsCount: number;
  claimsCount: number;
  ticketsCount: number;
}

export default function ReportingDashboardClient({ jobsCount, claimsCount, ticketsCount }: Props) {
  const [isJobsModalOpen, setIsJobsModalOpen] = useState(false);
  const [activeJobStep, setActiveJobStep] = useState<number>(2); // mock progress
  const [warrantyActivated, setWarrantyActivated] = useState<Record<string, boolean>>({});

  const handleActivateWarranty = (jobId: string) => {
    setWarrantyActivated(prev => ({ ...prev, [jobId]: true }));
    toast.success(`Warranty and SLA successfully activated for Job #${jobId}! Certificate generated and sent to customer.`);
  };

  const mockJobs = [
    {
      id: "JOB-1024",
      customer: "Saud Abbas",
      location: "DHA Phase 6, Lahore",
      equipment: "Growatt 5kW Inverter + 10kW Lithium Battery",
      status: "Dispatched",
      statusColor: "text-amber-500 bg-amber-50 border-amber-200",
      installer: "Muhammad Ali (Driver: LEA-4920)",
      steps: [
        { label: "Assigned", time: "08:30 AM", done: true },
        { label: "Dispatched", time: "09:15 AM", done: true },
        { label: "In Progress", time: "--:--", done: false },
        { label: "Completed & Verified", time: "--:--", done: false },
      ],
      canActivate: false
    },
    {
      id: "JOB-1025",
      customer: "Bismillah Electronics",
      location: "Gulberg III, Lahore",
      equipment: "Huawei Smart Inverter 10kW + 550W Panels",
      status: "In Progress",
      statusColor: "text-blue-500 bg-blue-50 border-blue-200",
      installer: "Sajid Mahmood (Field Lead)",
      steps: [
        { label: "Assigned", time: "09:00 AM", done: true },
        { label: "Dispatched", time: "09:45 AM", done: true },
        { label: "In Progress", time: "10:15 AM", done: true },
        { label: "Completed & Verified", time: "--:--", done: false },
      ],
      canActivate: false
    },
    {
      id: "JOB-1023",
      customer: "Ali & Sons",
      location: "Bahria Town Phase 4, Islamabad",
      equipment: "CoreTECH AIO Solar Hub 20kW",
      status: "Completed",
      statusColor: "text-emerald-500 bg-emerald-50 border-emerald-200",
      installer: "Haris Khan (Senior Tech)",
      steps: [
        { label: "Assigned", time: "Yesterday", done: true },
        { label: "Dispatched", time: "Yesterday", done: true },
        { label: "In Progress", time: "Yesterday", done: true },
        { label: "Completed & Verified", time: "09:30 AM Today", done: true },
      ],
      canActivate: true
    },
    {
      id: "JOB-1026",
      customer: "Kamil Traders",
      location: "I-9 Industrial Area, Islamabad",
      equipment: "Huawei 10kW Inverter + 10kW Battery",
      status: "Delayed",
      statusColor: "text-rose-500 bg-rose-50 border-rose-200",
      installer: "Zahid Ahmed (Structural clamp pending from LHR Warehouse)",
      steps: [
        { label: "Assigned", time: "07:30 AM", done: true },
        { label: "Dispatched", time: "08:15 AM", done: true },
        { label: "In Progress", time: "09:00 AM", done: true },
        { label: "Delayed: Supply Chain Block", time: "10:00 AM", done: true, error: true },
      ],
      canActivate: false
    }
  ];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 select-none">
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

        {/* Outstanding Receivables Ledger */}
        <div className="bg-[#F0FAFE] border border-cyan-200 rounded-[12px] p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-[#00B4D8] uppercase tracking-wider">Outstanding Ledger</p>
            <h4 className="text-xl font-extrabold text-slate-800">Rs. 4.25M</h4>
            <p className="text-[9px] text-cyan-600 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> 12 Distributors overdue
            </p>
          </div>
          <CreditCard className="w-8 h-8 text-[#00B4D8] opacity-75" />
        </div>

        {/* Open Inquiries & TAT SLA Status */}
        <div className="bg-slate-50 border border-slate-200 rounded-[12px] p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Open Support Tickets</p>
            <h4 className="text-xl font-extrabold text-slate-800">{ticketsCount} Inquiries</h4>
            <p className="text-[9px] text-rose-600 font-bold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 animate-pulse" /> 1 ticket pending &gt; 24 hrs
            </p>
          </div>
          <MessageSquare className="w-8 h-8 text-slate-400 opacity-75" />
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
              {mockJobs.map((job) => (
                <div key={job.id} className="border border-slate-100 rounded-[10px] p-4 space-y-4 hover:border-slate-200 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">{job.id}</span>
                      <h4 className="font-bold text-slate-800 text-sm mt-0.5">{job.customer}</h4>
                      <p className="text-[10px] text-slate-500 font-medium">{job.location} | <span className="text-[#00B4D8]">{job.equipment}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full border text-[9px] font-extrabold uppercase ${job.statusColor}`}>
                        {job.status}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Progress Timeline */}
                  <div className="grid grid-cols-4 gap-2 relative pt-2">
                    <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-100 -z-10"></div>
                    {job.steps.map((step, idx) => (
                      <div key={idx} className="flex flex-col items-center text-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] font-bold ${
                          step.done 
                            ? step.error 
                              ? "bg-rose-50 border-rose-200 text-rose-500"
                              : "bg-[#F0FAFE] border-[#00B4D8] text-[#00B4D8]"
                            : "bg-white border-slate-200 text-slate-400"
                        }`}>
                          {step.done ? (step.error ? "!" : "✓") : idx + 1}
                        </div>
                        <span className={`text-[9px] font-bold mt-1.5 ${step.done ? "text-slate-700" : "text-slate-400"}`}>{step.label}</span>
                        <span className="text-[8px] text-slate-400">{step.time}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-50 pt-3 text-[10px] text-slate-500 font-semibold">
                    <span>Lead: {job.installer}</span>
                    {job.canActivate ? (
                      <button
                        onClick={() => handleActivateWarranty(job.id)}
                        disabled={warrantyActivated[job.id]}
                        className={`h-7 px-3 text-[9px] font-bold rounded-[4px] shadow flex items-center gap-1 transition-colors ${
                          warrantyActivated[job.id] 
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-not-allowed" 
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
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
