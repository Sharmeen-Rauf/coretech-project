import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleRouting(session);
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

    if (!session) {
      // Redirect to login if not authenticated and not in auth screens
      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
    } else {
      // Redirect to jobs if authenticated and in auth screen
      if (inAuthGroup || segments.length === 0) {
        router.replace("/(tabs)/jobs");
      }
    }
  };

  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#00B4D8" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="job/[id]" options={{ headerShown: true, title: "Job Details" }} />
    </Stack>
  );
}
