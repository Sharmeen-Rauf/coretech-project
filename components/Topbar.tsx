"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { createClientComponentClient } from "@/lib/supabase";
import {
  Bell,
  Search,
  Settings,
  History,
  Grid,
  Calendar,
  X,
  User,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  target_role: string;
  read: boolean;
  created_at: string;
}

export default function Topbar() {
  const pathname = usePathname();
  const supabase = createClientComponentClient();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Parse path to breadcrumbs
  const getBreadcrumbs = () => {
    const segments = pathname.split("/").filter((x) => x);
    return segments.map((seg, idx) => {
      const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace("-", " ");
      const url = "/" + segments.slice(0, idx + 1).join("/");
      return { label, url };
    });
  };

  const breadcrumbs = getBreadcrumbs();
  const currentPageName =
    breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : "Home";

  // Fetch initial notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        setNotifications(data || []);
        setUnreadCount((data || []).filter((n: NotificationItem) => !n.read).length);
      } catch (err: any) {
        console.error("Error fetching notifications:", err.message);
      }
    };

    fetchNotifications();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: any) => {
          const newNotif = payload.new as NotificationItem;
          setNotifications((prev: any) => [newNotif, ...prev]);
          setUnreadCount((prev) => prev + 1);
          toast((t) => (
            <div className="flex items-start gap-2 text-xs">
              <Bell className="w-4 h-4 text-[#00B4D8] mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">{newNotif.title}</p>
                <p className="text-slate-500">{newNotif.message}</p>
              </div>
            </div>
          ), { duration: 4000 });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 fixed top-0 right-0 left-56 z-20 select-none">
        {/* Left Side: Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 text-xs">
            Dashboard
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <div key={crumb.url} className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-300">/</span>
              <span
                className={
                  idx === breadcrumbs.length - 1
                    ? "text-slate-800 font-semibold"
                    : "text-slate-400 hover:text-slate-600"
                }
              >
                {crumb.label}
              </span>
            </div>
          ))}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          {/* Today Dropdown Filter */}
          <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors bg-white">
            <Calendar className="w-3.5 h-3.5 text-[#00B4D8]" />
            <span>Today</span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              className="h-9 w-48 pl-9 pr-4 rounded-[6px] border border-slate-200 text-xs text-slate-800 placeholder-slate-400 bg-[#F8FAFC] focus:outline-none focus:border-[#00B4D8] focus:bg-white transition-all duration-200"
            />
          </div>

          {/* Actions Icons */}
          <button className="p-2 text-slate-500 hover:text-[#00B4D8] hover:bg-slate-50 rounded-full transition-colors">
            <Settings className="w-4.5 h-4.5" />
          </button>
          <button className="p-2 text-slate-500 hover:text-[#00B4D8] hover:bg-slate-50 rounded-full transition-colors">
            <History className="w-4.5 h-4.5" />
          </button>

          {/* Notifications Bell */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 text-slate-500 hover:text-[#00B4D8] hover:bg-slate-50 rounded-full relative transition-colors"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-rose-500 text-white font-bold text-[8px] flex items-center justify-center rounded-full border border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Grid Layout Icon */}
          <button className="p-2 text-slate-500 hover:text-[#00B4D8] hover:bg-slate-50 rounded-full transition-colors">
            <Grid className="w-4.5 h-4.5" />
          </button>

          <div className="w-px h-6 bg-slate-200 my-auto"></div>

          {/* User Profile Avatar */}
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 border border-slate-300 shadow-sm cursor-pointer hover:border-[#00B4D8] transition-colors">
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>

      {/* Notifications Drawer (Slides in from Right) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end select-none">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity"
          ></div>

          {/* Drawer Panel */}
          <div className="relative w-80 h-full bg-white shadow-2xl flex flex-col z-10 transition-transform duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4.5 h-4.5 text-[#00B4D8]" />
                <span className="font-bold text-slate-800 text-sm">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="bg-[#F0FAFE] text-[#00B4D8] text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Actions Bar */}
            {unreadCount > 0 && (
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-500">Unread updates waiting</span>
                <button
                  onClick={markAllAsRead}
                  className="text-[#00B4D8] font-bold hover:underline"
                >
                  Mark all as read
                </button>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2 p-4">
                  <CheckCircle2 className="w-8 h-8 text-slate-300" />
                  <p className="text-xs">All caught up! No notifications.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 hover:bg-slate-50/50 transition-colors text-xs ${
                      !notif.read ? "bg-[#F0FAFE]/40" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-bold text-slate-800">{notif.title}</p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {formatDate(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-1 leading-relaxed">
                      {notif.message}
                    </p>
                    {notif.target_role && (
                      <span className="inline-block mt-2 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase rounded-[4px]">
                        {notif.target_role}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
