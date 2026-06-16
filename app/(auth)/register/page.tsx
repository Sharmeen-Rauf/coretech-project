"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserAction } from "@/app/actions/users";
import toast from "react-hot-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contact, setContact] = useState("");
  const [designation, setDesignation] = useState("");
  const [role, setRole] = useState("employee");
  const [group, setGroup] = useState("sales");
  const [isLoading, setIsLoading] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required";
    if (!lastName.trim()) errs.lastName = "Last name is required";
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
    if (!contact.trim()) errs.contact = "Contact number is required";
    if (!designation.trim()) errs.designation = "Designation is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      // Call the Server Action which uses the admin client to bypass SMTP limits
      const res = await createUserAction({
        firstName,
        lastName,
        email,
        password,
        designation,
        contact,
        role,
        group,
        status: "active",
      });

      if (!res.success) {
        throw new Error(res.error || "Registration failed");
      }

      toast.success("Account successfully registered! Please log in.");
      router.push("/login");
    } catch (err: any) {
      toast.error(err.message || "Registration error occurred");
    } finally {
      setIsLoading(false);
    }
  };

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
      <div className="w-full max-w-md bg-[#F0FAFE] border border-[#00B4D8] rounded-[12px] p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/login"
            className="p-1 hover:bg-slate-200/50 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h2 className="text-xl font-bold text-slate-800">Register Account</h2>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                First Name*
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`w-full h-9 px-3 bg-white border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.firstName ? "border-rose-500" : "border-[#00B4D8]/30"
                }`}
                required
              />
              {errors.firstName && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.firstName}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Last Name*
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`w-full h-9 px-3 bg-white border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.lastName ? "border-rose-500" : "border-[#00B4D8]/30"
                }`}
                required
              />
              {errors.lastName && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Email Address*
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={`w-full h-9 px-3 bg-white border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                errors.email ? "border-rose-500" : "border-[#00B4D8]/30"
              }`}
              required
            />
            {errors.email && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Password*
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className={`w-full h-9 px-3 bg-white border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                errors.password ? "border-rose-500" : "border-[#00B4D8]/30"
              }`}
              required
            />
            {errors.password && (
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.password}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Contact Phone*
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="0300-1234567"
                className={`w-full h-9 px-3 bg-white border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.contact ? "border-rose-500" : "border-[#00B4D8]/30"
                }`}
                required
              />
              {errors.contact && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.contact}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Designation*
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Sales Officer"
                className={`w-full h-9 px-3 bg-white border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                  errors.designation ? "border-rose-500" : "border-[#00B4D8]/30"
                }`}
                required
              />
              {errors.designation && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.designation}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Account Role*
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-9 px-2 bg-white border border-[#00B4D8]/30 rounded-[6px] text-xs text-slate-850 focus:outline-none focus:border-[#00B4D8]"
              >
                <option value="admin">Admin</option>
                <option value="employee">Employee</option>
                <option value="distributor">Distributor</option>
                <option value="sub_dealer">Sub Dealer</option>
                <option value="installer">Installer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Department Group
              </label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full h-9 px-2 bg-white border border-[#00B4D8]/30 rounded-[6px] text-xs text-slate-850 focus:outline-none focus:border-[#00B4D8]"
              >
                <option value="sales">Sales</option>
                <option value="operations">Operations</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 mt-2 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 text-white font-medium rounded-[6px] flex items-center justify-center gap-2 shadow transition-all duration-200"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Register
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-[11px] text-slate-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[#00B4D8] hover:text-[#0077B6] font-bold transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
