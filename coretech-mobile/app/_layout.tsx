import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import React from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ErrorBoundary from "../components/ErrorBoundary";

// Without this, useSafeAreaInsets() anywhere in the app has no guaranteed
// context to read real device insets from - confirmed live: the tab bar's
// own insets.bottom fix (app/(tabs)/_layout.tsx) silently computed against
// zero insets without this provider, reproducing the exact same gesture-nav
// overlap the fix was meant to resolve, despite compiling and type-checking
// cleanly. Wrapping the true root guarantees every descendant screen gets
// real values, not just whichever ones happen to sit inside some other
// library's own internal provider.
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="job/[id]" options={{ headerShown: true, title: "Job Details" }} />
            <Stack.Screen name="notifications" options={{ headerShown: true, title: "Notifications" }} />
          </Stack>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
