"use client";

import React from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen w-full bg-[#FAFBFC] flex flex-col items-center justify-center p-4 select-none font-sans">
      {/* Brand Logo Header */}
      <div className="mb-6 flex flex-col items-center animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0077B6] to-[#00B4D8] flex items-center justify-center text-white font-extrabold text-xs shadow-md">
            CT
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">
            Core<span className="text-[#00B4D8]">TECH</span>
          </span>
        </div>
        <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest font-bold">
          Access Control Manager
        </p>
      </div>

      {/* Main Error Container */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[16px] p-8 text-center space-y-6 shadow-xl relative overflow-hidden">
        {/* Decorative Top Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />
        
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500 shadow-inner">
          <ShieldAlert className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Access Denied</h2>
          <p className="text-xs text-slate-500 leading-relaxed px-4">
            Your account role has restricted access or your profile approval status is currently <span className="font-bold text-rose-600">Pending Review</span> or <span className="font-bold text-rose-600">Suspended</span>.
          </p>
        </div>

        <div className="bg-[#FFF8F8] border border-rose-100 rounded-[12px] p-4 text-left text-xs text-slate-655 leading-relaxed space-y-2.5">
          <div className="flex gap-2 items-start">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
            <p><strong>Unverified Profile:</strong> Wait for your Admin or Country Head to verify and approve your registration status.</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
            <p><strong>Restricted Privileges:</strong> Verify that you are attempting to log in using the correct management credentials.</p>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Link
            href="/login"
            className="w-full h-11 bg-[#00B4D8] hover:bg-[#0077B6] text-white rounded-[8px] font-bold text-xs shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
