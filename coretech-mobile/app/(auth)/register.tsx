import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, CheckCircle } from "lucide-react-native";
import { API_BASE_URL } from "../../lib/installerAccess";
import AnimatedPressable from "../../components/AnimatedPressable";
import FadeInView from "../../components/FadeInView";

const STATES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Gilgit-Baltistan",
  "Azad Kashmir",
  "Islamabad Capital Territory",
];
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];
const PAYMENT_PROVIDERS = ["EasyPaisa", "JazzCash"];

function formatCNIC(value: string) {
  const clean = value.replace(/\D/g, "");
  if (clean.length <= 5) return clean;
  if (clean.length <= 12) return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  return `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12, 13)}`;
}

export default function RegisterScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cnic, setCnic] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("Single");
  const [paymentProvider, setPaymentProvider] = useState("EasyPaisa");
  const [paymentAccountNo, setPaymentAccountNo] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required";
    if (!lastName.trim()) errs.lastName = "Last name is required";
    if (!address.trim()) errs.address = "Address is required";
    if (!city.trim()) errs.city = "City is required";
    if (!state) errs.state = "State selection is required";

    const cleanCnic = cnic.replace(/\D/g, "");
    if (!cnic) errs.cnic = "CNIC is required";
    else if (cleanCnic.length !== 13) errs.cnic = "CNIC must be exactly 13 digits";

    if (!contact.trim()) errs.contact = "Contact number is required";
    else if (contact.trim().length < 10) errs.contact = "Enter a valid contact number";

    if (!email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Email format is invalid";

    if (!password) errs.password = "Password is required";
    else if (password.length < 6) errs.password = "Password must be at least 6 characters";

    if (!paymentAccountNo.trim()) errs.paymentAccountNo = "Payment account number is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    setSubmitError("");
    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/installer/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          contact: contact.trim(),
          cnic,
          address: address.trim(),
          city: city.trim(),
          state,
          maritalStatus,
          paymentProvider,
          paymentAccountNo: paymentAccountNo.trim(),
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setSubmitError(json.error || "Registration failed. Please try again.");
        return;
      }

      setIsSuccess(true);
    } catch (err: any) {
      setSubmitError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <FadeInView style={styles.successInner}>
          <View style={styles.successIcon}>
            <CheckCircle size={40} color="#059669" />
          </View>
          <Text style={styles.successHeading}>Application Submitted</Text>
          <Text style={styles.successBody}>
            Thank you for registering, {firstName} {lastName}. Your application is under
            review - please wait for an Owner to approve your account before signing in.
          </Text>
          <AnimatedPressable onPress={() => router.replace("/login")} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Go to Login</Text>
          </AnimatedPressable>
        </FadeInView>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flex}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={16} color="#64748B" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>Installer Network</Text>
          <Text style={styles.subheading}>Pakistan Application Form</Text>

          {submitError ? (
            <View style={styles.submitErrorBox}>
              <Text style={styles.submitErrorText}>{submitError}</Text>
            </View>
          ) : null}

          <Field label="First Name*" value={firstName} onChangeText={setFirstName} error={errors.firstName} />
          <Field label="Last Name*" value={lastName} onChangeText={setLastName} error={errors.lastName} />
          <Field
            label="Contact Number*"
            value={contact}
            onChangeText={(t) => setContact(t.replace(/\D/g, ""))}
            error={errors.contact}
            keyboardType="phone-pad"
            placeholder="03001234567"
          />
          <Field
            label="Email Address*"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="installer@gmail.com"
          />
          <Field
            label="Password*"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            placeholder="Minimum 6 characters"
          />
          <Field
            label="CNIC Number*"
            value={cnic}
            onChangeText={(t) => setCnic(formatCNIC(t))}
            error={errors.cnic}
            keyboardType="number-pad"
            placeholder="37405-1234567-1"
            maxLength={15}
          />
          <Field label="Street Address*" value={address} onChangeText={setAddress} error={errors.address} />
          <Field label="City*" value={city} onChangeText={setCity} error={errors.city} />

          <PickerField label="State / Province*" value={state} options={STATES} onSelect={setState} error={errors.state} />
          <PickerField label="Marital Status" value={maritalStatus} options={MARITAL_STATUSES} onSelect={setMaritalStatus} />
          <PickerField label="Payment Provider*" value={paymentProvider} options={PAYMENT_PROVIDERS} onSelect={setPaymentProvider} />

          <Field
            label="EasyPaisa / JazzCash No.*"
            value={paymentAccountNo}
            onChangeText={(t) => setPaymentAccountNo(t.replace(/\D/g, ""))}
            error={errors.paymentAccountNo}
            keyboardType="phone-pad"
          />

          <AnimatedPressable
            onPress={handleRegister}
            disabled={isLoading}
            style={[styles.primaryButton, isLoading && styles.buttonDisabled, { marginTop: 8 }]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Submit Registration</Text>
            )}
          </AnimatedPressable>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  error,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
  [key: string]: any;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#94A3B8"
        style={[styles.input, error && styles.inputError]}
        {...rest}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function PickerField({
  label,
  value,
  options,
  onSelect,
  error,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  error?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pickerRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={[styles.pickerChip, value === opt && styles.pickerChipSelected]}
          >
            <Text style={[styles.pickerChipText, value === opt && styles.pickerChipTextSelected]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  backButton: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backText: { fontSize: 12, fontWeight: "bold", color: "#64748B", marginLeft: 4 },
  heading: { fontSize: 20, fontWeight: "bold", color: "#1E293B", textAlign: "center" },
  subheading: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#94A3B8",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
    marginBottom: 20,
  },
  submitErrorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  submitErrorText: { color: "#B91C1C", fontSize: 12, fontWeight: "600" },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: "bold", color: "#475569", marginBottom: 6 },
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
  inputError: { borderColor: "#EF4444" },
  errorText: { color: "#DC2626", fontSize: 10, marginTop: 4, fontWeight: "bold" },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  pickerChipSelected: { backgroundColor: "#00B4D8", borderColor: "#00B4D8" },
  pickerChipText: { fontSize: 12, color: "#475569", fontWeight: "600" },
  pickerChipTextSelected: { color: "#FFFFFF" },
  primaryButton: {
    height: 44,
    backgroundColor: "#00B4D8",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 14 },
  successInner: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successHeading: { fontSize: 18, fontWeight: "bold", color: "#1E293B", marginBottom: 10 },
  successBody: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
});
