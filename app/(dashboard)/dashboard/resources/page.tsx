"use client";

import React, { useEffect, useState } from "react";
import { Target, Award, Loader2, Plus, X, Edit2, Users as UsersIcon } from "lucide-react";
import toast from "react-hot-toast";
import DataTable from "@/components/DataTable";
import { getMyPermissionKeysAction } from "@/app/actions/roles";
import {
  fetchMyTargetAction,
  fetchAllTargetsAction,
  fetchAssignableUsersAction,
  createOrUpdateTargetAction,
} from "@/app/actions/targets";

interface AssignableUser {
  id: string;
  first_name: string;
  last_name: string | null;
  role: string;
}

export default function TargetManagementPage() {
  const [activeTab, setActiveTab] = useState<"my_target" | "create_targets">("my_target");
  const [grantedKeys, setGrantedKeys] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const hasPermission = (key: string) => userRole === "admin" || grantedKeys.has(key);

  // My Target state
  const [myTarget, setMyTarget] = useState<any>(null);
  const [myAchieved, setMyAchieved] = useState(0);

  // Create Targets state
  const [allTargets, setAllTargets] = useState<any[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [targetUnits, setTargetUnits] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const permRes = await getMyPermissionKeysAction();
      setGrantedKeys(new Set(permRes.keys));
      setUserRole(permRes.role || "");

      const canCreate = permRes.role === "admin" || permRes.keys.includes("resources.create_targets");
      if (!canCreate && activeTab === "create_targets") setActiveTab("my_target");

      const [mine, all] = await Promise.all([
        fetchMyTargetAction(),
        canCreate ? fetchAllTargetsAction() : Promise.resolve({ success: true, data: [] }),
      ]);

      if (mine.success) {
        setMyTarget(mine.target);
        setMyAchieved(mine.achievedUnits);
      }
      if (all.success) setAllTargets(all.data);

      if (canCreate) {
        const users = await fetchAssignableUsersAction();
        if (users.success) setAssignableUsers(users.data);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load Target Management");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAssignModal = () => {
    setEditingTargetId(null);
    setAssigneeId("");
    setTargetUnits("");
    setPeriodStart("");
    setPeriodEnd("");
    setIsModalOpen(true);
  };

  const openEditModal = (row: any) => {
    setEditingTargetId(row.id);
    setAssigneeId(row.assignee_id);
    setTargetUnits(String(row.target_units));
    setPeriodStart(row.period_start);
    setPeriodEnd(row.period_end);
    setIsModalOpen(true);
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigneeId || !targetUnits || !periodStart || !periodEnd) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createOrUpdateTargetAction({
        targetId: editingTargetId || undefined,
        assigneeId,
        targetUnits: parseInt(targetUnits, 10),
        periodStart,
        periodEnd,
      });
      if (!res.success) {
        toast.error(res.error || "Failed to save target");
        return;
      }
      toast.success(editingTargetId ? "Target updated" : "Target assigned");
      setIsModalOpen(false);
      loadAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to save target");
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetColumns = [
    {
      key: "assignee",
      label: "Assignee",
      render: (val: any) => (
        <div>
          <span className="font-bold text-slate-800">{val ? `${val.first_name} ${val.last_name || ""}`.trim() : "Unknown"}</span>
          <span className="block text-[10px] text-slate-400 capitalize">{val?.role || ""}</span>
        </div>
      ),
    },
    {
      key: "period_start",
      label: "Period",
      render: (val: string, row: any) => (
        <span className="text-xs text-slate-600">
          {new Date(val).toLocaleDateString()} - {new Date(row.period_end).toLocaleDateString()}
        </span>
      ),
    },
    { key: "target_units", label: "Target (Units)" },
    {
      key: "achieved_units",
      label: "Achieved",
      render: (val: number, row: any) => {
        const pct = row.target_units > 0 ? Math.round((val / row.target_units) * 100) : 0;
        return (
          <span className={`font-bold ${val >= row.target_units ? "text-emerald-600" : "text-slate-700"}`}>
            {val} ({pct}%)
          </span>
        );
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (_: string, row: any) => (
        <button
          onClick={() => openEditModal(row)}
          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-[#00B4D8] rounded-[6px] transition-colors"
          title="Edit Target"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const paginatedTargets = allTargets.slice((currentPage - 1) * perPage, currentPage * perPage);

  const canCreateTargets = hasPermission("resources.create_targets");
  const progressPct = myTarget && myTarget.target_units > 0 ? Math.min(100, Math.round((myAchieved / myTarget.target_units) * 100)) : 0;

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Target Management</h1>
        <p className="text-xs text-slate-500">Track sales targets and progress, measured in units sold.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("my_target")}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 -mb-px ${
            activeTab === "my_target" ? "border-[#00B4D8] text-[#00B4D8]" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Sales Targets & Incentives
        </button>
        {canCreateTargets && (
          <button
            onClick={() => setActiveTab("create_targets")}
            className={`pb-2.5 text-xs font-bold transition-colors border-b-2 -mb-px ${
              activeTab === "create_targets" ? "border-[#00B4D8] text-[#00B4D8]" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Create Targets
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : activeTab === "my_target" ? (
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
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openAssignModal}
              className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Assign New Target
            </button>
          </div>

          <DataTable allData={allTargets}
            title="Sales Targets"
            columns={targetColumns}
            data={paginatedTargets}
            isLoading={false}
            searchPlaceholder="Search assignee..."
            pagination={{
              current: currentPage,
              total: allTargets.length,
              perPage: perPage,
              onChange: (page) => setCurrentPage(page),
            }}
          />
        </div>
      )}

      {/* Assign / Edit Target Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <UsersIcon className="w-4 h-4 text-[#00B4D8]" /> {editingTargetId ? "Edit Target" : "Assign New Target"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Assignee*
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={!!editingTargetId}
                  className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] disabled:bg-slate-50 disabled:text-slate-400"
                  required
                >
                  <option value="">Select a user</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name || ""} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Target (Units)*
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="e.g. 50"
                  value={targetUnits}
                  onChange={(e) => setTargetUnits(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Period Start*
                  </label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Period End*
                  </label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                    required
                  />
                </div>
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
                  {editingTargetId ? "Save Changes" : "Assign Target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
