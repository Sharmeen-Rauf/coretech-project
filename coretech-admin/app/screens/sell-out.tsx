import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import { Plus } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import BarcodeScanner from "../../components/BarcodeScanner";
import { useScannedSerials } from "../../lib/useScannedSerials";
import ListRow from "../../components/ListRow";

interface SellOutRow {
  id: string;
  serial_no: string;
  sold_out_at: string | null;
  products?: { name: string; brand: string; model: string } | null;
  sellerType: string;
  sellerName: string;
  consumer?: { consumer_name: string } | null;
}

interface SellOutResult {
  serialNo: string;
  success: boolean;
  error?: string;
}

// Sell Out - list (§17 #4) + create (§17 #5), one screen. Create is a bulk
// scan: one consumer, many serials, submitted once (§3.1) to
// app/api/mobile/sellout's POST, which loops server-side and returns a
// per-serial Success/Fail breakdown - shown here exactly as returned, not
// collapsed into one pass/fail message.
export default function SellOutScreen() {
  const [rows, setRows] = useState<SellOutRow[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [consumerName, setConsumerName] = useState("");
  const [consumerPhone, setConsumerPhone] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<SellOutResult[] | null>(null);
  const scanned = useScannedSerials();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await mobileApiFetch<{ success: boolean; data: SellOutRow[]; canWrite: boolean; error?: string }>(
        "/api/mobile/sellout"
      );
      if (!res.success) throw new Error(res.error || "Failed to load Sell Out records");
      setRows(res.data);
      setCanWrite(res.canWrite);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load Sell Out records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetCreateForm = () => {
    setConsumerName("");
    setConsumerPhone("");
    setSiteAddress("");
    scanned.clear();
    setResults(null);
  };

  const handleSubmit = async () => {
    if (!consumerName.trim() || !consumerPhone.trim()) {
      setError("Consumer name and phone are required.");
      return;
    }
    if (scanned.items.length === 0) {
      setError("Scan at least one serial number.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await mobileApiFetch<{ success: boolean; results: SellOutResult[]; error?: string }>(
        "/api/mobile/sellout",
        {
          method: "POST",
          body: JSON.stringify({
            date: new Date().toISOString().slice(0, 10),
            consumerName: consumerName.trim(),
            consumerPhone: consumerPhone.trim(),
            siteAddress: siteAddress.trim() || undefined,
            items: scanned.items.map((i) => ({ serialNo: i.serialNo })),
          }),
        }
      );
      if (!res.success) throw new Error(res.error || "Submission failed");
      setResults(res.results);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Sell Out" }} />

      {loading ? (
        <ActivityIndicator style={styles.centerLoader} size="large" color={theme.colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No Sell Out records yet.</Text>}
          renderItem={({ item }) => (
            <ListRow
              title={item.products?.name || "Unknown Product"}
              subtitle={`SN ${item.serial_no} · ${item.consumer?.consumer_name || item.sellerName}`}
              meta={item.sold_out_at ? new Date(item.sold_out_at).toLocaleDateString() : ""}
            />
          )}
        />
      )}

      {!!error && !createOpen && <Text style={styles.errorBanner}>{error}</Text>}

      {canWrite && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            resetCreateForm();
            setCreateOpen(true);
          }}
        >
          <Plus color="#FFFFFF" size={22} />
        </TouchableOpacity>
      )}

      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Sell Out</Text>
            <TouchableOpacity onPress={() => setCreateOpen(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>

          {results ? (
            <View style={styles.resultsWrap}>
              <Text style={styles.resultsHeading}>
                {results.filter((r) => r.success).length} of {results.length} succeeded
              </Text>
              <FlatList
                data={results}
                keyExtractor={(item, idx) => `${item.serialNo}-${idx}`}
                renderItem={({ item }) => (
                  <ListRow
                    title={item.serialNo}
                    subtitle={item.success ? "Recorded" : item.error || "Failed"}
                    right={
                      <Text style={[styles.resultMark, { color: item.success ? theme.colors.success : theme.colors.error }]}>
                        {item.success ? "✓" : "✕"}
                      </Text>
                    }
                  />
                )}
              />
              <TouchableOpacity style={styles.submitButton} onPress={() => setCreateOpen(false)}>
                <Text style={styles.submitButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Consumer Name"
                placeholderTextColor={theme.colors.textMuted}
                value={consumerName}
                onChangeText={setConsumerName}
              />
              <TextInput
                style={styles.input}
                placeholder="Consumer Phone"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
                value={consumerPhone}
                onChangeText={setConsumerPhone}
              />
              <TextInput
                style={styles.input}
                placeholder="Site Address (optional)"
                placeholderTextColor={theme.colors.textMuted}
                value={siteAddress}
                onChangeText={setSiteAddress}
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
          )}
        </KeyboardAvoidingView>
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
  emptyText: { textAlign: "center", color: theme.colors.textMuted, marginTop: theme.spacing.xl },
  errorBanner: {
    color: theme.colors.error,
    fontSize: 12,
    textAlign: "center",
    padding: theme.spacing.sm,
  },
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
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textStrong,
  },
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
  resultsWrap: { flex: 1, padding: theme.spacing.md },
  resultsHeading: { fontSize: 14, fontWeight: "bold", color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  resultMark: { fontSize: 16, fontWeight: "bold" },
});
