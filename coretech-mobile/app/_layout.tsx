import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { ActivityIndicator, View, StyleSheet, LogBox } from "react-native";
import { supabase } from "../lib/supabase";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Suppress known harmless warnings in production
LogBox.ignoreLogs(["Require cycle"]);

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [isInitializing, setIsInitializing] = useState(true);
  const sessionRef = useRef<any>(null);
  const hasNavigated = useRef(false);

  // Safe navigation - only navigate when the navigation tree is fully ready
  const navigateWhenReady = useCallback(
    (session: any) => {
      // Don't navigate until the root navigation state is loaded
      if (!navigationState?.key) return;

      const inAuthGroup = segments[0] === "(auth)";

      try {
        if (!session) {
          if (!inAuthGroup) {
            router.replace("/(auth)/login");
          }
        } else {
          if (inAuthGroup || segments.length < 1) {
            router.replace("/(tabs)/jobs");
          }
        }
      } catch (err) {
        console.warn("Navigation error (non-fatal):", err);
      }
    },
    [navigationState?.key, segments, router]
  );

  // Load session once on mount
  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (isMounted) {
          sessionRef.current = session;
          setIsInitializing(false);
        }
      } catch (error) {
        console.warn("Session load error (non-fatal):", error);
        if (isMounted) {
          sessionRef.current = null;
          setIsInitializing(false);
        }
      }
    };

    loadSession();

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionRef.current = session;
      if (!isInitializing) {
        navigateWhenReady(session);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate after initialization AND navigation tree is ready
  useEffect(() => {
    if (!isInitializing && navigationState?.key && !hasNavigated.current) {
      hasNavigated.current = true;
      navigateWhenReady(sessionRef.current);
    }
  }, [isInitializing, navigationState?.key, navigateWhenReady]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="job/[id]" options={{ headerShown: true, title: "Job Details" }} />
      </Stack>
      {isInitializing && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" },
          ]}
        >
          <ActivityIndicator size="large" color="#00B4D8" />
        </View>
      )}
    </GestureHandlerRootView>
  );
}
