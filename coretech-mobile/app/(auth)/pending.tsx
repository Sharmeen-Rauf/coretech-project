import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { resolveInstallerAccess } from "../../lib/installerAccess";

export default function PendingReviewScreen() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckAgain = async () => {
    setIsChecking(true);
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const access = await resolveInstallerAccess(session.user.id);
      if (!access.allowed) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }
      if (access.state === "approved") {
        router.replace("/(tabs)");
      }
      // Still pending - stay on this screen, nothing else to do.
    } finally {
      setIsChecking(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Pending Review</Text>
        </View>

        <Text style={styles.heading}>Your Profile Is Under Review</Text>
        <Text style={styles.body}>
          Thanks for registering. An Owner needs to approve your application before you can
          start seeing job assignments. This usually doesn't take long - check back soon.
        </Text>

        <TouchableOpacity
          onPress={handleCheckAgain}
          disabled={isChecking}
          style={[styles.primaryButton, isChecking && styles.buttonDisabled]}
        >
          {isChecking ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Check Again</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSignOut} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  badge: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#EA580C",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heading: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  primaryButton: {
    width: "100%",
    height: 44,
    backgroundColor: "#00B4D8",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  secondaryButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#64748B",
    fontWeight: "bold",
    fontSize: 13,
  },
});
