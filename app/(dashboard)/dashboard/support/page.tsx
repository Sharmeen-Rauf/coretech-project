"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { Loader2, Plus, X, MessageSquare, HelpCircle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { getLocalItems, saveLocalItem, mergeLocalItems, deleteLocalItem } from "@/lib/supabaseLocalFallback";
import { deleteRecordAction } from "@/app/actions/users";

interface SupportTicketRow {
  id: string;
  user_name: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export default function SupportTicketsPage() {
  const supabase = createClientComponentClient();
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let roleStr = "employee";
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) roleStr = profile.role;
      } catch (roleErr) {
        console.warn("Failed to get profile role. Defaulting to employee.", roleErr);
      }
      setUserRole(roleStr);

      let dbData: any[] = [];
      try {
        let query = supabase
          .from("support_tickets")
          .select(`
            id,
            subject,
            message,
            status,
            created_at,
            profile:profiles!user_id(first_name, last_name, role)
          `);

        if (roleStr !== "admin") {
          query = query.eq("user_id", session.user.id);
        }

        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        dbData = data || [];
      } catch (dbErr) {
        console.warn("Failed to fetch tickets from database. Using local fallback.", dbErr);
      }

      const merged = mergeLocalItems(dbData, "coretech_local_support_tickets");

      const formatted: SupportTicketRow[] = merged.map((row: any) => ({
        id: row.id,
        user_name: row.profile 
          ? `${row.profile.first_name} ${row.profile.last_name || ""}`.trim() 
          : (row.local_user_name || "System Guest"),
        subject: row.subject,
        message: row.message,
        status: row.status,
        created_at: row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
      }));

      setTickets(formatted);
    } catch (err: any) {
      console.error("Failed to load tickets", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated session found");

      const payload = {
        user_id: user.id,
        subject,
        message,
        status: "open",
      };

      try {
        const { error } = await supabase.from("support_tickets").insert(payload);
        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database ticket insert failed. Saving locally.", dbErr);
        saveLocalItem("coretech_local_support_tickets", {
          ...payload,
          local_user_name: user.email || "Local User",
        });
      }

      toast.success("Support ticket opened successfully!");
      setIsModalOpen(false);
      setSubject("");
      setMessage("");
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || "Failed to create support ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveTicket = async (id: string, newStatus: string) => {
    try {
      try {
        const { error } = await supabase
          .from("support_tickets")
          .update({ status: newStatus })
          .eq("id", id);

        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database ticket update failed. Saving locally.", dbErr);
        const localTickets = getLocalItems("coretech_local_support_tickets");
        const match = localTickets.find((t: any) => t.id === id);
        const updated = {
          ...(match || { id }),
          status: newStatus,
        };
        saveLocalItem("coretech_local_support_tickets", updated, true);
      }

      // Log activity safely
      try {
        const target = tickets.find((t) => t.id === id);
        await supabase.from("activity_logs").insert({
          action: "Support Ticket Update",
          details: `Ticket "${target?.subject}" marked as ${newStatus}`,
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }

      toast.success(`Ticket marked as ${newStatus}!`);
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || "Failed to update ticket status");
    }
  };

  const handleDeleteTicket = async (row: any) => {
    if (!window.confirm(`Are you sure you want to delete this ticket?`)) return;

    try {
      if (row.id) {
        const res = await deleteRecordAction("support_tickets", row.id);
        if (!res.success) {
          console.warn("DB delete failed, attempting local delete", res.error);
        }
      }
      
      deleteLocalItem("coretech_local_support_tickets", row.id);
      
      toast.success(`Ticket deleted successfully!`);
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete ticket");
    }
  };

  const baseColumns = [
    { key: "user_name", label: "User" },
    { key: "subject", label: "Subject" },
    {
      key: "message",
      label: "Message Summary",
      render: (val: string) => <span className="text-slate-500 text-xs truncate max-w-xs block">{val}</span>,
    },
    { key: "created_at", label: "Date Opened" },
    {
      key: "status",
      label: "Status",
      render: (val: string) => (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
          val === "resolved" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
          val === "closed" ? "bg-slate-50 text-slate-600 border border-slate-200" :
          "bg-amber-50 text-amber-600 border border-amber-200"
        }`}>
          {val}
        </span>
      ),
    },
  ];

  const columns = userRole === "admin" ? [
    ...baseColumns,
    {
      key: "id",
      label: "Action",
      render: (val: string, row: any) => {
        if (row.status === "closed" || row.status === "resolved") return <span className="text-slate-400 text-xs">Resolved</span>;
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleResolveTicket(val, "resolved")}
              className="p-1 hover:bg-emerald-50 text-emerald-600 rounded border border-emerald-100 transition-colors"
              title="Resolve Ticket"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleResolveTicket(val, "closed")}
              className="p-1 hover:bg-slate-50 text-slate-600 rounded border border-slate-200 transition-colors"
              title="Close Ticket"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    },
  ] : baseColumns;

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const paginated = tickets.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  return (
    <div className="space-y-6 select-none">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Support Tickets Channel</h1>
          <p className="text-xs text-slate-500">
            Open new operational inquiries and resolve support tickets.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Open Ticket
        </button>
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : (
        <DataTable allData={tickets}
          title="Support Tickets Board"
          columns={columns}
          data={paginated}
          isLoading={false}
          searchPlaceholder="Search Inquiries..."
          pagination={{
            current: currentPage,
            total: tickets.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
          onDeleteClick={handleDeleteTicket}
        />
      )}

      {/* Open Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Open Support Ticket
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Subject*
                </label>
                <input
                  type="text"
                  placeholder="e.g. Broken stock box delivery"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Message Details*
                </label>
                <textarea
                  placeholder="Explain your inquiry or issue in detail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
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
                  Open Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
