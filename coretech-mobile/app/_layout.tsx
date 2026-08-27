import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { supabase } from "../lib/supabase";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        handleRouting(session);
        setIsInitializing(false);
      })
      .catch((error) => {
        console.error("Error getting session:", error);
        handleRouting(null);
        setIsInitializing(false);
      });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleRouting(session);
    });

    return () => subscription.unsubscribe();
  }, [segments]);

  const handleRouting = (session: any) => {
    const inAuthGroup = segments[0] === "(auth)";

    setTimeout(() => {
      try {
        if (!session) {
          // Redirect to login if not authenticated and not in auth screens
          if (!inAuthGroup) {
            router.replace("/(auth)/login");
          }
        } else {
          // Redirect to jobs if authenticated and in auth screen
          if (inAuthGroup || !segments.length) {
            router.replace("/(tabs)/jobs");
          }
        }
      } catch (err) {
        console.error("Routing error:", err);
      }
    }, 0);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="job/[id]" options={{ headerShown: true, title: "Job Details" }} />
      </Stack>
      {isInitializing && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" }]}>
          <ActivityIndicator size="large" color="#00B4D8" />
        </View>
      )}
    </GestureHandlerRootView>
  );
}
