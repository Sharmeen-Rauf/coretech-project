import React, { useEffect, useState } from "react";
import { Text, StyleSheet, ScrollView, ActivityIndicator, View } from "react-native";
import { Target as TargetIcon } from "lucide-react-native";
import { mobileApiFetch, ApiError } from "../../lib/api";
import { theme } from "../../lib/theme";
import EmptyState from "../../components/EmptyState";

interface TargetRow {
  id: string;
  target_units: number;
  period_start: string;
  period_end: string;
  achieved_units: number;
  product?: { name: string; brand: string; model: string } | null;
}

// Target (Read Only everywhere on mobile, §12.1) - §17 #20, self-scoped
// (assignee_id = caller.id inside the query itself, no write path anywhere
// on mobile). Same shared computeAchievedUnitsForTargets logic the web
// dashboard uses, including the 2026-09-07 fix (Distributor = ST1 only,
// Sub-Dealer = SO only). The tab's own title ((tabs)/_layout.tsx) already
// says "Target" - no in-body heading here, and no "(Read Only)" wording,
// which was internal planning language that had leaked into the UI.
export default function TargetScreen() {
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    mobileApiFetch<{ success: boolean; targets: TargetRow[]; error?: string }>("/api/mobile/target")
      .then((res) => {
        if (!res.success) throw new Error(res.error || "Failed to load targets");
        setTargets(res.targets);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load targets"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color={theme.colors.primary} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!error && targets.length === 0 && (
        <View style={styles.emptyWrap}>
          <EmptyState icon={TargetIcon} title="No target assigned" subtitle="Nothing set for the current period yet." />
        </View>
      )}

      {targets.map((t) => {
        const pct = t.target_units > 0 ? Math.min(100, Math.round((t.achieved_units / t.target_units) * 100)) : 0;
        return (
          <View key={t.id} style={styles.card}>
            <Text style={styles.productName}>{t.product?.name || "Unknown Product"}</Text>
            <Text style={styles.period}>
              {new Date(t.period_start).toLocaleDateString()} – {new Date(t.period_end).toLocaleDateString()}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {t.achieved_units} / {t.target_units} units ({pct}%)
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, flexGrow: 1 },
  errorText: { color: theme.colors.error, fontSize: 13, textAlign: "center" },
  emptyWrap: { flex: 1 },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.card,
  },
  productName: { fontSize: 15, fontWeight: "bold", color: theme.colors.textPrimary },
  period: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, marginBottom: theme.spacing.sm },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.background,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  progressText: { fontSize: 12, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
});
