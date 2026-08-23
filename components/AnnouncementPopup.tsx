"use client";

import { useEffect, useState } from "react";
import { X, Megaphone } from "lucide-react";
import { fetchLatestAnnouncementForCallerAction } from "@/app/actions/broadcast";

// Simplified per client request: no "seen" tracking at all - just shows the
// latest announcement addressed to the current user every time the dashboard
// layout mounts fresh, which in practice means every login (client-side
// navigation within the dashboard doesn't remount this). Separate from the
// notification bell (Topbar.tsx), which keeps listing every announcement
// until it's deleted, not just the latest one.
export default function AnnouncementPopup() {
  const [announcement, setAnnouncement] = useState<{ id: string; title: string; content: string } | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetchLatestAnnouncementForCallerAction();
        if (res.success && res.announcement) {
          setAnnouncement(res.announcement);
        }
      } catch (err) {
        console.warn("Failed to check for latest announcement", err);
      }
    };
    check();
  }, []);

  const dismiss = () => {
    setAnnouncement(null);
  };

  if (!announcement) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div onClick={dismiss} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"></div>

      <div className="relative bg-white w-full max-w-md border border-slate-150 rounded-[12px] shadow-2xl p-6 flex flex-col z-10 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#00B4D8]" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">New Announcement</h3>
          </div>
          <button
            onClick={dismiss}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm font-bold text-slate-800 mb-2">{announcement.title}</p>
        <p className="text-xs text-slate-600 whitespace-pre-wrap">{announcement.content}</p>

        <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
          <button
            onClick={dismiss}
            className="h-9 px-4 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] rounded-[6px] shadow transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
