import React from "react";
import { View, StyleSheet } from "react-native";
import SkeletonBlock from "./SkeletonBlock";
import { theme } from "../lib/theme";

// Loading placeholder shaped like ListRow, so the layout doesn't jump once
// real data replaces it - used in place of a bare spinner on every list
// screen. "Every skeleton is a promise about what's coming" - matching the
// shape of the real content is what makes it read as polish, not just a
// different loading indicator.
export default function SkeletonList({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.left}>
            <SkeletonBlock style={styles.title} />
            <SkeletonBlock style={styles.subtitle} />
          </View>
          <SkeletonBlock style={styles.badge} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: theme.spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  left: { flex: 1, marginRight: theme.spacing.sm },
  title: { height: 14, width: "70%", marginBottom: theme.spacing.xs },
  subtitle: { height: 11, width: "45%" },
  badge: { height: 20, width: 56, borderRadius: theme.radius.full },
});
