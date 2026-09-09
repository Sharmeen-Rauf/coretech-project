import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../lib/theme";

export type BadgeTone = "success" | "warning" | "error" | "info" | "neutral";

const TONE_COLORS: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: theme.colors.successTint, fg: theme.colors.success },
  warning: { bg: theme.colors.warningTint, fg: theme.colors.warning },
  error: { bg: theme.colors.errorTint, fg: theme.colors.error },
  info: { bg: theme.colors.infoTint, fg: theme.colors.info },
  neutral: { bg: theme.colors.background, fg: theme.colors.textSecondary },
};

export default function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const colors = TONE_COLORS[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  text: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
});
