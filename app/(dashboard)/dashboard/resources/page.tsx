"use client";

import React, { useEffect, useState } from "react";
import { Target, Award, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { fetchMyTargetAction } from "@/app/actions/targets";

export default function SalesTargetsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [myTarget, setMyTarget] = useState<any>(null);
  const [myAchieved, setMyAchieved] = useState(0);

  const loadMyTarget = async () => {
    setIsLoading(true);
    try {
      const res = await fetchMyTargetAction();
      if (res.success) {
        setMyTarget(res.target);
        setMyAchieved(res.achievedUnits);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load your target");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMyTarget();
  }, []);

  const progressPct = myTarget && myTarget.target_units > 0 ? Math.min(100, Math.round((myAchieved / myTarget.target_units) * 100)) : 0;

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Sales Targets & Incentives</h1>
        <p className="text-xs text-slate-500">Track your sales target and progress, measured in units sold.</p>
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : (
        <div className="max-w-2xl">
          {!myTarget ? (
            <div className="bg-white border border-slate-200 rounded-[8px] p-8 text-center text-sm text-slate-400">
              No target assigned to you yet.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-[8px] p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[#00B4D8]" />
                <h3 className="font-bold text-slate-800 text-sm">
                  Target Period: {new Date(myTarget.period_start).toLocaleDateString()} - {new Date(myTarget.period_end).toLocaleDateString()}
                </h3>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Units Sold</span>
                  <span className="text-slate-800">{myAchieved} / {myTarget.target_units}</span>
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
                myAchieved >= myTarget.target_units
                  ? "bg-emerald-50/50 border-emerald-200"
                  : "bg-[#F0FAFE]/50 border-[#00B4D8]/20"
              }`}>
                <Award className={`w-5 h-5 shrink-0 mt-0.5 ${myAchieved >= myTarget.target_units ? "text-emerald-600" : "text-[#00B4D8]"}`} />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {myAchieved >= myTarget.target_units ? "Target Achieved" : "In Progress"}
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                    {myAchieved >= myTarget.target_units
                      ? "You've hit your target for this period."
                      : `${myTarget.target_units - myAchieved} more units to reach your target.`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
