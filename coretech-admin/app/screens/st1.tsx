import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import ListRow from "../../components/ListRow";
import StatusBadge from "../../components/StatusBadge";

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
// sees ST1 movements where they're the destination.
export default function St1Screen() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    mobileApiFetch<{ success: boolean; data: SaleRow[]; error?: string }>("/api/mobile/st1")
      .then((res) => {
        if (!res.success) throw new Error(res.error || "Failed to load ST1 records");
        setRows(res.data);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load ST1 records"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "ST1 (View Only)" }} />
      {loading ? (
        <ActivityIndicator style={styles.centerLoader} size="large" color={theme.colors.primary} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No ST1 records yet.</Text>}
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
  centerLoader: { flex: 1 },
  list: { padding: theme.spacing.md },
  emptyText: { textAlign: "center", color: theme.colors.textMuted, marginTop: theme.spacing.xl },
  errorText: { textAlign: "center", color: theme.colors.error, marginTop: theme.spacing.xl },
});
