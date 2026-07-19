"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { Loader2, ShieldCheck, Activity } from "lucide-react";
import toast from "react-hot-toast";

interface ActivityRow {
  id: string;
  user_name: string;
  action: string;
  details: string;
  created_at: string;
}

export default function ActivityLogsPage() {
  const supabase = createClientComponentClient();
  const [logs, setLogs] = useState<ActivityRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select(`
          id,
          action,
          details,
          created_at,
          profile:profiles!user_id(first_name, last_name, role)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted: ActivityRow[] = (data || []).map((row: any) => ({
        id: row.id,
        user_name: row.profile ? `${row.profile.first_name} ${row.profile.last_name || ""}`.trim() : "System Administrator",
        action: row.action,
        details: row.details || "-",
        created_at: row.created_at ? new Date(row.created_at).toLocaleString() : "-",
      }));

      setLogs(formatted);
    } catch (err: any) {
      console.error("Failed to load activity logs", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columns = [
    { key: "created_at", label: "Timestamp" },
    { key: "user_name", label: "User" },
    {
      key: "action",
      label: "Action Type",
      render: (val: string) => (
        <span className="inline-flex items-center gap-1 font-bold text-slate-800">
          <Activity className="w-3.5 h-3.5 text-[#00B4D8]" />
          {val}
        </span>
      ),
    },
    { key: "details", label: "Audit Details" },
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const paginated = logs.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  return (
    <div className="space-y-6 select-none">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">System Activity Logs</h1>
          <p className="text-xs text-slate-500">
            System audit trail showing database changes and administrative actions.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-55 border border-slate-200 rounded-[6px] text-slate-600 text-[10px] font-bold uppercase">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Audit Secured</span>
        </div>
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : (
        <DataTable allData={logs}
          title="Security Audit Ledger"
          columns={columns}
          data={paginated}
          isLoading={false}
          searchPlaceholder="Search Audit Logs..."
          pagination={{
            current: currentPage,
            total: logs.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
        />
      )}
    </div>
  );
}
