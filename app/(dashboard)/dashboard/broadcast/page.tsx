"use client";
 
import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { Loader2, Plus, X, Megaphone } from "lucide-react";
import toast from "react-hot-toast";
 
interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  role_target: string;
  created_at: string;
}
 
export default function BroadcastPage() {
  const supabase = createClientComponentClient();
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
 
  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [roleTarget, setRoleTarget] = useState("all");
 
  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
 
      // Get role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profile) setUserRole(profile.role);
 
      // Fetch announcements
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
 
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err: any) {
      console.error("Failed to load announcements", err.message);
    } finally {
      setIsLoading(false);
    }
  };
 
  useEffect(() => {
    fetchAnnouncements();
  }, []);
 
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
 
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated session found");
 
      const { error } = await supabase.from("announcements").insert({
        title: title.trim(),
        content: content.trim(),
        role_target: roleTarget,
        created_by: user.id,
      });
 
      if (error) throw error;
 
      // Log activity
      await supabase.from("activity_logs").insert({
        action: "Announcement Broadcast",
        details: `Announcement "${title}" was posted to ${roleTarget} users`,
      });
 
      toast.success("Notice broadcasted successfully!");
      setIsModalOpen(false);
      setTitle("");
      setContent("");
      setRoleTarget("all");
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message || "Failed to post announcement");
    } finally {
      setIsSubmitting(false);
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
      render: (val: string) => <span className="capitalize font-bold text-slate-600">{val}</span>,
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
 
        {userRole === "admin" && (
          <button
            onClick={() => setIsModalOpen(true)}
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
        <DataTable
          title="Broadcasted Notices"
          columns={columns}
          data={paginated}
          isLoading={false}
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
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>
 
          <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-[#00B4D8]" /> Broadcast Notice
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
 
            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
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
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Target Role
                </label>
                <select
                  value={roleTarget}
                  onChange={(e) => setRoleTarget(e.target.value)}
                  className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
                >
                  <option value="all">All Roles</option>
                  <option value="employee">Employees Only</option>
                  <option value="distributor">Distributors Only</option>
                  <option value="sub_dealer">Sub Dealers Only</option>
                  <option value="installer">Installers Only</option>
                </select>
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
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
