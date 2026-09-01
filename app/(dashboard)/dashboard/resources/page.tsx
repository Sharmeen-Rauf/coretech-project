"use client";

import React, { useEffect, useState } from "react";
import { Target, Award, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { fetchMyTargetAction } from "@/app/actions/targets";

export default function SalesTargetsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [myTargets, setMyTargets] = useState<any[]>([]);

  const loadMyTargets = async () => {
    setIsLoading(true);
    try {
      const res = await fetchMyTargetAction();
      if (res.success) {
        setMyTargets(res.targets || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load your targets");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMyTargets();
  }, []);

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Sales Targets & Incentives</h1>
        <p className="text-xs text-slate-500">Track your per-product sales targets and progress, measured in units sold.</p>
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          {myTargets.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-[8px] p-8 text-center text-sm text-slate-400">
              No targets assigned to you yet.
            </div>
          ) : (
            myTargets.map((target) => {
              const achieved = target.achieved_units || 0;
              const progressPct = target.target_units > 0 ? Math.min(100, Math.round((achieved / target.target_units) * 100)) : 0;
              const hit = achieved >= target.target_units;

              return (
                <div key={target.id} className="bg-white border border-slate-200 rounded-[8px] p-6 shadow-sm space-y-6">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-[#00B4D8]" />
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">
                          {target.product?.name || "Unknown Product"}
                          {target.product?.brand && <span className="text-slate-400 font-medium"> ({target.product.brand})</span>}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Period: {new Date(target.period_start).toLocaleDateString()} - {new Date(target.period_end).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Units Sold</span>
                      <span className="text-slate-800">{achieved} / {target.target_units}</span>
                    </div>

                    <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden relative">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className="bg-gradient-to-r from-[#0077B6] to-[#00B4D8] h-full transition-all duration-500"
                      ></div>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>0%</span>
                      <span className="text-[#00B4D8] font-bold">{progressPct}%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div className={`rounded-[6px] p-4 flex gap-3 items-start border ${
                    hit ? "bg-emerald-50/50 border-emerald-200" : "bg-[#F0FAFE]/50 border-[#00B4D8]/20"
                  }`}>
                    <Award className={`w-5 h-5 shrink-0 mt-0.5 ${hit ? "text-emerald-600" : "text-[#00B4D8]"}`} />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        {hit ? "Target Achieved" : "In Progress"}
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        {hit
                          ? "You've hit your target for this product this period."
                          : `${target.target_units - achieved} more units to reach your target.`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
