import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { Plus } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import BarcodeScanner from "../../components/BarcodeScanner";
import { useScannedSerials } from "../../lib/useScannedSerials";
import ListRow from "../../components/ListRow";

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
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [subDealers, setSubDealers] = useState<SubDealer[]>([]);
  const [selectedSubDealer, setSelectedSubDealer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scanned = useScannedSerials();

  const load = useCallback(async () => {
    setLoading(true);
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
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      setCreateOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "ST2" }} />

      {loading ? (
        <ActivityIndicator style={styles.centerLoader} size="large" color={theme.colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No ST2 records yet.</Text>}
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
        <TouchableOpacity style={styles.fab} onPress={openCreate}>
          <Plus color="#FFFFFF" size={22} />
        </TouchableOpacity>
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

            <TouchableOpacity style={styles.scanButton} onPress={() => setScannerOpen(true)}>
              <Text style={styles.scanButtonText}>Scan Serial Numbers</Text>
            </TouchableOpacity>

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

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? "Submitting..." : `Submit ${scanned.items.length || ""}`.trim()}
              </Text>
            </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: theme.colors.background },
  centerLoader: { flex: 1 },
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
  scanButton: {
    height: 44,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  scanButtonText: { color: theme.colors.primary, fontWeight: "bold", fontSize: 13 },
  scannedList: { flex: 1 },
  removeText: { color: theme.colors.error, fontSize: 12, fontWeight: "bold" },
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
});
