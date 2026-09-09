import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { TrendingUp, ShoppingCart, Users, ShoppingBag, Wrench, Bell } from "lucide-react-native";
import { useMyPermissions } from "../../lib/permissionsContext";
import { GRID_TILES } from "../../lib/navConfig";
import { theme } from "../../lib/theme";
import { mobileApiFetch } from "../../lib/api";

const ICONS: Record<string, React.ComponentType<{ color: string; size: number }>> = {
  TrendingUp,
  ShoppingCart,
  Users,
  ShoppingBag,
};

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

// Home / Dashboard (§17 #2) - a DCR-style icon grid (§12), recolored in the
// installer app's own palette rather than DCR's. Every mobileEligible
// permission except SN Lookup/Target lives here, permanently (§12.1) -
// those two live only in the bottom bar. The announcements card and
// notifications bell (§18) refetch on every focus (fetch-on-open, not
// real-time - keeps this app off direct Supabase access per §7).
export default function HomeScreen() {
  const { loading, keys } = useMyPermissions();
  const tiles = GRID_TILES.filter((tile) => keys.includes(tile.key));

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(() => {
    mobileApiFetch<{ success: boolean; announcement: Announcement | null }>("/api/mobile/announcements")
      .then((res) => setAnnouncement(res.success ? res.announcement : null))
      .catch(() => {});
    mobileApiFetch<{ success: boolean; unreadCount: number }>("/api/mobile/notifications")
      .then((res) => setUnreadCount(res.success ? res.unreadCount : 0))
      .catch(() => {});
  }, []);

  useFocusEffect(refresh);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Home</Text>
        <TouchableOpacity style={styles.bellButton} onPress={() => router.push("/screens/notifications")}>
          <Bell color={theme.colors.textPrimary} size={22} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {announcement && (
        <View style={styles.announcementCard}>
          <Text style={styles.announcementTitle}>{announcement.title}</Text>
          <Text style={styles.announcementBody} numberOfLines={3}>
            {announcement.content}
          </Text>
        </View>
      )}

      {!loading && tiles.length === 0 ? (
        <View style={styles.empty}>
          <Wrench color={theme.colors.textMuted} size={28} />
          <Text style={styles.emptyText}>Nothing has been granted to this account yet.</Text>
        </View>
      ) : (
        <FlatList
          data={tiles}
          keyExtractor={(item) => item.key}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => {
            const Icon = ICONS[item.icon] || Wrench;
            return (
              <TouchableOpacity style={styles.tile} onPress={() => router.push(item.route as any)}>
                <View style={styles.tileIcon}>
                  <Icon color={theme.colors.primary} size={22} />
                </View>
                <Text style={styles.tileLabel}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  heading: {
    fontSize: 22,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  announcementCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.primaryTint,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    padding: theme.spacing.md,
  },
  announcementTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: theme.colors.textStrong,
    marginBottom: 2,
  },
  announcementBody: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  grid: {
    paddingHorizontal: theme.spacing.md,
  },
  row: {
    justifyContent: "flex-start",
    gap: theme.spacing.sm,
  },
  tile: {
    flex: 1,
    maxWidth: "31%",
    aspectRatio: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textStrong,
    textAlign: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
});
