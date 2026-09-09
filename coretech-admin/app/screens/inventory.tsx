import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { Package } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import ListRow from "../../components/ListRow";
import StatusBadge, { BadgeTone } from "../../components/StatusBadge";
import EmptyState from "../../components/EmptyState";

interface StockRow {
  id: string;
  serial_no: string;
  status: string;
  warehouse_name: string | null;
  products?: { name: string; brand: string; model: string } | null;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  sold_out: "success",
  in_stock: "info",
  available: "info",
};

// Inventory - list, view only (§17 #12), self/region/everything scoped per
// the caller's own mobile grant on purchase.inventory.
export default function InventoryScreen() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    mobileApiFetch<{ success: boolean; data: StockRow[]; error?: string }>("/api/mobile/inventory")
      .then((res) => {
        if (!res.success) throw new Error(res.error || "Failed to load inventory");
        setRows(res.data);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load inventory"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.serial_no.toLowerCase().includes(q) || (r.products?.name || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Inventory" }} />
      <TextInput
        style={styles.search}
        placeholder="Search serial or product"
        placeholderTextColor={theme.colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />
      {loading ? (
        <ActivityIndicator style={styles.centerLoader} size="large" color={theme.colors.primary} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon={Package} title="No stock found" subtitle={search ? "Try a different search." : undefined} />}
          renderItem={({ item }) => (
            <ListRow
              title={item.products?.name || "Unknown Product"}
              subtitle={`SN ${item.serial_no}`}
              meta={item.warehouse_name || ""}
              right={<StatusBadge label={item.status.replace("_", " ")} tone={STATUS_TONE[item.status] || "neutral"} />}
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
  search: {
    height: 44,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textStrong,
    backgroundColor: theme.colors.card,
  },
  list: { padding: theme.spacing.md },
  errorText: { textAlign: "center", color: theme.colors.error, marginTop: theme.spacing.xl },
});
