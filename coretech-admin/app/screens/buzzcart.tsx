import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Stack, router } from "expo-router";
import { useRefreshOnFocus } from "../../lib/useRefreshOnFocus";
import { Plus, ShoppingBag } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import { haptics } from "../../lib/haptics";
import ListRow from "../../components/ListRow";
import StatusBadge, { BadgeTone } from "../../components/StatusBadge";
import EmptyState from "../../components/EmptyState";
import SkeletonList from "../../components/SkeletonList";
import AnimatedPressable from "../../components/AnimatedPressable";

interface OrderRow {
  id: string;
  order_code: string;
  status: string;
  created_at: string;
  product?: { name: string } | null;
  distributor?: { first_name: string; last_name: string } | null;
  user?: { first_name: string; last_name: string } | null;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: "warning",
  approved: "success",
  declined: "error",
  invoice_generated: "info",
  delivered: "success",
};

// Buzzcart - list (§17 #16) + create (§17 #17, a separate pushed screen -
// app/screens/buzzcart-create.tsx) + approve/decline (§17 #18) + Generate
// Invoice/Generate Gate Pass (admin-only, mirrors components/
// OrderStatusModal.tsx on web). Approve/decline and invoice/gate-pass are
// both locked pairs (§8) independent of the buzzcart mobile permission's
// own read/write setting - canApprove/canManageInvoice come from the route
// directly.
export default function BuzzcartScreen() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [canManageInvoice, setCanManageInvoice] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await mobileApiFetch<{
        success: boolean;
        data: OrderRow[];
        canWrite: boolean;
        canApprove: boolean;
        canManageInvoice: boolean;
        error?: string;
      }>("/api/mobile/buzzcart");
      if (!res.success) throw new Error(res.error || "Failed to load Buzzcart orders");
      setRows(res.data);
      setCanWrite(res.canWrite);
      setCanApprove(res.canApprove);
      setCanManageInvoice(res.canManageInvoice);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load Buzzcart orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(load);

  const runOrderAction = async (orderId: string, endpoint: string) => {
    haptics.light();
    setActioningId(orderId);
    try {
      const res = await mobileApiFetch<{ success: boolean; error?: string }>(`/api/mobile/buzzcart/${endpoint}`, {
        method: "POST",
        body: JSON.stringify({ orderId }),
      });
      if (!res.success) throw new Error(res.error || "Action failed");
      haptics.success();
      load();
    } catch (err) {
      haptics.error();
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setActioningId(null);
    }
  };

  const handleDecision = (orderId: string, decision: "approve" | "decline") => runOrderAction(orderId, decision);
  const handleGenerateInvoice = (orderId: string) => runOrderAction(orderId, "generate-invoice");
  const handleGenerateGatepass = (orderId: string) => runOrderAction(orderId, "generate-gatepass");

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Buzzcart" }} />

      {loading ? (
        <SkeletonList count={6} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<EmptyState icon={ShoppingBag} title="No orders yet" subtitle="Orders you create will show up here." />}
          renderItem={({ item }) => (
            <ListRow
              title={item.order_code}
              subtitle={item.product?.name || ""}
              meta={new Date(item.created_at).toLocaleDateString()}
              right={<StatusBadge label={item.status.replace("_", " ")} tone={STATUS_TONE[item.status] || "neutral"} />}
              footer={
                canApprove && item.status === "pending" ? (
                  <View style={styles.decisionRow}>
                    <TouchableOpacity
                      style={[styles.decisionButton, styles.declineButton]}
                      onPress={() => handleDecision(item.id, "decline")}
                      disabled={actioningId === item.id}
                    >
                      <Text style={styles.declineButtonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.decisionButton, styles.approveButton]}
                      onPress={() => handleDecision(item.id, "approve")}
                      disabled={actioningId === item.id}
                    >
                      <Text style={styles.approveButtonText}>{actioningId === item.id ? "..." : "Approve"}</Text>
                    </TouchableOpacity>
                  </View>
                ) : canManageInvoice && item.status === "approved" ? (
                  <TouchableOpacity
                    style={[styles.decisionButton, styles.approveButton]}
                    onPress={() => handleGenerateInvoice(item.id)}
                    disabled={actioningId === item.id}
                  >
                    <Text style={styles.approveButtonText}>
                      {actioningId === item.id ? "..." : "Generate Invoice"}
                    </Text>
                  </TouchableOpacity>
                ) : canManageInvoice && item.status === "invoice_generated" ? (
                  <TouchableOpacity
                    style={[styles.decisionButton, styles.approveButton]}
                    onPress={() => handleGenerateGatepass(item.id)}
                    disabled={actioningId === item.id}
                  >
                    <Text style={styles.approveButtonText}>
                      {actioningId === item.id ? "..." : "Generate Gate Pass"}
                    </Text>
                  </TouchableOpacity>
                ) : undefined
              }
            />
          )}
        />
      )}

      {canWrite && (
        <AnimatedPressable
          style={styles.fab}
          onPress={() => {
            haptics.light();
            router.push("/screens/buzzcart-create");
          }}
        >
          <Plus color="#FFFFFF" size={22} />
        </AnimatedPressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: theme.spacing.md },
  list: { padding: theme.spacing.md },
  fab: {
    position: "absolute",
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.fab,
  },
  decisionRow: { flexDirection: "row", gap: theme.spacing.sm },
  decisionButton: {
    flex: 1,
    height: 36,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButton: { borderWidth: 1, borderColor: theme.colors.error },
  declineButtonText: { color: theme.colors.error, fontWeight: "bold", fontSize: 12 },
  approveButton: { backgroundColor: theme.colors.success },
  approveButtonText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 12 },
});
