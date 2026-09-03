import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { Plus, CheckCircle, AlertTriangle, Clock, ChevronRight } from "lucide-react-native";
import AnimatedPressable from "../../components/AnimatedPressable";
import FadeInView from "../../components/FadeInView";
import SkeletonBlock from "../../components/SkeletonBlock";

export default function InstallerDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  // Only counts that reflect what actually happens in this app: a job never
  // exists until the installer has already finished the work and submitted
  // proof, so there is no "assigned, not started yet" state to show here.
  const [stats, setStats] = useState({
    underReview: 0,
    rejected: 0,
    completed: 0,
  });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profErr) throw profErr;
      setProfile(profData);

      const { data: jobs, error: jobsErr } = await supabase
        .from("installer_jobs")
        .select("*")
        .eq("installer_id", user.id)
        .order("created_at", { ascending: false });

      if (jobsErr) throw jobsErr;

      const list = jobs || [];
      const underReview = list.filter(
        (j) =>
          j.status === "pending_verification" ||
          j.status === "pending_approval" ||
          j.status === "pending_installation_approval" ||
          j.status === "pending"
      ).length;
      const rejected = list.filter((j) => j.status === "rejected").length;
      const completed = list.filter((j) => j.status === "approved" || j.status === "completed").length;

      setStats({ underReview, rejected, completed });
      setRecentJobs(list.slice(0, 3));
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

  const getStatusVisual = (status: string) => {
    if (status === "rejected") return { bg: "#FEE2E2", text: "#DC2626", label: "Rejected" };
    if (status === "approved" || status === "completed") return { bg: "#ECFDF5", text: "#059669", label: "Completed" };
    return { bg: "#ECFEFF", text: "#0891B2", label: "Under Review" };
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scrollContent}>
          <SkeletonBlock style={{ height: 84, marginBottom: 20 }} />
          <SkeletonBlock style={{ height: 56, marginBottom: 20 }} />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
            <SkeletonBlock style={{ flex: 1, height: 84 }} />
            <SkeletonBlock style={{ flex: 1, height: 84 }} />
            <SkeletonBlock style={{ flex: 1, height: 84 }} />
          </View>
          <SkeletonBlock style={{ height: 90, marginBottom: 12 }} />
          <SkeletonBlock style={{ height: 90 }} />
        </View>
      </SafeAreaView>
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
        <FadeInView>
          <View style={styles.welcomeBanner}>
            <Text style={styles.welcomeSubtitle}>Installer Portal</Text>
            <Text style={styles.welcomeTitle}>
              Hi, {profile?.first_name || "Installer"} {profile?.last_name || ""}
            </Text>
            <Text style={styles.locationText}>{profile?.designation || "Solar Installation Expert"}</Text>
          </View>
        </FadeInView>

        {/* Primary action - this is the only real flow the app has: an
            installer completes a job on their own, then reports it here. */}
        <FadeInView delay={40}>
          <AnimatedPressable onPress={() => router.push("/job/new")} style={styles.primaryCta}>
            <View style={styles.primaryCtaIcon}>
              <Plus size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.primaryCtaTitle}>Submit New Installation</Text>
              <Text style={styles.primaryCtaSubtitle}>Report a job you've already completed</Text>
            </View>
            <ChevronRight size={18} color="#FFFFFF" />
          </AnimatedPressable>
        </FadeInView>

        {/* Stats Grid */}
        <Text style={styles.sectionHeader}>Submission Summary</Text>
        <View style={styles.grid}>
          <FadeInView delay={80} style={styles.gridItem}>
            <View style={styles.gridCard}>
              <Clock size={20} color="#0891B2" style={styles.statIcon} />
              <Text style={[styles.statNumber, { color: "#0891B2" }]}>{stats.underReview}</Text>
              <Text style={styles.statLabel}>Under Review</Text>
            </View>
          </FadeInView>
          <FadeInView delay={120} style={styles.gridItem}>
            <View style={styles.gridCard}>
              <AlertTriangle size={20} color="#DC2626" style={styles.statIcon} />
              <Text style={[styles.statNumber, { color: "#DC2626" }]}>{stats.rejected}</Text>
              <Text style={styles.statLabel}>Rejected</Text>
            </View>
          </FadeInView>
          <FadeInView delay={160} style={styles.gridItem}>
            <View style={styles.gridCard}>
              <CheckCircle size={20} color="#059669" style={styles.statIcon} />
              <Text style={[styles.statNumber, { color: "#059669" }]}>{stats.completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </FadeInView>
        </View>

        {/* Recent Submissions */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Recent Submissions</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/jobs")}>
            <Text style={styles.seeAllText}>See All →</Text>
          </TouchableOpacity>
        </View>

        {recentJobs.length === 0 ? (
          <FadeInView delay={200}>
            <View style={styles.emptyCard}>
              <CheckCircle size={32} color="#94A3B8" />
              <Text style={styles.emptyText}>No submissions yet - report your first completed job above.</Text>
            </View>
          </FadeInView>
        ) : (
          recentJobs.map((item, idx) => {
            const visual = getStatusVisual(item.status);
            return (
              <FadeInView key={item.id} delay={200 + idx * 60}>
                <AnimatedPressable
                  onPress={() => router.push(`/job/${item.id}`)}
                  style={[styles.jobCard, item.status === "rejected" && styles.jobCardRejected]}
                >
                  <View style={styles.jobCardMain}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jobTitle}>{item.job_title}</Text>
                      <Text style={styles.jobAddress} numberOfLines={1}>
                        {item.address}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: visual.bg }]}>
                      <Text style={[styles.statusText, { color: visual.text }]}>{visual.label}</Text>
                    </View>
                  </View>
                  <View style={styles.jobCardFooter}>
                    <Text style={styles.footerDate}>
                      Submitted: {item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}
                    </Text>
                    <ChevronRight size={16} color="#94A3B8" />
                  </View>
                </AnimatedPressable>
              </FadeInView>
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
  welcomeBanner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 20,
    marginBottom: 16,
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
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00B4D8",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#00B4D8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryCtaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  primaryCtaTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  primaryCtaSubtitle: {
    fontSize: 10,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    marginTop: 2,
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
    gap: 8,
    marginBottom: 24,
  },
  gridItem: {
    flex: 1,
  },
  gridCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    alignItems: "center",
  },
  statIcon: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#64748B",
    marginTop: 2,
    textAlign: "center",
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
    textAlign: "center",
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
