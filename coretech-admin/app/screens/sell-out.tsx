import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import { useRefreshOnFocus } from "../../lib/useRefreshOnFocus";
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [consumerName, setConsumerName] = useState("");
  const [consumerPhone, setConsumerPhone] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<SellOutResult[] | null>(null);
  const scanned = useScannedSerials();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
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
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(load);

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
      haptics.success();
      setResults(res.results);
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
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Sell Out" />

      {loading ? (
        <SkeletonList count={6} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<EmptyState icon={TrendingUp} title="No Sell Out records yet" />}
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
        <AnimatedPressable
          style={styles.fab}
          onPress={() => {
            haptics.light();
            resetCreateForm();
            setCreateOpen(true);
          }}
        >
          <Plus color="#FFFFFF" size={22} />
        </AnimatedPressable>
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
              <Button label="Done" onPress={() => setCreateOpen(false)} />
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
  list: { padding: theme.spacing.md },
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
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textStrong,
  },
  scannedList: { flex: 1 },
  removeText: { color: theme.colors.error, fontSize: 12, fontWeight: "bold" },
  errorText: { color: theme.colors.error, fontSize: 12 },
  resultsWrap: { flex: 1, padding: theme.spacing.md },
  resultsHeading: { fontSize: 14, fontWeight: "bold", color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  resultMark: { fontSize: 16, fontWeight: "bold" },
});
