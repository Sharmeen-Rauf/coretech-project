import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { Plus, Minus } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import ListRow from "../../components/ListRow";
import StatusBadge, { BadgeTone } from "../../components/StatusBadge";

interface OrderRow {
  id: string;
  order_code: string;
  status: string;
  created_at: string;
  product?: { name: string } | null;
  distributor?: { first_name: string; last_name: string } | null;
  user?: { first_name: string; last_name: string } | null;
}

interface Party {
  id: string;
  first_name: string;
  last_name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: "warning",
  approved: "success",
  declined: "error",
  invoice_generated: "info",
  delivered: "success",
};

// Buzzcart - list (§17 #16) + create (§17 #17) + approve/decline (§17 #18).
// Employee only for list/create. Approve/decline is a locked pair (§8) -
// country_head/admin only, independent of the buzzcart mobile permission's
// own read/write setting - `canApprove` comes from the route directly.
export default function BuzzcartScreen() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [buyerType, setBuyerType] = useState<"distributor" | "sub_dealer">("sub_dealer");
  const [distributors, setDistributors] = useState<Party[]>([]);
  const [subDealers, setSubDealers] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await mobileApiFetch<{
        success: boolean;
        data: OrderRow[];
        canWrite: boolean;
        canApprove: boolean;
        products: Product[];
        distributors: Party[];
        subDealers: Party[];
        error?: string;
      }>("/api/mobile/buzzcart");
      if (!res.success) throw new Error(res.error || "Failed to load Buzzcart orders");
      setRows(res.data);
      setCanWrite(res.canWrite);
      setCanApprove(res.canApprove);
      setProducts(res.products || []);
      setDistributors(res.distributors || []);
      setSubDealers(res.subDealers || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load Buzzcart orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setBuyerType("sub_dealer");
    setSelectedParty(null);
    setQuantities({});
    setCreateOpen(true);
  };

  const adjustQuantity = (productId: string, delta: number) => {
    setQuantities((prev) => {
      const next = Math.max(0, (prev[productId] || 0) + delta);
      return { ...prev, [productId]: next };
    });
  };

  const handleSubmit = async () => {
    if (!selectedParty) {
      setError("Select a recipient.");
      return;
    }
    const items = products
      .filter((p) => (quantities[p.id] || 0) > 0)
      .map((p) => ({ productId: p.id, productName: p.name, quantity: quantities[p.id], price: p.price }));
    if (items.length === 0) {
      setError("Add at least one product.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await mobileApiFetch<{ success: boolean; error?: string }>("/api/mobile/buzzcart", {
        method: "POST",
        body: JSON.stringify({
          buyerType,
          selectedDistributorId: buyerType === "distributor" ? selectedParty : undefined,
          selectedSubDealerId: buyerType === "sub_dealer" ? selectedParty : undefined,
          items,
        }),
      });
      if (!res.success) throw new Error(res.error || "Submission failed");
      setCreateOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const parties = buyerType === "distributor" ? distributors : subDealers;

  const handleDecision = async (orderId: string, decision: "approve" | "decline") => {
    setActioningId(orderId);
    try {
      const res = await mobileApiFetch<{ success: boolean; error?: string }>(`/api/mobile/buzzcart/${decision}`, {
        method: "POST",
        body: JSON.stringify({ orderId }),
      });
      if (!res.success) throw new Error(res.error || "Action failed");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Buzzcart" }} />

      {loading ? (
        <ActivityIndicator style={styles.centerLoader} size="large" color={theme.colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No orders yet.</Text>}
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
                ) : undefined
              }
            />
          )}
        />
      )}

      {canWrite && (
        <TouchableOpacity style={styles.fab} onPress={openCreate}>
          <Plus color="#FFFFFF" size={22} />
        </TouchableOpacity>
      )}

      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Order</Text>
            <TouchableOpacity onPress={() => setCreateOpen(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.toggleRow}>
              {(["sub_dealer", "distributor"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.toggleButton, buyerType === t && styles.toggleButtonActive]}
                  onPress={() => {
                    setBuyerType(t);
                    setSelectedParty(null);
                  }}
                >
                  <Text style={[styles.toggleText, buyerType === t && styles.toggleTextActive]}>
                    {t === "sub_dealer" ? "Sub Dealer" : "Distributor"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              data={parties}
              keyExtractor={(item) => item.id}
              horizontal
              style={styles.pickerRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerChip, selectedParty === item.id && styles.pickerChipSelected]}
                  onPress={() => setSelectedParty(item.id)}
                >
                  <Text style={[styles.pickerChipText, selectedParty === item.id && styles.pickerChipTextSelected]}>
                    {item.first_name} {item.last_name}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              style={styles.productList}
              renderItem={({ item }) => (
                <ListRow
                  title={item.name}
                  subtitle={`PKR ${item.price}`}
                  right={
                    <View style={styles.qtyControls}>
                      <TouchableOpacity onPress={() => adjustQuantity(item.id, -1)} style={styles.qtyButton}>
                        <Minus size={14} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{quantities[item.id] || 0}</Text>
                      <TouchableOpacity onPress={() => adjustQuantity(item.id, 1)} style={styles.qtyButton}>
                        <Plus size={14} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  }
                />
              )}
            />

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>{submitting ? "Submitting..." : "Submit Order"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centerLoader: { flex: 1 },
  list: { padding: theme.spacing.md },
  emptyText: { textAlign: "center", color: theme.colors.textMuted, marginTop: theme.spacing.xl },
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
    elevation: 4,
  },
  modalContainer: { flex: 1, backgroundColor: theme.colors.card },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: theme.colors.textPrimary },
  modalClose: { color: theme.colors.primary, fontWeight: "bold" },
  form: { flex: 1, padding: theme.spacing.md, gap: theme.spacing.sm },
  toggleRow: { flexDirection: "row", gap: theme.spacing.sm },
  toggleButton: {
    flex: 1,
    height: 40,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleButtonActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  toggleText: { fontSize: 13, fontWeight: "bold", color: theme.colors.textSecondary },
  toggleTextActive: { color: "#FFFFFF" },
  pickerRow: { flexGrow: 0 },
  pickerChip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.xs,
  },
  pickerChipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pickerChipText: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: "bold" },
  pickerChipTextSelected: { color: "#FFFFFF" },
  productList: { flex: 1 },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: { fontSize: 14, fontWeight: "bold", color: theme.colors.textStrong, minWidth: 18, textAlign: "center" },
  errorText: { color: theme.colors.error, fontSize: 12 },
  submitButton: {
    height: 48,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 14 },
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
