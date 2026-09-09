import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { theme } from "../lib/theme";

// Generic landing spot for every Home icon-grid tile (§12) until Phase 6
// builds each feature's real screen. Reused as-is rather than one dummy
// file per tile.
export default function PlaceholderScreen() {
  const { title } = useLocalSearchParams<{ title?: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title || "Coming Soon"}</Text>
      <Text style={styles.note}>This screen is built in Phase 6.</Text>
      <TouchableOpacity style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
  },
  note: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  button: {
    height: 40,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 13,
  },
});
