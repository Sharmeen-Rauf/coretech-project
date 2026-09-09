import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Search } from "lucide-react-native";
import { theme } from "../../lib/theme";

// Placeholder for Phase 5 - the real single-serial lookup screen (§17 #19)
// is built in Phase 6, wired to the already-verified app/api/mobile/sn-lookup
// route (Phase 3). This screen's job right now is proving it's correctly
// present as a bottom-bar tab only when sn_lookup is mobile-granted, and
// absent otherwise (§12.1).
export default function SnLookupPlaceholder() {
  return (
    <View style={styles.container}>
      <Search color={theme.colors.textMuted} size={28} />
      <Text style={styles.title}>SN Lookup</Text>
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
