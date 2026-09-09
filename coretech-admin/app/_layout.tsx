import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ErrorBoundary from "../components/ErrorBoundary";
import { screenHeaderOptions } from "../lib/navHeader";

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
