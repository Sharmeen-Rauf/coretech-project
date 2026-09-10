import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Stack } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import { useRefreshOnFocus } from "../../lib/useRefreshOnFocus";
import { BellOff } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import ListRow from "../../components/ListRow";
import EmptyState from "../../components/EmptyState";
import SkeletonList from "../../components/SkeletonList";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

// Notifications - full list (§17 #21, §18). Reached only by tapping the
// Home bell. Opening this screen automatically marks everything in it as
// read - no explicit "mark all as read" button, unlike web's bell.
export default function NotificationsScreen() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await mobileApiFetch<{ success: boolean; data: NotificationRow[]; error?: string }>("/api/mobile/notifications");
      if (!res.success) throw new Error(res.error || "Failed to load notifications");
      setRows(res.data);
      const unreadIds = res.data.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length > 0) {
        mobileApiFetch("/api/mobile/notifications", { method: "POST", body: JSON.stringify({ ids: unreadIds }) }).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(load);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Notifications" />
      {loading ? (
        <SkeletonList count={6} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<EmptyState icon={BellOff} title="All caught up!" subtitle="No notifications." />}
          renderItem={({ item }) => (
            <ListRow
              title={item.title}
              subtitle={item.message}
              meta={new Date(item.created_at).toLocaleDateString()}
              right={!item.read ? <View style={styles.unreadDot} /> : undefined}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  list: { padding: theme.spacing.md },
  errorText: { textAlign: "center", color: theme.colors.error, marginTop: theme.spacing.xl },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
});
