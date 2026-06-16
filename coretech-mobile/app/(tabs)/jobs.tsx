import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function JobsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchJobs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("installer_jobs")
        .select("*")
        .eq("installer_id", user.id)
        .in("status", ["assigned", "in_progress"])
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
    switch (status.toLowerCase()) {
      case "assigned":
        return { bg: "#ECFEFF", text: "#0891B2" }; // Cyan
      case "in_progress":
        return { bg: "#FEF9C3", text: "#CA8A04" }; // Yellow
      default:
        return { bg: "#F1F5F9", text: "#475569" };
    }
  };

  const renderJobCard = ({ item }: { item: any }) => {
    const colors = getStatusColor(item.status);
    const dateFormatted = item.created_at
      ? new Date(item.created_at).toLocaleDateString()
      : "-";

    return (
      <TouchableOpacity
        onPress={() => router.push(`/job/${item.id}`)}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.jobTitle}>{item.job_title}</Text>
          <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>
              {item.status.replace("_", " ")}
            </Text>
          </View>
        </View>

        <Text style={styles.address}>{item.address}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>{dateFormatted}</Text>
          <Text style={styles.actionLink}>View Details →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00B4D8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        renderItem={renderJobCard}
        keyExtractor={(item) => item.id}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No active jobs assigned at the moment.
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
