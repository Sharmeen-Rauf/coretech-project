import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { theme } from "../lib/theme";

// Two attempts at fixing every app/screens/* page's header via
// react-native-screens' own native-stack props (statusBarTranslucent, then
// headerTopInsetEnabled) both measured zero effect on a real device - the
// gap between the status bar and the title stayed ~90px shorter than the
// Tabs navigator's own JS-rendered header the whole time. That's because
// they're two structurally different header widgets (a native Android
// Toolbar vs a JS-rendered React Navigation Header), not one widget with a
// misconfigured flag - no prop was ever going to make one match the other.
// This component sidesteps that entirely: every app/screens/* page now
// sets headerShown: false and renders this instead, using the exact same
// useSafeAreaInsets() hook the Tabs header already gets its correct
// spacing from - same mechanism, guaranteed same result, not a different
// native widget hoped to behave the same way.
export default function ScreenHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <ChevronLeft color={theme.colors.primary} size={26} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    // Breathing room for whatever comes below - lives here (not on each
    // screen's own container) so it applies after this header, not before
    // it. A screen's own paddingTop would sit above ScreenHeader too,
    // pushing its white background down and leaving a strip of the grey
    // page background exposed in the status bar area above it.
    marginBottom: theme.spacing.md,
  },
  row: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.xs,
  },
});
