import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { AdminSession, clearSession, getSession } from "../../lib/session";
import { theme } from "../../lib/theme";

// Placeholder landing screen for the scaffold phase only - proves the
// session-gated auth flow works end to end. Real screens per role/module
// (§17) replace this in Phase 6, once the nav shell (Phase 5) exists.
export default function HomePlaceholder() {
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  const handleSignOut = async () => {
    await clearSession();
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signed in</Text>
      {session ? (
        <Text style={styles.detail}>
          {session.name || session.userId} · {session.role}
        </Text>
      ) : null}
      <Text style={styles.note}>
        Screens for this role's modules land here in Phase 6.
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  detail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  note: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: theme.spacing.lg,
  },
  button: {
    height: 44,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});
