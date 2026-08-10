"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@/lib/supabase";

export default function InstallerProtection() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
          
        if (profile?.role === "installer") {
          // Immediately redirect installers away from admin dashboard
          router.replace("/installer");
        }
      } catch (err) {
        console.error("Installer protection check failed:", err);
      }
    };
    
    checkRole();
  }, [router, supabase]);

  return null;
}
