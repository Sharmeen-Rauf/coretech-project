"use client";

import React, { useState } from "react";
import { Search, Loader2, Package, ArrowRight, Wrench, CheckCircle2, XCircle, Clock, RotateCw } from "lucide-react";
import toast from "react-hot-toast";
import { fetchSnLookupAction } from "@/app/actions/snLookup";

const TYPE_LABELS: Record<string, string> = {
  ST1: "ST-1",
  ST2: "ST-2",
  return: "Return",
  transfer: "Transfer",
  sellout: "Sell Out",
};

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-600 border-emerald-100",
  verified: "bg-sky-50 text-sky-600 border-sky-100",
  rejected: "bg-rose-50 text-rose-500 border-rose-100",
  pending_verification: "bg-amber-50 text-amber-500 border-amber-100",
  pending_approval: "bg-sky-50 text-sky-600 border-sky-100",
};

export default function SnLookupPage() {
  const [serialNo, setSerialNo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNo.trim()) {
      toast.error("Enter a serial number");
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    try {
      const res = await fetchSnLookupAction(serialNo.trim());
      if (!res.success) {
        toast.error(res.error || "Failed to look up serial number");
        setResult(null);
        return;
      }
      setResult(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to look up serial number");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">SN Lookup</h1>
        <p className="text-xs text-slate-500">
          Trace a unit's complete history - inventory, transfers, and every installation attempt.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-lg">
        <input
          type="text"
          value={serialNo}
          onChange={(e) => setSerialNo(e.target.value)}
          placeholder="Enter serial number..."
          className="flex-1 h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </form>

      {isLoading && (
        <div className="min-h-[30vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      )}

      {!isLoading && hasSearched && (!result || !result.found) && (
        <div className="bg-white border border-slate-200 rounded-[8px] p-8 text-center text-sm text-slate-400">
          No record found for that serial number.
        </div>
      )}

      {!isLoading && result?.found && (
        <div className="space-y-6 max-w-3xl">
          {/* Inventory Record */}
          <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-4">
              <Package className="w-4 h-4 text-[#00B4D8]" /> Inventory Record
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-0.5">Product</p>
                <p className="font-semibold text-slate-700">{result.stock.productName}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-0.5">Brand / Model</p>
                <p className="font-semibold text-slate-700">{result.stock.brand} / {result.stock.model}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-0.5">Serial No.</p>
                <p className="font-semibold text-slate-700">{result.stock.serialNo}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-0.5">Imported To</p>
                <p className="font-semibold text-slate-700">{result.stock.warehouseName || "-"}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-0.5">Import Date</p>
                <p className="font-semibold text-slate-700">{result.stock.importDate ? new Date(result.stock.importDate).toLocaleDateString() : "-"}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-0.5">Current Status</p>
                <span className="capitalize font-semibold text-slate-700">{(result.stock.status || "-").replace("_", " ")}</span>
              </div>
            </div>
          </div>

          {/* Transaction Chain */}
          <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-4">
              <ArrowRight className="w-4 h-4 text-[#00B4D8]" /> Transaction Chain
            </h3>
            {result.chain.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Still in warehouse - no transfers recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {result.chain.map((step: any, idx: number) => (
                  <div key={step.id} className="flex items-start gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                    <div className="w-6 h-6 rounded-full bg-[#F0FAFE] text-[#00B4D8] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] bg-slate-100 px-2 py-0.5 rounded-full">
                          {TYPE_LABELS[step.type] || step.type}
                        </span>
                        <span className="text-slate-400">{step.stId}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{new Date(step.date).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1 text-slate-700 font-medium">
                        {step.from} <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" /> {step.to}
                      </p>
                      {step.siteAddress && (
                        <p className="text-slate-400 mt-0.5">{step.consumerPhone} · {step.siteAddress}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Installer Job History */}
          <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-4">
              <Wrench className="w-4 h-4 text-[#00B4D8]" /> Installation History
            </h3>
            {result.installerJobs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No installation submissions recorded for this unit.</p>
            ) : (
              <div className="space-y-3">
                {result.installerJobs.map((job: any) => (
                  <div key={job.id} className="pb-3 border-b border-slate-50 last:border-0 last:pb-0 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      {job.status === "approved" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : job.status === "rejected" ? (
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span className="font-bold text-slate-800">{job.installerName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${STATUS_STYLES[job.status] || "bg-slate-50 text-slate-500 border-slate-200"}`}>
                        {job.status.replace(/_/g, " ")}
                      </span>
                      {job.isResubmitted && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border bg-indigo-50 text-indigo-600 border-indigo-100 flex items-center gap-1">
                          <RotateCw className="w-2.5 h-2.5" /> Resubmitted
                        </span>
                      )}
                      <span className="text-slate-400 ml-auto">{new Date(job.createdAt).toLocaleDateString()}</span>
                    </div>
                    {job.remarks && <p className="text-slate-500 mt-1">Remarks: {job.remarks}</p>}
                    {job.verifierName && (
                      <p className="text-slate-500 mt-1">
                        Verified by <strong className="text-slate-700">{job.verifierName}</strong>
                        {job.verifiedAt && ` on ${new Date(job.verifiedAt).toLocaleDateString()}`}
                        {job.verificationNote && ` — "${job.verificationNote}"`}
                      </p>
                    )}
                    {job.approverName && (
                      <p className="text-slate-500 mt-1">
                        {job.status === "rejected" ? "Rejected" : "Approved"} by <strong className="text-slate-700">{job.approverName}</strong>
                        {job.approvedAt && ` on ${new Date(job.approvedAt).toLocaleDateString()}`}
                        {job.approvalNote && ` — "${job.approvalNote}"`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
