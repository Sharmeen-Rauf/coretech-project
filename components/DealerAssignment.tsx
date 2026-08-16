"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Link2 } from "lucide-react";
import toast from "react-hot-toast";
import DataTable from "@/components/DataTable";
import {
  fetchDealerAssignmentsAction,
  bulkAssignSubDealersAction,
  unassignSubDealerAction,
  fetchProfilesAction,
} from "@/app/actions/users";

interface Distributor {
  id: string;
  first_name: string;
  region: string;
}

interface SubDealer {
  id: string;
  first_name: string;
  last_name: string;
  region: string;
  distributor_id?: string | null;
}

interface AssignmentRow {
  id: string;
  first_name: string;
  last_name: string;
  region: string;
  distributor: { id: string; first_name: string; region: string } | null;
}

export default function DealerAssignment() {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [subDealers, setSubDealers] = useState<SubDealer[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDistributorId, setSelectedDistributorId] = useState("");
  const [checkedSubDealerIds, setCheckedSubDealerIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAssignments = async () => {
    setIsLoading(true);
    const res = await fetchDealerAssignmentsAction();
    if (res.success) {
      setAssignments((res.data as any[]) || []);
    } else {
      toast.error(res.error || "Failed to load dealer assignments");
    }
    setIsLoading(false);
  };

  const loadPickerData = async () => {
    const [distRes, subRes] = await Promise.all([
      fetchProfilesAction("distributor"),
      fetchProfilesAction("sub_dealer"),
    ]);
    if (distRes.success) {
      setDistributors((distRes.data || []).map((d: any) => ({ id: d.id, first_name: d.first_name, region: d.region || "" })));
    }
    if (subRes.success) {
      setSubDealers(
        (subRes.data || []).map((s: any) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          region: s.region || "",
          distributor_id: s.distributor_id || null,
        }))
      );
    }
  };

  useEffect(() => {
    loadAssignments();
    loadPickerData();
  }, []);

  const openNewAssignment = () => {
    setSelectedDistributorId("");
    setCheckedSubDealerIds([]);
    setIsModalOpen(true);
  };

  const openEditAssignment = (row: AssignmentRow) => {
    setSelectedDistributorId(row.distributor?.id || "");
    setCheckedSubDealerIds([row.id]);
    setIsModalOpen(true);
  };

  const handleUnassign = async (row: AssignmentRow) => {
    if (!window.confirm(`Unassign ${row.first_name} ${row.last_name} from ${row.distributor?.first_name || "their distributor"}?`)) return;
    const res = await unassignSubDealerAction(row.id);
    if (res.success) {
      toast.success(res.message || "Unassigned successfully");
      loadAssignments();
      loadPickerData();
    } else {
      toast.error(res.error || "Failed to unassign");
    }
  };

  const selectedDistributor = distributors.find((d) => d.id === selectedDistributorId);
  const regionMatchedSubDealers = selectedDistributor
    ? subDealers.filter((s) => (s.region || "").trim().toLowerCase() === (selectedDistributor.region || "").trim().toLowerCase())
    : [];

  const toggleSubDealer = (id: string) => {
    setCheckedSubDealerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    if (!selectedDistributorId) {
      toast.error("Select a distributor first");
      return;
    }
    if (checkedSubDealerIds.length === 0) {
      toast.error("Select at least one sub dealer");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await bulkAssignSubDealersAction(selectedDistributorId, checkedSubDealerIds);
      if (res.success) {
        toast.success(res.message || "Assignment saved");
        setIsModalOpen(false);
        loadAssignments();
        loadPickerData();
      } else {
        toast.error(res.error || "Failed to save assignment");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      key: "distributor",
      label: "Distributor Name",
      render: (_: any, row: AssignmentRow) => row.distributor?.first_name || <span className="text-slate-400 italic">Unassigned</span>,
    },
    {
      key: "first_name",
      label: "Sub Dealer Name",
      render: (_: any, row: AssignmentRow) => `${row.first_name} ${row.last_name}`,
    },
    { key: "region", label: "Region" },
  ];

  const paginated = assignments.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-6 select-none">
      <DataTable
        title="Dealer Assignments"
        columns={columns}
        data={paginated}
        allData={assignments}
        isLoading={isLoading}
        searchPlaceholder="Search assignments..."
        actionButton={{ label: "New Assignment", onClick: openNewAssignment }}
        onEditClick={(row) => openEditAssignment(row as AssignmentRow)}
        onDeleteClick={(row) => handleUnassign(row as AssignmentRow)}
        pagination={{
          current: currentPage,
          total: assignments.length,
          perPage,
          onChange: setCurrentPage,
        }}
        showExport={false}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <div onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"></div>

          <div className="relative bg-white w-full max-w-3xl border border-slate-100 rounded-[12px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#00B4D8]" />
                Assign Sub Dealers to a Distributor
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-6">
              {/* Left: Distributors (radio) */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#00B4D8] uppercase tracking-wider border-b pb-1">
                  Select Distributor
                </h4>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {distributors.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-2">No distributors found.</p>
                  )}
                  {distributors.map((d) => (
                    <label
                      key={d.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-[6px] border text-xs cursor-pointer transition-colors ${
                        selectedDistributorId === d.id ? "border-[#00B4D8] bg-sky-50" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="distributor"
                        checked={selectedDistributorId === d.id}
                        onChange={() => {
                          setSelectedDistributorId(d.id);
                          setCheckedSubDealerIds([]);
                        }}
                      />
                      <span className="font-semibold text-slate-700">{d.first_name}</span>
                      <span className="ml-auto text-[10px] text-slate-400 uppercase font-bold">{d.region || "—"}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Right: Sub Dealers (checkbox, filtered by region) */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#00B4D8] uppercase tracking-wider border-b pb-1">
                  Select Sub Dealers
                </h4>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {!selectedDistributorId && (
                    <p className="text-xs text-slate-400 italic py-2">Select a distributor first.</p>
                  )}
                  {selectedDistributorId && regionMatchedSubDealers.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-2">No sub dealers found in this region.</p>
                  )}
                  {regionMatchedSubDealers.map((s) => (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-[6px] border text-xs cursor-pointer transition-colors ${
                        checkedSubDealerIds.includes(s.id) ? "border-[#00B4D8] bg-sky-50" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checkedSubDealerIds.includes(s.id)}
                        onChange={() => toggleSubDealer(s.id)}
                      />
                      <span className="font-semibold text-slate-700">{s.first_name} {s.last_name}</span>
                      {s.distributor_id && s.distributor_id !== selectedDistributorId && (
                        <span className="ml-auto text-[9px] text-amber-600 font-bold uppercase">Reassign</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 h-9 text-xs font-bold text-slate-500 hover:text-slate-700 rounded-[6px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 h-9 flex items-center gap-2 text-xs font-bold text-white bg-[#00B4D8] hover:bg-[#00a3c4] rounded-[6px] disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
