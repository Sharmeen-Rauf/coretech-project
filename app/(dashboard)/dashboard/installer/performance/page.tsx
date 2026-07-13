"use client";
 
import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { Loader2, TrendingUp, DollarSign, Award, Percent } from "lucide-react";
import toast from "react-hot-toast";
 
interface PerformanceRow {
  id: string;
  name: string;
  contact: string;
  total_jobs: number;
  completed_jobs: number;
  completion_rate: number;
  pending_payments: number;
  completed_payments: number;
}
 
export default function PerformancePage() {
  const supabase = createClientComponentClient();
  const [data, setData] = useState<PerformanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
 
  const fetchPerformance = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all installers
      const { data: installers, error: instErr } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, contact")
        .eq("role", "installer")
        .eq("status", "active");
 
      if (instErr) throw instErr;
 
      // 2. Fetch all jobs
      const { data: jobs, error: jobsErr } = await supabase
        .from("installer_jobs")
        .select("installer_id, status, payment_status");
 
      if (jobsErr) throw jobsErr;
 
      // 3. Aggregate performance statistics
      const formatted: PerformanceRow[] = (installers || []).map((inst: any) => {
        const instJobs = (jobs || []).filter((j: any) => j.installer_id === inst.id);
        const total = instJobs.length;
        const completed = instJobs.filter((j: any) => j.status === "completed").length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
 
        const pendingPay = instJobs.filter((j: any) => j.status === "completed" && j.payment_status === "unpaid").length;
        const paidPay = instJobs.filter((j: any) => j.payment_status === "paid").length;
 
        return {
          id: inst.id,
          name: `${inst.first_name} ${inst.last_name || ""}`.trim(),
          contact: inst.contact || "-",
          total_jobs: total,
          completed_jobs: completed,
          completion_rate: rate,
          pending_payments: pendingPay,
          completed_payments: paidPay,
        };
      });
 
      setData(formatted);
    } catch (err: any) {
      toast.error(err.message || "Failed to compile installer performance logs");
    } finally {
      setIsLoading(false);
    }
  };
 
  useEffect(() => {
    fetchPerformance();
  }, []);
 
  const columns = [
    {
      key: "name",
      label: "Installer Name",
      render: (val: string) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#F0FAFE] text-[#00B4D8] font-bold text-[10px] flex items-center justify-center border border-[#00B4D8]/20">
            {val.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-slate-700">{val}</span>
        </div>
      ),
    },
    { key: "contact", label: "Contact Phone" },
    { key: "total_jobs", label: "Assigned Jobs" },
    { key: "completed_jobs", label: "Completed Jobs" },
    {
      key: "completion_rate",
      label: "Completion Rate",
      render: (val: number) => (
        <div className="flex items-center gap-2 max-w-[120px]">
          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                val >= 80 ? "bg-emerald-500" : val >= 50 ? "bg-amber-500" : "bg-rose-500"
              }`}
              style={{ width: `${val}%` }}
            ></div>
          </div>
          <span className="font-bold text-[10px] text-slate-600">{val}%</span>
        </div>
      ),
    },
    {
      key: "pending_payments",
      label: "Pending Claims",
      render: (val: number) => (
        <span className={`font-bold ${val > 0 ? "text-rose-600" : "text-slate-400"}`}>
          {val} Job(s)
        </span>
      ),
    },
    {
      key: "completed_payments",
      label: "Settled Payments",
      render: (val: number) => (
        <span className="font-bold text-emerald-600">
          {val} Job(s)
        </span>
      ),
    },
  ];
 
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const paginated = data.slice((currentPage - 1) * perPage, currentPage * perPage);
 
  // Calculate summary metrics
  const totalTechnicians = data.length;
  const avgCompletion = data.length > 0 ? Math.round(data.reduce((sum, item) => sum + item.completion_rate, 0) / data.length) : 0;
  const totalPendingClaims = data.reduce((sum, item) => sum + item.pending_payments, 0);
 
  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Performance logs</h1>
        <p className="text-xs text-slate-500">
          Track field technician task completions, rate benchmarks, and payout claims.
        </p>
      </div>
 
      {/* KPI summaries row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#F0FAFE] text-[#00B4D8] rounded-[8px]">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Active Techs</p>
            <p className="text-lg font-extrabold text-slate-800">{totalTechnicians}</p>
          </div>
        </div>
 
        <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#F0FAFE] text-[#00B4D8] rounded-[8px]">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Avg Completion Rate</p>
            <p className="text-lg font-extrabold text-slate-800">{avgCompletion}%</p>
          </div>
        </div>
 
        <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-500 rounded-[8px]">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-rose-400 text-[10px] font-bold uppercase tracking-wider">Unpaid Job Claims</p>
            <p className="text-lg font-extrabold text-rose-600">{totalPendingClaims} Ticket(s)</p>
          </div>
        </div>
      </div>
 
      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : (
        <DataTable
          title="Technician Performance Audit"
          columns={columns}
          data={paginated}
          isLoading={false}
          searchPlaceholder="Search Technician Name..."
          pagination={{
            current: currentPage,
            total: data.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
        />
      )}
    </div>
  );
}
