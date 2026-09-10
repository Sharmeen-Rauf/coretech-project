import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { Stack, router } from "expo-router";
import { Plus, Minus, Check } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import { haptics } from "../../lib/haptics";
import ListRow from "../../components/ListRow";
import Button from "../../components/Button";
import ScreenHeader from "../../components/ScreenHeader";

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

// New Buzzcart Order - a real pushed screen (not a React Native <Modal>).
// Submitting here and calling router.back() sends the caller back through
// the router's own focus lifecycle, so app/screens/buzzcart.tsx's
// useRefreshOnFocus picks up the change reliably - a plain Modal closing
// over the list left the underlying screen's data correct but not always
// visually repainted immediately on Android, which read as "I have to pull
// to refresh myself" even though the data was already fresh.
export default function BuzzcartCreateScreen() {
  const [loadingPickers, setLoadingPickers] = useState(true);
  const [step, setStep] = useState<0 | 1>(0);
  const [buyerType, setBuyerType] = useState<"distributor" | "sub_dealer">("sub_dealer");
  const [distributors, setDistributors] = useState<Party[]>([]);
  const [subDealers, setSubDealers] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    mobileApiFetch<{ success: boolean; products: Product[]; distributors: Party[]; subDealers: Party[]; error?: string }>(
      "/api/mobile/buzzcart/pickers"
    )
      .then((res) => {
        if (!res.success) throw new Error(res.error || "Failed to load");
        setProducts(res.products || []);
        setDistributors(res.distributors || []);
        setSubDealers(res.subDealers || []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoadingPickers(false));
  }, []);

  const parties = buyerType === "distributor" ? distributors : subDealers;

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
      haptics.success();
      router.back();
    } catch (err) {
      haptics.error();
      setError(err instanceof ApiError ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPickers) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="New Order" />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="New Order" />

      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, styles.stepDotDone]} />
        <View style={styles.stepLine} />
        <View style={[styles.stepDot, step === 1 && styles.stepDotDone]} />
      </View>

      {step === 0 ? (
        <>
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

          <Text style={styles.stepLabel}>Select a {buyerType === "sub_dealer" ? "Sub Dealer" : "Distributor"}</Text>

          <FlatList
            data={parties}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={parties.length > 0 ? styles.tileRow : undefined}
            style={styles.partyList}
            ListEmptyComponent={<Text style={styles.emptyText}>None assigned to you.</Text>}
            renderItem={({ item }) => {
              const selected = selectedParty === item.id;
              return (
                <TouchableOpacity
                  style={[styles.partyTile, selected && styles.partyTileSelected]}
                  onPress={() => setSelectedParty(item.id)}
                >
                  <Text style={[styles.partyTileText, selected && styles.partyTileTextSelected]} numberOfLines={1}>
                    {item.first_name} {item.last_name}
                  </Text>
                  {selected && (
                    <View style={styles.partyTileCheck}>
                      <Check color="#FFFFFF" size={12} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          style={styles.productList}
          ListHeaderComponent={<Text style={styles.stepLabel}>Add Products</Text>}
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
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.navRow}>
        {step === 1 && <Button label="Back" variant="secondary" onPress={() => setStep(0)} style={styles.navButton} />}
        {step === 0 ? (
          <Button label="Next" onPress={() => setStep(1)} disabled={!selectedParty} style={styles.navButton} />
        ) : (
          <Button label="Submit" onPress={handleSubmit} loading={submitting} style={styles.navButton} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.card, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md, gap: theme.spacing.sm },
  loadingContainer: { flex: 1, backgroundColor: theme.colors.card, alignItems: "center", justifyContent: "center" },
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
  stepIndicator: { flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.xs },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.border,
  },
  stepDotDone: { backgroundColor: theme.colors.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: theme.colors.border, marginHorizontal: theme.spacing.xs },
  stepLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    marginBottom: theme.spacing.xs,
  },
  partyList: { flex: 1 },
  tileRow: { gap: theme.spacing.sm },
  emptyText: { textAlign: "center", color: theme.colors.textMuted, marginTop: theme.spacing.md },
  partyTile: {
    flex: 1,
    height: 56,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  partyTileSelected: { backgroundColor: theme.colors.primaryTint, borderColor: theme.colors.primary, borderWidth: 1.5 },
  partyTileText: { fontSize: 13, fontWeight: "bold", color: theme.colors.textStrong },
  partyTileTextSelected: { color: theme.colors.primaryDark },
  partyTileCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  navRow: { flexDirection: "row", gap: theme.spacing.sm },
  navButton: { flex: 1 },
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
});
