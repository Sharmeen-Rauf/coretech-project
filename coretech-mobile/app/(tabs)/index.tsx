import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { Wrench, CheckCircle, Clock, AlertTriangle, ChevronRight, User } from "lucide-react-native";

export default function InstallerDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    assigned: 0,
    inProgress: 0,
    pendingVerification: 0,
    completed: 0,
  });
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Profile Info
      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profErr) throw profErr;
      setProfile(profData);

      // 2. Fetch Installer's Jobs to compute stats
      const { data: jobs, error: jobsErr } = await supabase
        .from("installer_jobs")
        .select("*")
        .eq("installer_id", user.id);

      if (jobsErr) throw jobsErr;

      const list = jobs || [];
      const assigned = list.filter((j) => j.status === "assigned").length;
      const inProgress = list.filter((j) => j.status === "in_progress").length;
      const pendingVerification = list.filter(
        (j) =>
          j.status === "pending_verification" ||
          j.status === "pending_approval" ||
          j.status === "pending_installation_approval" ||
          j.status === "pending"
      ).length;
      const completed = list.filter((j) => j.status === "approved" || j.status === "completed").length;

      setStats({
        assigned,
        inProgress,
        pendingVerification,
        completed,
      });

      // Show up to 3 active/assigned jobs for quick dashboard access
      const active = list
        .filter((j) => j.status === "assigned" || j.status === "in_progress" || j.status === "rejected")
        .slice(0, 3);
      setActiveJobs(active);
    } catch (err: any) {
      console.warn("Failed to load dashboard data", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00B4D8" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={["#00B4D8"]} />
        }
      >
        {/* Welcome Area */}
        <View style={styles.welcomeBanner}>
          <Text style={styles.welcomeSubtitle}>Installer Portal</Text>
          <Text style={styles.welcomeTitle}>
            Hi, {profile?.first_name || "Installer"} {profile?.last_name || ""}
          </Text>
          <Text style={styles.locationText}>{profile?.designation || "Solar Installation Expert"}</Text>
        </View>

        {/* Stats Grid */}
        <Text style={styles.sectionHeader}>Today's Status Summary</Text>
        <View style={styles.grid}>
          <View style={styles.gridCard}>
            <Wrench size={20} color="#00B4D8" style={styles.statIcon} />
            <Text style={styles.statNumber}>{stats.assigned}</Text>
            <Text style={styles.statLabel}>Assigned</Text>
          </View>
          <View style={styles.gridCard}>
            <Clock size={20} color="#CA8A04" style={styles.statIcon} />
            <Text style={[styles.statNumber, { color: "#CA8A04" }]}>{stats.inProgress}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={styles.gridCard}>
            <AlertTriangle size={20} color="#EA580C" style={styles.statIcon} />
            <Text style={[styles.statNumber, { color: "#EA580C" }]}>{stats.pendingVerification}</Text>
            <Text style={styles.statLabel}>Pending Review</Text>
          </View>
          <View style={styles.gridCard}>
            <CheckCircle size={20} color="#059669" style={styles.statIcon} />
            <Text style={[styles.statNumber, { color: "#059669" }]}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
        </View>

        {/* Active Assignments */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Active Assignments</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/jobs")}>
            <Text style={styles.seeAllText}>See All ({stats.assigned + stats.inProgress})</Text>
          </TouchableOpacity>
        </View>

        {activeJobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <CheckCircle size={32} color="#94A3B8" />
            <Text style={styles.emptyText}>All caught up! No active jobs assigned.</Text>
          </View>
        ) : (
          activeJobs.map((item) => {
            const isRejected = item.status === "rejected";
            const inProgress = item.status === "in_progress";

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(`/job/${item.id}`)}
                style={[styles.jobCard, isRejected && styles.jobCardRejected]}
              >
                <View style={styles.jobCardMain}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobTitle}>{item.job_title}</Text>
                    <Text style={styles.jobAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isRejected ? "#FEE2E2" : inProgress ? "#FEF9C3" : "#ECFEFF",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: isRejected ? "#DC2626" : inProgress ? "#CA8A04" : "#0891B2",
                        },
                      ]}
                    >
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.jobCardFooter}>
                  <Text style={styles.footerDate}>
                    Assigned: {item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}
                  </Text>
                  <ChevronRight size={16} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  welcomeBanner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 20,
    marginBottom: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  welcomeSubtitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#00B4D8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
  },
  locationText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#00B4D8",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  gridCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    alignItems: "center",
  },
  statIcon: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00B4D8",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748B",
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "bold",
    marginTop: 8,
  },
  jobCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 12,
  },
  jobCardRejected: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  jobCardMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  jobAddress: {
    fontSize: 11,
    color: "#64748B",
    paddingRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  jobCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  footerDate: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "bold",
  },
});
