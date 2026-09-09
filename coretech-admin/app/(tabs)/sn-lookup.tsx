import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Camera } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import BarcodeScanner from "../../components/BarcodeScanner";
import ListRow from "../../components/ListRow";

interface LookupResult {
  success: boolean;
  found: boolean;
  stock: {
    serialNo: string;
    productName: string;
    brand: string;
    model: string;
    warehouseName: string | null;
    status: string;
    soldOutAt: string | null;
  } | null;
  chain: { id: string; type: string; date: string; stId: string; from: string; to: string }[];
  installerJobs: { id: string; status: string; installerName: string; createdAt: string }[];
  error?: string;
}

// SN Lookup (§17 #19) - single-serial only, no bulk (§3.1 explicitly
// excludes it). Simplest screen in the app: one input, one result view.
export default function SnLookupScreen() {
  const [serial, setSerial] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState("");

  const runLookup = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSerial(trimmed);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await mobileApiFetch<LookupResult>(`/api/mobile/sn-lookup?serial=${encodeURIComponent(trimmed)}`);
      if (!res.success) throw new Error(res.error || "Lookup failed");
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Serial number"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="characters"
          value={serial}
          onChangeText={setSerial}
          onSubmitEditing={() => runLookup(serial)}
        />
        <TouchableOpacity style={styles.scanButton} onPress={() => setScannerOpen(true)}>
          <Camera color="#FFFFFF" size={20} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.searchButton} onPress={() => runLookup(serial)}>
        <Text style={styles.searchButtonText}>Look Up</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator style={styles.loader} size="large" color={theme.colors.primary} />}
      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {result && !result.found && <Text style={styles.emptyText}>No record found for that serial number.</Text>}

      {result?.found && result.stock && (
        <ScrollView style={styles.results}>
          <View style={styles.stockCard}>
            <Text style={styles.stockTitle}>{result.stock.productName}</Text>
            <Text style={styles.stockDetail}>{result.stock.brand} · {result.stock.model}</Text>
            <Text style={styles.stockDetail}>Status: {result.stock.status.replace("_", " ")}</Text>
            {result.stock.warehouseName && <Text style={styles.stockDetail}>Warehouse: {result.stock.warehouseName}</Text>}
          </View>

          <Text style={styles.sectionLabel}>Chain of Custody</Text>
          {result.chain.map((step) => (
            <ListRow
              key={step.id}
              title={`${step.type} · ${step.stId}`}
              subtitle={`${step.from} → ${step.to}`}
              meta={new Date(step.date).toLocaleDateString()}
            />
          ))}

          {result.installerJobs.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Installation Jobs</Text>
              {result.installerJobs.map((job) => (
                <ListRow
                  key={job.id}
                  title={job.installerName}
                  subtitle={job.status}
                  meta={new Date(job.createdAt).toLocaleDateString()}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <BarcodeScanner
        visible={scannerOpen}
        title="Scan Serial Number"
        onScan={(value) => {
          setScannerOpen(false);
          runLookup(value);
        }}
        onClose={() => setScannerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.md },
  searchRow: { flexDirection: "row", gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  input: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textStrong,
    backgroundColor: theme.colors.card,
  },
  scanButton: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButton: {
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  searchButtonText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 14 },
  loader: { marginTop: theme.spacing.lg },
  errorText: { color: theme.colors.error, fontSize: 13, textAlign: "center" },
  emptyText: { textAlign: "center", color: theme.colors.textMuted, marginTop: theme.spacing.lg },
  results: { flex: 1 },
  stockCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  stockTitle: { fontSize: 16, fontWeight: "bold", color: theme.colors.textPrimary },
  stockDetail: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
});
