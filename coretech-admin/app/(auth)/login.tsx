import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { resolveAdminAccess } from "../../lib/access";
import { theme } from "../../lib/theme";

// Same wording regardless of the real reason (wrong password, correct
// password but not an admin-app role) - mirrors coretech-mobile's login
// screen, so a stranger's guess never confirms whether an account exists.
const GENERIC_LOGIN_ERROR = "Invalid email or password.";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError || !data.user) {
        setError(GENERIC_LOGIN_ERROR);
        return;
      }

      const access = await resolveAdminAccess(data.user.id);
      if (!access.allowed) {
        await supabase.auth.signOut();
        setError(GENERIC_LOGIN_ERROR);
        return;
      }

      router.replace("/(tabs)");
    } catch (err) {
      setError(GENERIC_LOGIN_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>CT</Text>
          </View>
          <Text style={styles.brandName}>
            Core<Text style={{ color: theme.colors.primary }}>TECH</Text> Admin
          </Text>
          <Text style={styles.tagline}>YOUR CORE PARTNER IN TECH</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Sign In</Text>
          <Text style={styles.subtitle}>Use the account your admin set up for you.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@company.com"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter password"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry={secureText}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.showHideButton}>
                <Text style={styles.showHideText}>{secureText ? "Show" : "Hide"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.buttonText}>Sign In</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: theme.spacing.xl,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
    ...theme.shadow.fab,
  },
  logoBadgeText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 20,
  },
  brandName: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
  },
  tagline: {
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 2,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: theme.colors.primaryTint,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  heading: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: theme.spacing.lg,
  },
  fieldGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    height: 46,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textStrong,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    height: 46,
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textStrong,
  },
  showHideButton: {
    paddingHorizontal: theme.spacing.md,
    justifyContent: "center",
    height: "100%",
  },
  showHideText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  error: {
    color: theme.colors.error,
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: theme.spacing.md,
    textAlign: "center",
  },
  button: {
    height: 48,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.xs,
    ...theme.shadow.button,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 15,
  },
});
