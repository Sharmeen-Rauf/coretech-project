import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { router } from "expo-router";
import { User, Phone, MapPin, Shield } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { resolveAdminAccess, AdminAccess } from "../../lib/access";
import { theme } from "../../lib/theme";
import Button from "../../components/Button";

const ROLE_LABELS: Record<string, string> = {
  distributor: "Distributor",
  sub_dealer: "Sub Dealer",
  admin: "Admin",
  country_head: "Country Head",
  marketing_manager: "Marketing Manager",
  retail_manager: "Retail Manager",
  rsm: "RSM",
};

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <User color="#FFFFFF" size={30} />
        </View>
        {access?.allowed ? (
          <>
            <Text style={styles.name}>{access.name || "—"}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{ROLE_LABELS[access.role] || access.role}</Text>
            </View>
          </>
        ) : null}
      </View>

      {access?.allowed && (
        <View style={styles.detailsCard}>
          <Text style={styles.sectionLabel}>Account Details</Text>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Shield color={theme.colors.primary} size={16} />
            </View>
            <View>
              <Text style={styles.detailLabel}>Role</Text>
              <Text style={styles.detailValue}>{ROLE_LABELS[access.role] || access.role}</Text>
            </View>
          </View>

          {access.contact && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Phone color={theme.colors.primary} size={16} />
              </View>
              <View>
                <Text style={styles.detailLabel}>Contact</Text>
                <Text style={styles.detailValue}>{access.contact}</Text>
              </View>
            </View>
          )}

          {access.region && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <MapPin color={theme.colors.primary} size={16} />
              </View>
              <View>
                <Text style={styles.detailLabel}>Region</Text>
                <Text style={styles.detailValue}>{access.region}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <Button label="Sign Out" variant="destructive" onPress={handleSignOut} style={styles.signOutButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  profileCard: {
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
    ...theme.shadow.fab,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  roleBadge: {
    backgroundColor: theme.colors.primaryTint,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    textTransform: "uppercase",
  },
  detailsCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.card,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    marginBottom: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.background,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 13,
    color: theme.colors.textStrong,
    fontWeight: "600",
    marginTop: 1,
  },
  signOutButton: {
    marginTop: theme.spacing.sm,
  },
});
