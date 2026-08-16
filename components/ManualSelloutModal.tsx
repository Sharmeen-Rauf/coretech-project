"use client";

import { useState } from "react";
import { X, Loader2, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { createClientComponentClient } from "@/lib/supabase";
import { submitManualSelloutAction } from "@/app/actions/sales";

interface ManualSelloutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface VerifiedStock {
  productName: string;
  brand: string;
  model: string;
  sourceLabel: string;
}

export default function ManualSelloutModal({ isOpen, onClose, onSuccess }: ManualSelloutModalProps) {
  const supabase = createClientComponentClient();

  const [serialNo, setSerialNo] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState<VerifiedStock | null>(null);
  const [verifyError, setVerifyError] = useState("");

  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [consumerName, setConsumerName] = useState("");
  const [consumerPhone, setConsumerPhone] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setSerialNo("");
    setVerified(null);
    setVerifyError("");
    setDate(new Date().toLocaleDateString("en-CA"));
    setConsumerName("");
    setConsumerPhone("");
    setSiteAddress("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Read-only client-side lookup, just to show the admin what they're about to
  // sell - the real check (not already sold out, belongs to the caller) is
  // re-verified server-side in submitManualSelloutAction on submit.
  const handleVerify = async () => {
    const sn = serialNo.trim();
    if (!sn) return;
    setIsVerifying(true);
    setVerified(null);
    setVerifyError("");
    try {
      const { data: stockRow } = await supabase
        .from("stock")
        .select("status, warehouse_name, distributor_id, sub_dealer_id, products(name, brand, model)")
        .ilike("serial_no", sn)
        .maybeSingle();

      if (!stockRow) {
        setVerifyError("Serial number not found");
        return;
      }
      if (stockRow.status === "sold_out") {
        setVerifyError("This serial number is already sold out");
        return;
      }

      let sourceLabel = stockRow.warehouse_name || "Warehouse";
      if (stockRow.sub_dealer_id) {
        const { data: sd } = await supabase.from("profiles").select("first_name, last_name").eq("id", stockRow.sub_dealer_id).maybeSingle();
        sourceLabel = sd ? `${sd.first_name} ${sd.last_name || ""}`.trim() : "Sub Dealer";
      } else if (stockRow.distributor_id) {
        const { data: d } = await supabase.from("profiles").select("first_name, last_name").eq("id", stockRow.distributor_id).maybeSingle();
        sourceLabel = d ? `${d.first_name} ${d.last_name || ""}`.trim() : "Distributor";
      }

      const product = (stockRow as any).products;
      setVerified({
        productName: product?.name || "Unknown Product",
        brand: product?.brand || "-",
        model: product?.model || "-",
        sourceLabel,
      });
    } catch (err: any) {
      setVerifyError(err.message || "Failed to verify serial number");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verified) {
      toast.error("Verify the serial number first");
      return;
    }
    if (!consumerName.trim() || !consumerPhone.trim()) {
      toast.error("Consumer name and phone are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const stId = `SO-${Date.now()}`;
      const res = await submitManualSelloutAction({
        serialNo: serialNo.trim(),
        date,
        consumerName: consumerName.trim(),
        consumerPhone: consumerPhone.trim(),
        siteAddress: siteAddress.trim() || undefined,
        stId,
      });
      if (!res.success) {
        toast.error(res.error || "Failed to record sell out");
        return;
      }
      toast.success("Sell out recorded successfully!");
      handleClose();
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div onClick={handleClose} className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"></div>

      <div className="relative bg-white w-full max-w-md border border-slate-100 rounded-[12px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800">Manual Sell Out</h3>
          <button onClick={handleClose} className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Serial Number*</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={serialNo}
                onChange={(e) => { setSerialNo(e.target.value); setVerified(null); setVerifyError(""); }}
                onBlur={handleVerify}
                placeholder="Enter Serial Number"
                className="flex-1 h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
              />
              <button type="button" onClick={handleVerify} disabled={isVerifying || !serialNo.trim()} className="h-9 px-3 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-bold rounded-[6px] flex items-center justify-center min-w-[70px]">
                {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
              </button>
            </div>
            {verifyError && (
              <p className="flex items-center gap-1 text-[10px] text-rose-500 font-semibold mt-1"><XCircle className="w-3 h-3" />{verifyError}</p>
            )}
            {verified && (
              <div className="mt-2 bg-[#F0FAFE]/40 border border-[#00B4D8]/20 rounded-[6px] p-3 space-y-1 text-[11px]">
                <p className="flex items-center gap-1 font-bold text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" />Verified</p>
                <p><span className="text-slate-400">Product:</span> <span className="font-semibold text-slate-700">{verified.productName} ({verified.brand} / {verified.model})</span></p>
                <p><span className="text-slate-400">Currently with:</span> <span className="font-semibold text-slate-700">{verified.sourceLabel}</span></p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date*</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]" required />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Consumer Name*</label>
            <input type="text" value={consumerName} onChange={(e) => setConsumerName(e.target.value)} className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]" required />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Consumer Phone*</label>
            <input type="text" value={consumerPhone} onChange={(e) => setConsumerPhone(e.target.value.replace(/[^\d+]/g, ""))} placeholder="e.g. 03001234567" className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]" required />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Site Address (optional)</label>
            <textarea rows={2} value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} className="w-full p-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] resize-none" />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={handleClose} className="flex-1 h-9 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-[6px] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!verified || isSubmitting} className="flex-[2] h-9 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 text-white font-semibold text-xs rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-colors">
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
