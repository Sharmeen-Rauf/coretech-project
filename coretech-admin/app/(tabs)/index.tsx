import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { router } from "expo-router";
import { Box, Wrench } from "lucide-react-native";
import { useMyPermissions } from "../../lib/permissionsContext";
import { GRID_TILES } from "../../lib/navConfig";
import { theme } from "../../lib/theme";

// Home / Dashboard (§17 #2) - a DCR-style icon grid (§12), recolored in the
// installer app's own palette rather than DCR's. Every mobileEligible
// permission except SN Lookup/Target lives here, permanently (§12.1) -
// those two live only in the bottom bar. Tiles push a placeholder for now;
// Phase 6 replaces each with its real screen. The announcements card and
// notifications bell (§18) also land on this screen in Phase 6.
export default function HomeScreen() {
  const { loading, keys } = useMyPermissions();
  const tiles = GRID_TILES.filter((tile) => keys.includes(tile.key));

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Home</Text>

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
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tile}
              onPress={() => router.push(`/placeholder?title=${encodeURIComponent(item.title)}`)}
            >
              <View style={styles.tileIcon}>
                <Box color={theme.colors.primary} size={22} />
              </View>
              <Text style={styles.tileLabel}>{item.label}</Text>
            </TouchableOpacity>
          )}
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
  heading: {
    fontSize: 22,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
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
