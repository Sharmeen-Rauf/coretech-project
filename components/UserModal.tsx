"use client";

import React, { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createUserAction, updateUserAction } from "@/app/actions/users";
import toast from "react-hot-toast";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: string;
  onSuccess: () => void;
  editingUser?: any;
}

export default function UserModal({
  isOpen,
  onClose,
  role,
  onSuccess,
  editingUser,
}: UserModalProps) {
  const isEdit = !!editingUser;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [designation, setDesignation] = useState("");
  const [contact, setContact] = useState("");
  const [group, setGroup] = useState("sales");
  const [status, setStatus] = useState("active");
  const [isLoading, setIsLoading] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (editingUser) {
        setFirstName(editingUser.first_name || "");
        setLastName(editingUser.last_name || "");
        setEmail(editingUser.email || "");
        setDesignation(editingUser.designation || "");
        setContact(editingUser.contact || "");
        setGroup(editingUser.group_name || "sales");
        setStatus(editingUser.status || "active");
        setPassword("");
      } else {
        setFirstName("");
        setLastName("");
        setEmail("");
        setPassword("");
        setDesignation("");
        setContact("");
        setGroup("sales");
        setStatus("active");
      }
      setErrors({});
    }
  }, [isOpen, editingUser]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required";
    if (!lastName.trim()) errs.lastName = "Last name is required";
    
    if (!isEdit) {
      if (!email.trim()) {
        errs.email = "Email is required";
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        errs.email = "Email format is invalid";
      }
      if (!password) {
        errs.password = "Password is required";
      } else if (password.length < 6) {
        errs.password = "Password must be at least 6 characters";
      }
    }
    
    if (!designation.trim()) errs.designation = "Designation is required";
    if (!contact.trim()) errs.contact = "Contact number is required";
    
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    const formData = {
      firstName,
      lastName,
      email,
      password,
      designation,
      contact,
      role: role.toLowerCase().replace(" ", "_"),
      group,
      status,
    };

    try {
      let res;
      if (isEdit) {
        res = await updateUserAction(editingUser.id, formData);
      } else {
        res = await createUserAction(formData);
      }

      if (res.success) {
        toast.success(res.message || "Success");
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Operation failed");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
      ></div>

      {/* Card Body */}
      <div className="relative bg-white w-full max-w-md border border-slate-100 rounded-[12px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800">
            {isEdit ? `Edit ${role}` : `Add ${role}`}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                First Name*
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.firstName ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.firstName && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.firstName}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Last Name*
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.lastName ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.lastName && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.lastName}</p>
              )}
            </div>
          </div>

          {!isEdit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Email Address*
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                    errors.email ? "border-rose-500" : "border-slate-200"
                  }`}
                />
                {errors.email && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.email}</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Password*
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                    errors.password ? "border-rose-500" : "border-slate-200"
                  }`}
                />
                {errors.password && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.password}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Designation*
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.designation ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.designation && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.designation}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Contact Phone*
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="0300-1234567"
                className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.contact ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.contact && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.contact}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Department Group
              </label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
              >
                <option value="owner">Owner</option>
                <option value="sales">Sales</option>
                <option value="operations">Operations</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Status
              </label>
              <div className="flex items-center mt-2">
                <button
                  type="button"
                  onClick={() => setStatus(status === "active" ? "inactive" : "active")}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors focus:outline-none ${
                    status === "active" ? "bg-[#00B4D8]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      status === "active" ? "translate-x-5" : ""
                    }`}
                  ></span>
                </button>
                <span className="text-xs text-slate-600 font-bold ml-3 uppercase tracking-wider select-none">
                  {status}
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-100 rounded-[6px] text-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="h-9 px-4 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
