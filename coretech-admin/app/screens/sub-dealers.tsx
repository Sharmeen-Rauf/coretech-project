import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Stack } from "expo-router";
import { useRefreshOnFocus } from "../../lib/useRefreshOnFocus";
import { Users } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import ListRow from "../../components/ListRow";
import EmptyState from "../../components/EmptyState";
import SkeletonList from "../../components/SkeletonList";

interface SubDealer {
  id: string;
  first_name: string;
  last_name: string;
}

// Sub Dealer List - Distributor's own assigned sub-dealers, read only
// (§17 #13). Assignment itself is an admin/web-only action.
export default function SubDealersScreen() {
  const [rows, setRows] = useState<SubDealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await mobileApiFetch<{ success: boolean; data: SubDealer[]; error?: string }>("/api/mobile/sub-dealers");
      if (!res.success) throw new Error(res.error || "Failed to load sub dealers");
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load sub dealers");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(load);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Sub Dealer List" }} />
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
          ListEmptyComponent={<EmptyState icon={Users} title="No sub dealers assigned to you yet" />}
          renderItem={({ item }) => <ListRow title={`${item.first_name} ${item.last_name}`} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: theme.spacing.md },
  list: { padding: theme.spacing.md },
  errorText: { textAlign: "center", color: theme.colors.error, marginTop: theme.spacing.xl },
});
