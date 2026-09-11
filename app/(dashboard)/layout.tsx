"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AnnouncementPopup from "@/components/AnnouncementPopup";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [isValidated, setIsValidated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Fetched once here and passed down to Sidebar/Topbar, instead of each of
  // those independently re-running the same auth.getSession() + profiles
  // fetch this layout already has to do to gate the page in the first place.
  const [profile, setProfile] = useState<any>(null);
  // Mobile nav drawer. Owned here because the trigger (Topbar hamburger) and
  // the thing it opens (Sidebar) are siblings. Always starts closed, and
  // above `lg` nothing reads it - the sidebar is a static column there.
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const verifyRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace("/login");
          return;
        }

        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (!prof?.role) {
          // No session gets rejected above, and installer gets redirected
          // below - a session whose profile is missing or has no role must
          // not silently fall into the "authorized" branch and render the
          // full dashboard shell either.
          console.error("DashboardLayout: session has no profile role", session.user.id);
          router.replace("/login");
          return;
        }

        document.cookie = `user_role=${prof.role}; path=/; max-age=2592000; SameSite=Lax`;
        document.cookie = `user_status=${prof.status || "active"}; path=/; max-age=2592000; SameSite=Lax`;

        if (prof.role === "installer") {
          // Immediately redirect installer to their portal
          router.replace("/installer");
        } else {
          // Authorized user (admin, distributor, sub_dealer, etc.)
          setProfile({ ...prof, email: session.user.email });
          setIsValidated(true);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("DashboardLayout validation failed:", err);
        router.replace("/login");
      }
    };

    verifyRole();
  }, [router, supabase]);

  if (isLoading || !isValidated) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#00B4D8] mb-2" />
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
          Verifying authorization...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <AnnouncementPopup />

      {/* Sidebar Navigation */}
      <Sidebar
        profile={profile}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      {/* `pl-56` reserves the sidebar column on desktop; below `lg` the
          sidebar is off-canvas, so that reservation is cancelled. */}
      <div className="pl-56 flex flex-col min-h-screen max-lg:pl-0">
        {/* Topbar Actions */}
        <Topbar profile={profile} onMenuClick={() => setIsSidebarOpen(true)} />

        {/* Dashboard Pages */}
        {/* Only the horizontal and bottom padding is tightened for mobile.
            The 4rem top padding is deliberately left alone: it clears the
            fixed 64px Topbar, and Tailwind emits all-sides padding utilities
            ahead of single-side ones, so a mobile all-sides override would
            win over it and slide content up under the header. */}
        <main className="flex-1 pt-16 p-6 overflow-x-hidden max-lg:px-3 max-lg:pb-4">
          {children}
        </main>
      </div>
    </div>
  );
}
