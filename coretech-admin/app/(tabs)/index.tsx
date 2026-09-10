import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { router } from "expo-router";
import { TrendingUp, ShoppingCart, Users, ShoppingBag, Wrench, LayoutGrid, ArrowUp, ArrowDown } from "lucide-react-native";
import { useMyPermissions } from "../../lib/permissionsContext";
import { GRID_TILES, TARGET_KEY, type GridTile } from "../../lib/navConfig";
import { theme } from "../../lib/theme";
import { mobileApiFetch } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { resolveAdminAccess } from "../../lib/access";
import { haptics } from "../../lib/haptics";
import { useRefreshOnFocus } from "../../lib/useRefreshOnFocus";
import EmptyState from "../../components/EmptyState";
import AnimatedPressable from "../../components/AnimatedPressable";
import ProgressRing from "../../components/ProgressRing";

const ICONS: Record<string, React.ComponentType<{ color: string; size: number; style?: object }>> = {
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

interface HomeStats {
  sellOut: { thisMonth: number; lastMonth: number; thisWeek: number } | null;
  st1: { thisWeek: number } | null;
  st2: { thisWeek: number } | null;
}

interface TargetRow {
  id: string;
  target_units: number;
  achieved_units: number;
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
  // A FlatList numColumns row with fewer than 3 real items left-aligns them
  // (row style is justifyContent: "flex-start") but each tile's own flex: 1
  // still competes for the row's leftover space unevenly, reading as
  // misaligned/stretched icons on the last row. Padding out to a full
  // multiple of 3 with invisible filler cells keeps every row structurally
  // identical - always exactly 3 equal-width flex items - so the last row's
  // real tiles never grow past the size of tiles in the rows above it.
  const paddedTiles: (GridTile | { key: string; filler: true })[] = [...tiles];
  while (paddedTiles.length % 3 !== 0) {
    paddedTiles.push({ key: `filler-${paddedTiles.length}`, filler: true });
  }

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [firstName, setFirstName] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [targetPct, setTargetPct] = useState<number | null>(null);

  const loadAnnouncement = useCallback(() => {
    return mobileApiFetch<{ success: boolean; announcement: Announcement | null }>("/api/mobile/announcements")
      .then((res) => setAnnouncement(res.success ? res.announcement : null))
      .catch(() => {});
  }, []);

  const loadStats = useCallback(() => {
    return mobileApiFetch<{ success: boolean } & HomeStats>("/api/mobile/home/stats")
      .then((res) => setStats(res.success ? { sellOut: res.sellOut, st1: res.st1, st2: res.st2 } : null))
      .catch(() => {});
  }, []);

  const loadTarget = useCallback(() => {
    if (!keys.includes(TARGET_KEY)) {
      setTargetPct(null);
      return Promise.resolve();
    }
    return mobileApiFetch<{ success: boolean; targets: TargetRow[] }>("/api/mobile/target")
      .then((res) => {
        if (!res.success || res.targets.length === 0) {
          setTargetPct(null);
          return;
        }
        const totalTarget = res.targets.reduce((sum, t) => sum + (t.target_units || 0), 0);
        const totalAchieved = res.targets.reduce((sum, t) => sum + (t.achieved_units || 0), 0);
        setTargetPct(totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0);
      })
      .catch(() => setTargetPct(null));
  }, [keys]);

  const loadAll = useCallback(() => {
    loadAnnouncement();
    loadStats();
    loadTarget();
    supabase.auth.getSession().then(({ data }) => {
      const userId = data?.session?.user?.id;
      if (!userId) return;
      resolveAdminAccess(userId).then((access) => {
        if (access.allowed) setFirstName(access.name.split(" ")[0] || "");
      });
    });
  }, [loadAnnouncement, loadStats, loadTarget]);

  useRefreshOnFocus(loadAll);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAnnouncement(), loadStats(), loadTarget()]);
    setRefreshing(false);
  };

  const sellOutTrend = stats?.sellOut
    ? stats.sellOut.thisMonth - stats.sellOut.lastMonth
    : null;
  const hasWeeklyActivity = !!(stats?.sellOut || stats?.st1 || stats?.st2);

  return (
    <FlatList
      style={styles.container}
      data={paddedTiles}
      keyExtractor={(item) => item.key}
      numColumns={3}
      columnWrapperStyle={paddedTiles.length > 0 ? styles.row : undefined}
      contentContainerStyle={styles.grid}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
      ListHeaderComponent={
        <>
          {!!firstName && <Text style={styles.greeting}>{greetingForHour(new Date().getHours())}, {firstName} 👋</Text>}

          {targetPct !== null && (
            <AnimatedPressable
              style={styles.statCard}
              onPress={() => {
                haptics.light();
                router.push("/target" as any);
              }}
            >
              <ProgressRing percent={targetPct} size={48} strokeWidth={5} />
              <View style={styles.statCardText}>
                <Text style={styles.statCardLabel}>This Month's Target</Text>
                <Text style={styles.statCardValue}>{Math.round(targetPct)}% achieved</Text>
              </View>
            </AnimatedPressable>
          )}

          {stats?.sellOut && (
            <View style={styles.statCard}>
              <View style={styles.statCardIcon}>
                <TrendingUp color={theme.colors.primary} size={20} />
              </View>
              <View style={styles.statCardText}>
                <Text style={styles.statCardLabel}>Sell Out This Month</Text>
                <Text style={styles.statCardValue}>{stats.sellOut.thisMonth} units</Text>
              </View>
              {sellOutTrend !== null && sellOutTrend !== 0 && (
                <View style={styles.trendBadge}>
                  {sellOutTrend > 0 ? (
                    <ArrowUp color={theme.colors.success} size={14} />
                  ) : (
                    <ArrowDown color={theme.colors.error} size={14} />
                  )}
                  <Text style={[styles.trendText, { color: sellOutTrend > 0 ? theme.colors.success : theme.colors.error }]}>
                    {Math.abs(sellOutTrend)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {hasWeeklyActivity && (
            <View style={styles.weeklyCard}>
              <Text style={styles.weeklyTitle}>This Week</Text>
              <View style={styles.weeklyRow}>
                {stats?.sellOut && (
                  <View style={styles.weeklyItem}>
                    <Text style={styles.weeklyValue}>{stats.sellOut.thisWeek}</Text>
                    <Text style={styles.weeklyLabel}>Sell Out</Text>
                  </View>
                )}
                {stats?.st1 && (
                  <View style={styles.weeklyItem}>
                    <Text style={styles.weeklyValue}>{stats.st1.thisWeek}</Text>
                    <Text style={styles.weeklyLabel}>ST1</Text>
                  </View>
                )}
                {stats?.st2 && (
                  <View style={styles.weeklyItem}>
                    <Text style={styles.weeklyValue}>{stats.st2.thisWeek}</Text>
                    <Text style={styles.weeklyLabel}>ST2</Text>
                  </View>
                )}
              </View>
            </View>
          )}

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
        if ("filler" in item) {
          return <View style={[styles.tile, styles.tileFiller]} />;
        }
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
              {/* lucide's Users glyph isn't symmetric within its own bounding
                  box the way TrendingUp/ShoppingCart/ShoppingBag are - even
                  perfectly centered in this box, it visually reads as
                  shifted left (Sub Dealer List/Distributor View/Sub-Dealer
                  View all use this icon). A small nudge compensates so it
                  lines up with every other tile. */}
              <Icon color={theme.colors.primary} size={22} style={item.icon === "Users" ? styles.usersIconNudge : undefined} />
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
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    ...theme.shadow.card,
  },
  statCardIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  statCardText: {
    flex: 1,
  },
  statCardLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  statCardValue: {
    fontSize: 15,
    fontWeight: "bold",
    color: theme.colors.textStrong,
    marginTop: 2,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  trendText: {
    fontSize: 13,
    fontWeight: "bold",
  },
  weeklyCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    ...theme.shadow.card,
  },
  weeklyTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    marginBottom: theme.spacing.sm,
  },
  weeklyRow: {
    flexDirection: "row",
  },
  weeklyItem: {
    flex: 1,
    alignItems: "center",
  },
  weeklyValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  weeklyLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
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
  tileFiller: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
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
  usersIconNudge: {
    marginLeft: 3,
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textStrong,
    textAlign: "center",
  },
});
