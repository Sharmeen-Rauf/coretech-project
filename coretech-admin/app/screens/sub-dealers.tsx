import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { Users } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import ListRow from "../../components/ListRow";
import EmptyState from "../../components/EmptyState";

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
  const [error, setError] = useState("");

  useEffect(() => {
    mobileApiFetch<{ success: boolean; data: SubDealer[]; error?: string }>("/api/mobile/sub-dealers")
      .then((res) => {
        if (!res.success) throw new Error(res.error || "Failed to load sub dealers");
        setRows(res.data);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load sub dealers"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Sub Dealer List" }} />
      {loading ? (
        <ActivityIndicator style={styles.centerLoader} size="large" color={theme.colors.primary} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon={Users} title="No sub dealers assigned to you yet" />}
          renderItem={({ item }) => <ListRow title={`${item.first_name} ${item.last_name}`} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centerLoader: { flex: 1 },
  list: { padding: theme.spacing.md },
  errorText: { textAlign: "center", color: theme.colors.error, marginTop: theme.spacing.xl },
});
