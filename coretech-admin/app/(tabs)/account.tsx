import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { User } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { resolveAdminAccess, AdminAccess } from "../../lib/access";
import { theme } from "../../lib/theme";

// My Account (§17 #3) - universal, no permission gating, matches the
// installer app's own Profile screen pattern (name, role, sign out).
export default function AccountScreen() {
  const [access, setAccess] = useState<AdminAccess | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const userId = data?.session?.user?.id;
      if (!userId) return;
      resolveAdminAccess(userId).then(setAccess);
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <User color={theme.colors.primary} size={32} />
      </View>
      {access?.allowed ? (
        <>
          <Text style={styles.name}>{access.name || "—"}</Text>
          <Text style={styles.role}>{access.role}</Text>
        </>
      ) : null}

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl * 2,
    backgroundColor: theme.colors.background,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
  },
  role: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textTransform: "capitalize",
    marginBottom: theme.spacing.xl,
  },
  button: {
    marginTop: "auto",
    height: 44,
    width: "100%",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: theme.colors.error,
    fontWeight: "bold",
    fontSize: 14,
  },
});
