import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { TrendingUp, ShoppingCart, Users, ShoppingBag, Wrench, LayoutGrid } from "lucide-react-native";
import { useMyPermissions } from "../../lib/permissionsContext";
import { GRID_TILES } from "../../lib/navConfig";
import { theme } from "../../lib/theme";
import { mobileApiFetch } from "../../lib/api";
import EmptyState from "../../components/EmptyState";

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
// those two live only in the bottom bar. The title and notifications bell
// (§18) now live on the native tab header ((tabs)/_layout.tsx,
// components/NotificationBell.tsx) instead of being hand-rolled here - this
// screen's body is just the announcement card and the grid.
export default function HomeScreen() {
  const { loading, keys } = useMyPermissions();
  const tiles = GRID_TILES.filter((tile) => keys.includes(tile.key));

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useFocusEffect(
    useCallback(() => {
      mobileApiFetch<{ success: boolean; announcement: Announcement | null }>("/api/mobile/announcements")
        .then((res) => setAnnouncement(res.success ? res.announcement : null))
        .catch(() => {});
    }, [])
  );

  return (
    <View style={styles.container}>
      {announcement && (
        <View style={styles.announcementCard}>
          <Text style={styles.announcementTitle}>{announcement.title}</Text>
          <Text style={styles.announcementBody} numberOfLines={3}>
            {announcement.content}
          </Text>
        </View>
      )}

      {!loading && tiles.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="Nothing here yet" subtitle="Nothing has been granted to this account yet." />
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
    paddingTop: theme.spacing.md,
  },
  announcementCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.primaryTint,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    padding: theme.spacing.md,
    ...theme.shadow.card,
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
    ...theme.shadow.card,
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
});
