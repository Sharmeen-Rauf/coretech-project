import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Suspense } from "react";
import InstallerProtection from "@/components/InstallerProtection";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Client-side protection to redirect installers */}
      <InstallerProtection />

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
