import React from "react";
import { Stack } from "expo-router";

// No self-registration here - accounts are admin-issued only (§16), unlike
// the installer app's own (auth) group which also has register/pending.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
