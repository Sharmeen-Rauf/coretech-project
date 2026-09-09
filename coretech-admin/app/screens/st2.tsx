import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  RefreshControl,
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { Plus, TrendingUp } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import { haptics } from "../../lib/haptics";
import BarcodeScanner from "../../components/BarcodeScanner";
import { useScannedSerials } from "../../lib/useScannedSerials";
import ListRow from "../../components/ListRow";
import EmptyState from "../../components/EmptyState";
import SkeletonList from "../../components/SkeletonList";
import Button from "../../components/Button";
import AnimatedPressable from "../../components/AnimatedPressable";

interface SaleRow {
  id: string;
  st_id: string;
  date: string;
  source_type: string;
  destination_type: string;
}

interface SubDealer {
  id: string;
  first_name: string;
  last_name: string;
}

// ST2 - list (view only for Sub-Dealer, recipient-scoped per §4.2) + create
// (Distributor only, §17 #9/#10). Unlike Sell Out, submitSt2Action already
// accepts the whole scanned batch as one atomic transfer (§15 Phase 3
// finding) - so this is one submit, one result, not a per-serial breakdown.
export default function St2Screen() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [subDealers, setSubDealers] = useState<SubDealer[]>([]);
  const [selectedSubDealer, setSelectedSubDealer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scanned = useScannedSerials();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      const res = await mobileApiFetch<{ success: boolean; data: SaleRow[]; canWrite: boolean; error?: string }>(
        "/api/mobile/st2"
      );
      if (!res.success) throw new Error(res.error || "Failed to load ST2 records");
      setRows(res.data);
      setCanWrite(res.canWrite);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load ST2 records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openCreate = async () => {
    setSelectedSubDealer(null);
    scanned.clear();
    setCreateOpen(true);
    try {
      const res = await mobileApiFetch<{ success: boolean; data: SubDealer[] }>("/api/mobile/sub-dealers");
      if (res.success) setSubDealers(res.data);
    } catch {
      // Non-critical - the picker just stays empty and the user sees no options.
    }
  };

  const handleSubmit = async () => {
    if (!selectedSubDealer) {
      setError("Select a sub dealer.");
      return;
    }
    if (scanned.items.length === 0) {
      setError("Scan at least one serial number.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await mobileApiFetch<{ success: boolean; message?: string; error?: string }>("/api/mobile/st2", {
        method: "POST",
        body: JSON.stringify({
          subDealerId: selectedSubDealer,
          date: new Date().toISOString().slice(0, 10),
          items: scanned.items.map((i) => ({ serialNo: i.serialNo })),
        }),
      });
      if (!res.success) throw new Error(res.error || "Submission failed");
      haptics.success();
      setCreateOpen(false);
      load();
    } catch (err) {
      haptics.error();
      setError(err instanceof ApiError ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "ST2" }} />

      {loading ? (
        <SkeletonList count={6} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<EmptyState icon={TrendingUp} title="No ST2 records yet" />}
          renderItem={({ item }) => (
            <ListRow
              title={item.st_id}
              subtitle={`${item.source_type} → ${item.destination_type}`}
              meta={new Date(item.date).toLocaleDateString()}
            />
          )}
        />
      )}

      {canWrite && (
        <AnimatedPressable
          style={styles.fab}
          onPress={() => {
            haptics.light();
            openCreate();
          }}
        >
          <Plus color="#FFFFFF" size={22} />
        </AnimatedPressable>
      )}

      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New ST2 Transfer</Text>
            <TouchableOpacity onPress={() => setCreateOpen(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Sub Dealer</Text>
            <FlatList
              data={subDealers}
              keyExtractor={(item) => item.id}
              horizontal
              style={styles.pickerRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerChip, selectedSubDealer === item.id && styles.pickerChipSelected]}
                  onPress={() => setSelectedSubDealer(item.id)}
                >
                  <Text
                    style={[styles.pickerChipText, selectedSubDealer === item.id && styles.pickerChipTextSelected]}
                  >
                    {item.first_name} {item.last_name}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No sub dealers assigned to you.</Text>}
            />

            <Button label="Scan Serial Numbers" variant="secondary" onPress={() => setScannerOpen(true)} />

            {scanned.duplicateError && <Text style={styles.errorText}>{scanned.duplicateError}</Text>}

            <FlatList
              data={scanned.items}
              keyExtractor={(item) => item.serialNo}
              style={styles.scannedList}
              renderItem={({ item }) => (
                <ListRow
                  title={item.serialNo}
                  right={
                    <TouchableOpacity onPress={() => scanned.remove(item.serialNo)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  }
                />
              )}
            />

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <Button
              label={`Submit ${scanned.items.length || ""}`.trim()}
              onPress={handleSubmit}
              loading={submitting}
            />
          </View>
        </View>
      </Modal>

      <BarcodeScanner
        visible={scannerOpen}
        title="Scan Serial Numbers"
        onScan={(value) => scanned.add(value)}
        onClose={() => setScannerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: theme.spacing.md },
  list: { padding: theme.spacing.md },
  emptyText: { textAlign: "center", color: theme.colors.textMuted, marginTop: theme.spacing.md },
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
  label: { fontSize: 12, fontWeight: "bold", color: theme.colors.textMuted, textTransform: "uppercase" },
  pickerRow: { flexGrow: 0, marginBottom: theme.spacing.sm },
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
  scannedList: { flex: 1 },
  removeText: { color: theme.colors.error, fontSize: 12, fontWeight: "bold" },
  errorText: { color: theme.colors.error, fontSize: 12 },
});
