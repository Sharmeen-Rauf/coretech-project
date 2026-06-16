import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function MobileLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Required fields", "Please fill in all inputs.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Verify the role is installer
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileErr || !profile || (profile.role !== "installer" && profile.role !== "admin")) {
        // Sign out if they are not an installer/admin to prevent illegal access
        await supabase.auth.signOut();
        Alert.alert("Access Denied", "Only installers are permitted on this application.");
        return;
      }

      router.replace("/(tabs)/jobs");
    } catch (err: any) {
      Alert.alert("Login Error", err.message || "Failed to authenticate.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* Brand Area */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>CT</Text>
          </View>
          <Text style={styles.brandName}>
            Core<Text style={{ color: "#00B4D8" }}>TECH</Text>
          </Text>
          <Text style={styles.tagline}>YOUR CORE PARTNER IN TECH</Text>
        </View>

        {/* Auth Card */}
        <View style={styles.card}>
          <Text style={styles.heading}>Login</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="enter email/admin/user"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter Password*"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            style={[styles.button, isLoading && styles.buttonDisabled]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          Don't have an account yet?{" "}
          <Text style={{ color: "#00B4D8", fontWeight: "bold" }}>Register for free</Text>
        </Text>
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
  brandContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#00B4D8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00B4D8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 12,
  },
  logoBadgeText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 20,
  },
  brandName: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1E293B",
  },
  tagline: {
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#64748B",
    marginTop: 4,
  },
  card: {
    width: "100%",
    backgroundColor: "#F0FAFE",
    borderWidth: 1.5,
    borderColor: "#00B4D8",
    borderRadius: 12,
    padding: 24,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  heading: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 6,
  },
  input: {
    height: 44,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#1E293B",
  },
  button: {
    height: 44,
    backgroundColor: "#00B4D8",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: "#00B4D8",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  footerText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 24,
  },
});
