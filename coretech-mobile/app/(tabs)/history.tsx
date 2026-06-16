import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function HistoryScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("installer_jobs")
        .select("*")
        .eq("installer_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err: any) {
      Alert.alert("Error", "Failed to load installation logs history.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHistory();
  };

  const getPaymentBadge = (status: string) => {
    const isPaid = (status || "").toLowerCase() === "paid";
    return {
      bg: isPaid ? "#ECFDF5" : "#FFF7ED",
      text: isPaid ? "#059669" : "#EA580C",
      label: isPaid ? "Paid" : "Unpaid",
    };
  };

  const renderHistoryItem = ({ item }: { item: any }) => {
    const payment = getPaymentBadge(item.payment_status);
    const dateFormatted = item.created_at
      ? new Date(item.created_at).toLocaleDateString()
      : "-";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.jobTitle}>{item.job_title}</Text>
          <View style={[styles.badge, { backgroundColor: payment.bg }]}>
            <Text style={[styles.badgeText, { color: payment.text }]}>
              {payment.label}
            </Text>
          </View>
        </View>

        <Text style={styles.address}>{item.address}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>Completed: {dateFormatted}</Text>
        </View>
      </View>
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
        renderItem={renderHistoryItem}
        keyExtractor={(item) => item.id}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No history logged</Text>
            <Text style={styles.emptySubtitle}>
              Completed jobs will appear here.
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
    opacity: 0.9,
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
    marginBottom: 12,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  dateText: {
    fontSize: 10,
    color: "#94A3B8",
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
