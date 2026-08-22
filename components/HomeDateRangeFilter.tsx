"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar, X } from "lucide-react";
import toast from "react-hot-toast";

export default function HomeDateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [from, setFrom] = useState(searchParams.get("from") || "");
  const [to, setTo] = useState(searchParams.get("to") || "");

  const hasActiveFilter = !!(searchParams.get("from") && searchParams.get("to"));

  const apply = () => {
    if (!from || !to) {
      toast.error("Pick both a start and end date");
      return;
    }
    if (from > to) {
      toast.error("Start date must be before end date");
      return;
    }
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    router.push(`${pathname}?${params.toString()}`);
  };

  const clear = () => {
    setFrom("");
    setTo("");
    router.push(pathname);
  };

  return (
    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-[8px] px-3 py-2 shadow-sm">
      <Calendar className="w-3.5 h-3.5 text-slate-400" />
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="h-7 px-1.5 text-xs text-slate-700 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#00B4D8]"
      />
      <span className="text-[10px] text-slate-400 font-semibold">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="h-7 px-1.5 text-xs text-slate-700 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#00B4D8]"
      />
      <button
        onClick={apply}
        className="h-7 px-3 text-[11px] font-bold text-white bg-[#00B4D8] hover:bg-[#0077B6] rounded-[4px] transition-colors"
      >
        Apply
      </button>
      {hasActiveFilter && (
        <button
          onClick={clear}
          title="Clear date filter - back to all-time"
          className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-[4px] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
