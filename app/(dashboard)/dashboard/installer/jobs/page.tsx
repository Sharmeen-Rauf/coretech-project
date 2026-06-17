"use client";
 
import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { X, Loader2, Plus, DollarSign, Calendar, MapPin, Wrench } from "lucide-react";
import toast from "react-hot-toast";
 
interface JobRow {
  id: string;
  job_title: string;
  address: string;
  installer_name: string;
  status: string;
  payment_status: string;
  created_at: string;
}
 
export default function AdminJobsPage() {
  const supabase = createClientComponentClient();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [installers, setInstallers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
 
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [selectedInstallerId, setSelectedInstallerId] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
 
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch jobs joined with installer name
      const { data: jobsData, error: jobsErr } = await supabase
        .from("installer_jobs")
        .select(`
          id,
          job_title,
          address,
          status,
          payment_status,
          created_at,
          installer:profiles!installer_id(first_name, last_name)
        `)
        .order("created_at", { ascending: false });
 
      if (jobsErr) throw jobsErr;
 
      const formatted: JobRow[] = (jobsData || []).map((row: any) => ({
        id: row.id,
        job_title: row.job_title,
        address: row.address,
        installer_name: row.installer ? `${row.installer.first_name} ${row.installer.last_name || ""}`.trim() : "Unassigned",
        status: row.status,
        payment_status: row.payment_status || "unpaid",
        created_at: row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
      }));
      setJobs(formatted);
 
      // 2. Fetch active installers for dropdown selection
      const { data: instData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("role", "installer");
      setInstallers(instData || []);
 
    } catch (err: any) {
      toast.error(err.message || "Failed to load installer data");
    } finally {
      setIsLoading(false);
    }
  };
 
  useEffect(() => {
    fetchData();
  }, []);
 
  const handleAssignJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() || !selectedInstallerId || !address.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
 
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("installer_jobs").insert({
        installer_id: selectedInstallerId,
        job_title: jobTitle.trim(),
        address: address.trim(),
        status: "assigned",
        payment_status: "unpaid",
        notes: notes.trim(),
      });
 
      if (error) throw error;
 
      // Log audit
      const targetInstaller = installers.find((i) => i.id === selectedInstallerId);
      const name = targetInstaller ? `${targetInstaller.first_name} ${targetInstaller.last_name || ""}`.trim() : "Installer";
      await supabase.from("activity_logs").insert({
        action: "Job Assigned",
        details: `Job "${jobTitle}" was assigned to installer ${name}`,
      });
 
      toast.success("Job ticket assigned successfully!");
      setIsModalOpen(false);
      setJobTitle("");
      setSelectedInstallerId("");
      setAddress("");
      setNotes("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign job");
    } finally {
      setIsSubmitting(false);
    }
  };
 
  const handleMarkPaymentPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from("installer_jobs")
        .update({ payment_status: "paid" })
        .eq("id", id);
 
      if (error) throw error;
 
      const target = jobs.find((j) => j.id === id);
      await supabase.from("activity_logs").insert({
        action: "Job Payment Settlement",
        details: `Installer payment for job "${target?.job_title}" set to Paid`,
      });
 
      toast.success("Job payment status marked as PAID!");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to settle payment");
    }
  };
 
  const columns = [
    { key: "job_title", label: "Job Title" },
    { key: "address", label: "Installation Location" },
    { key: "installer_name", label: "Assigned Installer" },
    {
      key: "status",
      label: "Job Status",
      render: (val: string) => (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
          val === "completed" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
          val === "in_progress" ? "bg-amber-50 text-amber-600 border border-amber-200" :
          "bg-cyan-50 text-cyan-600 border border-cyan-200"
        }`}>
          {val}
        </span>
      ),
    },
    {
      key: "payment_status",
      label: "Payment Status",
      render: (val: string) => (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
          val === "paid" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"
        }`}>
          {val}
        </span>
      ),
    },
    { key: "created_at", label: "Date Assigned" },
    {
      key: "id",
      label: "Settle Payment",
      render: (val: string, row: any) => {
        if (row.status !== "completed") return <span className="text-slate-400 text-xs">-</span>;
        if (row.payment_status === "paid") return <span className="text-emerald-600 text-xs font-bold">Settled</span>;
        return (
          <button
            onClick={() => handleMarkPaymentPaid(val)}
            className="p-1 hover:bg-emerald-50 text-emerald-600 rounded border border-emerald-100 transition-colors"
            title="Mark Paid"
          >
            <DollarSign className="w-3.5 h-3.5" />
          </button>
        );
      },
    },
  ];
 
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const paginated = jobs.slice((currentPage - 1) * perPage, currentPage * perPage);
 
  return (
    <div className="space-y-6 select-none">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Job Assignment</h1>
          <p className="text-xs text-slate-500">
            Dispatch solar panel and inverter installation tickets to field technicians.
          </p>
        </div>
 
        <button
          onClick={() => setIsModalOpen(true)}
          className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Assign New Job
        </button>
      </div>
 
      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : (
        <DataTable
          title="Installer Jobs Ledger"
          columns={columns}
          data={paginated}
          isLoading={false}
          searchPlaceholder="Search Job Title or Location..."
          pagination={{
            current: currentPage,
            total: jobs.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
        />
      )}
 
      {/* Assign Job Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>
 
          <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Assign Installation Job
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
 
            <form onSubmit={handleAssignJob} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Job Title*
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10kW Hybrid System Setup"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>
 
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Assign to Installer*
                </label>
                <select
                  value={selectedInstallerId}
                  onChange={(e) => setSelectedInstallerId(e.target.value)}
                  className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
                  required
                >
                  <option value="">Select Installer</option>
                  {installers.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.first_name} {inst.last_name || ""}
                    </option>
                  ))}
                </select>
              </div>
 
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Installation Address*
                </label>
                <input
                  type="text"
                  placeholder="e.g. House 44, Sector Y DHA, Lahore"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>
 
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Special Steps / Checklist Instructions
                </label>
                <textarea
                  placeholder="Enter custom installation steps (one per line)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-24 px-3 py-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] resize-none"
                />
              </div>
 
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-100 rounded-[6px] text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-4 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Assign Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
