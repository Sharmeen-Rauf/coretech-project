import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../lib/theme";

interface EmptyStateProps {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  title: string;
  subtitle?: string;
}

// One shared empty/no-data state instead of a bare gray sentence per
// screen - used for empty lists, no-permission states, and "nothing here
// yet" across the app.
export default function EmptyState({ icon: Icon, title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon color={theme.colors.textMuted} size={28} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
});
