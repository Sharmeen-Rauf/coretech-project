"use server";

import { createClient as createJSClient } from "@supabase/supabase-js";
import { getCallerIdentity } from "@/app/actions/users";
import { getMyScopeAction } from "@/app/actions/roles";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createJSClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Announcement creation was a raw client-side insert, gated only by a hardcoded
// `userRole === "admin"` check in the page itself - the same inconsistency
// already found and fixed on the Users page's three admin-only sub-items: since
// "broadcast" isn't a locked permission, an admin granting write access to
// another role through Role Management would have had no effect here, because
// the button would still never appear for anyone but admin. Replaced with the
// real can_write check so the two systems can't drift out of sync again.
export async function createAnnouncementAction(params: {
  title: string;
  content: string;
  roleTarget: string;
}) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    const { canWrite } = await getMyScopeAction("broadcast");
    if (!canWrite) return { success: false, error: "You have read-only access to Broadcast Notice" };

    if (!params.title?.trim() || !params.content?.trim()) {
      return { success: false, error: "Title and content are required" };
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title: params.title.trim(),
        content: params.content.trim(),
        role_target: params.roleTarget,
        created_by: caller.id,
      })
      .select("id, title")
      .single();
    if (error) throw error;

    try {
      await supabase.from("activity_logs").insert({
        action: "Announcement Broadcast",
        details: `Announcement "${params.title}" was posted to ${params.roleTarget} users`,
      });
    } catch {
      // Non-critical.
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to post announcement" };
  }
}
