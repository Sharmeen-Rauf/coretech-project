"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import toast from "react-hot-toast";
import { User, Shield, Phone, Mail, Key, Save, Loader2 } from "lucide-react";

export default function AccountPage() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [profile, setProfile] = useState<any>({
    first_name: "",
    last_name: "",
    contact: "",
    email: "",
    role: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;

      setProfile({
        ...data,
        email: session.user.email,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          contact: profile.contact,
        })
        .eq("id", session.user.id);

      if (error) throw error;
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (passwordForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.password,
      });

      if (error) throw error;
      toast.success("Password updated successfully!");
      setPasswordForm({ password: "", confirmPassword: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Account Settings</h1>
        <p className="text-xs text-slate-500">
          Manage your personal details, credentials, and settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Side: Summary Panel */}
        <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-sm flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-[#F0FAFE] text-[#00B4D8] font-bold text-3xl flex items-center justify-center border border-[#00B4D8]/20 shadow-inner">
            {profile.first_name ? profile.first_name.charAt(0).toUpperCase() : "?"}
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-lg">
              {profile.first_name} {profile.last_name || ""}
            </h2>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-full bg-[#F0FAFE] text-[#00B4D8] text-[10px] font-bold uppercase border border-[#00B4D8]/10">
              <Shield className="w-3 h-3" />
              {profile.role || "User"}
            </div>
          </div>
          <div className="w-full border-t border-slate-100 pt-4 space-y-2 text-left text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="truncate">{profile.email}</span>
            </div>
            {profile.contact && (
              <div className="flex items-center gap-2 text-slate-500">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{profile.contact}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Forms */}
        <div className="md:col-span-2 space-y-8">
          {/* Edit Profile details */}
          <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-sm">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-6">
              <User className="w-4 h-4 text-[#00B4D8]" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Profile Details
              </h3>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profile.first_name}
                    onChange={(e) =>
                      setProfile({ ...profile, first_name: e.target.value })
                    }
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profile.last_name || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, last_name: e.target.value })
                    }
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  value={profile.contact || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, contact: e.target.value })
                  }
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors disabled:opacity-55"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Profile
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-sm">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-6">
              <Key className="w-4 h-4 text-[#00B4D8]" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Security & Password
              </h3>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={passwordForm.password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, password: e.target.value })
                  }
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  placeholder="Repeat new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="h-9 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors disabled:opacity-55"
                >
                  {changingPassword ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Key className="w-3.5 h-3.5" />
                  )}
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
