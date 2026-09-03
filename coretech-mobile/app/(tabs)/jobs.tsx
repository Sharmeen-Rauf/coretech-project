import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { syncOfflineSubmissions } from "../../lib/offlineQueue";
import AnimatedPressable from "../../components/AnimatedPressable";
import SkeletonBlock from "../../components/SkeletonBlock";

// Groups every real status value onto one of the four tabs. "Active" covers
// anything not yet finally decided - assigned/in_progress work, and both
// in-review statuses, which previously had nowhere to display at all (the
// installer_jobs query used to only ask for assigned/in_progress/rejected,
// so a submitted-and-under-review job simply vanished from the app).
const STATUS_GROUPS: Record<string, "active" | "rejected" | "completed"> = {
  assigned: "active",
  in_progress: "active",
  pending_verification: "active",
  pending_approval: "active",
  pending_installation_approval: "active",
  rejected: "rejected",
  approved: "completed",
  completed: "completed",
};

const FILTERS = ["all", "active", "rejected", "completed"] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_LABELS: Record<string, string> = {
  assigned: "Assigned",
  in_progress: "In Progress",
  pending_verification: "Pending Review",
  pending_approval: "Pending Review",
  pending_installation_approval: "Pending Review",
  rejected: "Rejected",
  approved: "Completed",
  completed: "Completed",
};

export default function JobsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchJobs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Retry anything that failed to submit while offline, same as the web
      // page's own local-save-and-sync behavior, before showing the list.
      try {
        const { synced } = await syncOfflineSubmissions();
        if (synced > 0) {
          Alert.alert(
            "Synced",
            `${synced} previously offline submission${synced > 1 ? "s" : ""} sent successfully.`
          );
        }
      } catch {
        // Sync is best-effort - a failure here shouldn't block loading jobs.
      }

      // No status filter here at all - every job the installer has, so the
      // tabs below can group and count them client-side instead of a
      // separate query per status hiding rows that don't fit any of them.
      const { data, error } = await supabase
        .from("installer_jobs")
        .select("*")
        .eq("installer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load jobs.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchJobs();
  };

  const getStatusColor = (status: string) => {
    const group = STATUS_GROUPS[status] || "active";
    switch (group) {
      case "rejected":
        return { bg: "#FEE2E2", text: "#DC2626" }; // Red
      case "completed":
        return { bg: "#ECFDF5", text: "#059669" }; // Green
      default:
        return status === "in_progress"
          ? { bg: "#FEF9C3", text: "#CA8A04" } // Yellow
          : { bg: "#ECFEFF", text: "#0891B2" }; // Cyan
    }
  };

  const renderJobCard = ({ item }: { item: any }) => {
    const colors = getStatusColor(item.status);
    const dateFormatted = item.created_at
      ? new Date(item.created_at).toLocaleDateString()
      : "-";

    const isRejected = item.status === "rejected";
    const label = STATUS_LABELS[item.status] || item.status.replace(/_/g, " ");

    return (
      <AnimatedPressable
        onPress={() => router.push(`/job/${item.id}`)}
        style={[styles.card, isRejected && styles.cardRejected]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.jobTitle}>{item.job_title}</Text>
          <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>{label}</Text>
          </View>
        </View>

        <Text style={styles.address}>{item.address}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>{dateFormatted}</Text>
          <Text style={[styles.actionLink, isRejected && { color: "#DC2626" }]}>
            {isRejected ? "Fix & Re-submit →" : "View Details →"}
          </Text>
        </View>
      </AnimatedPressable>
    );
  };

  const filteredJobs = jobs.filter((j) => {
    if (filter === "all") return true;
    return (STATUS_GROUPS[j.status] || "active") === filter;
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.filterRow}>
          {FILTERS.map((t) => (
            <SkeletonBlock key={t} style={{ flex: 1, height: 32 }} />
          ))}
        </View>
        <View style={styles.list}>
          <SkeletonBlock style={{ height: 92, marginBottom: 12 }} />
          <SkeletonBlock style={{ height: 92, marginBottom: 12 }} />
          <SkeletonBlock style={{ height: 92 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Status Filter Tab Row */}
      <View style={styles.filterRow}>
        {FILTERS.map((t) => (
          <AnimatedPressable
            key={t}
            onPress={() => setFilter(t)}
            style={[styles.filterTab, filter === t && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, filter === t && styles.filterTabTextActive]}>
              {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </AnimatedPressable>
        ))}
      </View>

      <FlatList
        data={filteredJobs}
        renderItem={renderJobCard}
        keyExtractor={(item) => item.id}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No jobs found</Text>
            <Text style={styles.emptySubtitle}>
              There are no jobs matching this status.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  filterRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  filterTabActive: {
    backgroundColor: "#00B4D8",
  },
  filterTabText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748B",
    textTransform: "uppercase",
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  cardRejected: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E293B",
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  address: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  dateText: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "bold",
  },
  actionLink: {
    fontSize: 11,
    color: "#00B4D8",
    fontWeight: "bold",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#94A3B8",
  },
});
