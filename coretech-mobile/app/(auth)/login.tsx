import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { resolveInstallerAccess } from "../../lib/installerAccess";
import AnimatedPressable from "../../components/AnimatedPressable";
import FadeInView from "../../components/FadeInView";

// Every rejection shows this same wording, no matter the real reason (wrong
// password, correct password but not an installer, or a rejected/blocked
// installer account). Distinguishing them would tell anyone probing
// credentials whether they'd just found a real, valid account - even one
// they can't use - which a stranger's wrong-password attempt should never
// reveal.
const GENERIC_LOGIN_ERROR = "Invalid email or password.";

export default function MobileLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleLogin = async () => {
    setErrorText("");
    if (!email || !password) {
      setErrorText("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorText(GENERIC_LOGIN_ERROR);
        return;
      }

      const access = await resolveInstallerAccess(data.user.id);
      if (!access.allowed) {
        await supabase.auth.signOut();
        setErrorText(GENERIC_LOGIN_ERROR);
        return;
      }

      router.replace(access.state === "pending" ? "/(auth)/pending" : "/(tabs)");
    } catch (err: any) {
      setErrorText(GENERIC_LOGIN_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* Brand Area */}
        <FadeInView style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>CT</Text>
          </View>
          <Text style={styles.brandName}>
            Core<Text style={{ color: "#00B4D8" }}>TECH</Text>
          </Text>
          <Text style={styles.tagline}>YOUR CORE PARTNER IN TECH</Text>
        </FadeInView>

        {/* Auth Card */}
        <FadeInView delay={80} style={styles.card}>
          <Text style={styles.heading}>Login</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter Password*"
                placeholderTextColor="#94A3B8"
                secureTextEntry={secureText}
                autoCapitalize="none"
                style={styles.passwordInput}
              />
              <TouchableOpacity
                onPress={() => setSecureText(!secureText)}
                style={styles.showHideButton}
              >
                <Text style={styles.showHideText}>
                  {secureText ? "Show" : "Hide"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <AnimatedPressable
            onPress={handleLogin}
            disabled={isLoading}
            style={[styles.button, isLoading && styles.buttonDisabled]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </AnimatedPressable>
        </FadeInView>

        <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
          <Text style={styles.footerText}>
            Don't have an account yet?{" "}
            <Text style={{ color: "#00B4D8", fontWeight: "bold" }}>Register for free</Text>
          </Text>
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
  errorText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
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
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    height: 44,
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#1E293B",
  },
  showHideButton: {
    paddingHorizontal: 12,
    justifyContent: "center",
    height: "100%",
  },
  showHideText: {
    fontSize: 11,
    color: "#00B4D8",
    fontWeight: "bold",
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
