import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { Camera, CheckCircle, FileText, Image as ImageIcon } from "lucide-react-native";

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState("assigned");
  const [photos, setPhotos] = useState<string[]>([]);

  const fetchJobDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("installer_jobs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setJob(data);
      setStatus(data.status || "assigned");
      setPhotos(data.photos || []);
    } catch (err: any) {
      Alert.alert("Error", "Failed to fetch job details.");
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobDetails();
  }, [id]);

  const handleStatusChange = async (nextStatus: string) => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from("installer_jobs")
        .update({ status: nextStatus })
        .eq("id", id);

      if (error) throw error;
      setStatus(nextStatus);
      Alert.alert("Status Updated", `Job is now marked as ${nextStatus.replace("_", " ")}.`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera permission", "Permission is required to take photos.");
      return;
    }

    const pickerResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (pickerResult.canceled) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User session invalid.");

      // Pick image URI
      const imageUri = pickerResult.assets[0].uri;
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const fileExt = imageUri.split(".").pop() || "jpg";
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from("job-photos")
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
        });

      if (uploadErr) throw uploadErr;

      // Fetch public URL
      const { data: publicData } = supabase.storage
        .from("job-photos")
        .getPublicUrl(filePath);

      const uploadedUrl = publicData.publicUrl;
      const updatedPhotos = [...photos, uploadedUrl];

      // Update Database record
      const { error: dbErr } = await supabase
        .from("installer_jobs")
        .update({ photos: updatedPhotos })
        .eq("id", id);

      if (dbErr) throw dbErr;

      setPhotos(updatedPhotos);
      Alert.alert("Upload Complete", "Installation photo successfully saved.");
    } catch (err: any) {
      Alert.alert("Upload Error", err.message || "Failed to upload photo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleMarkComplete = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from("installer_jobs")
        .update({
          status: "completed",
          payment_status: "unpaid", // Default to unpaid as per specs
        })
        .eq("id", id);

      if (error) throw error;

      Alert.alert("Job Completed", "The installation has been successfully logged.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert notes (instructions) to step list
  const getInstructions = () => {
    if (!job?.notes) return ["Mount bracket onto stable brick or concrete wall.", "Connect wiring connections securely.", "Verify diagnostic dashboard indicators."];
    return job.notes.split("\n").filter((x: string) => x.trim());
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00B4D8" />
      </View>
    );
  }

  const instructions = getInstructions();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title block */}
      <View style={styles.header}>
        <Text style={styles.title}>{job.job_title}</Text>
        <Text style={styles.address}>{job.address}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>
            Status: <Text style={{ color: "#00B4D8", fontWeight: "bold" }}>{status.replace("_", " ").toUpperCase()}</Text>
          </Text>
        </View>
      </View>

      {/* Steps checklist */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Installation Checklist</Text>
        {instructions.map((step, idx) => (
          <View key={idx} style={styles.stepRow}>
            <View style={styles.stepIndex}>
              <Text style={styles.stepIndexText}>{idx + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {/* Photo Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Job Documentation</Text>
        {photos.length === 0 ? (
          <View style={styles.emptyPhotos}>
            <ImageIcon size={28} color="#94A3B8" />
            <Text style={styles.emptyPhotosText}>No documentation photos uploaded</Text>
          </View>
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((url, idx) => (
              <Image key={idx} source={{ uri: url }} style={styles.thumbnail} />
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={handleUploadPhoto}
          disabled={isUploading}
          style={styles.uploadButton}
        >
          {isUploading ? (
            <ActivityIndicator color="#00B4D8" size="small" />
          ) : (
            <>
              <Camera size={16} color="#00B4D8" style={{ marginRight: 8 }} />
              <Text style={styles.uploadButtonText}>Capture & Upload Photo</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Control Buttons */}
      <View style={styles.actionsGroup}>
        {status === "assigned" && (
          <TouchableOpacity
            onPress={() => handleStatusChange("in_progress")}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>Start Job (In Progress)</Text>
          </TouchableOpacity>
        )}

        {status !== "completed" && (
          <TouchableOpacity
            onPress={handleMarkComplete}
            style={styles.completeButton}
          >
            <CheckCircle size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.completeButtonText}>Mark Job Complete</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
  },
  address: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
  },
  statusRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  statusText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "bold",
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  stepIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F0FAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepIndexText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#00B4D8",
  },
  stepText: {
    fontSize: 12,
    color: "#475569",
    flex: 1,
    lineHeight: 18,
  },
  emptyPhotos: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyPhotosText: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 8,
    fontWeight: "bold",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
  },
  uploadButton: {
    height: 40,
    borderWidth: 1.5,
    borderColor: "#00B4D8",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: 8,
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#00B4D8",
  },
  actionsGroup: {
    marginTop: 8,
  },
  actionButton: {
    height: 44,
    backgroundColor: "#F0FAFE",
    borderWidth: 1,
    borderColor: "#00B4D8",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#00B4D8",
  },
  completeButton: {
    height: 44,
    backgroundColor: "#00B4D8",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  completeButtonText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});
