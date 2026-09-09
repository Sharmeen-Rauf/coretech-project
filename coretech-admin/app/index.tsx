import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { supabase } from "../lib/supabase";
import { resolveAdminAccess } from "../lib/access";
import { theme } from "../lib/theme";

type Destination = "/(tabs)" | "/login";

export default function IndexScreen() {
  const [destination, setDestination] = useState<Destination | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session || null;
        if (!session) {
          if (isMounted) setDestination("/login");
          return;
        }

        // A session persists across app restarts (SecureStore), so role has
        // to be re-checked every time the app opens, not just at the moment
        // of the original login - otherwise a role change (e.g. moved off
        // an admin-app role after already being logged in) would never take
        // effect until the session itself expired. Mirrors coretech-mobile's
        // index.tsx.
        const access = await resolveAdminAccess(session.user.id);
        if (!access.allowed) {
          await supabase.auth.signOut();
          if (isMounted) setDestination("/login");
          return;
        }

        if (isMounted) setDestination("/(tabs)");
      } catch (err) {
        console.warn("Auth check error:", err);
        if (isMounted) setDestination("/login");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!destination) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return <Redirect href={destination} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.card,
  },
});
