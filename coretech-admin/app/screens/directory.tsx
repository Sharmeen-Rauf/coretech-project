import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Stack, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Users } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import ListRow from "../../components/ListRow";
import EmptyState from "../../components/EmptyState";
import SkeletonList from "../../components/SkeletonList";

interface DirectoryProfile {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
  region: string | null;
}

// Distributor View / Sub-Dealer View (§17 #14/#15) - Employee only, both
// hard view-only, distinct permissions sharing one screen shape (matches
// app/api/mobile/directory's own ?type= split). No edit/create UI on
// either, ever.
export default function DirectoryScreen() {
  const { type } = useLocalSearchParams<{ type: "distributor" | "sub_dealer" }>();
  const [rows, setRows] = useState<DirectoryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const title = type === "sub_dealer" ? "Sub-Dealer View" : "Distributor View";

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await mobileApiFetch<{ success: boolean; data: DirectoryProfile[]; error?: string }>(
        `/api/mobile/directory?type=${type}`
      );
      if (!res.success) throw new Error(res.error || "Failed to load directory");
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load directory");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title }} />
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
          ListEmptyComponent={<EmptyState icon={Users} title="Nothing to show" />}
          renderItem={({ item }) => (
            <ListRow
              title={`${item.first_name} ${item.last_name}`}
              subtitle={item.contact || undefined}
              meta={item.region || ""}
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
