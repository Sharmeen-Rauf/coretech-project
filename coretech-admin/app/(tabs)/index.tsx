import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { TrendingUp, ShoppingCart, Users, ShoppingBag, Wrench, LayoutGrid } from "lucide-react-native";
import { useMyPermissions } from "../../lib/permissionsContext";
import { GRID_TILES } from "../../lib/navConfig";
import { theme } from "../../lib/theme";
import { mobileApiFetch } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { resolveAdminAccess } from "../../lib/access";
import { haptics } from "../../lib/haptics";
import EmptyState from "../../components/EmptyState";
import AnimatedPressable from "../../components/AnimatedPressable";

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

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Home / Dashboard (§17 #2) - a DCR-style icon grid (§12), recolored in the
// installer app's own palette rather than DCR's. Every mobileEligible
// permission except SN Lookup/Target lives here, permanently (§12.1) -
// those two live only in the bottom bar. The page title and notifications
// bell (§18) live on the native tab header ((tabs)/_layout.tsx,
// components/NotificationBell.tsx); this body just adds a personalized
// greeting, the announcement card, and the grid.
export default function HomeScreen() {
  const { loading, keys } = useMyPermissions();
  const tiles = GRID_TILES.filter((tile) => keys.includes(tile.key));

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [firstName, setFirstName] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadAnnouncement = useCallback(() => {
    return mobileApiFetch<{ success: boolean; announcement: Announcement | null }>("/api/mobile/announcements")
      .then((res) => setAnnouncement(res.success ? res.announcement : null))
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAnnouncement();
      supabase.auth.getSession().then(({ data }) => {
        const userId = data?.session?.user?.id;
        if (!userId) return;
        resolveAdminAccess(userId).then((access) => {
          if (access.allowed) setFirstName(access.name.split(" ")[0] || "");
        });
      });
    }, [loadAnnouncement])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnnouncement();
    setRefreshing(false);
  };

  return (
    <FlatList
      style={styles.container}
      data={tiles}
      keyExtractor={(item) => item.key}
      numColumns={3}
      columnWrapperStyle={tiles.length > 0 ? styles.row : undefined}
      contentContainerStyle={styles.grid}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
      ListHeaderComponent={
        <>
          {!!firstName && <Text style={styles.greeting}>{greetingForHour(new Date().getHours())}, {firstName} 👋</Text>}
          {announcement && (
            <View style={styles.announcementCard}>
              <Text style={styles.announcementTitle}>{announcement.title}</Text>
              <Text style={styles.announcementBody} numberOfLines={3}>
                {announcement.content}
              </Text>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        !loading ? <EmptyState icon={LayoutGrid} title="Nothing here yet" subtitle="Nothing has been granted to this account yet." /> : null
      }
      renderItem={({ item }) => {
        const Icon = ICONS[item.icon] || Wrench;
        return (
          <AnimatedPressable
            style={styles.tile}
            onPress={() => {
              haptics.light();
              router.push(item.route as any);
            }}
          >
            <View style={styles.tileIcon}>
              <Icon color={theme.colors.primary} size={22} />
            </View>
            <Text style={styles.tileLabel}>{item.label}</Text>
          </AnimatedPressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  greeting: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
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
    paddingTop: theme.spacing.sm,
    flexGrow: 1,
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
