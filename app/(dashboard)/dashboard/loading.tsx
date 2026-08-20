import { Loader2 } from "lucide-react";

// Shown while a dashboard route's server payload is being fetched during
// navigation, instead of a blank page - covers every /dashboard/* route
// since none of them had a loading.tsx before.
export default function DashboardLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
    </div>
  );
}
