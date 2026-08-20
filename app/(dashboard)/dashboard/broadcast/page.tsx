"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { Loader2, Plus, X, Megaphone } from "lucide-react";
import toast from "react-hot-toast";
import { mergeLocalItems } from "@/lib/supabaseLocalFallback";
import { createAnnouncementAction, updateAnnouncementAction, deleteAnnouncementAction } from "@/app/actions/broadcast";
import { getMyScopeAction } from "@/app/actions/roles";

const ALL_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "country_head", label: "Country Head" },
  { value: "retail_manager", label: "Retail Manager" },
  { value: "rsm", label: "RSM" },
  { value: "marketing_manager", label: "Marketing Manager" },
  { value: "distributor", label: "Distributor" },
  { value: "sub_dealer", label: "Sub Dealer" },
  { value: "installer", label: "Installer" },
  { value: "employee", label: "Employee" },
];

interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  role_target: string[];
  created_at: string;
  creator?: { first_name: string; last_name: string | null } | null;
}

export default function BroadcastPage() {
  const supabase = createClientComponentClient();
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canWrite, setCanWrite] = useState(false); // deny-until-resolved, same as other scoped pages

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [roleTargets, setRoleTargets] = useState<string[]>(["all"]);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const writeRes = await getMyScopeAction("broadcast");
        setCanWrite(writeRes.canWrite);
      } catch (writeErr) {
        console.warn("Failed to resolve write access", writeErr);
      }

      // Fetch announcements
      let dbData: any[] = [];
      try {
        const { data, error } = await supabase
          .from("announcements")
          .select("*, creator:profiles!created_by(first_name, last_name)")
          .order("created_at", { ascending: false });

        if (error) throw error;
        dbData = data || [];
      } catch (dbErr) {
        console.warn("Failed to load announcements from database. Using local fallback.", dbErr);
      }

      const merged = mergeLocalItems(dbData, "coretech_local_announcements");
      setAnnouncements(merged);
    } catch (err: any) {
      console.error("Failed to load announcements", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setRoleTargets(["all"]);
  };

  const toggleRole = (role: string) => {
    setRoleTargets((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const toggleSelectAll = () => {
    setRoleTargets((prev) => (prev.length === ALL_ROLES.length ? [] : ALL_ROLES.map((r) => r.value)));
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || roleTargets.length === 0) {
      toast.error("Please fill in all fields and select at least one role");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = editingId
        ? await updateAnnouncementAction({ id: editingId, title, content, roleTargets })
        : await createAnnouncementAction({ title, content, roleTargets });

      if (!res.success) {
        toast.error(res.error || "Failed to save announcement");
        return;
      }

      toast.success(editingId ? "Announcement updated" : "Notice broadcasted successfully!");
      setIsModalOpen(false);
      resetForm();
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message || "Failed to save announcement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (row: any) => {
    setEditingId(row.id);
    setTitle(row.title);
    setContent(row.content);
    setRoleTargets(Array.isArray(row.role_target) ? row.role_target : [row.role_target].filter(Boolean));
    setIsModalOpen(true);
  };

  const handleDeleteAnnouncement = async (row: any) => {
    if (!window.confirm(`Delete announcement "${row.title}"? This also removes it from the notification bell.`)) return;

    try {
      const res = await deleteAnnouncementAction(row.id);
      if (!res.success) {
        toast.error(res.error || "Failed to delete announcement");
        return;
      }
      toast.success("Announcement deleted");
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete announcement");
    }
  };

  const columns = [
    { key: "title", label: "Notice Title" },
    {
      key: "content",
      label: "Message Content",
      render: (val: string) => <span className="text-slate-500 truncate block max-w-sm">{val}</span>,
    },
    {
      key: "role_target",
      label: "Target Audience",
      render: (val: string[]) => (
        <span className="capitalize font-bold text-slate-600">
          {Array.isArray(val) ? val.map((r) => r.replace("_", " ")).join(", ") : val}
        </span>
      ),
    },
    {
      key: "creator",
      label: "Posted By",
      render: (val: any) => (
        <span className="text-xs text-slate-600">{val ? `${val.first_name} ${val.last_name || ""}`.trim() : "-"}</span>
      ),
    },
    {
      key: "created_at",
      label: "Date Broadcasted",
      render: (val: string) => <span>{new Date(val).toLocaleDateString()}</span>,
    },
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const paginated = announcements.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-6 select-none">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Broadcast Notice</h1>
          <p className="text-xs text-slate-500">
            Publish notifications and announcements across company portals.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Broadcast Notice
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : (
        <DataTable allData={announcements}
          title="Broadcasted Notices"
          columns={columns}
          data={paginated}
          isLoading={false}
          onEditClick={canWrite ? handleEditClick : undefined}
          onDeleteClick={canWrite ? handleDeleteAnnouncement : undefined}
          pagination={{
            current: currentPage,
            total: announcements.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
        />
      )}

      {/* Broadcast Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => { setIsModalOpen(false); resetForm(); }}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-[#00B4D8]" /> {editingId ? "Edit Announcement" : "Broadcast Notice"}
              </h3>
              <button
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Notice Title*
                </label>
                <input
                  type="text"
                  placeholder="e.g. Server Maintenance Notice"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Target Roles*
                  </label>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-[10px] font-bold text-[#00B4D8] hover:underline"
                  >
                    {roleTargets.length === ALL_ROLES.length ? "Clear All" : "Select All"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 border border-slate-200 rounded-[6px] p-2 max-h-36 overflow-y-auto">
                  {ALL_ROLES.map((r) => (
                    <label key={r.value} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roleTargets.includes(r.value)}
                        onChange={() => toggleRole(r.value)}
                        className="accent-[#00B4D8]"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Announcement Body*
                </label>
                <textarea
                  placeholder="Write announcement text here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-28 px-3 py-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
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
                  {editingId ? "Save Changes" : "Publish Notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
