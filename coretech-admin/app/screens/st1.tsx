import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Stack } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import { useRefreshOnFocus } from "../../lib/useRefreshOnFocus";
import { TrendingUp } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import ListRow from "../../components/ListRow";
import StatusBadge from "../../components/StatusBadge";
import EmptyState from "../../components/EmptyState";
import SkeletonList from "../../components/SkeletonList";

interface SaleRow {
  id: string;
  st_id: string;
  date: string;
  source_type: string;
  destination_type: string;
}

// ST1 - list, view only everywhere it appears (§2.3/§9/§17 #7) - no create,
// no detail screen, no write path exists on mobile for this permission.
// Recipient-scoped inbound tracker (§4.2): a distributor/employee only ever
// sees ST1 movements where they're the destination. Title is plain "ST1" -
// "(View Only)" was the same internal-wording leak Target had.
export default function St1Screen() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await mobileApiFetch<{ success: boolean; data: SaleRow[]; error?: string }>("/api/mobile/st1");
      if (!res.success) throw new Error(res.error || "Failed to load ST1 records");
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load ST1 records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(load);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="ST1" />
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
          ListEmptyComponent={<EmptyState icon={TrendingUp} title="No ST1 records yet" />}
          renderItem={({ item }) => (
            <ListRow
              title={item.st_id}
              subtitle={`${item.source_type} → ${item.destination_type}`}
              meta={new Date(item.date).toLocaleDateString()}
              right={<StatusBadge label="ST1" tone="info" />}
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
});
