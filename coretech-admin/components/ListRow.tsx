import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../lib/theme";

interface ListRowProps {
  title: string;
  subtitle?: string;
  meta?: string;
  right?: React.ReactNode;
}

// Shared row shape for every list screen (Sell Out, ST1/ST2, Inventory,
// directories, Buzzcart) - one consistent card layout instead of
// per-screen styling drift.
export default function ListRow({ title, subtitle, meta, right }: ListRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  left: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    color: theme.colors.textStrong,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  right: {
    alignItems: "flex-end",
  },
});
