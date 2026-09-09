import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from "react-native";
import { theme } from "../lib/theme";

type Variant = "primary" | "secondary" | "destructive";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

// One shared button across every screen instead of each one hand-rolling
// its own submit/scan/decision button styling - the drift that was
// already visible between screens before this pass.
export default function Button({ label, onPress, variant = "primary", loading, disabled, style }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.base, VARIANT_STYLES[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "primary" ? "#FFFFFF" : theme.colors.primary} />
      ) : (
        <Text style={[styles.label, TEXT_STYLES[variant]]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 46,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
  },
});

const VARIANT_STYLES: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: theme.colors.primary, ...theme.shadow.button },
  secondary: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: theme.colors.primary },
  destructive: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: theme.colors.error },
};

const TEXT_STYLES: Record<Variant, { color: string }> = {
  primary: { color: "#FFFFFF" },
  secondary: { color: theme.colors.primary },
  destructive: { color: theme.colors.error },
};
