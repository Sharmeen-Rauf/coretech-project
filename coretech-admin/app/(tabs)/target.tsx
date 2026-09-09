import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Target as TargetIcon } from "lucide-react-native";
import { theme } from "../../lib/theme";

// Placeholder for Phase 5 - the real Target (Read Only) screen (§17 #20) is
// built in Phase 6, wired to the already-verified app/api/mobile/target
// route (Phase 3). This screen's job right now is proving it's correctly
// present as a bottom-bar tab only when the target permission ("resources")
// is mobile-granted, and absent otherwise (§12.1).
export default function TargetPlaceholder() {
  return (
    <View style={styles.container}>
      <TargetIcon color={theme.colors.textMuted} size={28} />
      <Text style={styles.title}>Target (Read Only)</Text>
      <Text style={styles.note}>Real screen lands in Phase 6.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
  },
  note: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
});
