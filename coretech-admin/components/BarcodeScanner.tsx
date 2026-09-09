import React, { useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { theme } from "../lib/theme";

interface BarcodeScannerProps {
  visible: boolean;
  onScan: (value: string) => void;
  onClose: () => void;
  title?: string;
}

// Same code sitting in frame fires onBarcodeScanned repeatedly - ignore
// repeats of the identical value within this window rather than closing the
// camera after one hit, since bulk screens (§3.1) need it to stay open for
// "Add / Scan Again" without a duplicate firing for the same held-up unit.
const SCAN_LOCK_MS = 1500;

const BARCODE_TYPES = ["qr", "code128", "code39", "ean13", "ean8", "upc_a", "upc_e", "datamatrix"] as const;

// Shared scan primitive (§3) - reused everywhere a serial number is entered.
// Always fires onScan on every distinct scan; the caller decides what to do
// with it (SN Lookup closes immediately on first scan, Sell Out/ST2/Buzzcart
// append to a running list and keep the camera open - see useScannedSerials).
// Manual entry is always available alongside the camera, never a fallback
// hidden behind a permission failure only.
export default function BarcodeScanner({ visible, onScan, onClose, title = "Scan Barcode" }: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manualValue, setManualValue] = useState("");
  const lastScanRef = useRef<{ data: string; at: number } | null>(null);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    const now = Date.now();
    const last = lastScanRef.current;
    if (last && last.data === result.data && now - last.at < SCAN_LOCK_MS) return;
    lastScanRef.current = { data: result.data, at: now };
    onScan(result.data);
  };

  const handleManualSubmit = () => {
    const trimmed = manualValue.trim();
    if (!trimmed) return;
    setManualValue("");
    onScan(trimmed);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {!permission ? (
          <View style={styles.center}>
            <Text style={styles.hint}>Checking camera permission…</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.hint}>
              Camera access is needed to scan barcodes. You can still type the serial number manually below.
            </Text>
            {permission.canAskAgain && (
              <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
                <Text style={styles.permissionButtonText}>Allow Camera Access</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        )}

        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="Or type serial number manually"
            placeholderTextColor={theme.colors.textMuted}
            value={manualValue}
            onChangeText={setManualValue}
            autoCapitalize="characters"
            onSubmitEditing={handleManualSubmit}
          />
          <TouchableOpacity onPress={handleManualSubmit} style={styles.manualButton}>
            <Text style={styles.manualButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.textStrong,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  closeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  closeButtonText: {
    color: theme.colors.primary,
    fontWeight: "bold",
    fontSize: 14,
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  hint: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  permissionButton: {
    height: 44,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  manualRow: {
    flexDirection: "row",
    padding: theme.spacing.md,
    backgroundColor: theme.colors.textStrong,
    gap: theme.spacing.sm,
  },
  manualInput: {
    flex: 1,
    height: 44,
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textStrong,
  },
  manualButton: {
    height: 44,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  manualButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});
