"use client";

import { useState } from "react";
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { lookupUserByEmailAction, resetUserPasswordAction } from "@/app/actions/users";

const MIN_LENGTH = 8;

export default function AdminPasswordReset() {
  const [email, setEmail] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [found, setFound] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [justReset, setJustReset] = useState(false);

  const passwordTooShort = newPassword.length > 0 && newPassword.length < MIN_LENGTH;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    newPassword.length >= MIN_LENGTH && confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFound(null);
    setNotFound(false);
    setJustReset(false);
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
    if (!found || !canSubmit) return;
    if (
      !window.confirm(
        `Set a new password for ${found.name} (${found.email})? Their current password will stop working immediately.`
      )
    )
      return;

    setIsResetting(true);
    try {
      const res = await resetUserPasswordAction(found.email, newPassword);
      if (res.success) {
        setJustReset(true);
        toast.success("Password updated successfully");
      } else {
        toast.error(res.error || "Failed to reset password");
      }
    } finally {
      setIsResetting(false);
    }
  };

  const resetAll = () => {
    setFound(null);
    setNotFound(false);
    setEmail("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setJustReset(false);
  };

  return (
    <div className="max-w-lg bg-white border border-slate-100 rounded-[12px] p-6 shadow-sm space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-800">Reset a User's Password</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Look up an account by email, then set a new password for it directly. Their current
          password stops working the moment it's changed.
        </p>
      </div>

      {!found && !justReset && (
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

      {notFound && !found && (
        <p className="text-xs text-rose-500 font-semibold">
          No account exists with that email address.
        </p>
      )}

      {found && !justReset && (
        <div className="border border-slate-100 bg-slate-50/50 rounded-[8px] p-4 space-y-4">
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

          <div className="border-t border-slate-200 pt-3 space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={`w-full h-9 px-3 pr-9 border rounded-[6px] text-xs text-slate-800 focus:outline-none bg-white ${
                    passwordTooShort ? "border-rose-300" : "border-slate-200 focus:border-[#00B4D8]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {passwordTooShort && (
                <p className="text-[9px] text-rose-500 mt-1 font-bold">
                  Must be at least {MIN_LENGTH} characters
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter the password"
                className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none bg-white ${
                  passwordsMismatch ? "border-rose-300" : "border-slate-200 focus:border-[#00B4D8]"
                }`}
              />
              {passwordsMismatch && (
                <p className="text-[9px] text-rose-500 mt-1 font-bold">Passwords don't match</p>
              )}
            </div>
          </div>

          <button
            onClick={handleReset}
            disabled={isResetting || !canSubmit}
            className="w-full h-9 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white text-xs font-bold rounded-[6px] flex items-center justify-center gap-1.5"
          >
            {isResetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Set New Password
          </button>
        </div>
      )}

      {justReset && found && (
        <div className="border border-emerald-200 bg-emerald-50/50 rounded-[8px] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-bold text-emerald-800">
              Password updated for {found.name} ({found.email})
            </p>
          </div>
          <button
            onClick={resetAll}
            className="w-full h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-[6px]"
          >
            Reset Another
          </button>
        </div>
      )}
    </div>
  );
}
