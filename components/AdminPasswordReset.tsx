"use client";

import { useState } from "react";
import { Loader2, Copy, Check } from "lucide-react";
import toast from "react-hot-toast";
import { lookupUserByEmailAction, resetUserPasswordAction } from "@/app/actions/users";

export default function AdminPasswordReset() {
  const [email, setEmail] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [found, setFound] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFound(null);
    setNotFound(false);
    setRevealedPassword(null);
    if (!email.trim()) return;

    setIsLookingUp(true);
    try {
      const res = await lookupUserByEmailAction(email.trim());
      if (res.success) {
        setFound(res.data);
      } else {
        setNotFound(true);
        toast.error(res.error || "No account found with that email");
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleReset = async () => {
    if (!found) return;
    if (
      !window.confirm(
        `Reset the password for ${found.name} (${found.email})? Their current password will stop working immediately.`
      )
    )
      return;

    setIsResetting(true);
    try {
      const res = await resetUserPasswordAction(found.email);
      if (res.success && res.password) {
        setRevealedPassword(res.password);
        toast.success("Password reset successfully");
      } else {
        toast.error(res.error || "Failed to reset password");
      }
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopy = async () => {
    if (!revealedPassword) return;
    await navigator.clipboard.writeText(revealedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    setRevealedPassword(null);
    setFound(null);
    setNotFound(false);
    setEmail("");
  };

  return (
    <div className="max-w-lg bg-white border border-slate-100 rounded-[12px] p-6 shadow-sm space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-800">Reset a User's Password</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Enter any account's email address to generate a brand-new random password. Their current
          password stops working the moment it's reset.
        </p>
      </div>

      {!revealedPassword && (
        <form onSubmit={handleLookup} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFound(null);
                setNotFound(false);
              }}
              placeholder="user@example.com"
              className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={isLookingUp || !email.trim()}
            className="h-9 px-4 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 rounded-[6px] flex items-center gap-1.5 shrink-0"
          >
            {isLookingUp && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Look Up
          </button>
        </form>
      )}

      {notFound && (
        <p className="text-xs text-rose-500 font-semibold">
          No account exists with that email address.
        </p>
      )}

      {found && !revealedPassword && (
        <div className="border border-slate-100 bg-slate-50/50 rounded-[8px] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[9px] font-extrabold text-slate-500 uppercase">Name</p>
              <p className="font-bold text-slate-800 mt-0.5">{found.name || "-"}</p>
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-slate-500 uppercase">Role</p>
              <p className="font-bold text-slate-800 mt-0.5 capitalize">
                {(found.role || "-").replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-slate-500 uppercase">Status</p>
              <p className="font-bold text-slate-800 mt-0.5 capitalize">{found.status || "-"}</p>
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-slate-500 uppercase">Email</p>
              <p className="font-bold text-slate-800 mt-0.5 break-all">{found.email}</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="w-full h-9 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white text-xs font-bold rounded-[6px] flex items-center justify-center gap-1.5"
          >
            {isResetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Reset Password
          </button>
        </div>
      )}

      {revealedPassword && (
        <div className="border border-amber-200 bg-amber-50/50 rounded-[8px] p-4 space-y-3">
          <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
            Copy this now — it will not be shown again
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border border-slate-200 rounded-[6px] px-3 py-2 text-sm font-mono font-bold text-slate-800 select-all break-all">
              {revealedPassword}
            </div>
            <button
              onClick={handleCopy}
              className="h-9 px-3 bg-slate-700 hover:bg-slate-800 text-white rounded-[6px] flex items-center gap-1.5 text-xs font-semibold shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            onClick={handleDone}
            className="w-full h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-[6px]"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
