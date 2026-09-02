import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { supabase } from "../lib/supabase";
import { resolveInstallerAccess } from "../lib/installerAccess";

type Destination = "/(tabs)/jobs" | "/(auth)/pending" | "/login";

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

        // A session persists across app restarts (SecureStore), so role and
        // approval status need re-checking every time the app opens, not
        // just at the moment of the original login - otherwise a role or
        // status change (e.g. rejected after already being logged in once)
        // would never actually take effect until the session itself expired.
        const access = await resolveInstallerAccess(session.user.id);
        if (!access.allowed) {
          await supabase.auth.signOut();
          if (isMounted) setDestination("/login");
          return;
        }

        if (isMounted) {
          setDestination(access.state === "pending" ? "/(auth)/pending" : "/(tabs)/jobs");
        }
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
        <ActivityIndicator size="large" color="#00B4D8" />
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
    backgroundColor: "#FFFFFF",
  },
});
