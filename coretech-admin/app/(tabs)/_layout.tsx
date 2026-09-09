import React from "react";
import { Stack } from "expo-router";

// Placeholder single screen for the scaffold phase only - the real DCR-style
// icon-grid + fixed 4-slot bottom bar (Home/SN Lookup/Target/Account, §12.1)
// is built in Phase 5, not here.
export default function TabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
