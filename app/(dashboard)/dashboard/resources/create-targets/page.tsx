"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X, Edit2, Trash2, Users as UsersIcon } from "lucide-react";
import toast from "react-hot-toast";
import DataTable from "@/components/DataTable";
import {
  fetchAllTargetsAction,
  fetchAssignableUsersAction,
  createOrUpdateTargetAction,
  deleteTargetAction,
} from "@/app/actions/targets";
import { getMyScopeAction } from "@/app/actions/roles";

interface AssignableUser {
  id: string;
  first_name: string;
  last_name: string | null;
  role: string;
}

export default function CreateTargetsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(false);

  const [allTargets, setAllTargets] = useState<any[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [targetUnits, setTargetUnits] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const writeRes = await getMyScopeAction("resources.create_targets");
      setCanWrite(writeRes.canWrite);

      const [all, users] = await Promise.all([fetchAllTargetsAction(), fetchAssignableUsersAction()]);
      if (all.success) setAllTargets(all.data);
      if (users.success) setAssignableUsers(users.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load Create Targets");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const availableRoles = useMemo(
    () => Array.from(new Set(assignableUsers.map((u) => u.role))).sort(),
    [assignableUsers]
  );
  const filteredAssignees = useMemo(
    () => (roleFilter ? assignableUsers.filter((u) => u.role === roleFilter) : assignableUsers),
    [assignableUsers, roleFilter]
  );

  const openAssignModal = () => {
    setEditingTargetId(null);
    setRoleFilter("");
    setAssigneeId("");
    setTargetUnits("");
    setPeriodStart("");
    setPeriodEnd("");
    setIsModalOpen(true);
  };

  const openEditModal = (row: any) => {
    setEditingTargetId(row.id);
    setRoleFilter(row.assignee?.role || "");
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

  const handleDeleteTarget = async (id: string) => {
    if (!window.confirm("Delete this target? This cannot be undone.")) return;
    try {
      const res = await deleteTargetAction(id);
      if (!res.success) {
        toast.error(res.error || "Failed to delete target");
        return;
      }
      toast.success("Target deleted");
      loadAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete target");
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
      key: "creator",
      label: "Assigned By",
      render: (val: any, row: any) => {
        const creatorName = val ? `${val.first_name} ${val.last_name || ""}`.trim() : "Unknown";
        const updaterName = row.updater ? `${row.updater.first_name} ${row.updater.last_name || ""}`.trim() : null;
        const wasEditedByOther = updaterName && row.updated_by && row.updated_by !== row.created_by;
        return (
          <span className="text-xs text-slate-600">
            Assigned by {creatorName}
            {wasEditedByOther && <span className="text-slate-400"> (Edited by {updaterName})</span>}
          </span>
        );
      },
    },
    ...(canWrite
      ? [
          {
            key: "id",
            label: "Actions",
            render: (val: string, row: any) => (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openEditModal(row)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-[#00B4D8] rounded-[6px] transition-colors"
                  title="Edit Target"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteTarget(val)}
                  className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-[6px] transition-colors"
                  title="Delete Target"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const paginatedTargets = allTargets.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-6 select-none">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Create Targets</h1>
          <p className="text-xs text-slate-500">Assign and manage sales targets across the team.</p>
        </div>

        {canWrite && (
          <button
            onClick={openAssignModal}
            className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Assign New Target
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : (
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
                  Role
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setAssigneeId("");
                  }}
                  disabled={!!editingTargetId}
                  className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white capitalize focus:outline-none focus:border-[#00B4D8] disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">All Roles</option>
                  {availableRoles.map((r) => (
                    <option key={r} value={r} className="capitalize">
                      {r}
                    </option>
                  ))}
                </select>
              </div>

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
                  {filteredAssignees.map((u) => (
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
