"use client";

import React, { useState } from "react";
import { BookOpen, Download, Search, Target, Award, ShieldAlert, Sparkles } from "lucide-react";

interface Resource {
  title: string;
  category: string;
  size: string;
  description: string;
  link: string;
}

export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState<"training" | "targets">("training");
  const [searchQuery, setSearchQuery] = useState("");

  // Mock document items matching CoreTECH portfolio
  const resources: Resource[] = [
    {
      title: "CoreTECH Inverter Installation Guide v2.1",
      category: "Technical Manual",
      size: "4.8 MB",
      description: "Detailed wiring schematics and configuration guides for hybrid residential inverters.",
      link: "#",
    },
    {
      title: "CoreTECH Smart Battery Safety Manual",
      category: "Technical Manual",
      size: "3.2 MB",
      description: "Safety guidelines, thermal indicators, and wall-mount protocols for Lithium storage packs.",
      link: "#",
    },
    {
      title: "CoreTECH All-in-One Catalog (2026)",
      category: "Product Specs",
      size: "12.4 MB",
      description: "Marketing brochure and detailed product specs sheet for distributors and sub-dealers.",
      link: "#",
    },
    {
      title: "Consignment Operations Guide",
      category: "Operations",
      size: "1.5 MB",
      description: "Step-by-step instructions on submitting stock requests and processing returns.",
      link: "#",
    },
    {
      title: "Sub-Dealer Incentive Matrix",
      category: "Policy Document",
      size: "850 KB",
      description: "Comprehensive structure explaining reward percentages and monthly volume bonuses.",
      link: "#",
    },
  ];

  // Sales Target states
  const currentSales = 850000;
  const targetSales = 1200000;
  const completionPercentage = Math.round((currentSales / targetSales) * 100);

  const rewards = [
    { minAmount: 300000, reward: "3% Base Commission", achieved: currentSales >= 300000 },
    { minAmount: 600000, reward: "5% Mid-Volume Rebate", achieved: currentSales >= 600000 },
    { minAmount: 1000000, reward: "7% High-Volume Bonus", achieved: currentSales >= 1000000 },
    { minAmount: 1500000, reward: "Exclusive Regional Distributor Invitation", achieved: currentSales >= 1500000 },
  ];

  const filteredResources = resources.filter(
    (res) =>
      res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dealer Resources & Targets</h1>
        <p className="text-xs text-slate-500">
          Access product training documentation and track sales targets.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("training")}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 -mb-px ${
            activeTab === "training" ? "border-[#00B4D8] text-[#00B4D8]" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Marketing & Training
        </button>
        <button
          onClick={() => setActiveTab("targets")}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 -mb-px ${
            activeTab === "targets" ? "border-[#00B4D8] text-[#00B4D8]" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Sales Targets & Incentives
        </button>
      </div>

      {activeTab === "training" ? (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search resources, specifications or manuals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full pl-9 pr-4 rounded-[6px] border border-slate-200 text-xs text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:border-[#00B4D8] transition-all"
            />
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredResources.map((res, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm hover:border-[#00B4D8]/50 hover:shadow transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-0.5 bg-[#F0FAFE] text-[#00B4D8] font-bold text-[9px] rounded uppercase tracking-wider">
                      {res.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{res.size}</span>
                  </div>
                  <h3 className="font-bold text-slate-850 text-sm mb-1">{res.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{res.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>PDF Document</span>
                  </div>
                  <a
                    href={res.link}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#00B4D8] hover:text-[#0077B6] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Target Progress Bar Card */}
          <div className="bg-white border border-slate-200 rounded-[8px] p-6 shadow-sm lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#00B4D8]" />
              <h3 className="font-bold text-slate-800 text-sm">Monthly Sales Target Progress</h3>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500">Current Sales Volume</span>
                <span className="text-slate-800">Rs. {currentSales.toLocaleString()} / Rs. {targetSales.toLocaleString()}</span>
              </div>

              {/* Progress track */}
              <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden relative">
                <div
                  style={{ width: `${completionPercentage}%` }}
                  className="bg-gradient-to-r from-[#0077B6] to-[#00B4D8] h-full transition-all duration-500"
                ></div>
              </div>

              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>0%</span>
                <span className="text-[#00B4D8] font-bold">{completionPercentage}% Completed</span>
                <span>100%</span>
              </div>
            </div>

            <div className="bg-[#F0FAFE]/50 border border-[#00B4D8]/20 rounded-[6px] p-4 flex gap-3 items-start">
              <Sparkles className="w-5 h-5 text-[#00B4D8] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">Goal Focus Reward</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                  Achieve Rs. 1,200,000 in monthly sales volume to unlock higher distribution tiers. Keep promoting our high-margin hybrid batteries to reach your goals faster!
                </p>
              </div>
            </div>
          </div>

          {/* Incentive rewards structure */}
          <div className="bg-white border border-slate-200 rounded-[8px] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#00B4D8]" />
              <h3 className="font-bold text-slate-800 text-sm">Incentive Tiers</h3>
            </div>

            <div className="divide-y divide-slate-100">
              {rewards.map((r, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                  <div>
                    <p className="font-bold text-slate-800">{r.reward}</p>
                    <p className="text-[10px] text-slate-400">Min. Volume: Rs. {r.minAmount.toLocaleString()}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    r.achieved ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-50 text-slate-400 border border-slate-200"
                  }`}>
                    {r.achieved ? "Achieved" : "Locked"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
