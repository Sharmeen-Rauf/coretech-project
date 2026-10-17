import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import SkeletonBlock from "../components/SkeletonBlock";
import FadeInView from "../components/FadeInView";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

// Reuses the exact backend the web Topbar bell already relies on
// (notifications/notification_reads, both wide-open-RLS tables) via a
// direct Supabase call - this app has no Next.js API layer at all (every
// other screen already queries Supabase directly), so there's nothing to
// add server-side. Mirrors app/actions/broadcast.ts's
// fetchMyNotificationsAction/markNotificationsReadAction logic, just run
// client-side instead of as a server action.
export default function NotificationsScreen() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const role = profile?.role || "installer";

      const { data: notifs, error } = await supabase
        .from("notifications")
        .select("id, title, message, created_at")
        .overlaps("target_role", ["all", role])
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      const ids = (notifs || []).map((n) => n.id);
      let readIds = new Set<string>();
      if (ids.length > 0) {
        const { data: reads } = await supabase
          .from("notification_reads")
          .select("notification_id")
          .eq("user_id", user.id)
          .in("notification_id", ids);
        readIds = new Set((reads || []).map((r: any) => r.notification_id));
      }

      const withReadState = (notifs || []).map((n) => ({ ...n, read: readIds.has(n.id) }));
      setRows(withReadState);

      // Mark everything visible as read, same as the web bell does on open -
      // a per-user upsert, so this never affects any other installer's
      // unread state.
      const unreadIds = withReadState.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length > 0) {
        await supabase
          .from("notification_reads")
          .upsert(
            unreadIds.map((notification_id) => ({ notification_id, user_id: user.id })),
            { onConflict: "notification_id,user_id" }
          );
      }
    } catch (err) {
      console.warn("Failed to load notifications", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
        <View style={styles.content}>
          <SkeletonBlock style={{ height: 80, marginBottom: 12 }} />
          <SkeletonBlock style={{ height: 80, marginBottom: 12 }} />
          <SkeletonBlock style={{ height: 80 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} colors={["#00B4D8"]} />}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Bell size={32} color="#94A3B8" />
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={index * 40}>
            <View style={[styles.card, !item.read && styles.cardUnread]}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMessage}>{item.message}</Text>
              <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
          </FadeInView>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 12,
  },
  cardUnread: {
    borderColor: "#00B4D8",
    backgroundColor: "#ECFEFF",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  cardMessage: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 8,
  },
  cardDate: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "bold",
    marginTop: 8,
  },
});
