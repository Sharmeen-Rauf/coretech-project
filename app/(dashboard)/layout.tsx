"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
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

  useEffect(() => {
    const verifyRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, status")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          document.cookie = `user_role=${profile.role}; path=/; max-age=2592000; SameSite=Lax`;
          document.cookie = `user_status=${profile.status || "active"}; path=/; max-age=2592000; SameSite=Lax`;
        }

        if (profile?.role === "installer") {
          // Immediately redirect installer to their portal
          router.replace("/installer");
        } else {
          // Authorized user (admin, distributor, sub_dealer, etc.)
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
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="pl-56 flex flex-col min-h-screen">
        {/* Topbar Actions */}
        <Topbar />

        {/* Dashboard Pages */}
        <main className="flex-1 pt-16 p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
