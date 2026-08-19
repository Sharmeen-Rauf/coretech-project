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

    // Also surface it in the notification bell - `announcement_id` links back
    // so deleting the announcement (below) cascades to remove this row too,
    // rather than leaving a stale bell entry pointing at nothing.
    try {
      await supabase.from("notifications").insert({
        title: params.title.trim(),
        message: params.content.trim(),
        target_role: params.roleTarget,
        announcement_id: data.id,
      });
    } catch (notifErr) {
      console.warn("Failed to create notification for announcement:", notifErr);
    }

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

// Deletes an announcement and, via the FK's ON DELETE CASCADE, its matching
// notifications row along with it - so removing a notice here also clears it
// out of the bell immediately rather than leaving a stale entry behind.
export async function deleteAnnouncementAction(id: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    const { canWrite } = await getMyScopeAction("broadcast");
    if (!canWrite) return { success: false, error: "You have read-only access to Broadcast Notice" };

    const supabase = getAdminClient();
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete announcement" };
  }
}

// Powers the "popup on first login after a new announcement" behavior: returns
// the latest announcement actually addressed to this caller (their own role,
// or "all"), plus whether it's newer than the last one they've dismissed.
export async function fetchLatestAnnouncementForCallerAction(): Promise<{
  success: boolean;
  announcement: { id: string; title: string; content: string; created_at: string } | null;
  isUnseen: boolean;
  error?: string;
}> {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, announcement: null, isUnseen: false, error: "Not authenticated" };

    const supabase = getAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("last_seen_announcement_at")
      .eq("id", caller.id)
      .maybeSingle();

    const { data: latest, error } = await supabase
      .from("announcements")
      .select("id, title, content, created_at, role_target")
      .in("role_target", ["all", caller.role])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    if (!latest) return { success: true, announcement: null, isUnseen: false };

    const lastSeen = profile?.last_seen_announcement_at ? new Date(profile.last_seen_announcement_at).getTime() : 0;
    const isUnseen = new Date(latest.created_at).getTime() > lastSeen;

    return {
      success: true,
      announcement: { id: latest.id, title: latest.title, content: latest.content, created_at: latest.created_at },
      isUnseen,
    };
  } catch (err: any) {
    return { success: false, announcement: null, isUnseen: false, error: err.message || "Failed to fetch latest announcement" };
  }
}

// Marks the current moment as "seen" - called when the popup is dismissed, so
// it won't reappear until a genuinely newer announcement is posted.
export async function markAnnouncementSeenAction() {
  try {
    const caller = await getCallerIdentity();
    if (!caller) return { success: false, error: "Not authenticated" };

    const supabase = getAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({ last_seen_announcement_at: new Date().toISOString() })
      .eq("id", caller.id);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark announcement as seen" };
  }
}
