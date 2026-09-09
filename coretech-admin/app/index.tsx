import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { getSession } from "../lib/session";
import { theme } from "../lib/theme";

type Destination = "/(tabs)" | "/login";

export default function IndexScreen() {
  const [destination, setDestination] = useState<Destination | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      // TODO(Phase 3): once app/api/mobile/* exists, re-verify this token and
      // the caller's mobile-permission grants against the server on every
      // open (like the installer app's resolveInstallerAccess), not just
      // trust the locally stored role forever.
      const session = await getSession();
      if (isMounted) setDestination(session ? "/(tabs)" : "/login");
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
