import React, { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Stack } from "expo-router";
import { useRefreshOnFocus } from "../../lib/useRefreshOnFocus";
import { Package, Search, Boxes } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import ListRow from "../../components/ListRow";
import StatusBadge, { BadgeTone } from "../../components/StatusBadge";
import EmptyState from "../../components/EmptyState";
import SkeletonList from "../../components/SkeletonList";

interface StockRow {
  id: string;
  serial_no: string;
  status: string;
  warehouse_name: string | null;
  distributor_id: string | null;
  sub_dealer_id: string | null;
  products?: { name: string; brand: string; model: string } | null;
}

const LOCATION_TONE: Record<string, BadgeTone> = {
  "Sub Dealer": "success",
  Distributor: "info",
  Warehouse: "neutral",
};

function locationFor(row: StockRow): string {
  if (row.sub_dealer_id) return "Sub Dealer";
  if (row.distributor_id) return "Distributor";
  return "Warehouse";
}

// Inventory - list, view only (§17 #12), self/region/everything scoped per
// the caller's own mobile grant on purchase.inventory. Filters out
// status === "sold_out" client-side, matching the web Inventory page
// exactly (app/(dashboard)/dashboard/purchase/inventory/page.tsx) - sold
// units belong to the Sell Out screen, not here; this mobile screen
// previously skipped that filter and leaked them in. The status badge
// (only ever "active" once sold_out is excluded) is replaced with a more
// useful current-location badge (Warehouse/Distributor/Sub Dealer).
export default function InventoryScreen() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await mobileApiFetch<{ success: boolean; data: StockRow[]; error?: string }>("/api/mobile/inventory");
      if (!res.success) throw new Error(res.error || "Failed to load inventory");
      setRows(res.data.filter((item) => item.status !== "sold_out"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(load);

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

      <View style={styles.searchRow}>
        <Search color={theme.colors.textMuted} size={16} style={styles.searchIcon} />
        <TextInput
          style={styles.search}
          placeholder="Search serial or product"
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {!loading && (
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Boxes color={theme.colors.primary} size={18} />
          </View>
          <View>
            <Text style={styles.statValue}>{rows.length}</Text>
            <Text style={styles.statLabel}>units in stock</Text>
          </View>
        </View>
      )}

      {loading ? (
        <SkeletonList count={6} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<EmptyState icon={Package} title="No stock found" subtitle={search ? "Try a different search." : undefined} />}
          renderItem={({ item }) => {
            const location = locationFor(item);
            return (
              <ListRow
                title={item.products?.name || "Unknown Product"}
                subtitle={`SN ${item.serial_no}`}
                meta={item.warehouse_name || ""}
                right={<StatusBadge label={location} tone={LOCATION_TONE[location] || "neutral"} />}
              />
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: theme.spacing.md },
  searchRow: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    position: "relative",
    justifyContent: "center",
  },
  searchIcon: {
    position: "absolute",
    left: theme.spacing.md,
    zIndex: 1,
  },
  search: {
    height: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingLeft: theme.spacing.xl + theme.spacing.xs,
    paddingRight: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textStrong,
    backgroundColor: theme.colors.card,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    ...theme.shadow.card,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 16, fontWeight: "bold", color: theme.colors.textStrong },
  statLabel: { fontSize: 11, color: theme.colors.textMuted },
  list: { padding: theme.spacing.md },
  errorText: { textAlign: "center", color: theme.colors.error, marginTop: theme.spacing.xl },
});
