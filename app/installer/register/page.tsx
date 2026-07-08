"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserAction } from "@/app/actions/users";
import toast from "react-hot-toast";
import { 
  Loader2, 
  CheckCircle,
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Lock, 
  CreditCard
} from "lucide-react";
import Link from "next/link";

export default function InstallerRegisterPage() {
  const router = useRouter();

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [cnic, setCnic] = useState("");
  const [contact, setContact] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("Single");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [paymentNo, setPaymentNo] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatCNIC = (value: string) => {
    // Strip non-numeric
    const clean = value.replace(/\D/g, "");
    if (clean.length <= 5) return clean;
    if (clean.length <= 12) return `${clean.slice(0, 5)}-${clean.slice(5)}`;
    return `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12, 13)}`;
  };

  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnic(formatCNIC(e.target.value));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required";
    if (!lastName.trim()) errs.lastName = "Last name is required";
    if (!address.trim()) errs.address = "Address is required";
    if (!city.trim()) errs.city = "City is required";
    if (!state) errs.state = "State selection is required";
    
    // CNIC validator: 13 digits format: 12345-1234567-1
    const cleanCnic = cnic.replace(/\D/g, "");
    if (!cnic) {
      errs.cnic = "CNIC is required";
    } else if (cleanCnic.length !== 13) {
      errs.cnic = "CNIC must be exactly 13 digits";
    }

    if (!contact.trim()) {
      errs.contact = "Contact number is required";
    } else if (contact.trim().length < 10) {
      errs.contact = "Enter a valid contact number";
    }

    if (!email.trim()) {
      errs.email = "Email/Gmail is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errs.email = "Email format is invalid";
    }

    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < 6) {
      errs.password = "Password must be at least 6 characters";
    }

    if (!paymentNo.trim()) {
      errs.paymentNo = "EasyPaisa / JazzCash number is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please correct errors before submitting");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Prepare installer metadata for designation column
      const installerMetadata = {
        marital_status: maritalStatus,
        easypaisa_jazzcash_no: paymentNo,
        registered_via: "QR_CODE_SCAN"
      };

      // Call server action to create confirmed auth user + profile
      const res = await createUserAction({
        firstName,
        lastName,
        email,
        password,
        designation: `[INSTALLER_METADATA]${JSON.stringify(installerMetadata)}`,
        contact,
        role: "installer",
        group: "installers",
        status: "pending", // waiting for owner approval
        state,
        address,
        city,
        cnic,
      });

      if (!res.success) {
        throw new Error(res.error || "Registration failed");
      }

      setIsSuccess(true);
      toast.success("Registration submitted! Pending owner review.");
    } catch (err: any) {
      toast.error(err.message || "Registration error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center justify-center p-4 font-sans select-none">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-[16px] p-8 text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
            <CheckCircle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800">Application Submitted</h2>
            <p className="text-xs text-slate-500 leading-relaxed px-2">
              Thank you for registering, <span className="font-bold text-slate-700">{firstName} {lastName}</span>! 
              Your application is under review. Please wait for the Owner to approve your account.
            </p>
          </div>
          
          <div className="bg-amber-50/50 border border-amber-100 rounded-[12px] p-4 text-left text-xs space-y-1 text-slate-655 font-medium">
            <p className="font-bold text-amber-800 text-center mb-1">Approval Stage: PENDING</p>
            <p>• Profile documents submitted (CNIC: {cnic}).</p>
            <p>• Payout Account: {paymentNo}.</p>
          </div>

          <button
            onClick={() => router.push("/login")}
            className="w-full h-11 bg-[#00B4D8] hover:bg-[#0077B6] text-white rounded-[8px] font-bold text-xs shadow-lg shadow-cyan-100 flex items-center justify-center gap-1.5 transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[16px] p-6 shadow-xl space-y-6 my-4">
        {/* Header */}
        <div className="flex flex-col items-center border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0077B6] to-[#00B4D8] flex items-center justify-center text-white font-extrabold text-lg shadow-md mb-2">
            CT
          </div>
          <h2 className="text-lg font-bold text-slate-800">Installer Network</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Pakistan Application Form</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          
          {/* Name Section */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                First Name*
              </label>
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`w-full h-10 px-3 border rounded-[8px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                  errors.firstName ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.firstName && <p className="text-[9px] text-rose-500 mt-1 font-bold">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Last Name*
              </label>
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`w-full h-10 px-3 border rounded-[8px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                  errors.lastName ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.lastName && <p className="text-[9px] text-rose-500 mt-1 font-bold">{errors.lastName}</p>}
            </div>
          </div>

          {/* Contact & Email */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Contact Number*
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-[10px] font-bold text-slate-400">PK</span>
                <input
                  type="text"
                  placeholder="e.g. 03001234567"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className={`w-full h-10 pl-9 pr-3 border rounded-[8px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                    errors.contact ? "border-rose-500" : "border-slate-200"
                  }`}
                />
              </div>
              {errors.contact && <p className="text-[9px] text-rose-500 mt-1 font-bold">{errors.contact}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Gmail / Email Address*
              </label>
              <input
                type="email"
                placeholder="installer@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full h-10 px-3 border rounded-[8px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                  errors.email ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.email && <p className="text-[9px] text-rose-500 mt-1 font-bold">{errors.email}</p>}
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Secure Password*
            </label>
            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full h-10 px-3 border rounded-[8px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                errors.password ? "border-rose-500" : "border-slate-200"
              }`}
            />
            {errors.password && <p className="text-[9px] text-rose-500 mt-1 font-bold">{errors.password}</p>}
          </div>

          {/* CNIC (NIC Number) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              CNIC Number (NIC Number)*
            </label>
            <input
              type="text"
              placeholder="37405-1234567-1"
              maxLength={15}
              value={cnic}
              onChange={handleCnicChange}
              className={`w-full h-10 px-3 border rounded-[8px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                errors.cnic ? "border-rose-500" : "border-slate-200"
              }`}
            />
            {errors.cnic && <p className="text-[9px] text-rose-500 mt-1 font-bold">{errors.cnic}</p>}
          </div>

          {/* Address details */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Street Address*
              </label>
              <input
                type="text"
                placeholder="Full Residential Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`w-full h-10 px-3 border rounded-[8px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                  errors.address ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.address && <p className="text-[9px] text-rose-500 mt-1 font-bold">{errors.address}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  City*
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lahore"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={`w-full h-10 px-3 border rounded-[8px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                    errors.city ? "border-rose-500" : "border-slate-200"
                  }`}
                />
                {errors.city && <p className="text-[9px] text-rose-500 mt-1 font-bold">{errors.city}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  State / Province*
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={`w-full h-10 px-2 border rounded-[8px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                    errors.state ? "border-rose-500" : "border-slate-200"
                  }`}
                >
                  <option value="">Select State</option>
                  <option value="Punjab">Punjab</option>
                  <option value="Sindh">Sindh</option>
                  <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa</option>
                  <option value="Balochistan">Balochistan</option>
                  <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
                  <option value="Azad Kashmir">Azad Kashmir</option>
                  <option value="Islamabad Capital Territory">Islamabad</option>
                </select>
                {errors.state && <p className="text-[9px] text-rose-500 mt-1 font-bold">{errors.state}</p>}
              </div>
            </div>
          </div>

          {/* Marital Status & Payout details */}
          <div className="grid grid-cols-2 gap-3 pb-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Marital Status
              </label>
              <select
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                className="w-full h-10 px-2 border border-slate-200 rounded-[8px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
              >
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                EasyPaisa / JazzCash No.*
              </label>
              <input
                type="text"
                placeholder="Payout Account No."
                value={paymentNo}
                onChange={(e) => setPaymentNo(e.target.value)}
                className={`w-full h-10 px-3 border rounded-[8px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white ${
                  errors.paymentNo ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {errors.paymentNo && <p className="text-[9px] text-rose-500 mt-1 font-bold">{errors.paymentNo}</p>}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/65 text-white rounded-[8px] font-bold text-xs shadow-lg shadow-cyan-100 flex items-center justify-center gap-1.5 transition-all mt-4 hover:scale-[1.01]"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? "Creating installer account..." : "Submit Registration"}
          </button>
        </form>

        <div className="text-center pt-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-550 font-medium">
            Already have an approved account?{" "}
            <Link href="/login" className="text-[#00B4D8] font-bold hover:underline">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
