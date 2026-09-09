import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { resolveAdminAccess, AdminAccess } from "../../lib/access";
import { theme } from "../../lib/theme";
import BarcodeScanner from "../../components/BarcodeScanner";
import { useScannedSerials } from "../../lib/useScannedSerials";

// Placeholder landing screen for the scaffold phase only - proves the
// session-gated auth flow works end to end. Real screens per role/module
// (§17) replace this in Phase 6, once the nav shell (Phase 5) exists.
//
// The scanner test section below is a Phase 4 verification aid, not a real
// feature - it exists so the new camera/barcode native module actually gets
// bundled and is testable on a real device before Phase 6 wires the two
// components (BarcodeScanner, useScannedSerials) into real screens. Remove
// once Phase 6 lands.
export default function HomePlaceholder() {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [singleScanValue, setSingleScanValue] = useState("");
  const [singleScannerOpen, setSingleScannerOpen] = useState(false);
  const [bulkScannerOpen, setBulkScannerOpen] = useState(false);
  const bulk = useScannedSerials();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const userId = data?.session?.user?.id;
      if (!userId) return;
      resolveAdminAccess(userId).then(setAccess);
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signed in</Text>
      {access?.allowed ? (
        <Text style={styles.detail}>
          {access.name || "—"} · {access.role}
        </Text>
      ) : null}
      <Text style={styles.note}>Screens for this role's modules land here in Phase 6.</Text>

      <View style={styles.scannerTest}>
        <Text style={styles.scannerTestLabel}>Phase 4 scanner test</Text>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => setSingleScannerOpen(true)}>
          <Text style={styles.secondaryButtonText}>Test Single Scan (SN Lookup style)</Text>
        </TouchableOpacity>
        {singleScanValue ? <Text style={styles.scanResult}>Last scanned: {singleScanValue}</Text> : null}

        <TouchableOpacity style={styles.secondaryButton} onPress={() => setBulkScannerOpen(true)}>
          <Text style={styles.secondaryButtonText}>Test Bulk Scan (Sell Out/ST2 style)</Text>
        </TouchableOpacity>
        {bulk.duplicateError ? <Text style={styles.errorText}>{bulk.duplicateError}</Text> : null}
        {bulk.items.length > 0 && (
          <FlatList
            data={bulk.items}
            keyExtractor={(item) => item.serialNo}
            style={styles.bulkList}
            renderItem={({ item }) => (
              <View style={styles.bulkRow}>
                <Text style={styles.bulkRowText}>{item.serialNo}</Text>
                <TouchableOpacity onPress={() => bulk.remove(item.serialNo)}>
                  <Text style={styles.bulkRemove}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>

      <BarcodeScanner
        visible={singleScannerOpen}
        title="Scan Serial Number"
        onScan={(value) => {
          setSingleScanValue(value);
          setSingleScannerOpen(false);
        }}
        onClose={() => setSingleScannerOpen(false)}
      />

      <BarcodeScanner
        visible={bulkScannerOpen}
        title="Scan Serials (Add / Scan Again)"
        onScan={(value) => bulk.add(value)}
        onClose={() => setBulkScannerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl * 2,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  detail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  note: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: theme.spacing.lg,
  },
  scannerTest: {
    width: "100%",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  scannerTestLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    marginBottom: theme.spacing.xs,
  },
  secondaryButton: {
    height: 40,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontWeight: "bold",
    fontSize: 13,
  },
  scanResult: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.error,
  },
  bulkList: {
    maxHeight: 160,
  },
  bulkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  bulkRowText: {
    fontSize: 13,
    color: theme.colors.textStrong,
  },
  bulkRemove: {
    fontSize: 12,
    color: theme.colors.error,
    fontWeight: "bold",
  },
  button: {
    height: 44,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});
