"use client";

import React from "react";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center p-4 select-none">
      {/* Brand Header */}
      <div className="mb-6 flex flex-col items-center">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0077B6] to-[#00B4D8] flex items-center justify-center text-white font-extrabold text-sm shadow">
            CT
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-800">
            Core<span className="text-[#00B4D8]">TECH</span>
          </span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">
          Your Core Partner in TECH
        </p>
      </div>

      {/* Card Body */}
      <div className="w-full max-w-md bg-white border border-rose-200 rounded-[12px] p-6 shadow-lg text-center space-y-6">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500 shadow-inner">
          <ShieldAlert className="w-9 h-9" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-slate-800">Public Registration Closed</h2>
          <p className="text-xs text-slate-500 leading-relaxed px-4">
            Security policy prohibits self-registration. Only pre-authorized staff members added by the Admin, Country Head, or Retail Manager can sign in.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-4 text-left text-xs text-slate-600 leading-normal space-y-2">
          <p className="font-bold text-slate-700">How to get access:</p>
          <p>• Contact your Regional Manager or Administrator to whitelist your email address.</p>
          <p>• Once registered internally, you will receive your login credentials immediately.</p>
        </div>

        <div className="pt-2">
          <Link
            href="/login"
            className="w-full h-10 border border-slate-200 text-slate-600 hover:bg-slate-55 rounded-[8px] font-bold text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
