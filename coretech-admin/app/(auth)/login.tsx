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
  Image,
} from "react-native";
import { router } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { resolveAdminAccess } from "../../lib/access";
import { theme } from "../../lib/theme";
import FadeInView from "../../components/FadeInView";

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
        <FadeInView style={styles.brandContainer}>
          <Image source={require("../../assets/icon.png")} style={styles.logoImage} />
          <Text style={styles.brandName}>
            Core<Text style={{ color: theme.colors.primary }}>TECH</Text> Admin
          </Text>
          <Text style={styles.tagline}>YOUR CORE PARTNER IN TECH</Text>
        </FadeInView>

        <View style={styles.cardSlot}>
          <FadeInView delay={80} style={styles.card}>
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
                  {secureText ? (
                    <Eye color={theme.colors.textSecondary} size={18} />
                  ) : (
                    <EyeOff color={theme.colors.textSecondary} size={18} />
                  )}
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
          </FadeInView>
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
    padding: theme.spacing.lg,
  },
  brandContainer: {
    alignItems: "center",
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.fab,
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
  cardSlot: {
    flex: 1,
    justifyContent: "center",
  },
  card: {
    backgroundColor: theme.colors.primaryTint,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
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
    height: 48,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textStrong,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    height: 48,
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
