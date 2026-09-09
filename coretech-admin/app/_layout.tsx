import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import ErrorBoundary from "../components/ErrorBoundary";
import { screenHeaderOptions } from "../lib/navHeader";

// Holds the native splash screen up past its default auto-hide (which fires
// on the very first paint - the blank auth-check spinner in index.tsx, or
// worse, a login screen caught mid fade-in). app/index.tsx explicitly calls
// SplashScreen.hideAsync() once it has actually decided where to send the
// user, so the handoff is always splash -> real destination screen, never
// splash -> a transitional blank/low-opacity frame.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        {/* Branded header (screenHeaderOptions) is the DEFAULT for this
            Stack, not registered against a "screens" route name - that
            named registration never actually matched anything (app/screens/
            is a plain folder, not a routable group of its own), so every
            file under it silently inherited headerShown:false instead of
            the intended header. Flipping the default and explicitly hiding
            it only for the three groups that manage their own chrome fixes
            every screens/* page in one place. */}
        <Stack screenOptions={screenHeaderOptions}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
