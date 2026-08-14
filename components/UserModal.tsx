"use client";

import React, { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createUserAction, updateUserAction, fetchRecordsAction } from "@/app/actions/users";
import toast from "react-hot-toast";
import { mergeLocalItems } from "@/lib/supabaseLocalFallback";

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

  // Distributor specific states
  const [state, setState] = useState("");
  const [region, setRegion] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [cnic, setCnic] = useState("");

  // Installer specific states
  const [maritalStatus, setMaritalStatus] = useState("Single");
  const [paymentProvider, setPaymentProvider] = useState("EasyPaisa");
  const [paymentAccountNo, setPaymentAccountNo] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dbWarehouses, setDbWarehouses] = useState<string[]>([]);
  const [systemRegions, setSystemRegions] = useState<{ id: string; name: string; region_code: string; warehouse: string }[]>([]);

  const resolveRegionValue = (raw: string) => {
    if (!raw) return "";
    const clean = raw.toLowerCase().trim();
    const found = systemRegions.find(
      r => r.name.toLowerCase().trim() === clean ||
           r.region_code.toLowerCase().trim() === clean ||
           `${r.name} (${r.region_code})`.toLowerCase().trim() === clean ||
           clean.includes(r.name.toLowerCase().trim()) ||
           clean.includes(r.region_code.toLowerCase().trim())
    );
    return found ? found.name : raw;
  };

  const formatCNIC = (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length <= 5) return clean;
    if (clean.length <= 12) return `${clean.slice(0, 5)}-${clean.slice(5)}`;
    return `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12, 13)}`;
  };

  useEffect(() => {
    const loadRegionsAndWHs = async () => {
      let dbData: any[] = [];
      try {
        const res = await fetchRecordsAction("regions");
        if (res.success && res.data) {
          dbData = res.data;
        }
      } catch (err) {
        console.warn("Failed to load regions for dropdown", err);
      }
      const merged = mergeLocalItems(dbData, "coretech_local_regions");
      const formatted = merged.map((r: any) => ({
        id: r.id || r.region_code || r.name,
        name: r.name || r.region_code || "",
        region_code: r.region_code || "",
        warehouse: r.warehouse || "",
      })).filter((r: any) => r.name);
      setSystemRegions(formatted);

      const names = Array.from(new Set(merged.map((r: any) => r.warehouse).filter(Boolean))) as string[];
      setDbWarehouses(names);
    };
    loadRegionsAndWHs();
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (editingUser) {
        setFirstName(editingUser.first_name || "");
        setLastName(editingUser.last_name || "");
        setEmail(editingUser.email || "");
        setContact(editingUser.contact || "");
        if (role === "Employee") {
          setGroup(editingUser.role || "rsm");
        } else {
          setGroup(editingUser.group_name || "sales");
        }
        setStatus(editingUser.status || "active");
        setPassword("");
 
        // Check for serialized metadata fallback in designation
        let meta: any = {};
        let cleanDesignation = editingUser.designation || "";
        if (editingUser.designation && editingUser.designation.startsWith("[DISTRIBUTOR_METADATA]")) {
          try {
            meta = JSON.parse(editingUser.designation.replace("[DISTRIBUTOR_METADATA]", ""));
            cleanDesignation = meta.designation || (role === "Distributor" ? "Distributor" : "");
          } catch (e) {
            cleanDesignation = "";
          }
        }
        setDesignation(cleanDesignation);
        setState(editingUser.state || meta.state || "");
        
        const rawRegion = editingUser.region || meta.region || "";
        setRegion(rawRegion);
        setWarehouse(editingUser.warehouse || meta.warehouse || "");
        setAddress(editingUser.address || meta.address || "");
        setCity(editingUser.city || meta.city || "");
        setBankName(editingUser.bank_name || meta.bankName || "");
        setBankAccount(editingUser.bank_account || meta.bankAccount || "");
        setAccountHolderName(editingUser.account_holder_name || meta.accountHolderName || "");
        setCnic(editingUser.cnic || meta.cnic || "");
        setMaritalStatus(editingUser.marital_status || "Single");
        setPaymentProvider(editingUser.payment_provider || "EasyPaisa");
        setPaymentAccountNo(editingUser.payment_account_no || "");
      } else {
        setFirstName("");
        setLastName("");
        setEmail("");
        setPassword("");
        setDesignation(role === "Distributor" ? "Distributor" : "");
        setContact("");
        if (role === "Employee") {
          setGroup("rsm");
        } else {
          setGroup("sales");
        }
        setStatus("active");
        setState("");
        setRegion("");
        setWarehouse("");
        setAddress("");
        setCity("");
        setBankName("");
        setBankAccount("");
        setAccountHolderName("");
        setCnic("");
        setMaritalStatus("Single");
        setPaymentProvider("EasyPaisa");
        setPaymentAccountNo("");
      }
      setErrors({});
    }
  }, [isOpen, editingUser, role]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) {
      errs.firstName = role === "Distributor" ? "Distributor name is required" : "First name is required";
    }
    if (!lastName.trim()) {
      errs.lastName = role === "Distributor" ? "Owner name is required" : "Last name is required";
    }
    
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
    
    if (role !== "Distributor" && role !== "Installer" && !designation.trim()) errs.designation = "Designation is required";
    if (!contact.trim()) errs.contact = "Contact number is required";
    
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    const finalRole = role === "Employee" ? group : role.toLowerCase().replace(" ", "_");
    const finalGroup = 
      finalRole === "rsm" ? "sales" :
      finalRole === "country_head" ? "sales" :
      finalRole === "retail_manager" ? "sales" :
      finalRole === "marketing_manager" ? "operations" :
      finalRole === "admin" ? "owner" :
      role === "Distributor" ? "sales" :
      group;

    const formData = {
      firstName,
      lastName,
      email,
      password,
      designation: role === "Distributor" ? "Distributor" : role === "Installer" ? "Installer" : designation,
      contact,
      role: finalRole,
      group: finalGroup,
      status,
      state,
      region,
      warehouse,
      address,
      city,
      bankName,
      bankAccount,
      accountHolderName,
      cnic,
      maritalStatus,
      paymentProvider,
      paymentAccountNo,
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
      <div className={`relative bg-white w-full ${role === "Distributor" ? "max-w-2xl" : "max-w-md"} border border-slate-100 rounded-[12px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200`}>
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
          {role === "Distributor" ? (
            <div className="grid grid-cols-2 gap-6 text-slate-800 text-left">
              {/* Left Column: Distributor Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#00B4D8] uppercase tracking-wider border-b pb-1">
                  Distributor Info
                </h4>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Distributor Name*
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
                    Contact Phone*
                  </label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 03001234567"
                    className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                      errors.contact ? "border-rose-500" : "border-slate-200"
                    }`}
                  />
                  {errors.contact && (
                    <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.contact}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Punjab"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    System Region
                  </label>
                  <select
                    value={resolveRegionValue(region)}
                    onChange={(e) => {
                      const sel = e.target.value;
                      setRegion(sel);
                      const matched = systemRegions.find(r => r.name === sel || r.region_code === sel);
                      if (matched && matched.warehouse) setWarehouse(matched.warehouse);
                    }}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white font-semibold"
                  >
                    <option value="">Select Region</option>
                    {systemRegions.map((reg) => (
                      <option key={reg.id || reg.name} value={reg.name}>
                        {reg.name} ({reg.region_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Warehouse
                  </label>
                  <select
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white"
                  >
                    <option value="">Select Warehouse</option>
                    {dbWarehouses.map((wh) => (
                      <option key={wh} value={wh}>
                        {wh}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lahore"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Complete Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Complete Street Address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] resize-none"
                  />
                </div>
              </div>

              {/* Right Column: Owner & Bank Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#00B4D8] uppercase tracking-wider border-b pb-1">
                  Owner & Bank Info
                </h4>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Owner Name*
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
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    placeholder="Owner / Co. Account Name"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HBL / Alfalah"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Bank Account / IBAN
                  </label>
                  <input
                    type="text"
                    placeholder="Account Number / IBAN"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  />
                </div>

                {/* Login Info Card */}
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-1 pt-2">
                  System Credentials
                </h4>
                {!isEdit ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Email*
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full h-9 px-2 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                          errors.email ? "border-rose-500" : "border-slate-200"
                        }`}
                      />
                      {errors.email && (
                        <p className="text-[9px] text-rose-500 font-semibold mt-0.5">{errors.email}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Password*
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full h-9 px-2 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                          errors.password ? "border-rose-500" : "border-slate-200"
                        }`}
                      />
                      {errors.password && (
                        <p className="text-[9px] text-rose-500 font-semibold mt-0.5">{errors.password}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">
                    Login credentials cannot be modified inside the profile modal.
                  </p>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Status
                    </label>
                    <div className="flex items-center mt-1.5">
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
                      <span className="text-[10px] text-slate-600 font-bold ml-2 uppercase tracking-wider">
                        {status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : role === "Installer" ? (
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
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Contact Number*
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value.replace(/\D/g, ""))}
                  placeholder="03001234567"
                  className={`w-full h-9 px-3 border rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] ${
                    errors.contact ? "border-rose-500" : "border-slate-200"
                  }`}
                />
                {errors.contact && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.contact}</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  State / Province
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
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
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  CNIC Number
                </label>
                <input
                  type="text"
                  value={cnic}
                  onChange={(e) => setCnic(formatCNIC(e.target.value))}
                  placeholder="12345-1234567-1"
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Marital Status
                </label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
                >
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Payment Provider
                </label>
                <select
                  value={paymentProvider}
                  onChange={(e) => setPaymentProvider(e.target.value)}
                  className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
                >
                  <option value="EasyPaisa">EasyPaisa</option>
                  <option value="JazzCash">JazzCash</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  EasyPaisa / JazzCash No.
                </label>
                <input
                  type="text"
                  value={paymentAccountNo}
                  onChange={(e) => setPaymentAccountNo(e.target.value.replace(/\D/g, ""))}
                  placeholder="Payout Account No."
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                />
              </div>

              {!isEdit && (
                <>
                  <div className="col-span-2 border-t pt-4 mt-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">System Credentials</h4>
                  </div>
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
                </>
              )}
            </div>
          ) : (
            <>
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
                    onChange={(e) => setContact(e.target.value.replace(/\D/g, ""))}
                    placeholder="03001234567"
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
                    <option value="rsm">RSM</option>
                    <option value="country_head">CH</option>
                    <option value="retail_manager">RETAIL MANAGER</option>
                    <option value="admin">ADMIN</option>
                    <option value="marketing_manager">MARKETING MANAGER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Assigned Region {group === "rsm" ? "*" : ""}
                  </label>
                  <select
                    value={resolveRegionValue(region)}
                    onChange={(e) => {
                      const sel = e.target.value;
                      setRegion(sel);
                      const matched = systemRegions.find(r => r.name === sel || r.region_code === sel);
                      if (matched && matched.warehouse) setWarehouse(matched.warehouse);
                    }}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] bg-white font-semibold"
                  >
                    <option value="">Select Region</option>
                    {systemRegions.map((reg) => (
                      <option key={reg.id || reg.name} value={reg.name}>
                        {reg.name} ({reg.region_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
            </>
          )}
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
