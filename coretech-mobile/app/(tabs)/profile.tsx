import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { LogOut, Phone, MapPin, CreditCard, BadgeCheck, Heart } from "lucide-react-native";

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  approved: { label: "Approved", bg: "#ECFDF5", text: "#059669" },
  active: { label: "Approved", bg: "#ECFDF5", text: "#059669" },
  rejected: { label: "Rejected", bg: "#FEE2E2", text: "#DC2626" },
};

export default function ProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfileAndStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Profile
      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profErr) throw profErr;
      setProfile(profData);

      // 2. Fetch Jobs count
      const { data: jobs, error: jobsErr } = await supabase
        .from("installer_jobs")
        .select("status")
        .eq("installer_id", user.id);

      if (jobsErr) throw jobsErr;

      const total = jobs?.length || 0;
      const completed = jobs?.filter((j) => j.status === "completed" || j.status === "approved").length || 0;
      const pending = total - completed;

      setStats({ total, completed, pending });
    } catch (err: any) {
      Alert.alert("Error", "Failed to fetch profile statistics.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndStats();
  }, []);

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Sign Out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00B4D8" />
      </View>
    );
  }

  // profile.first_name can be missing on a hastily-created account (no real
  // installer in the live 377 has hit this, but a test/dev account easily
  // can) - .charAt(0) on undefined crashed the whole screen before this
  // fallback existed.
  const firstInitial = profile?.first_name?.charAt(0) || "";
  const lastInitial = profile?.last_name?.charAt(0) || "";
  const initials = (firstInitial + lastInitial).toUpperCase() || "CT";

  const statusBadge = STATUS_BADGE[String(profile?.status || "").toLowerCase()] || {
    label: "Pending Review",
    bg: "#FFF7ED",
    text: "#EA580C",
  };

  return (
    <View style={styles.container}>
      {/* Profile Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <Text style={styles.fullName}>
          {profile?.first_name || "Installer"} {profile?.last_name || ""}
        </Text>
        <Text style={styles.designation}>{profile?.designation || "Installation Tech"}</Text>

        <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusBadge.text }]}>
            {statusBadge.label}
          </Text>
        </View>

        <View style={styles.contactRow}>
          <Phone size={14} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.contactText}>{profile?.contact || "No Phone Recorded"}</Text>
        </View>
      </View>

      {/* Full Account Detail */}
      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>Account Detail</Text>

        <DetailRow icon={<BadgeCheck size={14} color="#64748B" />} label="CNIC" value={profile?.cnic} />
        <DetailRow
          icon={<MapPin size={14} color="#64748B" />}
          label="Address"
          value={[profile?.address, profile?.city, profile?.state].filter(Boolean).join(", ")}
        />
        <DetailRow icon={<Heart size={14} color="#64748B" />} label="Marital Status" value={profile?.marital_status} />
        <DetailRow
          icon={<CreditCard size={14} color="#64748B" />}
          label="Payment Account"
          value={
            profile?.payment_account_no
              ? `${profile?.payment_provider || ""} - ${profile.payment_account_no}`.trim()
              : undefined
          }
        />
      </View>

      {/* Stats Counter Section */}
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Job Report Summary</Text>

        <View style={styles.statsRow}>
          <View style={styles.statColumn}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Jobs</Text>
          </View>
          <View style={[styles.statColumn, styles.statBorder]}>
            <Text style={[styles.statNumber, { color: "#059669" }]}>
              {stats.completed}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statColumn}>
            <Text style={[styles.statNumber, { color: "#EA580C" }]}>
              {stats.pending}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
        <LogOut size={16} color="#DC2626" style={{ marginRight: 8 }} />
        <Text style={styles.logoutButtonText}>Sign Out Account</Text>
      </TouchableOpacity>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value || "Not recorded"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#00B4D8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  fullName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
  },
  designation: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    marginTop: 10,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  contactText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "bold",
  },
  detailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  detailIcon: {
    width: 20,
    marginTop: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "bold",
    width: 100,
  },
  detailValue: {
    fontSize: 11,
    color: "#1E293B",
    fontWeight: "600",
    flex: 1,
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 24,
  },
  statsTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statColumn: {
    flex: 1,
    alignItems: "center",
  },
  statBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#F1F5F9",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00B4D8",
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#64748B",
    marginTop: 4,
    textTransform: "uppercase",
  },
  logoutButton: {
    height: 44,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#DC2626",
  },
});
